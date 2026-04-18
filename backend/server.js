// Initialize Sentry FIRST — before all other imports
const Sentry = require('@sentry/node');

require('dotenv').config();

// Sentry must be initialized BEFORE require('express') for auto-instrumentation
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 1.0,
    });
    console.log('✅ Sentry error monitoring initialized');
}

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('./lib/prisma');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const blockchainListener = require('./services/blockchainListener');
const ipfsService = require('./services/ipfsService');
const zkpService = require('./services/zkpService');
const logger = require('./lib/logger');

// Child loggers for specific contexts
const serverLog = logger.child('server');
const authLog = logger.child('auth');
const voteLog = logger.child('vote');
const adminLog = logger.child('admin');

// Initialize Backend EVM WebSocket Listeners for real-time contract tracing
blockchainListener.init();

// Initialize Election Email Notification Scheduler
const electionNotifier = require('./services/electionNotifier');
electionNotifier.start();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-local-key-' + require('crypto').randomBytes(16).toString('hex');

// Helper: Basic input sanitization (XSS prevention)
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
    if (typeof str !== 'string') return true; // Empty is OK
    if (str === '') return true;
    return /^(Qm[a-zA-Z0-9]{44}|bafy[a-zA-Z0-9]{55,60})$/.test(str);
}

// Helper: Log Admin Action
async function logAdminAction(admin_email, action, details, ip_address) {
    try {
        await prisma.adminAuditLog.create({
            data: { admin_email, action, details, ip_address }
        });
    } catch (err) {
        console.error('Audit log write error:', err.message);
    }
}

// ===================== SECURITY MIDDLEWARE =====================

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://upload.wikimedia.org", "https://*.wikimedia.org"],
            connectSrc: ["'self'", "http://localhost:*", "ws://localhost:*"]
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true }
}));

const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' }));

