const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { getDb } = require('./src/db/database');
const { initializeCA } = require('./src/ca/authority');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/documents', require('./src/routes/documents'));
app.use('/api/admin', require('./src/routes/admin'));

// Catch-all: serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize
function start() {
    getDb();
    initializeCA();

    // Enable HTTPS with strict ciphers for Forward Secrecy
    const options = {
        key: fs.readFileSync(path.join(__dirname, 'src/db/server.key')),
        cert: fs.readFileSync(path.join(__dirname, 'src/db/server.cert')),
        ciphers: [
            "ECDHE-RSA-AES256-GCM-SHA384",
            "ECDHE-RSA-AES128-GCM-SHA256"
        ].join(':'),
        honorCipherOrder: true
    };

    https.createServer(options, app).listen(PORT, () => {
        console.log(`\n🔐 Secure Document Exchange System`);
        console.log(`   Server running at https://localhost:${PORT}`);
        console.log(`   Forward Secrecy enabled via ECDHE ciphers!`);
        console.log(`   Ready for secure document exchange!\n`);
    });
}

if (require.main === module) {
    start();
}

module.exports = app;
