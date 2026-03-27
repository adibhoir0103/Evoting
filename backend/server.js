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
const otpService = require('./services/otpService');
const { otpLimiterUpstash, authLimiterUpstash } = require('./services/rateLimiter');

const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

// Initialize Supabase Admin Client
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in backend/.env for Auth.');
} else {
    // Admin client (bypasses RLS strictly for backend provisioning)
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

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

// Auth middleware using Supabase
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Connect Supabase Auth Identity with Local Data Structure
    try {
        const localUser = await prisma.user.findUnique({ where: { email: data.user.email } });
        if (!localUser) return res.status(403).json({ error: 'User demographic data not found' });
        
        req.user = {
            id: localUser.id,
            voterId: localUser.voter_id,
            email: localUser.email,
            auth_id: data.user.id
        };
        next();
    } catch (dbError) {
        console.error('Session validation error:', dbError);
        return res.status(500).json({ error: 'Database session validation error' });
    }
};

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

// Register new user
app.post('/api/v1/auth/register', authLimiter, async (req, res) => {
    try {
        const { fullname, voterId, email, password, aadhaarNumber, mobileNumber, stateCode, constituencyCode } = req.body;

        // Validation
        if (!fullname || !voterId || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Strong password policy
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Password must include uppercase, lowercase, and a number' });
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
            return res.status(400).json({ error: 'User with this email, voter ID, or Aadhaar number already exists' });
        }

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
                fullname: cleanName,
                voter_id: cleanVoterId
            }
        });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        // Insert user into local DB
        await prisma.user.create({
            data: {
                fullname: cleanName,
                voter_id: cleanVoterId,
                email: cleanEmail,
                password: null, // Password handled by Supabase
                aadhaar_number: aadhaarNumber || null,
                mobile_number: mobileNumber || null,
                state_code: stateCode || 0,
                constituency_code: constituencyCode || 0
            }
        });

        res.status(201).json({
            message: 'Registration successful'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/v1/auth/login', authLimiter, async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Email/Voter ID and password are required' });
        }

        let emailToLogin = identifier;
        
        // If identifier is not an email (e.g. voter_id), find the email from Prisma
        if (!identifier.includes('@')) {
            const userLookup = await prisma.user.findFirst({ where: { voter_id: identifier }, select: { email: true }});
            if (!userLookup) return res.status(401).json({ error: 'Invalid credentials' });
            emailToLogin = userLookup.email;
        }

        // Authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: emailToLogin,
            password: password,
        });

        if (authError || !authData.session) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Fetch local demographic profile
        const user = await prisma.user.findUnique({
            where: { email: emailToLogin }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = authData.session.access_token;

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                fullname: user.fullname,
                voterId: user.voter_id,
                email: user.email,
                hasVoted: user.has_voted,
                walletAddress: user.wallet_address,
                fatherName: user.father_name,
                gender: user.gender,
                dob: user.dob
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
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

// Record vote (after blockchain transaction)
app.post('/api/v1/vote/record', authenticateToken, async (req, res) => {
    try {
        const { candidateId, txHash } = req.body;

        if (!candidateId) {
            return res.status(400).json({ error: 'Candidate ID is required' });
        }

        // Check if already voted
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { has_voted: true }
        });
        
        if (user && user.has_voted) {
            return res.status(400).json({ error: 'You have already voted' });
        }

        // Use Prisma transaction to ensure both operations succeed or fail together
        await prisma.$transaction([
            prisma.vote.create({
                data: {
                    voter_id: req.user.voterId,
                    candidate_id: candidateId,
                    tx_hash: txHash || null
                }
            }),
            prisma.user.update({
                where: { id: req.user.id },
                data: { has_voted: true }
            })
        ]);

        res.json({ message: 'Vote recorded successfully' });
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
                candidate_id: true,
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

// ===================== AADHAAR OTP ROUTES =====================

// Send OTP via email or mobile
app.post('/api/v1/auth/send-otp', otpLimiter, otpLimiterUpstash, verifyTurnstile, async (req, res) => {
    try {
        const { aadhaarNumber, email, mobileNumber, method = 'email' } = req.body;
        console.log('DEBUG: Received OTP Request:', { aadhaarNumber, email, mobileNumber, method });

        if (!aadhaarNumber) {
            return res.status(400).json({ error: 'Aadhaar number is required' });
        }

        // Validate Aadhaar format (12 digits)
        if (!/^\d{12}$/.test(aadhaarNumber)) {
            return res.status(400).json({ error: 'Invalid Aadhaar number format' });
        }

        // Check if user exists with this Aadhaar
        const user = await prisma.user.findFirst({
            where: { aadhaar_number: aadhaarNumber },
            select: { id: true, fullname: true, aadhaar_number: true, email: true, mobile_number: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'No account found with this Aadhaar number. Please register first.' });
        }

        // Determine which method to use and validate recipient
        let recipient;
        if (method === 'email') {
            // Use email from request or fallback to user's registered email
            recipient = email || user.email;
            if (!recipient) {
                return res.status(400).json({ error: 'Email is required for email OTP method' });
            }

            // Verify email matches (if provided in request)
            if (email && user.email !== email) {
                return res.status(400).json({ error: 'Email does not match our records' });
            }
        } else {
            // Use mobile from request or fallback to user's registered mobile
            recipient = mobileNumber || user.mobile_number;
            if (!recipient) {
                return res.status(400).json({ error: 'Mobile number is required for mobile OTP method' });
            }

            // Validate mobile format (10 digits)
            if (!/^\d{10}$/.test(recipient)) {
                return res.status(400).json({ error: 'Invalid mobile number format' });
            }

            // Verify mobile number matches (if provided in request)
            if (mobileNumber && user.mobile_number !== mobileNumber) {
                return res.status(400).json({ error: 'Mobile number does not match our records' });
            }
        }

        // Send OTP via Supabase
        const { data, error } = await supabase.auth.signInWithOtp({
            email: recipient
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({
            message: `OTP securely sent via Supabase to ${method}`,
            method: method
        });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Server error while sending OTP' });
    }
});

// Verify OTP and login
app.post('/api/v1/auth/verify-otp', authLimiter, authLimiterUpstash, async (req, res) => {
    try {
        const { aadhaarNumber, otp } = req.body;

        if (!aadhaarNumber || !otp) {
            return res.status(400).json({ error: 'Aadhaar number and OTP are required' });
        }

        // Find user to map Aadhaar to Email
        const user = await prisma.user.findFirst({
            where: { aadhaar_number: aadhaarNumber }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify OTP via Supabase
        const { data: authData, error: authError } = await supabase.auth.verifyOtp({
            email: user.email,
            token: otp,
            type: 'email'
        });

        if (authError || !authData?.session) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        res.json({
            message: 'OTP verified. Login successful!',
            token: authData.session.access_token,
            user: {
                id: user.id,
                fullname: user.fullname,
                voterId: user.voter_id,
                email: user.email,
                hasVoted: user.has_voted,
                walletAddress: user.wallet_address
            }
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Server error during OTP verification' });
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

// Admin middleware
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Admin access token required' });
    }

    jwt.verify(token, EFFECTIVE_JWT_SECRET, (err, decoded) => {
        if (err || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access denied' });
        }
        req.admin = decoded;
        next();
    });
};

// Get all registered users (Admin only)
app.get('/api/v1/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true, fullname: true, voter_id: true, email: true,
                aadhaar_number: true, mobile_number: true, wallet_address: true,
                state_code: true, constituency_code: true, has_voted: true, created_at: true
            }
        });
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all votes (Admin only)
app.get('/api/v1/admin/votes', authenticateAdmin, async (req, res) => {
    try {
        const votes = await prisma.vote.findMany();
        res.json({ votes });
    } catch (error) {
        console.error('Get votes error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get statistics (Admin only)
app.get('/api/v1/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const totalUsers = await prisma.user.count();
        const votedUsers = await prisma.user.count({ where: { has_voted: true } });
        const totalVotes = await prisma.vote.count();

        res.json({
            totalUsers,
            votedUsers,
            totalVotes,
            votingPercentage: totalUsers > 0 ? ((votedUsers / totalUsers) * 100).toFixed(1) : 0
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper: Log admin action
async function logAdminAction(adminEmail, action, details, ip) {
    try {
        await prisma.adminAuditLog.create({
            data: {
                admin_email: adminEmail,
                action: action,
                details: details || '',
                ip_address: ip || 'unknown'
            }
        });
    } catch (e) {
        console.error('Audit log error:', e);
    }
}

// Get admin audit log
app.get('/api/v1/admin/audit-log', authenticateAdmin, async (req, res) => {
    try {
        const logs = await prisma.adminAuditLog.findMany({
            orderBy: { created_at: 'desc' },
            take: 100
        });
        res.json({ logs });
    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===================== ZKP ROUTES =====================

const zkpService = require('./services/zkpService');
const ipfsService = require('./services/ipfsService');

// Get ZKP status
app.get('/api/v1/zkp/status', apiLimiter, (req, res) => {
    res.json({
        zkpEnabled: true,
        electionId: 'bharat-evote-2026',
        features: ['pedersen-commitments', 'schnorr-proofs', 'nullifier-privacy', 'ipfs-metadata', 'erc2771-metatx']
    });
});

// Generate vote commitment
app.post('/api/v1/zkp/generate-commitment', zkpLimiter, authenticateToken, (req, res) => {
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
app.post('/api/v1/zkp/generate-proof', zkpLimiter, authenticateToken, (req, res) => {
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
app.post('/api/v1/zkp/generate-nullifier', zkpLimiter, authenticateToken, (req, res) => {
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

// Generate complete vote package
app.post('/api/v1/zkp/generate-vote-package', zkpLimiter, authenticateToken, (req, res) => {
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
app.post('/api/v1/ipfs/pin-candidate', ipfsLimiter, authenticateAdmin, async (req, res) => {
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
app.get('/api/v1/ipfs', apiLimiter, authenticateAdmin, async (req, res) => {
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

// ===================== START SERVER =====================

app.listen(PORT, () => {
    console.log(`🚀 Bharat E-Vote Backend running on http://localhost:${PORT}`);
});