// ===================== USER AUTH MIDDLEWARE =====================
// Verifies JWT if provided; falls back to mock user for local dev only
const injectUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    // If a real JWT token is provided (not the dev placeholder), verify it
    if (token && token !== 'test-token') {
        try {
            const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
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
    }

    // Dev fallback — only in non-production
    if (process.env.NODE_ENV === 'production' && (!token || token === 'test-token')) {
        return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    // Local dev: inject test user
    req.user = {
        id: 1,
        voterId: 'TEST-123',
        email: 'testvoter@evote.gov',
        auth_id: 'test-auth-id'
    };
    req.auth = { userId: 'test-auth-id' };
    next();
};

// ===================== RATE LIMITERS =====================

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const zkpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: { error: 'Too many ZKP requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const ipfsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many IPFS requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const metaTxLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: { error: 'Too many meta-transaction requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// ===================== HEALTH CHECK =====================

app.get('/', (req, res) => {
    res.json({
        status: 'running',
        service: 'Bharat E-Vote Backend API',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        endpoints: '/api/v1/*'
    });
});

// ===================== VOTER REGISTRATION & LOGIN =====================

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many auth attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Register a new voter
app.post('/api/v1/auth/register', authLimiter, async (req, res) => {
    try {
        const { fullname, email, password, voter_id, aadhaar_number, father_name, gender, dob, mobile_number, state_code, constituency_code, address } = req.body;

        // Validate required fields
        if (!fullname || !email || !password || !voter_id) {
            return res.status(400).json({ error: 'Full name, email, password, and voter ID are required' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanVoterId = voter_id.trim().toUpperCase();

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        // Validate Aadhaar format (12 digits)
        if (aadhaar_number && !/^\d{12}$/.test(aadhaar_number.replace(/\s/g, ''))) {
            return res.status(400).json({ error: 'Aadhaar number must be exactly 12 digits' });
        }

        // Check eligibility: voter email must be in ApprovedVoter whitelist
        const approvedVoter = await prisma.approvedVoter.findUnique({
            where: { email: cleanEmail }
        });

        if (!approvedVoter) {
            return res.status(403).json({ 
                error: 'You are not in the approved voter list. Please contact your local Election Officer to get whitelisted.',
                code: 'NOT_WHITELISTED'
            });
        }

        if (approvedVoter.status === 'BLACKLIST') {
            return res.status(403).json({ 
                error: 'Your voter registration has been suspended. Please contact ECI helpline 1950.',
                code: 'BLACKLISTED'
            });
        }

        // Check for duplicate email or voter_id
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: cleanEmail },
                    { voter_id: cleanVoterId }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.email === cleanEmail) {
                return res.status(409).json({ error: 'An account with this email already exists. Please login instead.' });
            }
            return res.status(409).json({ error: 'This Voter ID is already registered.' });
        }

        // Check duplicate Aadhaar
        if (aadhaar_number) {
            const cleanAadhaar = aadhaar_number.replace(/\s/g, '');
            const existingAadhaar = await prisma.user.findUnique({ where: { aadhaar_number: cleanAadhaar } });
            if (existingAadhaar) {
                return res.status(409).json({ error: 'This Aadhaar number is already linked to another account.' });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await prisma.user.create({
            data: {
                fullname: sanitize(fullname),
                email: cleanEmail,
                password: hashedPassword,
                voter_id: cleanVoterId,
                aadhaar_number: aadhaar_number ? aadhaar_number.replace(/\s/g, '') : null,
                father_name: father_name ? sanitize(father_name) : null,
                gender: gender ? sanitize(gender) : null,
                dob: dob || null,
                mobile_number: mobile_number ? sanitize(mobile_number) : null,
                state_code: state_code ? parseInt(state_code) : 0,
                constituency_code: constituency_code ? parseInt(constituency_code) : 0,
                address: address ? sanitize(address) : null,
                role: 'VOTER'
            }
        });

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, voterId: user.voter_id, role: 'VOTER' },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '30m' }
        );

        // Log registration
        await prisma.loginHistory.create({
            data: { voter_id: user.voter_id, ip_address: req.ip, status: 'REGISTERED' }
        });

        res.status(201).json({
            message: 'Registration successful! Welcome to Bharat E-Vote.',
            token,
            user: {
                id: user.id,
                fullname: user.fullname,
                email: user.email,
                voterId: user.voter_id,
                hasVoted: false
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// Voter login — Step 1: Verify password, then send OTP for MFA
app.post('/api/v1/auth/login', authLimiter, async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Email/Voter ID and password are required' });
        }

        const cleanIdentifier = identifier.trim().toLowerCase();

        // Find user by email or voter_id
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: cleanIdentifier },
                    { voter_id: cleanIdentifier.toUpperCase() }
                ]
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'No account found with these credentials. Please register first.' });
        }

        // --- SINGLE ACTIVE SESSION CONSTRAINT ---
        if (user.active_session_token && user.active_session_expires && user.active_session_expires > new Date()) {
            return res.status(403).json({ error: 'user is active in another window' });
        }

        if (!user.password) {
            return res.status(401).json({ error: 'This account was created without a password. Please contact support.' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            // Log failed attempt
            await prisma.loginHistory.create({
                data: { voter_id: user.voter_id, ip_address: req.ip, status: 'FAILED' }
            }).catch(() => {});
            return res.status(401).json({ error: 'Invalid password. Please try again.' });
        }

        // Check if voter is blacklisted
        const approvedVoter = await prisma.approvedVoter.findUnique({ where: { email: user.email } });
        if (approvedVoter && approvedVoter.status === 'BLACKLIST') {
            return res.status(403).json({ error: 'Your account has been suspended. Contact ECI helpline 1950.' });
        }

        // ====== MFA: Generate and send OTP ======
        const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit OTP
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Invalidate previous OTPs for this user
        await prisma.mfaToken.updateMany({
            where: { user_email: user.email, verified: false },
            data: { verified: true }  // Mark old ones as used
        });

        // Create new MFA token
        await prisma.mfaToken.create({
            data: {
                user_email: user.email,
                otp_hash: otpHash,
                purpose: 'LOGIN',
                expires_at: expiresAt,
                verified: false,
                attempts: 0
            }
        });

        // Send OTP via email
        const emailService = require('./services/emailService');
        const emailResult = await emailService.sendOTP(user.email, otp, user.fullname || 'Voter');

        // Issue a short-lived pre-auth token (NOT the final JWT — just proves password was correct)
        const preAuthToken = jwt.sign(
            { id: user.id, email: user.email, voterId: user.voter_id, step: 'mfa_pending' },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '10m' }  // Only valid for 10 minutes (to complete OTP)
        );

        // Log pre-auth success
        await prisma.loginHistory.create({
            data: { voter_id: user.voter_id, ip_address: req.ip, device_info: req.headers['user-agent']?.slice(0, 200), status: 'MFA_PENDING' }
        }).catch(() => {});

        res.json({
            message: 'Password verified. OTP sent to your registered email.',
            mfaRequired: true,
            preAuthToken,
            email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Masked email
            otpDemo: emailResult.demo ? otp : undefined, // Only in demo mode
            user: {
                id: user.id,
                fullname: user.fullname,
                email: user.email,
                voterId: user.voter_id,
                hasVoted: user.has_voted,
                walletAddress: user.wallet_address
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// Voter login — Step 2: Verify OTP to complete MFA
app.post('/api/v1/auth/mfa/verify-otp', authLimiter, async (req, res) => {
    try {
        const { preAuthToken, otp } = req.body;

        if (!preAuthToken || !otp) {
            return res.status(400).json({ error: 'Pre-auth token and OTP are required' });
        }

        // Verify pre-auth token
        let decoded;
        try {
            decoded = jwt.verify(preAuthToken, EFFECTIVE_JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }

        if (decoded.step !== 'mfa_pending') {
            return res.status(400).json({ error: 'Invalid authentication step.' });
        }

        // Find the latest unverified OTP for this user
        const mfaToken = await prisma.mfaToken.findFirst({
            where: {
                user_email: decoded.email,
                purpose: 'LOGIN',
                verified: false,
                expires_at: { gte: new Date() }
            },
            orderBy: { created_at: 'desc' }
        });

        if (!mfaToken) {
            return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
        }

        // Check max attempts (5)
        if (mfaToken.attempts >= 5) {
            await prisma.mfaToken.update({
                where: { id: mfaToken.id },
                data: { verified: true }
            });
            return res.status(429).json({ error: 'Too many failed OTP attempts. Please login again.' });
        }

        // Verify OTP
        const isValidOtp = await bcrypt.compare(otp.trim(), mfaToken.otp_hash);
        if (!isValidOtp) {
            await prisma.mfaToken.update({
                where: { id: mfaToken.id },
                data: { attempts: mfaToken.attempts + 1 }
            });
            return res.status(401).json({
                error: `Invalid OTP. ${4 - mfaToken.attempts} attempts remaining.`,
                attemptsRemaining: 4 - mfaToken.attempts
            });
        }

        // Mark OTP as verified
        await prisma.mfaToken.update({
            where: { id: mfaToken.id },
            data: { verified: true }
        });

        // Fetch full user data
        const user = await prisma.user.findUnique({ where: { email: decoded.email } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Issue active session constraint token
        const crypto = require('crypto');
        const sessionToken = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        const sessionExpiry = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes timeout

        await prisma.user.update({
            where: { id: user.id },
            data: {
                active_session_token: sessionToken,
                active_session_expires: sessionExpiry
            }
        });

        // Issue the FINAL JWT (full authentication complete)
        const token = jwt.sign(
            { id: user.id, email: user.email, voterId: user.voter_id, voter_id: user.voter_id, role: user.role, mfa: true, active_session_token: sessionToken },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '20m' }
        );

        // Log full login success
        await prisma.loginHistory.create({
            data: { voter_id: user.voter_id, ip_address: req.ip, device_info: req.headers['user-agent']?.slice(0, 200), status: 'SUCCESS' }
        }).catch(() => {});

        res.json({
            message: 'MFA verification successful. Login complete.',
            mfaVerified: true,
            token,
            user: {
                id: user.id,
                fullname: user.fullname,
                email: user.email,
                voterId: user.voter_id,
                hasVoted: user.has_voted,
                walletAddress: user.wallet_address
            }
        });
    } catch (error) {
        console.error('MFA verify error:', error);
        res.status(500).json({ error: 'OTP verification failed. Please try again.' });
    }
});

// Resend OTP
app.post('/api/v1/auth/mfa/resend-otp', authLimiter, async (req, res) => {
    try {
        const { preAuthToken } = req.body;

        if (!preAuthToken) {
            return res.status(400).json({ error: 'Pre-auth token is required' });
        }

        let decoded;
        try {
            decoded = jwt.verify(preAuthToken, EFFECTIVE_JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }

        if (decoded.step !== 'mfa_pending') {
            return res.status(400).json({ error: 'Invalid authentication step.' });
        }

        const user = await prisma.user.findUnique({ where: { email: decoded.email } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Invalidate previous OTPs
        await prisma.mfaToken.updateMany({
            where: { user_email: user.email, verified: false },
            data: { verified: true }
        });

        // Generate new OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await prisma.mfaToken.create({
            data: {
                user_email: user.email,
                otp_hash: otpHash,
                purpose: 'LOGIN',
                expires_at: expiresAt,
                verified: false,
                attempts: 0
            }
        });

        const emailService = require('./services/emailService');
        const emailResult = await emailService.sendOTP(user.email, otp, user.fullname || 'Voter');

        res.json({
            message: 'New OTP sent to your registered email.',
            email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
            otpDemo: emailResult.demo ? otp : undefined
        });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Failed to resend OTP' });
    }
});

// ===================== LOGOUT =====================
app.post('/api/v1/auth/logout', injectUser, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                active_session_token: null,
                active_session_expires: null
            }
        });
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// ===================== FORGOT PASSWORD =====================

// Step 1: Request password reset — sends OTP to registered email
app.post('/api/v1/auth/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email address is required' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Find user
        const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
        if (!user) {
            // Don't reveal whether account exists (security best practice)
            return res.json({ message: 'If an account exists with this email, an OTP has been sent.' });
        }

        // Generate OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes for password reset

        // Invalidate previous reset OTPs
        await prisma.mfaToken.updateMany({
            where: { user_email: cleanEmail, purpose: 'PASSWORD_RESET', verified: false },
            data: { verified: true }
        });

        // Create reset token
        await prisma.mfaToken.create({
            data: {
                user_email: cleanEmail,
                otp_hash: otpHash,
                purpose: 'PASSWORD_RESET',
                expires_at: expiresAt,
                verified: false,
                attempts: 0
            }
        });

        // Send OTP
        const emailService = require('./services/emailService');
        const emailResult = await emailService.sendOTP(cleanEmail, otp, user.fullname || 'Voter', 'Password Reset');

        // Issue a short-lived reset token
        const resetToken = jwt.sign(
            { email: cleanEmail, purpose: 'password_reset' },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '10m' }
        );

        res.json({
            message: 'If an account exists with this email, an OTP has been sent.',
            resetToken,
            email: cleanEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
            otpDemo: emailResult.demo ? otp : undefined
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request. Please try again.' });
    }
});

// Step 2: Reset password — verify OTP and set new password
app.post('/api/v1/auth/reset-password', authLimiter, async (req, res) => {
    try {
        const { resetToken, otp, newPassword } = req.body;

        if (!resetToken || !otp || !newPassword) {
            return res.status(400).json({ error: 'Reset token, OTP, and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, EFFECTIVE_JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Reset session expired. Please request a new OTP.' });
        }

        if (decoded.purpose !== 'password_reset') {
            return res.status(400).json({ error: 'Invalid reset token.' });
        }

        // Find the latest unverified reset OTP
        const mfaToken = await prisma.mfaToken.findFirst({
            where: {
                user_email: decoded.email,
                purpose: 'PASSWORD_RESET',
                verified: false,
                expires_at: { gte: new Date() }
            },
            orderBy: { created_at: 'desc' }
        });

        if (!mfaToken) {
            return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
        }

        // Check max attempts
        if (mfaToken.attempts >= 5) {
            await prisma.mfaToken.update({
                where: { id: mfaToken.id },
                data: { verified: true }
            });
            return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
        }

        // Verify OTP
        const isValidOtp = await bcrypt.compare(otp.trim(), mfaToken.otp_hash);
        if (!isValidOtp) {
            await prisma.mfaToken.update({
                where: { id: mfaToken.id },
                data: { attempts: mfaToken.attempts + 1 }
            });
            return res.status(401).json({
                error: `Invalid OTP. ${4 - mfaToken.attempts} attempts remaining.`,
                attemptsRemaining: 4 - mfaToken.attempts
            });
        }

        // Mark OTP as verified
        await prisma.mfaToken.update({
            where: { id: mfaToken.id },
            data: { verified: true }
        });

        // Hash and update password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { email: decoded.email },
            data: { password: hashedPassword }
        });

        // Log the password reset
        const user = await prisma.user.findUnique({ where: { email: decoded.email } });
        await prisma.loginHistory.create({
            data: { voter_id: user?.voter_id || 'UNKNOWN', ip_address: req.ip, status: 'PASSWORD_RESET' }
        }).catch(() => {});

        res.json({ message: 'Password reset successful! You can now login with your new password.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Password reset failed. Please try again.' });
    }
});

// ===================== QR CODE VOTING TICKETS =====================

// Generate QR Voting Ticket (after full MFA login)
app.post('/api/v1/auth/generate-qr-ticket', injectUser, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, email: true, voter_id: true, has_voted: true, fullname: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.has_voted) {
            return res.status(400).json({ error: 'You have already voted. QR ticket cannot be issued.' });
        }

        // Invalidate any existing unused tickets
        await prisma.qrVoteTicket.updateMany({
            where: { user_email: user.email, used: false },
            data: { used: true }
        });

        // Generate time-limited ticket JWT (5 minutes)
        const ticketExpiry = new Date(Date.now() + 5 * 60 * 1000);
        const ticketToken = jwt.sign(
            {
                type: 'QR_VOTE_TICKET',
                userId: user.id,
                email: user.email,
                voterId: user.voter_id,
                issuedAt: Date.now(),
                nonce: require('crypto').randomBytes(16).toString('hex')
            },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '5m' }
        );

        // Store ticket in database
        await prisma.qrVoteTicket.create({
            data: {
                user_email: user.email,
                ticket_token: ticketToken,
                expires_at: ticketExpiry,
                used: false
            }
        });

        res.json({
            message: 'QR Voting Ticket issued. Valid for 5 minutes.',
            ticketToken,
            expiresAt: ticketExpiry.toISOString(),
            validitySeconds: 300,
            voterName: user.fullname
        });
    } catch (error) {
        console.error('Generate QR ticket error:', error);
        res.status(500).json({ error: 'Failed to generate voting ticket' });
    }
});

