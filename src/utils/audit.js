const { v4: uuidv4 } = require('uuid');

/**
 * Log an audit event
 */
function logAudit(db, { userId, action, targetType, targetId, ipAddress, details }) {
    const stmt = db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, ip_address, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(uuidv4(), userId, action, targetType, targetId, ipAddress, details || null);
}

module.exports = { logAudit };
