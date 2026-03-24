require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const otpService = require('./services/otpService');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('⚠️  WARNING: JWT_SECRET is not set. Using insecure default for development only.');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-insecure-key-' + Date.now();
const DB_PATH = path.join(__dirname, 'evoting.db');

let db = null;

// Helper: Safe parameterized SELECT query (prevents SQL injection)
function safeQuery(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

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

// Initialize SQLite database
async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create new
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
        console.log('✅ Database loaded from file');
    } else {
        db = new SQL.Database();
        console.log('✅ New database created');
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullname TEXT NOT NULL,
            voter_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT,
            aadhaar_number TEXT UNIQUE,
            mobile_number TEXT,
            wallet_address TEXT,
            has_voted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            voter_id TEXT NOT NULL,
            candidate_id INTEGER NOT NULL,
            tx_hash TEXT,
            voted_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migration: Add father_name column if it doesn't exist
    try {
        db.run("ALTER TABLE users ADD COLUMN father_name TEXT");
        console.log('✅ Migration: Added father_name column');
    } catch (err) {
        // Column likely exists
    }

    // Migration: Add gender and dob columns if they don't exist (future proofing)
    try { db.run("ALTER TABLE users ADD COLUMN gender TEXT"); } catch (e) { }
    try { db.run("ALTER TABLE users ADD COLUMN dob TEXT"); } catch (e) { }

    // Migration: Add state_code and constituency_code for constituency-based voting
    try { db.run("ALTER TABLE users ADD COLUMN state_code INTEGER DEFAULT 0"); console.log('✅ Migration: Added state_code column'); } catch (e) { }
    try { db.run("ALTER TABLE users ADD COLUMN constituency_code INTEGER DEFAULT 0"); console.log('✅ Migration: Added constituency_code column'); } catch (e) { }

    saveDatabase();
    console.log('✅ Tables initialized');
}