// Validate QR Voting Ticket (before allowing vote submission)
app.post('/api/v1/auth/validate-qr-ticket', injectUser, async (req, res) => {
    try {
        const { ticketToken } = req.body;

        if (!ticketToken) {
            return res.status(400).json({ error: 'QR ticket token is required' });
        }

        // Verify JWT signature and expiry
        let ticketPayload;
        try {
            ticketPayload = jwt.verify(ticketToken, EFFECTIVE_JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'QR ticket has expired or is invalid. Please generate a new one.', expired: true });
        }

        if (ticketPayload.type !== 'QR_VOTE_TICKET') {
            return res.status(400).json({ error: 'Invalid ticket type' });
        }

        // Verify ticket belongs to the current user
        if (ticketPayload.email !== req.user.email) {
            return res.status(403).json({ error: 'This ticket does not belong to you' });
        }

        // Check database record
        const ticket = await prisma.qrVoteTicket.findUnique({
            where: { ticket_token: ticketToken }
        });

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found in records' });
        }

        if (ticket.used) {
            return res.status(400).json({ error: 'This ticket has already been used' });
        }

        if (new Date() > ticket.expires_at) {
            return res.status(401).json({ error: 'Ticket has expired', expired: true });
        }

        // Mark ticket as used
        await prisma.qrVoteTicket.update({
            where: { id: ticket.id },
            data: { used: true }
        });

        res.json({
            valid: true,
            message: 'QR ticket validated. You may proceed to vote.',
            voterId: ticketPayload.voterId,
            email: ticketPayload.email
        });
    } catch (error) {
        console.error('Validate QR ticket error:', error);
        res.status(500).json({ error: 'Failed to validate ticket' });
    }
});

