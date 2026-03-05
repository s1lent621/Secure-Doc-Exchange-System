const crypto = require('crypto');

/**
 * Generate a random 256-bit AES key
 */
function generateAESKey() {
    return crypto.randomBytes(32);
}

/**
 * Encrypt a file buffer using AES-256-CBC
 * @returns {{ encrypted: Buffer, iv: Buffer }}
 */
function encryptFile(buffer, aesKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return { encrypted, iv };
}

/**
 * Encrypt the AES key using the recipient's RSA public key (RSA-OAEP)
 */
function encryptAESKey(aesKey, recipientPublicKey) {
    const encryptedKey = crypto.publicEncrypt(
        {
            key: recipientPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        aesKey
    );
    return encryptedKey.toString('base64');
}

module.exports = { generateAESKey, encryptFile, encryptAESKey };
