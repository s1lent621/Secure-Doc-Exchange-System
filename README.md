**Secure Document Exchange System**
**Overview**

The Secure Document Exchange System is a web-based platform designed for legal professionals and clients to share, download, and verify documents securely. It ensures confidentiality, integrity, and controlled access using hybrid encryption (AES + RSA), role-based authentication, and digital signature verification.

**Features**

- User Roles: Users can register as standard users, while administrators assign elevated roles (Lawyer or Admin).

- Secure File Upload & Download: Documents are encrypted before transmission and decrypted only by authorized recipients.

- Hybrid Encryption: Combines AES-256 for fast document encryption and RSA for secure key exchange.

- Document Verification: Supports hash checks and digital signatures to ensure integrity.

- Encrypted Database Storage: Protects documents even if the database is compromised.

- Performance Optimized: Efficient encryption and decryption for both small and large files.

**Installation / Setup**

**Clone the repository:**

```git clone https://github.com/s1lent621/Secure-Doc-Exchange-System.git```

Navigate to the project directory:

```cd secure-document-exchange```

**Install dependencies (for Node.js backend):**

```npm install```

Configure environment variables (e.g., database connection, encryption keys).

**Start the server:**

```npm start```

Open the client interface in a browser at **http://localhost:3000**.