// ===================== KEYSTROKE DYNAMICS =====================

// Enroll keystroke profile (during registration or first logins)
app.post('/api/v1/auth/keystroke/enroll', authLimiter, injectUser, async (req, res) => {
    try {
        const { holdTimes, flightTimes, meanSpeed, stdDeviation } = req.body;

        if (!holdTimes || !flightTimes) {
            return res.status(400).json({ error: 'Keystroke timing data is required' });
        }

        const userEmail = req.user.email;
        const MIN_SAMPLES = 3;

        // Get or create profile
        let profile = await prisma.keystrokeProfile.findUnique({ where: { user_email: userEmail } });

        if (!profile) {
            profile = await prisma.keystrokeProfile.create({
                data: {
                    user_email: userEmail,
                    hold_times: JSON.stringify(holdTimes),
                    flight_times: JSON.stringify(flightTimes),
                    mean_speed: meanSpeed || 0,
                    std_deviation: stdDeviation || 0,
                    sample_count: 1,
                    is_enrolled: false
                }
            });
        } else {
            // Average the new sample with existing data
            const existingHold = JSON.parse(profile.hold_times);
            const existingFlight = JSON.parse(profile.flight_times);
            const newCount = profile.sample_count + 1;

            const avgHold = holdTimes.map((val, i) => {
                const prev = existingHold[i] || 0;
                return ((prev * profile.sample_count) + val) / newCount;
            });

            const avgFlight = flightTimes.map((val, i) => {
                const prev = existingFlight[i] || 0;
                return ((prev * profile.sample_count) + val) / newCount;
            });

            const avgSpeed = ((profile.mean_speed * profile.sample_count) + (meanSpeed || 0)) / newCount;
            const avgStd = ((profile.std_deviation * profile.sample_count) + (stdDeviation || 0)) / newCount;

            profile = await prisma.keystrokeProfile.update({
                where: { user_email: userEmail },
                data: {
                    hold_times: JSON.stringify(avgHold),
                    flight_times: JSON.stringify(avgFlight),
                    mean_speed: avgSpeed,
                    std_deviation: avgStd,
                    sample_count: newCount,
                    is_enrolled: newCount >= MIN_SAMPLES
                }
            });
        }

        res.json({
            message: profile.is_enrolled ? 'Keystroke profile enrolled successfully' : `Sample ${profile.sample_count}/${MIN_SAMPLES} recorded`,
            isEnrolled: profile.is_enrolled,
            sampleCount: profile.sample_count,
            samplesNeeded: MIN_SAMPLES
        });
    } catch (error) {
        console.error('Keystroke enroll error:', error);
        res.status(500).json({ error: 'Failed to enroll keystroke profile' });
    }
});

