const forge = require('node-forge');

/**
 * Generate a PCKS#12 keystore containing the user's private key and a valid certificate
 * @param {string} pemPrivateKey - User's private key in PEM format
 * @param {string} pemPublicKey - User's public key in PEM format
 * @param {string} exportPassword - Password to protect the PCKS#12 file
 * @param {string} friendlyName - Name to associate with the key
 * @returns {Buffer} - The PCKS#12 file buffer
 */
function createPKCS12(pemPrivateKey, pemPublicKey, exportPassword, friendlyName = 'DocExchange Keystore') {
    const privateKey = forge.pki.privateKeyFromPem(pemPrivateKey);
    const publicKey = forge.pki.publicKeyFromPem(pemPublicKey);

    // Create an X.509 certificate to satisfy PKCS#12 format requirements
    const cert = forge.pki.createCertificate();
    cert.publicKey = publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

    const attrs = [{
        name: 'commonName',
        value: friendlyName
    }];
    cert.setSubject(attrs);
    cert.setIssuer([{ name: 'commonName', value: 'DocExchange Internal CA' }]);

    // Self-sign the certificate
    cert.sign(privateKey, forge.md.sha256.create());

    // Create PCKS#12 (p12)
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
        privateKey,
        [cert],
        exportPassword,
        {
            generateLocalKeyId: true,
            friendlyName: friendlyName,
            algorithm: '3des' // Good compatibility with older systems
        }
    );

    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    return Buffer.from(p12Der, 'binary');
}

module.exports = { createPKCS12 };
