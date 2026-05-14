/**
 * Authentication Middleware
 * 
 * Extracted from server.js during modularization.
 * Provides JWT verification and Redis session enforcement.
 */

const jwt = require('jsonwebtoken');
const redisService = require('../services/redisService');

// JWT Secret — crash in production if missing
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production.');
    process.exit(1);
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-local-key-' + require('crypto').randomBytes(16).toString('hex');

/**
 * Voter authentication middleware.
 * Verifies JWT and enforces single active session via Redis.
 */
const injectUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token || token === 'test-token') {
        return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    try {
        const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
        // Enforce single active session using Redis (High Performance)
        if (decoded.active_session_token) {
            const currentSession = await redisService.getActiveSession(decoded.id);
            if (!currentSession || currentSession !== decoded.active_session_token) {
                return res.status(401).json({ error: 'Session invalidated by login in another window' });
            }
        }

        req.user = {
            id: decoded.id,
            voterId: decoded.voterId || decoded.voter_id,
            email: decoded.email,
            auth_id: decoded.auth_id || decoded.sub
        };
        req.auth = { userId: decoded.auth_id || decoded.sub };
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
    }
};

/**
 * Admin authentication middleware.
 * Verifies JWT and attaches admin user info.
 */
const isAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (token && token !== 'test-token') {
        try {
            const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
            req.adminUser = {
                id: decoded.id || 0,
                email: decoded.email,
                role: decoded.role === 'admin' ? 'SUPER_ADMIN' : (decoded.role || 'SUPER_ADMIN')
            };
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired admin token. Please log in again.' });
        }
    }

    return res.status(401).json({ error: 'Admin authentication required.' });
};

module.exports = {
    injectUser,
    isAdmin,
    EFFECTIVE_JWT_SECRET
};
