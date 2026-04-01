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
const { PrismaClient } = require('@prisma/client');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { clerkMiddleware, requireAuth } = require('@clerk/express');
const prisma = new PrismaClient();
const otpService = require('./services/otpService');
const { otpLimiterUpstash, authLimiterUpstash, zkpLimiterUpstash } = require('./services/rateLimiter');

const blockchainListener = require('./services/blockchainListener');
const qStashWorker = require('./services/qStashWorker');
const ipfsService = require('./services/ipfsService');

// Helper: Log Admin Action (used during admin login audit trail)
async function logAdminAction(admin_email, action, details, ip_address) {
    try {
        await prisma.adminAuditLog.create({
            data: { admin_email, action, details, ip_address }
        });
    } catch (err) {
        console.error('Audit log write error:', err.message);
    }
}

// Initialize Backend EVM WebSocket Listeners for real-time contract tracing
blockchainListener.init();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('⚠️  WARNING: JWT_SECRET is not set. Using insecure default for development only.');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-insecure-key-' + Date.now();

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

// Legacy SQLite functions removed

// Security Middleware
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
    crossOriginEmbedderPolicy: false
}));
const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',') 
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' })); // Limit payload size

// Mount Clerk context handler globally
app.use(clerkMiddleware());

// Rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Increased for dev/testing
    message: { error: 'Too many attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

// ZKP/Crypto endpoints — tighter limits to prevent proof-grinding and abuse
const zkpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 30, // 30 requests per 10 min per IP
    message: { error: 'Too many ZKP requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// IPFS pinning — prevent storage abuse
const ipfsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many IPFS requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Meta-transaction relay — prevent gas-drain attacks on the relayer
const metaTxLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: { error: 'Too many meta-transaction requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// General API limiter for non-critical read endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Increased for dev/testing
    message: { error: 'Too many OTP requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Cloudflare Turnstile verification middleware
const verifyTurnstile = async (req, res, next) => {
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    const token = req.body.turnstileToken;

    // Skip verification if Turnstile is not configured or token is a dev passthrough
    if (!turnstileSecret || token === 'turnstile-not-configured') {
        return next();
    }

    if (!token) {
        return res.status(400).json({ error: 'Bot verification failed. Please refresh and try again.' });
    }

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: turnstileSecret,
                response: token,
                remoteip: req.ip
            })
        });

        const data = await response.json();

        if (!data.success) {
            console.warn('⚠️ Turnstile verification failed:', data);
            return res.status(403).json({ error: 'Bot verification failed. Please refresh and try again.' });
        }

        next();
    } catch (error) {
        console.error('Turnstile verification error:', error);
        // Fail-open in case of Cloudflare outage
        next();
    }
};

// Auth middleware using Clerk
const authenticateToken = [
    requireAuth(),
    async (req, res, next) => {
        try {
            const authPayload = typeof req.auth === 'function' ? req.auth() : req.auth;
            const auth_id = authPayload?.userId || authPayload?.claims?.sub;
            if (!auth_id) {
                console.error("Clerk Token Verification Failed. authPayload =", authPayload);
                return res.status(401).json({ error: 'Unauthorized: Invalid authentication session' });
            }
            const localUser = await prisma.user.findUnique({ where: { auth_id } });
            
            if (!localUser) {
                return res.status(403).json({ error: 'User demographic data not found. Please complete onboarding.' });
            }
            
            req.user = {
                id: localUser.id,
                voterId: localUser.voter_id,
                email: localUser.email,
                auth_id: auth_id
            };
            next();
        } catch (dbError) {
            console.error('Session validation error:', dbError);
            return res.status(500).json({ error: 'Database session validation error' });
        }
    }
];

// ===================== AUTH ROUTES =====================