// Verify keystroke pattern (during login)
app.post('/api/v1/auth/keystroke/verify', authLimiter, async (req, res) => {
    try {
        const { email, holdTimes, flightTimes, meanSpeed } = req.body;

        if (!email || !holdTimes || !flightTimes) {
            return res.status(400).json({ error: 'Email and keystroke data required' });
        }

        const profile = await prisma.keystrokeProfile.findUnique({ where: { user_email: email.trim().toLowerCase() } });

        if (!profile || !profile.is_enrolled) {
            return res.json({ verified: true, score: 0, reason: 'No enrolled profile — skipping verification', enrolled: false });
        }

        // Euclidean distance comparison
        const storedHold = JSON.parse(profile.hold_times);
        const storedFlight = JSON.parse(profile.flight_times);

        let holdDistance = 0, flightDistance = 0;
        const holdLen = Math.min(holdTimes.length, storedHold.length);
        const flightLen = Math.min(flightTimes.length, storedFlight.length);

        for (let i = 0; i < holdLen; i++) {
            holdDistance += Math.pow((holdTimes[i] - storedHold[i]), 2);
        }
        for (let i = 0; i < flightLen; i++) {
            flightDistance += Math.pow((flightTimes[i] - storedFlight[i]), 2);
        }

        const totalDistance = Math.sqrt(holdDistance + flightDistance);
        const speedDiff = Math.abs((meanSpeed || 0) - profile.mean_speed);

        // Score: 0 = perfect match, higher = suspicious
        const score = parseFloat((totalDistance + speedDiff * 10).toFixed(2));
        const THRESHOLD = 500; // Configurable threshold
        const verified = score < THRESHOLD;

        // Update profile with last verification
        await prisma.keystrokeProfile.update({
            where: { user_email: email.trim().toLowerCase() },
            data: {
                last_verified: new Date(),
                last_score: score,
                flagged_count: verified ? profile.flagged_count : profile.flagged_count + 1
            }
        });

        if (!verified) {
            console.warn(`⚠️ Keystroke mismatch for ${email} — Score: ${score} (threshold: ${THRESHOLD})`);
        }

        res.json({
            verified,
            score,
            threshold: THRESHOLD,
            enrolled: true,
            reason: verified ? 'Keystroke pattern matches enrolled profile' : 'Keystroke pattern differs significantly from enrolled profile'
        });
    } catch (error) {
        console.error('Keystroke verify error:', error);
        res.status(500).json({ error: 'Failed to verify keystroke pattern' });
    }
});

