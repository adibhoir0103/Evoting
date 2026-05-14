/**
 * Auth Routes
 * Mounts all authentication, profile, and wallet endpoints.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { injectUser } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../controllers/authController');

// Rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 20,
    message: { error: 'Too many auth attempts. Please try again later.' },
    standardHeaders: true, legacyHeaders: false
});

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, max: 3,
    message: { error: 'Too many OTP attempts. Account temporarily locked for 5 minutes.' },
    standardHeaders: true, legacyHeaders: false
});

// Registration & Login
router.post('/register', authLimiter, asyncHandler(auth.register));
router.post('/login', authLimiter, asyncHandler(auth.login));
router.post('/mfa/verify-otp', otpLimiter, asyncHandler(auth.verifyOtp));
router.post('/mfa/resend-otp', authLimiter, asyncHandler(auth.resendOtp));
router.post('/logout', injectUser, asyncHandler(auth.logout));

// Password Reset
router.post('/forgot-password', authLimiter, asyncHandler(auth.forgotPassword));
router.post('/reset-password', authLimiter, asyncHandler(auth.resetPassword));

// QR Voting Tickets
router.post('/generate-qr-ticket', injectUser, asyncHandler(auth.generateQrTicket));
router.post('/validate-qr-ticket', injectUser, asyncHandler(auth.validateQrTicket));

// Keystroke Dynamics
router.post('/keystroke/enroll', authLimiter, injectUser, asyncHandler(auth.keystrokeEnroll));
router.post('/keystroke/verify', authLimiter, injectUser, asyncHandler(auth.keystrokeVerify));

// User Profile
router.get('/me', injectUser, asyncHandler(auth.getMe));

module.exports = router;