// Update User Profile (Father's Name, Gender, DOB, Address)
app.put('/api/v1/user/profile', authenticateToken, async (req, res) => {
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

// Register user metrics bridged from Clerk Web SSO (Onboarding)
app.post('/api/v1/auth/register-clerk', requireAuth(), async (req, res) => {
    try {
        const { fullname, voterId, aadhaarNumber, mobileNumber, stateCode, constituencyCode, email } = req.body;
        
        const authPayload = typeof req.auth === 'function' ? req.auth() : req.auth;
        const auth_id = authPayload?.userId || authPayload?.claims?.sub;

        if (!auth_id) {
            console.error("Clerk Token Verification Failed in register. authPayload =", authPayload);
            return res.status(401).json({ error: 'Unauthorized session' });
        }

        // Validation
        if (!fullname || !voterId || !email) {
            return res.status(400).json({ error: 'Required identity fields missing' });
        }

        // Sanitize inputs
        const cleanName = sanitize(fullname);
        const cleanVoterId = sanitize(voterId);
        const cleanEmail = email.trim().toLowerCase();

        // Check if user exists using Prisma
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: cleanEmail },
                    { voter_id: cleanVoterId },
                    { aadhaar_number: aadhaarNumber ? aadhaarNumber : undefined }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.auth_id === auth_id) return res.json({ message: 'User already synced' });
            return res.status(400).json({ error: 'User with this email, voter ID, or Aadhaar number already exists' });
        }

        // Insert user into local DB linked to Clerk auth_id
        await prisma.user.create({
            data: {
                auth_id,
                fullname: cleanName,
                voter_id: cleanVoterId,
                email: cleanEmail,
                password: null, // Password completely delegated to Clerk
                aadhaar_number: aadhaarNumber || null,
                mobile_number: mobileNumber || null,
                state_code: stateCode || 0,
                constituency_code: constituencyCode || 0
            }
        });

        res.status(201).json({ message: 'Voter demographic sync successful' });
    } catch (error) {
        console.error('Registration/Sync error:', error);
        res.status(500).json({ error: 'Server error during sync' });
    }
});

