const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { generateRSAKeyPair, encryptPrivateKey, decryptPrivateKey } = require('../crypto/keys');
const { authenticate, generateToken } = require('../middleware/auth');
const { issueCertificate, verifyCertificate } = require('../ca/authority');
const { logAudit } = require('../utils/audit');
const { createPKCS12 } = require('../crypto/export');
const { preventReplay } = require('../middleware/replay');

const router = express.Router();

// Register new user
router.post('/register', preventReplay, async (req, res) => {
    try {
        const { username, email, password, fullName, role } = req.body;
        if (!username || !email || !password || !fullName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const db = getDb();

        // Check existing user
        const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
        if (existing) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Generate RSA key pair
        const { publicKey, privateKey } = generateRSAKeyPair();
        const encryptedPrivateKey = encryptPrivateKey(privateKey, password);

        const id = uuidv4();
        const userRole = role && ['admin', 'lawyer', 'client'].includes(role) ? role : 'client';

        db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, full_name, rsa_public_key, rsa_private_key_encrypted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, username, email, passwordHash, userRole, fullName, publicKey, encryptedPrivateKey);

        // Issue certificate
        issueCertificate(id, publicKey, `CN=${fullName}, O=DocExchange, ROLE=${userRole}`);

        // Audit log
        logAudit(db, {
            userId: id,
            action: 'USER_REGISTERED',
            targetType: 'user',
            targetId: id,
            ipAddress: req.ip,
            details: `New ${userRole} user registered: ${username}`,
        });

        const token = generateToken(id);

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: { id, username, email, role: userRole, fullName },
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', preventReplay, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user.id);

        logAudit(db, {
            userId: user.id,
            action: 'USER_LOGIN',
            targetType: 'user',
            targetId: user.id,
            ipAddress: req.ip,
        });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                fullName: user.full_name,
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
router.get('/me', authenticate, (req, res) => {
    res.json({ user: req.user });
});

// Logout
router.post('/logout', authenticate, (req, res) => {
    logAudit(getDb(), {
        userId: req.user.id,
        action: 'USER_LOGOUT',
        targetType: 'user',
        targetId: req.user.id,
        ipAddress: req.ip,
    });
    res.json({ message: 'Logged out successfully' });
});

// Export PKCS#12 Keystore
router.post('/export-keys', authenticate, preventReplay, (req, res) => {
    try {
        const { password, exportPassword } = req.body;
        if (!password || !exportPassword) {
            return res.status(400).json({ error: 'Current password and export password are required' });
        }

        const db = getDb();
        const user = db.prepare('SELECT rsa_private_key_encrypted, rsa_public_key, full_name, username FROM users WHERE id = ?').get(req.user.id);

        let privateKey;
        try {
            privateKey = decryptPrivateKey(user.rsa_private_key_encrypted, password);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid current password' });
        }

        const certCheck = verifyCertificate(req.user.id);
        if (!certCheck.valid) {
            return res.status(403).json({ error: 'No valid certificate found to export' });
        }

        const p12Buffer = createPKCS12(privateKey, user.rsa_public_key, exportPassword, `${user.full_name} (${user.username})`);

        logAudit(db, {
            userId: req.user.id,
            action: 'KEYS_EXPORTED',
            targetType: 'user',
            targetId: req.user.id,
            ipAddress: req.ip,
            details: 'Exported PKCS#12 keystore'
        });

        res.setHeader('Content-Type', 'application/x-pkcs12');
        res.setHeader('Content-Disposition', 'attachment; filename="keystore.p12"');
        res.send(p12Buffer);

    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: 'Failed to export keys' });
    }
});

module.exports = router;