// Save database to file
function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Increased for dev/testing
    message: { error: 'Too many OTP requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, EFFECTIVE_JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ===================== AUTH ROUTES =====================

// Update User Profile (Father's Name, Gender, DOB, Address)
app.put('/api/user/profile', authenticateToken, (req, res) => {
    try {
        const { fatherName, gender, dob, address } = req.body;
        const updates = [];
        const params = [];

        if (fatherName !== undefined) {
            updates.push("father_name = ?");
            params.push(sanitize(fatherName));
        }
        if (gender !== undefined) {
            updates.push("gender = ?");
            params.push(sanitize(gender));
        }
        if (dob !== undefined) {
            updates.push("dob = ?");
            params.push(sanitize(dob));
        }
        if (address !== undefined) {
            updates.push("address = ?");
            params.push(sanitize(address));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(req.user.id);
        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

        db.run(sql, params);
        saveDatabase();

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error updating profile' });
    }
});

// Register new user
app.post('/api/auth/register', authLimiter, async (req, res) => {
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

        // Check if user exists (parameterized to prevent SQL injection)
        const existingUser = safeQuery(
            'SELECT id FROM users WHERE email = ? OR voter_id = ? OR (aadhaar_number IS NOT NULL AND aadhaar_number = ?)',
            [cleanEmail, cleanVoterId, aadhaarNumber || '']
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'User with this email, voter ID, or Aadhaar number already exists' });
        }

        // Hash password (optional for Aadhaar-only users)
        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

        // Insert user with constituency info
        db.run(
            `INSERT INTO users (fullname, voter_id, email, password, aadhaar_number, mobile_number, state_code, constituency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [cleanName, cleanVoterId, cleanEmail, hashedPassword, aadhaarNumber || null, mobileNumber || null, stateCode || 0, constituencyCode || 0]
        );
        saveDatabase();

        res.status(201).json({
            message: 'Registration successful'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Email/Voter ID and password are required' });
        }

        // Find user by email or voter_id (parameterized to prevent SQL injection)
        const results = safeQuery(
            'SELECT * FROM users WHERE email = ? OR voter_id = ?',
            [identifier, identifier]
        );

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = results[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, voterId: user.voter_id, email: user.email },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '4h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                fullname: user.fullname,
                voterId: user.voter_id,
                email: user.email,
                hasVoted: user.has_voted === 1,
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
app.get('/api/auth/me', authenticateToken, (req, res) => {
    try {
        const results = safeQuery(
            'SELECT id, fullname, voter_id, email, wallet_address, has_voted, father_name, gender, dob FROM users WHERE id = ?',
            [req.user.id]
        );

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = results[0];

        res.json({
            id: user.id,
            fullname: user.fullname,
            voterId: user.voter_id,
            email: user.email,
            hasVoted: user.has_voted === 1,
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
app.post('/api/user/link-wallet', authenticateToken, (req, res) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address is required' });
        }

        db.run(`UPDATE users SET wallet_address = ? WHERE id = ?`, [walletAddress, req.user.id]);
        saveDatabase();

        res.json({ message: 'Wallet linked successfully' });
    } catch (error) {
        console.error('Link wallet error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===================== VOTE ROUTES =====================

// Record vote (after blockchain transaction)
app.post('/api/vote/record', authenticateToken, (req, res) => {
    try {
        const { candidateId, txHash } = req.body;

        if (!candidateId) {
            return res.status(400).json({ error: 'Candidate ID is required' });
        }

        // Check if already voted (parameterized)
        const userResult = safeQuery('SELECT has_voted FROM users WHERE id = ?', [req.user.id]);
        if (userResult.length > 0 && userResult[0].has_voted === 1) {
            return res.status(400).json({ error: 'You have already voted' });
        }

        // Record vote
        db.run(
            `INSERT INTO votes (voter_id, candidate_id, tx_hash) VALUES (?, ?, ?)`,
            [req.user.voterId, candidateId, txHash || null]
        );

        // Update user status
        db.run(`UPDATE users SET has_voted = 1 WHERE id = ?`, [req.user.id]);
        saveDatabase();

        res.json({ message: 'Vote recorded successfully' });
    } catch (error) {
        console.error('Record vote error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Check if user has voted
app.get('/api/vote/status', authenticateToken, (req, res) => {
    try {
        const results = safeQuery('SELECT has_voted FROM users WHERE id = ?', [req.user.id]);
        const hasVoted = results.length > 0 && results[0].has_voted === 1;
        res.json({ hasVoted });
    } catch (error) {
        console.error('Vote status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get vote receipt (for dashboard display)
app.get('/api/vote/receipt', authenticateToken, (req, res) => {
    try {
        const results = safeQuery(
            'SELECT candidate_id, tx_hash, voted_at FROM votes WHERE voter_id = ?',
            [req.user.voterId]
        );
        res.json({ vote: results.length > 0 ? results[0] : null });
    } catch (error) {
        console.error('Vote receipt error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===================== AADHAAR OTP ROUTES =====================

// Send OTP via email or mobile
app.post('/api/auth/send-otp', otpLimiter, async (req, res) => {
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

        // Check if user exists with this Aadhaar (parameterized)
        const results = safeQuery(
            'SELECT id, fullname, aadhaar_number, email, mobile_number FROM users WHERE aadhaar_number = ?',
            [aadhaarNumber]
        );

        if (results.length === 0) {
            return res.status(404).json({ error: 'No account found with this Aadhaar number. Please register first.' });
        }

        const user = results[0];

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

        // Send OTP
        const otpResult = await otpService.sendOTP(recipient, aadhaarNumber, method, user.fullname);

        res.json({
            message: otpResult.message,
            method: otpResult.method,
            // Only include demo OTP in development mode
            ...(process.env.NODE_ENV !== 'production' && { demoOTP: otpResult.demoOTP })
        });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Server error while sending OTP' });
    }
});

// Verify OTP and login
app.post('/api/auth/verify-otp', authLimiter, async (req, res) => {
    try {
        const { aadhaarNumber, otp } = req.body;

        if (!aadhaarNumber || !otp) {
            return res.status(400).json({ error: 'Aadhaar number and OTP are required' });
        }

        // Verify OTP
        const verifyResult = otpService.verifyOTP(aadhaarNumber, otp);

        if (!verifyResult.success) {
            return res.status(400).json({ error: verifyResult.message });
        }

        // Get user details (parameterized)
        const results = safeQuery(
            'SELECT * FROM users WHERE aadhaar_number = ?',
            [aadhaarNumber]
        );

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = results[0];

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, voterId: user.voter_id, email: user.email },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '4h' }
        );

        res.json({
            message: 'OTP verified. Login successful!',
            token,
            user: {
                id: user.id,
                fullname: user.fullname,
                voterId: user.voter_id,
                email: user.email,
                hasVoted: user.has_voted === 1,
                walletAddress: user.wallet_address
            }
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Server error during OTP verification' });
    }
});

// ===================== ADMIN ROUTES =====================

// Admin credentials (use env vars in production)
// Default password: 'admin123' — hashed with bcrypt (10 rounds)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@evote.com';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$Kt0pL8Whn56ONQcrVNJNiOvGqmaPl6lDurpEoWOKd8QK21AU8y0dS';

// Admin login
app.post('/api/admin/login', authLimiter, async (req, res) => {
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
        const isValidPassword = await bcrypt.compare(trimmedPassword, ADMIN_PASSWORD_HASH);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        const token = jwt.sign(
            { id: 0, email: email, role: 'admin' },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '8h' }
        );

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
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
    try {
        const result = db.exec('SELECT id, fullname, voter_id, email, aadhaar_number, mobile_number, wallet_address, state_code, constituency_code, has_voted, created_at FROM users');

        if (result.length === 0) {
            return res.json({ users: [] });
        }

        const columns = result[0].columns;
        const users = result[0].values.map(row => {
            const user = {};
            columns.forEach((col, idx) => user[col] = row[idx]);
            return user;
        });

        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all votes (Admin only)
app.get('/api/admin/votes', authenticateAdmin, (req, res) => {
    try {
        const result = db.exec('SELECT * FROM votes');

        if (result.length === 0) {
            return res.json({ votes: [] });
        }

        const columns = result[0].columns;
        const votes = result[0].values.map(row => {
            const vote = {};
            columns.forEach((col, idx) => vote[col] = row[idx]);
            return vote;
        });

        res.json({ votes });
    } catch (error) {
        console.error('Get votes error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get statistics (Admin only)
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    try {
        const usersResult = db.exec('SELECT COUNT(*) as total FROM users');
        const votedResult = db.exec('SELECT COUNT(*) as voted FROM users WHERE has_voted = 1');
        const votesResult = db.exec('SELECT COUNT(*) as total FROM votes');

        const totalUsers = usersResult.length > 0 ? usersResult[0].values[0][0] : 0;
        const votedUsers = votedResult.length > 0 ? votedResult[0].values[0][0] : 0;
        const totalVotes = votesResult.length > 0 ? votesResult[0].values[0][0] : 0;

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

// ===================== START SERVER =====================

initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Bharat E-Vote Backend running on http://localhost:${PORT}`);
    });
});
