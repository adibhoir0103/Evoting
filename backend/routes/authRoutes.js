/**
 * Auth Routes
 * Mounts all authentication, profile, and wallet endpoints.
 */

const express = require('express');
const router = express.Router();
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { verifyTurnstile } = require('../middleware/turnstile');
const { injectUser } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../controllers/authController');

// Registration & Login
router.post('/register', authLimiter, verifyTurnstile, asyncHandler(auth.register));
router.post('/login', authLimiter, verifyTurnstile, asyncHandler(auth.login));
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
