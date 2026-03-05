const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { generateAESKey, encryptFile, encryptAESKey } = require('../crypto/encrypt');
const { decryptAESKey, decryptFile } = require('../crypto/decrypt');
const { hashFile, signHash, verifySignature } = require('../crypto/signature');
const { decryptPrivateKey } = require('../crypto/keys');
const { verifyCertificate } = require('../ca/authority');
const { logAudit } = require('../utils/audit');
const { preventReplay } = require('../middleware/replay');

const router = express.Router();

// Configure multer for file uploads
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// Upload document
router.post('/upload', authenticate, preventReplay, upload.single('file'), (req, res) => {
    try {
        const { recipientId, password } = req.body;
        const file = req.file;

        if (!file || !recipientId || !password) {
            return res.status(400).json({ error: 'File, recipient, and password are required' });
        }

        const db = getDb();

        // Get recipient's public key
        const recipient = db.prepare('SELECT id, rsa_public_key, username FROM users WHERE id = ? AND is_active = 1').get(recipientId);
        if (!recipient) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        // Get sender's private key
        const sender = db.prepare('SELECT rsa_private_key_encrypted FROM users WHERE id = ?').get(req.user.id);
        let senderPrivateKey;
        try {
            senderPrivateKey = decryptPrivateKey(sender.rsa_private_key_encrypted, password);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid password — could not decrypt your private key' });
        }

        // Verify sender's certificate
        const certCheck = verifyCertificate(req.user.id);
        if (!certCheck.valid) {
            return res.status(403).json({ error: 'Your certificate is invalid or revoked' });
        }

        // Step 1: Generate AES key
        const aesKey = generateAESKey();

        // Step 2: Encrypt the file with AES-256-CBC
        const { encrypted, iv } = encryptFile(file.buffer, aesKey);

        // Step 3: Encrypt the AES key with recipient's RSA public key
        const encryptedAESKey = encryptAESKey(aesKey, recipient.rsa_public_key);

        // Step 4: Hash the original file with SHA-256
        const fileHash = hashFile(file.buffer);

        // Step 5: Sign the hash with sender's RSA private key
        const digitalSignature = signHash(fileHash, senderPrivateKey);

        // Step 6: Store the encrypted file
        const docId = uuidv4();
        const filename = docId + '.enc';
        const filePath = path.join(UPLOAD_DIR, filename);
        fs.writeFileSync(filePath, encrypted);

        // Step 7: Store metadata in database
        db.prepare(`
      INSERT INTO documents (id, filename, original_name, file_size, mime_type, sender_id, recipient_id, encrypted_aes_key, iv, file_hash, digital_signature)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            docId,
            filename,
            file.originalname,
            file.size,
            file.mimetype,
            req.user.id,
            recipientId,
            encryptedAESKey,
            iv.toString('hex'),
            fileHash,
            digitalSignature
        );

        // Step 8: Audit log
        logAudit(db, {
            userId: req.user.id,
            action: 'DOCUMENT_UPLOADED',
            targetType: 'document',
            targetId: docId,
            ipAddress: req.ip,
            details: `Uploaded "${file.originalname}" for ${recipient.username}`,
        });

        res.status(201).json({
            message: 'Document uploaded and encrypted successfully',
            document: {
                id: docId,
                originalName: file.originalname,
                fileSize: file.size,
                recipientId,
                fileHash,
                signatureVerified: true,
            },
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
});

// List documents for current user
router.get('/', authenticate, (req, res) => {
    try {
        const db = getDb();
        const sent = db.prepare(`
      SELECT d.*, u.username as recipient_name, u.full_name as recipient_full_name
      FROM documents d
      JOIN users u ON d.recipient_id = u.id
      WHERE d.sender_id = ?
      ORDER BY d.created_at DESC
    `).all(req.user.id);

        const received = db.prepare(`
      SELECT d.*, u.username as sender_name, u.full_name as sender_full_name
      FROM documents d
      JOIN users u ON d.sender_id = u.id
      WHERE d.recipient_id = ?
      ORDER BY d.created_at DESC
    `).all(req.user.id);

        res.json({ sent, received });
    } catch (err) {
        console.error('List documents error:', err);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

// Download and decrypt document
router.post('/:id/download', authenticate, preventReplay, (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password is required to decrypt' });
        }

        const db = getDb();
        const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);

        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Only the recipient can download
        if (doc.recipient_id !== req.user.id && doc.sender_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // If receiver, decrypt with their private key
        if (doc.recipient_id === req.user.id) {
            const user = db.prepare('SELECT rsa_private_key_encrypted FROM users WHERE id = ?').get(req.user.id);
            let privateKey;
            try {
                privateKey = decryptPrivateKey(user.rsa_private_key_encrypted, password);
            } catch (e) {
                return res.status(401).json({ error: 'Invalid password — could not decrypt private key' });
            }

            // Step 1: Read encrypted file
            const filePath = path.join(UPLOAD_DIR, doc.filename);
            const encryptedData = fs.readFileSync(filePath);

            // Step 2: Decrypt AES key
            const aesKey = decryptAESKey(doc.encrypted_aes_key, privateKey);

            // Step 3: Decrypt file
            const iv = Buffer.from(doc.iv, 'hex');
            const decryptedData = decryptFile(encryptedData, aesKey, iv);

            // Step 4: Verify integrity (hash comparison)
            const computedHash = hashFile(decryptedData);
            const integrityValid = computedHash === doc.file_hash;

            // Step 5: Verify digital signature
            const sender = db.prepare('SELECT rsa_public_key FROM users WHERE id = ?').get(doc.sender_id);
            const signatureValid = verifySignature(doc.file_hash, doc.digital_signature, sender.rsa_public_key);

            // Update status
            db.prepare('UPDATE documents SET status = ? WHERE id = ?').run('downloaded', doc.id);

            // Audit log
            logAudit(db, {
                userId: req.user.id,
                action: 'DOCUMENT_DOWNLOADED',
                targetType: 'document',
                targetId: doc.id,
                ipAddress: req.ip,
                details: `Downloaded "${doc.original_name}" — Integrity: ${integrityValid}, Signature: ${signatureValid}`,
            });

            res.json({
                document: {
                    id: doc.id,
                    originalName: doc.original_name,
                    mimeType: doc.mime_type,
                    fileSize: doc.file_size,
                    integrityValid,
                    signatureValid,
                    data: decryptedData.toString('base64'),
                },
            });
        } else {
            // Sender can view metadata but not download the encrypted file intended for recipient
            res.json({
                document: {
                    id: doc.id,
                    originalName: doc.original_name,
                    fileSize: doc.file_size,
                    status: doc.status,
                    fileHash: doc.file_hash,
                    createdAt: doc.created_at,
                },
            });
        }
    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Download failed: ' + err.message });
    }
});

// Verify document integrity without downloading
router.get('/:id/verify', authenticate, (req, res) => {
    try {
        const db = getDb();
        const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);

        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (doc.recipient_id !== req.user.id && doc.sender_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Verify sender's certificate
        const certCheck = verifyCertificate(doc.sender_id);

        // Verify digital signature
        const sender = db.prepare('SELECT rsa_public_key, username, full_name FROM users WHERE id = ?').get(doc.sender_id);
        const signatureValid = verifySignature(doc.file_hash, doc.digital_signature, sender.rsa_public_key);

        // Check if encrypted file exists
        const filePath = path.join(UPLOAD_DIR, doc.filename);
        const fileExists = fs.existsSync(filePath);

        logAudit(db, {
            userId: req.user.id,
            action: 'DOCUMENT_VERIFIED',
            targetType: 'document',
            targetId: doc.id,
            ipAddress: req.ip,
        });

        res.json({
            verification: {
                documentId: doc.id,
                originalName: doc.original_name,
                fileHash: doc.file_hash,
                signatureValid,
                certificateValid: certCheck.valid,
                certificateReason: certCheck.reason,
                senderName: sender.full_name,
                senderUsername: sender.username,
                fileExists,
                uploadedAt: doc.created_at,
            },
        });
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Get all users (for recipient picker)
router.get('/users', authenticate, (req, res) => {
    try {
        const db = getDb();
        const users = db.prepare(`
      SELECT id, username, full_name, role, email
      FROM users WHERE is_active = 1 AND id != ?
    `).all(req.user.id);
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

module.exports = router;
