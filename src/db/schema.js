const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('admin', 'lawyer', 'client')),
    full_name TEXT NOT NULL,
    rsa_public_key TEXT,
    rsa_private_key_encrypted TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    encrypted_aes_key TEXT NOT NULL,
    iv TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    digital_signature TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'downloaded', 'verified', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    ip_address TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    serial_number TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    public_key TEXT NOT NULL,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked INTEGER DEFAULT 0,
    revoked_at DATETIME,
    revoked_reason TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ca_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ca_name TEXT NOT NULL,
    ca_public_key TEXT NOT NULL,
    ca_private_key_encrypted TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_documents_sender ON documents(sender_id);
  CREATE INDEX IF NOT EXISTS idx_documents_recipient ON documents(recipient_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
  CREATE INDEX IF NOT EXISTS idx_certificates_serial ON certificates(serial_number);
`;

module.exports = { SCHEMA };
