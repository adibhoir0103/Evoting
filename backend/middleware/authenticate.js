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
// Deterministic dev-only fallback to support PM2 clustering in development
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-local-key-fixed-for-clustering';

/**
 * Voter authentication middleware.
 * Reads JWT from httpOnly cookie first, falls back to Authorization header.
 * Enforces single active session via Redis.
 */
const injectUser = async (req, res, next) => {
    // Priority: httpOnly cookie > Authorization header
    const cookieToken = req.cookies && req.cookies.token;
    const authHeader = req.headers.authorization;
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const token = cookieToken || headerToken;

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
 * Reads JWT from httpOnly cookie first, falls back to Authorization header.
 */
const isAdmin = (req, res, next) => {
    // Priority: httpOnly cookie > Authorization header
    const cookieToken = req.cookies && req.cookies.admin_token;
    const authHeader = req.headers.authorization;
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const token = cookieToken || headerToken;

    if (token && token !== 'test-token') {
        try {
            const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
            
            // SECURITY: Enforce role check!
            if (!decoded.role || !['admin', 'SUPER_ADMIN', 'ELECTION_OFFICER', 'AUDITOR'].includes(decoded.role)) {
                return res.status(403).json({ error: 'Access denied: Admin privileges required.' });
            }

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

// ============ Cookie Configuration ============
const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    domain: isProduction ? '.bharat-evote.me' : undefined,
    path: '/'
};

/**
 * Set a JWT token as an httpOnly cookie on the response.
 * @param {object} res - Express response object
 * @param {string} name - Cookie name ('token' for voter, 'admin_token' for admin)
 * @param {string} token - JWT string
 * @param {number} maxAgeMs - Cookie lifetime in milliseconds
 */
function setTokenCookie(res, name, token, maxAgeMs) {
    res.cookie(name, token, { ...COOKIE_OPTIONS, maxAge: maxAgeMs });
}

/**
 * Clear a JWT cookie.
 */
function clearTokenCookie(res, name) {
    res.clearCookie(name, { ...COOKIE_OPTIONS });
}

module.exports = {
    injectUser,
    isAdmin,
    EFFECTIVE_JWT_SECRET,
    setTokenCookie,
    clearTokenCookie
};
