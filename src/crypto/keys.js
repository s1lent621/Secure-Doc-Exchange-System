const crypto = require('crypto');

/**
 * Generate an RSA-2048 key pair
 */
function generateRSAKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
}

/**
 * Encrypt a private key with a passphrase using AES-256-CBC
 */
function encryptPrivateKey(privateKey, passphrase) {
    const key = crypto.scryptSync(passphrase, 'salt-doc-exchange', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a private key with a passphrase
 */
function decryptPrivateKey(encryptedKey, passphrase) {
    const [ivHex, encrypted] = encryptedKey.split(':');
    const key = crypto.scryptSync(passphrase, 'salt-doc-exchange', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = { generateRSAKeyPair, encryptPrivateKey, decryptPrivateKey };
