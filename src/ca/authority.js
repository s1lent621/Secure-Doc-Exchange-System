const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { generateRSAKeyPair, encryptPrivateKey, decryptPrivateKey } = require('../crypto/keys');

const CA_PASSPHRASE = 'ca-master-key-doc-exchange-2024';

/**
 * Initialize the Certificate Authority if not already set up
 */
function initializeCA() {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM ca_config LIMIT 1').get();
    if (existing) {
        console.log('✅ Certificate Authority already initialized');
        return existing;
    }

    const { publicKey, privateKey } = generateRSAKeyPair();
    const encryptedPrivateKey = encryptPrivateKey(privateKey, CA_PASSPHRASE);

    const stmt = db.prepare(`
    INSERT INTO ca_config (ca_name, ca_public_key, ca_private_key_encrypted)
    VALUES (?, ?, ?)
  `);
    stmt.run('DocExchange Internal CA', publicKey, encryptedPrivateKey);
    console.log('✅ Certificate Authority initialized');
    return db.prepare('SELECT * FROM ca_config LIMIT 1').get();
}

/**
 * Issue a certificate for a user
 */
function issueCertificate(userId, publicKey, subject) {
    const db = getDb();
    const id = uuidv4();
    const serialNumber = uuidv4().replace(/-/g, '').toUpperCase();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const stmt = db.prepare(`
    INSERT INTO certificates (id, user_id, serial_number, subject, public_key, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    stmt.run(id, userId, serialNumber, subject, publicKey, expiresAt);

    return db.prepare('SELECT * FROM certificates WHERE id = ?').get(id);
}

/**
 * Revoke a certificate
 */
function revokeCertificate(serialNumber, reason) {
    const db = getDb();
    const stmt = db.prepare(`
    UPDATE certificates
    SET revoked = 1, revoked_at = CURRENT_TIMESTAMP, revoked_reason = ?
    WHERE serial_number = ?
  `);
    const result = stmt.run(reason, serialNumber);
    return result.changes > 0;
}

/**
 * Verify a certificate is valid and not revoked
 */
function verifyCertificate(userId) {
    const db = getDb();
    const cert = db.prepare(`
    SELECT * FROM certificates
    WHERE user_id = ? AND revoked = 0 AND expires_at > datetime('now')
    ORDER BY issued_at DESC LIMIT 1
  `).get(userId);

    if (!cert) return { valid: false, reason: 'No valid certificate found' };
    return { valid: true, certificate: cert };
}

/**
 * Get Certificate Revocation List
 */
function getCRL() {
    const db = getDb();
    return db.prepare(`
    SELECT serial_number, user_id, revoked_at, revoked_reason, subject
    FROM certificates WHERE revoked = 1
    ORDER BY revoked_at DESC
  `).all();
}

/**
 * Get all certificates
 */
function getAllCertificates() {
    const db = getDb();
    return db.prepare(`
    SELECT c.*, u.username, u.full_name
    FROM certificates c
    JOIN users u ON c.user_id = u.id
    ORDER BY c.issued_at DESC
  `).all();
}

module.exports = {
    initializeCA,
    issueCertificate,
    revokeCertificate,
    verifyCertificate,
    getCRL,
    getAllCertificates,
    CA_PASSPHRASE,
};
