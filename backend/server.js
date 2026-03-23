const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const otpService = require('./services/otpService');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'bharat-evote-secret-key-2026';
const DB_PATH = path.join(__dirname, 'evoting.db');

let db = null;

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

    saveDatabase();
    console.log('✅ Tables initialized');
}

// Save database to file
function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ===================== AUTH ROUTES =====================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { fullname, voterId, email, password, aadhaarNumber, mobileNumber } = req.body;

        // Validation
        if (!fullname || !voterId || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const stmtCheck = db.prepare('SELECT id FROM users WHERE email = ? OR voter_id = ?');
        let existingUser;
        try {
            stmtCheck.bind([email, voterId]);
            existingUser = stmtCheck.step();
        } finally {
            stmtCheck.free();
        }

        if (existingUser) {
            return res.status(400).json({ error: 'User with this email or voter ID already exists' });
        }

        // Hash password (optional for Aadhaar-only users)
        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

        // Insert user
        db.run(
            `INSERT INTO users (fullname, voter_id, email, password, aadhaar_number, mobile_number) VALUES (?, ?, ?, ?, ?, ?)`,
            [fullname, voterId, email, hashedPassword, aadhaarNumber || null, mobileNumber || null]
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
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Email/Voter ID and password are required' });
        }

        // Find user by email or voter_id
        const stmtLogin = db.prepare('SELECT * FROM users WHERE email = ? OR voter_id = ?');
        let user;
        try {
            stmtLogin.bind([identifier, identifier]);
            user = stmtLogin.step() ? stmtLogin.getAsObject() : null;
        } finally {
            stmtLogin.free();
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, voterId: user.voter_id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
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
                walletAddress: user.wallet_address
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
        const stmtMe = db.prepare('SELECT id, fullname, voter_id, email, wallet_address, has_voted FROM users WHERE id = ?');
        let user;
        try {
            stmtMe.bind([req.user.id]);
            user = stmtMe.step() ? stmtMe.getAsObject() : null;
        } finally {
            stmtMe.free();
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            fullname: user.fullname,
            voterId: user.voter_id,
            email: user.email,
            hasVoted: user.has_voted === 1,
            walletAddress: user.wallet_address
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

        // Check if already voted
        const stmtVoted = db.prepare('SELECT has_voted FROM users WHERE id = ?');
        let voteCheckRow;
        try {
            stmtVoted.bind([req.user.id]);
            voteCheckRow = stmtVoted.step() ? stmtVoted.getAsObject() : null;
        } finally {
            stmtVoted.free();
        }
        if (voteCheckRow && voteCheckRow.has_voted === 1) {
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
        const stmtStatus = db.prepare('SELECT has_voted FROM users WHERE id = ?');
        let statusRow;
        try {
            stmtStatus.bind([req.user.id]);
            statusRow = stmtStatus.step() ? stmtStatus.getAsObject() : null;
        } finally {
            stmtStatus.free();
        }
        const hasVoted = statusRow !== null && statusRow.has_voted === 1;
        res.json({ hasVoted });
    } catch (error) {
        console.error('Vote status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===================== AADHAAR OTP ROUTES =====================

// Send OTP via email or mobile
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { aadhaarNumber, email, mobileNumber, method = 'email' } = req.body;

        if (!aadhaarNumber) {
            return res.status(400).json({ error: 'Aadhaar number is required' });
        }

        // Validate Aadhaar format (12 digits)
        if (!/^\d{12}$/.test(aadhaarNumber)) {
            return res.status(400).json({ error: 'Invalid Aadhaar number format' });
        }

        // Check if user exists with this Aadhaar
        const stmtOtp = db.prepare('SELECT id, fullname, aadhaar_number, email, mobile_number FROM users WHERE aadhaar_number = ?');
        let user;
        try {
            stmtOtp.bind([aadhaarNumber]);
            user = stmtOtp.step() ? stmtOtp.getAsObject() : null;
        } finally {
            stmtOtp.free();
        }

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

        // Send OTP
        const otpResult = await otpService.sendOTP(recipient, aadhaarNumber, method, user.fullname);

        const response = {
            message: otpResult.message,
            method: otpResult.method
        };
        if (process.env.NODE_ENV !== 'production') {
            response.demoOTP = otpResult.demoOTP;
        }
        res.json(response);
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Server error while sending OTP' });
    }
});

// Verify OTP and login
app.post('/api/auth/verify-otp', async (req, res) => {
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

        // Get user details
        const stmtVerify = db.prepare('SELECT * FROM users WHERE aadhaar_number = ?');
        let user;
        try {
            stmtVerify.bind([aadhaarNumber]);
            user = stmtVerify.step() ? stmtVerify.getAsObject() : null;
        } finally {
            stmtVerify.free();
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, voterId: user.voter_id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
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

// Admin credentials (configurable via environment variables)
const ADMIN_CREDENTIALS = {
    email: process.env.ADMIN_EMAIL || 'admin@evote.com',
    password: process.env.ADMIN_PASSWORD || 'admin123'
};

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Trim whitespace
        const trimmedEmail = email ? email.trim().toLowerCase() : '';
        const trimmedPassword = password ? password.trim() : '';

        console.log('Admin login attempt:', { email: trimmedEmail });

        if (!trimmedEmail || !trimmedPassword) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (trimmedEmail !== ADMIN_CREDENTIALS.email || trimmedPassword !== ADMIN_CREDENTIALS.password) {
            console.log('Failed login - credentials mismatch');
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }

        const token = jwt.sign(
            { id: 0, email: email, role: 'admin' },
            JWT_SECRET,
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

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
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
        const result = db.exec('SELECT id, fullname, voter_id, email, aadhaar_number, mobile_number, has_voted, created_at FROM users');

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
