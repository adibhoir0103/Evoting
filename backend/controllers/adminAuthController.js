/**
 * Admin Auth Controller
 * Handles admin login and MFA verification.
 * Extracted from server.js — admin-specific auth flows.
 */

const prisma = require('../lib/prisma');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { logAdminAction } = require('../utils/helpers');
const { EFFECTIVE_JWT_SECRET, setTokenCookie } = require('../middleware/authenticate');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@evote.com';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

let EFFECTIVE_ADMIN_HASH;
if (ADMIN_PASSWORD_HASH) {
    EFFECTIVE_ADMIN_HASH = ADMIN_PASSWORD_HASH;
} else if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: ADMIN_PASSWORD_HASH environment variable is required in production.');
    process.exit(1);
} else {
    // Default cost factor to 12 for better security against offline brute force
    EFFECTIVE_ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_DEV_PASSWORD || 'Admin@modern7', 12);
    console.warn('⚠️  Using development admin credentials.');
}

exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;
    const trimmedEmail = email ? email.trim().toLowerCase() : '';
    const trimmedPassword = password ? password.trim() : '';

    if (!trimmedEmail || !trimmedPassword) return res.status(400).json({ error: 'Email and password are required' });
    if (trimmedEmail !== ADMIN_EMAIL) return res.status(401).json({ error: 'Incorrect email or password' });

    const isValidPassword = await bcrypt.compare(trimmedPassword, EFFECTIVE_ADMIN_HASH);
    if (!isValidPassword) return res.status(401).json({ error: 'Incorrect email or password' });

    // Issue final JWT immediately — no OTP required for admin
    const token = jwt.sign(
        { id: 'admin', email: trimmedEmail, role: 'ADMIN' },
        EFFECTIVE_JWT_SECRET, { expiresIn: '2h' }
    );

    logAdminAction(trimmedEmail, 'LOGIN', 'Admin login successful', req.ip);

    // Set admin JWT as httpOnly cookie
    setTokenCookie(res, 'admin_token', token, 2 * 60 * 60 * 1000);

    res.json({ message: 'Admin login successful', token, admin: { email: trimmedEmail, role: 'ADMIN' } });
};