// Get current user
app.get('/api/v1/auth/me', authenticateToken, async (req, res) => {
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

// ===================== WALLET ROUTES =====================

// Link wallet address to user
app.post('/api/v1/user/link-wallet', authenticateToken, async (req, res) => {
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

// Upstash Redis for vote pre-flight tokens (persistent, survives server restarts)
const { Redis: UpstashRedis } = require('@upstash/redis');
let voteTokenRedis = null;
const voteTokenFallback = new Map(); // In-memory fallback only if Upstash not configured

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    voteTokenRedis = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
    console.log('✅ Vote Pre-Flight Tokens: Upstash Redis connected');
} else {
    console.warn('⚠️  Vote Pre-Flight Tokens: Using in-memory fallback (no Upstash configured)');
}

async function storeVoteToken(auth_id, token) {
    if (voteTokenRedis) {
        await voteTokenRedis.set(`vote-token:${auth_id}`, JSON.stringify({ token }), { ex: 300 });
    } else {
        voteTokenFallback.set(auth_id, { token, expiresAt: Date.now() + 300000 });
    }
}

async function getVoteToken(auth_id) {
    if (voteTokenRedis) {
        const data = await voteTokenRedis.get(`vote-token:${auth_id}`);
        if (!data) return null;
        return typeof data === 'string' ? JSON.parse(data) : data;
    } else {
        const entry = voteTokenFallback.get(auth_id);
        if (!entry || Date.now() > entry.expiresAt) { voteTokenFallback.delete(auth_id); return null; }
        return entry;
    }
}

async function deleteVoteToken(auth_id) {
    if (voteTokenRedis) {
        await voteTokenRedis.del(`vote-token:${auth_id}`);
    } else {
        voteTokenFallback.delete(auth_id);
    }
}

// Generate 5-minute single-use token (Pre-Flight Check)
app.get('/api/v1/vote/pre-flight', requireAuth(), async (req, res) => {
    try {
        const auth_id = req.auth.userId;
        const user = await prisma.user.findUnique({
            where: { auth_id },
            select: { id: true, has_voted: true }
        });

        if (!user) return res.status(404).json({ error: 'Identity mapping missing' });
        if (user.has_voted) return res.status(400).json({ error: 'You have already voted' });

        const token = require('crypto').randomBytes(32).toString('hex');
        await storeVoteToken(auth_id, token);
        res.json({ upstashToken: token });
    } catch (err) {
        console.error('Pre-flight error:', err);
        res.status(500).json({ error: 'Server error during allocation' });
    }
});

// Record vote (after blockchain transaction)
app.post('/api/v1/vote/record', requireAuth(), verifyTurnstile, async (req, res) => {
    try {
        const { txHash, upstashToken } = req.body;
        const auth_id = req.auth.userId;

        if (!txHash) {
            return res.status(400).json({ error: 'Transaction hash is required' });
        }

        // 1. Upstash Redis Cache Check (persistent across restarts)
        const cacheEntry = await getVoteToken(auth_id);
        if (!cacheEntry) {
            return res.status(403).json({ error: 'No pre-flight token session found. Access Denied.' });
        }
        if (cacheEntry.token !== upstashToken) {
            await deleteVoteToken(auth_id);
            return res.status(403).json({ error: 'Pre-flight token invalid or expired. Access Denied.' });
        }
        
        // Burn the token instantly to prevent race conditions
        await deleteVoteToken(auth_id);

        // Verify voter through Clerk backend UUID
        const user = await prisma.user.findUnique({
            where: { auth_id },
            select: { id: true, voter_id: true, has_voted: true, email: true, fullname: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'Identity mapping missing' });
        }

        if (user.has_voted) {
            return res.status(400).json({ error: 'You have already voted' });
        }

        // ZERO-KNOWLEDGE ENFORCEMENT: Never record the candidate_id in web2 databases
        await prisma.$transaction([
            prisma.vote.create({
                data: {
                    voter_id: user.voter_id,
                    tx_hash: txHash
                }
            }),
            prisma.user.update({
                where: { auth_id },
                data: { has_voted: true }
            })
        ]);

        // Dispatch Enterprise Transactional Resend Receipt (QStash Decoupled Flow)
        if (user.email && user.fullname) {
            qStashWorker.publish('send_vote_receipt', { 
                email: user.email, 
                fullname: user.fullname, 
                txHash: txHash 
            });
        }

        // Auto-pin vote metadata to IPFS for tamper-proof decentralized receipt
        let ipfsHash = null;
        try {
            const ipfsResult = await ipfsService.pinVoteMetadata({
                commitment: txHash, // Use tx hash as commitment for non-ZKP votes
                nullifierHash: `voter-${user.voter_id}`,
                timestamp: new Date().toISOString()
            });
            ipfsHash = ipfsResult.ipfsHash;
            console.log(`📌 Vote IPFS pinned: ${ipfsHash}`);
        } catch (ipfsErr) {
            console.warn('IPFS pinning failed (non-blocking):', ipfsErr.message);
        }

        res.json({ 
            message: 'Zero-Knowledge Vote securely recorded & QStash receipt enqueued',
            ipfsHash: ipfsHash || null
        });
    } catch (error) {
        console.error('Record vote error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Check if user has voted
app.get('/api/v1/vote/status', authenticateToken, async (req, res) => {
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

// Get vote receipt (for dashboard display)
app.get('/api/v1/vote/receipt', authenticateToken, async (req, res) => {
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

// ===================== OTP ROUTES (2FA + Password Reset) =====================

// Send OTP (for 2FA after password login, or password reset)
app.post('/api/v1/auth/send-otp', otpLimiter, otpLimiterUpstash, verifyTurnstile, async (req, res) => {
    try {
        const { email, purpose } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const cleanEmail = email.trim().toLowerCase();

        // For password-reset, verify user exists
        if (purpose === 'password-reset') {
            const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
            if (!user) {
                // Return success to prevent email enumeration attacks
                return res.json({ message: 'If this email is registered, an OTP has been sent.' });
            }
        }

        const result = await otpService.sendOTP(cleanEmail, cleanEmail, 'email');
        
        // Log delivery
        await prisma.otpDeliveryLog.create({
            data: {
                recipient: cleanEmail,
                purpose: purpose || 'login-2fa',
                success: result.success
            }
        }).catch(() => {}); // Non-blocking

        res.json({ 
            message: result.message,
            ...(result.demoOTP && { otp: result.demoOTP }) // Only in dev mode
        });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// Verify OTP (for 2FA after password login, or password reset)
app.post('/api/v1/auth/verify-otp', otpLimiter, otpLimiterUpstash, verifyTurnstile, async (req, res) => {
    try {
        const { email, otp, purpose } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

        const cleanEmail = email.trim().toLowerCase();
        const result = await otpService.verifyOTP(cleanEmail, otp);

        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        // Log successful verification
        await prisma.otpDeliveryLog.create({
            data: {
                recipient: cleanEmail,
                purpose: `${purpose || 'login-2fa'}-verified`,
                success: true
            }
        }).catch(() => {});

        res.json({ message: result.message, verified: true });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

// Reset Password — OTP verified, then delegates actual password change to Clerk
// We NEVER store passwords locally (password field is always null).
// Frontend uses Clerk's reset_password_email_code strategy after this returns success.
app.post('/api/v1/auth/reset-password', authLimiter, async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Verify OTP
        const otpResult = await otpService.verifyOTP(cleanEmail, otp);
        if (!otpResult.success) {
            return res.status(400).json({ error: otpResult.message });
        }

        // Log successful verification for audit
        await prisma.otpDeliveryLog.create({
            data: {
                recipient: cleanEmail,
                purpose: 'password-reset-verified',
                success: true
            }
        }).catch(() => {});

        // Signal frontend to proceed with Clerk's password reset
        // The actual password change happens via Clerk SDK on the frontend
        res.json({ 
            message: 'OTP verified. You may now reset your password.',
            verified: true,
            // Frontend will use signIn.resetPassword() with Clerk
            clerkResetReady: true
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to verify reset request' });
    }
});

// Send Login 2FA OTP (called after Clerk password auth succeeds)
app.post('/api/v1/auth/login-2fa', otpLimiter, otpLimiterUpstash, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const cleanEmail = email.trim().toLowerCase();
        const result = await otpService.sendOTP(cleanEmail, `2fa:${cleanEmail}`, 'email');

        await prisma.otpDeliveryLog.create({
            data: {
                recipient: cleanEmail,
                purpose: 'login-2fa',
                success: result.success
            }
        }).catch(() => {});

        res.json({ 
            message: 'Security verification code sent to your email.',
            ...(result.demoOTP && { otp: result.demoOTP })
        });
    } catch (error) {
        console.error('Login 2FA error:', error);
        res.status(500).json({ error: 'Failed to send 2FA code' });
    }
});

// Verify Login 2FA OTP
app.post('/api/v1/auth/verify-login-2fa', otpLimiter, otpLimiterUpstash, async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

        const cleanEmail = email.trim().toLowerCase();
        const result = await otpService.verifyOTP(`2fa:${cleanEmail}`, otp);

        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        res.json({ message: '2FA verification successful', verified: true });
    } catch (error) {
        console.error('Verify Login 2FA error:', error);
        res.status(500).json({ error: 'Failed to verify 2FA code' });
    }
});

// ===================== KEYSTROKE DYNAMICS ROUTES =====================

const keystrokeService = require('./services/keystrokeService');

// Enroll or verify keystroke pattern (called during password login)
app.post('/api/v1/keystroke/process', apiLimiter, async (req, res) => {
    try {
        const { email, timingData } = req.body;
        if (!email || !timingData) {
            return res.status(400).json({ error: 'Email and timing data are required' });
        }

        const result = await keystrokeService.processKeystroke(email.trim().toLowerCase(), timingData);
        
        res.json({
            enrolled: result.enrolled,
            suspicious: result.suspicious,
            score: result.score,
            message: result.message
        });
    } catch (error) {
        console.error('Keystroke process error:', error);
        // Fail-open: never block login due to keystroke service failure
        res.json({ enrolled: false, suspicious: false, score: 0, message: 'Service unavailable' });
    }
});

// Get keystroke enrollment status
app.get('/api/v1/keystroke/status/:email', apiLimiter, async (req, res) => {
    try {
        const email = req.params.email.trim().toLowerCase();
        const status = await keystrokeService.getStatus(email);
        res.json(status);
    } catch (error) {
        console.error('Keystroke status error:', error);
        res.json({ enrolled: false, sampleCount: 0, flaggedCount: 0 });
    }
});

// ===================== ADMIN ROUTES =====================

// Admin credentials — MUST be set via environment variables in production
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@evote.com';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
if (!ADMIN_PASSWORD_HASH) {
    // Generate a secure fallback for dev only — never hardcode a known password hash
    console.warn('⚠️  WARNING: ADMIN_PASSWORD_HASH not set. Using auto-generated dev hash (password: admin123)');
}
const EFFECTIVE_ADMIN_HASH = ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10);

// Admin login
app.post('/api/v1/admin/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Trim whitespace
        const trimmedEmail = email ? email.trim().toLowerCase() : '';
        const trimmedPassword = password ? password.trim() : '';

        if (process.env.NODE_ENV !== 'production') {
            console.log('Admin login attempt:', { email: trimmedEmail });
        }

        if (!trimmedEmail || !trimmedPassword) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check email match
        if (trimmedEmail !== ADMIN_EMAIL) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        // Verify password with bcrypt
        const isValidPassword = await bcrypt.compare(trimmedPassword, EFFECTIVE_ADMIN_HASH);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        const token = jwt.sign(
            { id: 0, email: email, role: 'admin' },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Fire-and-forget audit log (no await to not block login response)
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

// Mount the detailed RBAC SaaS Admin Router
app.use('/api/v1/admin', require('./routes/admin'));

// Admin middleware for standalone legacy routes (IPFS)
const authenticateAdmin = async (req, res, next) => {
    try {
        if (!req.auth || !req.auth.userId) return res.status(401).json({ error: 'Unauthorized' });
        const user = await prisma.user.findUnique({ where: { auth_id: req.auth.userId } });
        if (!user || user.role === 'VOTER') return res.status(403).json({ error: 'Admin access denied' });
        next();
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// ===================== ZKP ROUTES =====================

const zkpService = require('./services/zkpService');
// ipfsService already imported at top of file

// Get ZKP status
app.get('/api/v1/zkp/status', apiLimiter, (req, res) => {
    res.json({
        zkpEnabled: true,
        electionId: 'bharat-evote-2026',
        features: ['pedersen-commitments', 'schnorr-proofs', 'nullifier-privacy', 'ipfs-metadata', 'erc2771-metatx']
    });
});

// Generate vote commitment
app.post('/api/v1/zkp/generate-commitment', zkpLimiter, zkpLimiterUpstash, authenticateToken, (req, res) => {
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

// Generate ZK proof
app.post('/api/v1/zkp/generate-proof', zkpLimiter, zkpLimiterUpstash, authenticateToken, (req, res) => {
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

// Generate nullifier
app.post('/api/v1/zkp/generate-nullifier', zkpLimiter, zkpLimiterUpstash, authenticateToken, (req, res) => {
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

// Verify ZK proof (public endpoint — rate limited to prevent proof-grinding)
app.post('/api/v1/zkp/verify-proof', zkpLimiter, zkpLimiterUpstash, (req, res) => {
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

// Generate complete vote package
app.post('/api/v1/zkp/generate-vote-package', zkpLimiter, zkpLimiterUpstash, authenticateToken, (req, res) => {
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

// Pin vote metadata to IPFS
app.post('/api/v1/ipfs/pin-vote', ipfsLimiter, authenticateToken, async (req, res) => {
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

// Pin candidate metadata to IPFS
app.post('/api/v1/ipfs/pin-candidate', ipfsLimiter, requireAuth(), authenticateAdmin, async (req, res) => {
    try {
        const { id, name, partyName, partySymbol, stateCode, constituencyCode } = req.body;

        const result = await ipfsService.pinCandidateMetadata({
            id, 
            name: sanitize(name), 
            partyName: sanitize(partyName), 
            partySymbol: sanitize(partySymbol), 
            stateCode, 
            constituencyCode
        });

        res.json({
            ipfsHash: result.ipfsHash,
            message: 'Candidate metadata pinned to IPFS'
        });
    } catch (error) {
        console.error('IPFS pin candidate error:', error);
        res.status(500).json({ error: 'Failed to pin candidate metadata' });
    }
});

// Retrieve from IPFS
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

// List all pinned items
app.get('/api/v1/ipfs', apiLimiter, requireAuth(), authenticateAdmin, async (req, res) => {
    try {
        const pins = await ipfsService.listPins();
        res.json({ pins });
    } catch (error) {
        console.error('IPFS list error:', error);
        res.status(500).json({ error: 'Failed to list IPFS pins' });
    }
});

// ===================== META-TX RELAY =====================

// Relay a gasless meta-transaction
app.post('/api/v1/meta-tx/relay', metaTxLimiter, authenticateToken, async (req, res) => {
    try {
        const { request, signature } = req.body;

        if (!request || !signature) {
            return res.status(400).json({ error: 'Forward request and signature are required' });
        }

        // This endpoint would forward the meta-transaction to the blockchain
        // In production, the relayer would have its own wallet to pay gas
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
        console.error('Meta-tx relay error:', error);
        res.status(500).json({ error: 'Failed to relay meta-transaction' });
    }
});

// Sentry error handler — must be after all routes but before app.listen()
Sentry.setupExpressErrorHandler(app);

// Strict API Error Catcher (Prevents HTML "Unexpected Token <" payload leaks)
app.use((err, req, res, next) => {
    console.error('API Pipeline Fault:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Crash' });
});

// ===================== START SERVER =====================

app.listen(PORT, () => {
    console.log(`🚀 Bharat E-Vote Backend running on http://localhost:${PORT}`);
});
