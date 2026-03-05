const crypto = require('crypto');

/**
 * Decrypt the AES key using the recipient's RSA private key
 */
function decryptAESKey(encryptedKeyBase64, privateKey) {
    const encryptedKey = Buffer.from(encryptedKeyBase64, 'base64');
    const decryptedKey = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        encryptedKey
    );
    return decryptedKey;
}

/**
 * Decrypt a file buffer using AES-256-CBC
 */
function decryptFile(encryptedBuffer, aesKey, iv) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return decrypted;
}

module.exports = { decryptAESKey, decryptFile };
