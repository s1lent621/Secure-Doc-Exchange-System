const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const JWT_SECRET = 'doc-exchange-jwt-secret-2024-secure-key';

/**
 * Authentication middleware — verifies JWT token
 */
function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = getDb();
        const user = db.prepare('SELECT id, username, email, role, full_name, is_active, rsa_public_key FROM users WHERE id = ?').get(decoded.userId);
        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'User not found or deactivated' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Role-based access control middleware
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

/**
 * Generate a JWT token for a user
 */
function generateToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

module.exports = { authenticate, requireRole, generateToken, JWT_SECRET };
