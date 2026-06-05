/**
 * Shared Utility Functions
 * 
 * Extracted from server.js during modularization.
 * Used across all controllers for input sanitization,
 * validation, and audit logging.
 */

const prisma = require('../lib/prisma');

// Basic input sanitization (XSS prevention)
function sanitize(str) {
    if (typeof str !== 'string') return str;
    return str.trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// Validate hex string (for ZKP proof components, commitments, nullifiers)
function isValidHex(str) {
    if (typeof str !== 'string') return false;
    return /^0x[0-9a-fA-F]{1,128}$/.test(str);
}

// Validate IPFS CID format (Qm... or bafy...)
function isValidIPFSHash(str) {
    if (typeof str !== 'string') return false;
    if (str.trim() === '') return false;
    return /^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{55,60})$/.test(str);
}

// Log Admin Action to audit trail
async function logAdminAction(admin_email, action, details, ip_address) {
    try {
        await prisma.adminAuditLog.create({
            data: { admin_email, action, details, ip_address }
        });
    } catch (err) {
        console.error('Audit log write error:', err.message);
    }
}

module.exports = {
    sanitize,
    isValidHex,
    isValidIPFSHash,
    logAdminAction
};