// ===================== USER ROUTES =====================

// Get current user
app.get('/api/v1/auth/me', injectUser, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                fullname: true,
                voter_id: true,
                email: true,
                wallet_address: true,
                has_voted: true,
                father_name: true,
                gender: true,
                dob: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            fullname: user.fullname,
            voterId: user.voter_id,
            email: user.email,
            hasVoted: user.has_voted,
            walletAddress: user.wallet_address,
            fatherName: user.father_name,
            gender: user.gender,
            dob: user.dob
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update User Profile
app.put('/api/v1/user/profile', injectUser, async (req, res) => {
    try {
        const { fatherName, gender, dob, address } = req.body;
        const updates = {};

        if (fatherName !== undefined) updates.father_name = sanitize(fatherName);
        if (gender !== undefined) updates.gender = sanitize(gender);
        if (dob !== undefined) updates.dob = sanitize(dob);
        if (address !== undefined) updates.address = sanitize(address);

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        await prisma.user.update({
            where: { id: req.user.id },
            data: updates
        });

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error updating profile' });
    }
});

// ===================== WALLET ROUTES =====================

app.post('/api/v1/user/link-wallet', injectUser, async (req, res) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address is required' });
        }

        await prisma.user.update({
            where: { id: req.user.id },
            data: { wallet_address: walletAddress }
        });

        res.json({ message: 'Wallet linked successfully' });
    } catch (error) {
        console.error('Link wallet error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===================== VOTE ROUTES =====================

// Record vote (after blockchain transaction) — simplified, no pre-flight token needed
app.post('/api/v1/vote/record', injectUser, async (req, res) => {
    try {
        const { txHash } = req.body;

        if (!txHash) {
            return res.status(400).json({ error: 'Transaction hash is required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, voter_id: true, has_voted: true, email: true, fullname: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.has_voted) {
            return res.status(400).json({ error: 'You have already voted' });
        }

        // Record the vote
        await prisma.$transaction([
            prisma.vote.create({
                data: {
                    voter_id: user.voter_id,
                    tx_hash: txHash
                }
            }),
            prisma.user.update({
                where: { id: req.user.id },
                data: { has_voted: true }
            })
        ]);

        // Auto-pin vote metadata to IPFS for tamper-proof receipt
        let ipfsHash = null;
        try {
            const ipfsResult = await ipfsService.pinVoteMetadata({
                commitment: txHash,
                nullifierHash: `voter-${user.voter_id}`,
                timestamp: new Date().toISOString()
            });
            ipfsHash = ipfsResult.ipfsHash;
            console.log(`📌 Vote IPFS pinned: ${ipfsHash}`);
        } catch (ipfsErr) {
            console.warn('IPFS pinning failed (non-blocking):', ipfsErr.message);
        }

        res.json({
            message: 'Vote securely recorded',
            ipfsHash: ipfsHash || null
        });
    } catch (error) {
        console.error('Record vote error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Check if user has voted
app.get('/api/v1/vote/status', injectUser, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { has_voted: true }
        });
        res.json({ hasVoted: user ? user.has_voted : false });
    } catch (error) {
        console.error('Vote status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get vote receipt
app.get('/api/v1/vote/receipt', injectUser, async (req, res) => {
    try {
        const vote = await prisma.vote.findFirst({
            where: { voter_id: req.user.voterId },
            select: {
                tx_hash: true,
                voted_at: true
            }
        });
        res.json({ vote: vote || null });
    } catch (error) {
        console.error('Vote receipt error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===================== ADMIN ROUTES =====================

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@evote.com';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

let EFFECTIVE_ADMIN_HASH;
if (ADMIN_PASSWORD_HASH) {
    EFFECTIVE_ADMIN_HASH = ADMIN_PASSWORD_HASH;
    console.log('✅ Admin credentials loaded from environment variables');
} else {
    EFFECTIVE_ADMIN_HASH = bcrypt.hashSync(process.env.ADMIN_DEV_PASSWORD || 'Admin@modern7', 10);
    console.warn('⚠️  Using development admin credentials.');
}

const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.post('/api/v1/admin/login', adminLoginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const trimmedEmail = email ? email.trim().toLowerCase() : '';
        const trimmedPassword = password ? password.trim() : '';

        if (!trimmedEmail || !trimmedPassword) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (trimmedEmail !== ADMIN_EMAIL) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        const isValidPassword = await bcrypt.compare(trimmedPassword, EFFECTIVE_ADMIN_HASH);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        const token = jwt.sign(
            { id: 0, email: email, role: 'admin' },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '8h' }
        );

        logAdminAction(trimmedEmail, 'LOGIN', 'Admin login successful', req.ip);

        res.json({
            message: 'Admin login successful',
            token,
            admin: { email, role: 'admin' }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Server error during admin login' });
    }
});

// Mount the admin router
app.use('/api/v1/admin', require('./routes/admin'));

// ===================== ZKP ROUTES =====================

app.get('/api/v1/zkp/status', apiLimiter, (req, res) => {
    res.json({
        zkpEnabled: true,
        electionId: 'bharat-evote-2026',
        features: ['pedersen-commitments', 'schnorr-proofs', 'nullifier-privacy', 'ipfs-metadata', 'erc2771-metatx']
    });
});

app.post('/api/v1/zkp/generate-commitment', zkpLimiter, injectUser, (req, res) => {
    try {
        const { candidateId } = req.body;
        if (!candidateId || candidateId < 1) {
            return res.status(400).json({ error: 'Valid candidateId is required' });
        }

        const result = zkpService.generateCommitment(candidateId);
        res.json({
            commitment: result.commitment,
            randomness: result.randomness,
            message: 'Commitment generated. Keep your randomness secret!'
        });
    } catch (error) {
        console.error('Generate commitment error:', error);
        res.status(500).json({ error: 'Failed to generate commitment' });
    }
});

app.post('/api/v1/zkp/generate-proof', zkpLimiter, injectUser, (req, res) => {
    try {
        const { candidateId, randomness, candidatesCount, commitment, nullifierHash } = req.body;

        if (!candidateId || !randomness || !candidatesCount || !commitment || !nullifierHash) {
            return res.status(400).json({ error: 'All proof parameters are required' });
        }

        if (!isValidHex(randomness) || !isValidHex(commitment) || !isValidHex(nullifierHash)) {
            return res.status(400).json({ error: 'Invalid hex format for cryptographic parameters' });
        }

        const result = zkpService.generateVoteProof(
            candidateId, randomness, candidatesCount, commitment, nullifierHash
        );
        res.json({ proof: result.proof, message: 'ZK proof generated successfully' });
    } catch (error) {
        console.error('Generate proof error:', error);
        res.status(500).json({ error: 'Failed to generate proof' });
    }
});

app.post('/api/v1/zkp/generate-nullifier', zkpLimiter, injectUser, (req, res) => {
    try {
        const { voterSecret, electionId } = req.body;

        if (!voterSecret || typeof voterSecret !== 'string') {
            return res.status(400).json({ error: 'Voter secret is required' });
        }

        const cleanElectionId = sanitize(electionId || 'bharat-evote-2026');
        const nullifier = zkpService.generateNullifier(voterSecret, cleanElectionId);
        const identity = zkpService.generateIdentityCommitment(voterSecret);

        res.json({
            nullifierHash: nullifier.nullifierHash,
            identityCommitment: identity.identityCommitment,
            message: 'Nullifier and identity commitment generated'
        });
    } catch (error) {
        console.error('Generate nullifier error:', error);
        res.status(500).json({ error: 'Failed to generate nullifier' });
    }
});

app.post('/api/v1/zkp/verify-proof', zkpLimiter, (req, res) => {
    try {
        const { commitment, nullifierHash, proof, candidatesCount } = req.body;

        if (!commitment || !nullifierHash || !proof || !candidatesCount) {
            return res.status(400).json({ error: 'All verification parameters are required' });
        }

        if (!isValidHex(commitment) || !isValidHex(nullifierHash)) {
            return res.status(400).json({ error: 'Invalid hex format for commitment or nullifier' });
        }

        if (!Array.isArray(proof) || !proof.every(p => isValidHex(p) || typeof p === 'string')) {
            return res.status(400).json({ error: 'Invalid proof format' });
        }

        const result = zkpService.verifyProof(commitment, nullifierHash, proof, candidatesCount);
        res.json({
            valid: result.valid,
            reason: result.reason || 'Proof is valid',
            message: result.valid ? 'ZK proof verified successfully' : 'ZK proof verification failed'
        });
    } catch (error) {
        console.error('Verify proof error:', error);
        res.status(500).json({ error: 'Failed to verify proof' });
    }
});

app.post('/api/v1/zkp/generate-vote-package', zkpLimiter, injectUser, (req, res) => {
    try {
        const { candidateId, voterSecret, candidatesCount, electionId } = req.body;

        if (!candidateId || !voterSecret || !candidatesCount) {
            return res.status(400).json({ error: 'candidateId, voterSecret, and candidatesCount are required' });
        }

        const cleanElectionId = sanitize(electionId || 'bharat-evote-2026');
        const votePackage = zkpService.generateVotePackage(
            candidateId, voterSecret, candidatesCount, cleanElectionId
        );

        res.json({
            ...votePackage,
            message: 'Complete ZKP vote package generated'
        });
    } catch (error) {
        console.error('Generate vote package error:', error);
        res.status(500).json({ error: 'Failed to generate vote package' });
    }
});

// ===================== IPFS ROUTES =====================

app.post('/api/v1/ipfs/pin-vote', ipfsLimiter, injectUser, async (req, res) => {
    try {
        const { commitment, nullifierHash, timestamp } = req.body;

        if (!commitment || !nullifierHash) {
            return res.status(400).json({ error: 'Commitment and nullifierHash are required' });
        }

        if (!isValidHex(commitment) || !isValidHex(nullifierHash)) {
            return res.status(400).json({ error: 'Invalid hex format for commitment or nullifier' });
        }

        const cleanTimestamp = sanitize(timestamp || new Date().toISOString());

        const result = await ipfsService.pinVoteMetadata({
            commitment,
            nullifierHash,
            timestamp: cleanTimestamp
        });

        res.json({
            ipfsHash: result.ipfsHash,
            pinSize: result.pinSize,
            message: 'Vote metadata pinned to IPFS'
        });
    } catch (error) {
        console.error('IPFS pin vote error:', error);
        res.status(500).json({ error: 'Failed to pin vote metadata' });
    }
});

app.get('/api/v1/ipfs/:hash', apiLimiter, async (req, res) => {
    try {
        const hash = req.params.hash;
        if (!isValidIPFSHash(hash)) {
            return res.status(400).json({ error: 'Invalid IPFS hash format' });
        }

        const data = await ipfsService.getFromIPFS(hash);
        res.json({ data });
    } catch (error) {
        console.error('IPFS get error:', error);
        res.status(404).json({ error: 'IPFS content not found' });
    }
});

// ===================== META-TX RELAY =====================

app.post('/api/v1/meta-tx/relay', metaTxLimiter, injectUser, async (req, res) => {
    try {
        const { request, signature } = req.body;

        if (!request || !signature) {
            return res.status(400).json({ error: 'Forward request and signature are required' });
        }

        res.json({
            message: 'Meta-transaction relay endpoint ready',
            status: 'received',
            request: {
                from: request.from,
                to: request.to,
                nonce: request.nonce
            },
            note: 'In production, this relayer submits the tx on-chain and pays gas'
        });
    } catch (error) {
        serverLog.error('Meta-tx relay error', { error: error.message });
        res.status(500).json({ error: 'Failed to relay meta-transaction' });
    }
});

// Sentry error handler
Sentry.setupExpressErrorHandler(app);

// API Error Catcher
app.use((err, req, res, next) => {
    serverLog.error('API Pipeline Fault', { error: err.message, status: err.status, path: req.path });
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Crash' });
});

// ===================== HEALTH CHECK (Keep-alive for Render free tier) =====================

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'bharat-evote-api',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()) + 's'
    });
});

app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'bharat-evote-api',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()) + 's'
    });
});

// ===================== START SERVER =====================

app.listen(PORT, () => {
    serverLog.info(`Server started on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV || 'development' });
});
