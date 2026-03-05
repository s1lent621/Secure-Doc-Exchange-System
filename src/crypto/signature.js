const crypto = require('crypto');

/**
 * Generate SHA-256 hash of a file buffer
 */
function hashFile(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Digitally sign a hash using the sender's RSA private key
 */
function signHash(hash, senderPrivateKey) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(hash);
    signer.end();
    return signer.sign(senderPrivateKey, 'base64');
}

/**
 * Verify a digital signature using the sender's RSA public key
 */
function verifySignature(hash, signature, senderPublicKey) {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(hash);
    verifier.end();
    return verifier.verify(senderPublicKey, signature, 'base64');
}

module.exports = { hashFile, signHash, verifySignature };
