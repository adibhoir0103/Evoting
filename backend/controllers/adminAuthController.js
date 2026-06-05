/**
 * Admin Auth Controller
 * Handles admin login and MFA verification.
 * Extracted from server.js — admin-specific auth flows.
 */

const prisma = require('../lib/prisma');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const redisService = require('../services/redisService');
const { logAdminAction } = require('../utils/helpers');
const { EFFECTIVE_JWT_SECRET } = require('../middleware/authenticate');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@evote.com';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

let EFFECTIVE_ADMIN_HASH;
if (ADMIN_PASSWORD_HASH) {
    EFFECTIVE_ADMIN_HASH = ADMIN_PASSWORD_HASH;
} else if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: ADMIN_PASSWORD_HASH environment variable is required in production.');
    process.exit(1);
} else {
    EFFECTIVE_ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_DEV_PASSWORD || 'Admin@modern7', 10);
    console.warn('⚠️  Using development admin credentials.');
}

exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;
    const trimmedEmail = email ? email.trim().toLowerCase() : '';
    const trimmedPassword = password ? password.trim() : '';

    if (!trimmedEmail || !trimmedPassword) return res.status(400).json({ error: 'Email and password are required' });
    if (trimmedEmail !== ADMIN_EMAIL) return res.status(401).json({ error: 'Invalid admin credentials' });

    const isValidPassword = await bcrypt.compare(trimmedPassword, EFFECTIVE_ADMIN_HASH);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid admin credentials' });

    // Admin MFA: Generate and send OTP
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);
    const preAuthToken = jwt.sign(
        { email: trimmedEmail, role: 'admin', purpose: 'admin-mfa' },
        EFFECTIVE_JWT_SECRET, { expiresIn: '5m' }
    );

    await redisService.setActiveSession(`admin-mfa:${trimmedEmail}`, otpHash, 300);

    const emailService = require('../services/emailService');
    await emailService.sendOTP(trimmedEmail, otp, 'Admin', 'Admin Login Verification');

    logAdminAction(trimmedEmail, 'LOGIN_MFA_INITIATED', 'Admin MFA OTP sent', req.ip);

    res.json({
        message: 'Password verified. OTP sent to admin email.', mfaRequired: true, preAuthToken,
        email: trimmedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    });
};

exports.adminVerifyMfa = async (req, res) => {
    const { preAuthToken, otp } = req.body;
    if (!preAuthToken || !otp) return res.status(400).json({ error: 'Pre-auth token and OTP are required' });

    let decoded;
    try { decoded = jwt.verify(preAuthToken, EFFECTIVE_JWT_SECRET); }
    catch (err) { return res.status(401).json({ error: 'Session expired. Please login again.' }); }

    if (decoded.purpose !== 'admin-mfa' || decoded.role !== 'admin') return res.status(401).json({ error: 'Invalid pre-auth token' });

    const storedOtpHash = await redisService.getActiveSession(`admin-mfa:${decoded.email}`);
    if (!storedOtpHash) return res.status(401).json({ error: 'OTP expired. Please login again.' });

    const isOtpValid = await bcrypt.compare(otp.toString().trim(), storedOtpHash);
    if (!isOtpValid) return res.status(401).json({ error: 'Invalid OTP. Please try again.' });

    await redisService.clearActiveSession(`admin-mfa:${decoded.email}`);

    const token = jwt.sign(
        { id: 'admin', email: decoded.email, role: 'admin' },
        EFFECTIVE_JWT_SECRET, { expiresIn: '2h' }
    );

    logAdminAction(decoded.email, 'LOGIN', 'Admin login successful (MFA verified)', req.ip);

    res.json({ message: 'Admin login successful', token, admin: { email: decoded.email, role: 'admin' } });
};
