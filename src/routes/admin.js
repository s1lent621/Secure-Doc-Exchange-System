const express = require('express');
const { getDb } = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { getAllCertificates, revokeCertificate, getCRL } = require('../ca/authority');
const { logAudit } = require('../utils/audit');

const router = express.Router();

// All admin routes require admin role
router.use(authenticate, requireRole('admin'));

// List all users
router.get('/users', (req, res) => {
    try {
        const db = getDb();
        const users = db.prepare(`
      SELECT id, username, email, role, full_name, is_active, created_at
      FROM users ORDER BY created_at DESC
    `).all();
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update user role
router.put('/users/:id/role', (req, res) => {
    try {
        const { role } = req.body;
        if (!role || !['admin', 'lawyer', 'client'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const db = getDb();
        db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, req.params.id);

        logAudit(db, {
            userId: req.user.id,
            action: 'USER_ROLE_UPDATED',
            targetType: 'user',
            targetId: req.params.id,
            ipAddress: req.ip,
            details: `Role changed to ${role}`,
        });

        res.json({ message: 'Role updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Deactivate user
router.delete('/users/:id', (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot deactivate yourself' });
        }

        const db = getDb();
        db.prepare('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

        logAudit(db, {
            userId: req.user.id,
            action: 'USER_DEACTIVATED',
            targetType: 'user',
            targetId: req.params.id,
            ipAddress: req.ip,
        });

        res.json({ message: 'User deactivated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
});

// Get audit logs
router.get('/audit-logs', (req, res) => {
    try {
        const db = getDb();
        const { limit = 100, action, userId } = req.query;

        let query = `
      SELECT a.*, u.username, u.full_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
    `;
        const params = [];
        const conditions = [];

        if (action) {
            conditions.push('a.action = ?');
            params.push(action);
        }
        if (userId) {
            conditions.push('a.user_id = ?');
            params.push(userId);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY a.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const logs = db.prepare(query).all(...params);
        res.json({ logs });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// Get all certificates
router.get('/certificates', (req, res) => {
    try {
        const certificates = getAllCertificates();
        res.json({ certificates });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch certificates' });
    }
});

// Revoke a certificate
router.post('/certificates/:serialNumber/revoke', (req, res) => {
    try {
        const { reason } = req.body;
        const success = revokeCertificate(req.params.serialNumber, reason || 'Revoked by admin');

        if (success) {
            logAudit(getDb(), {
                userId: req.user.id,
                action: 'CERTIFICATE_REVOKED',
                targetType: 'certificate',
                targetId: req.params.serialNumber,
                ipAddress: req.ip,
                details: reason || 'Revoked by admin',
            });
            res.json({ message: 'Certificate revoked' });
        } else {
            res.status(404).json({ error: 'Certificate not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to revoke certificate' });
    }
});

// Get CRL
router.get('/crl', (req, res) => {
    try {
        const crl = getCRL();
        res.json({ crl });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch CRL' });
    }
});

// Dashboard stats
router.get('/stats', (req, res) => {
    try {
        const db = getDb();
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
        const totalDocuments = db.prepare('SELECT COUNT(*) as count FROM documents').get().count;
        const totalCerts = db.prepare('SELECT COUNT(*) as count FROM certificates').get().count;
        const revokedCerts = db.prepare('SELECT COUNT(*) as count FROM certificates WHERE revoked = 1').get().count;
        const recentLogs = db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE created_at > datetime("now", "-24 hours")').get().count;

        res.json({
            stats: { totalUsers, activeUsers, totalDocuments, totalCerts, revokedCerts, recentLogs }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
