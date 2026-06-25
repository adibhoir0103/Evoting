const express = require('express');
const router = express.Router();
const { createRateLimiter } = require('../middleware/rateLimiter');
const multer = require('multer');
const { isAdmin } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const { verifyTurnstile } = require('../middleware/turnstile');
const adminAuth = require('../controllers/adminAuthController');
const admin = require('../controllers/adminController');
const path = require('path');

// Configure Multer for CSV Uploads with security limits
const uploadDir = path.resolve(__dirname, '..', 'uploads');
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        // SECURITY: Require BOTH the correct mimetype and extension to prevent malicious uploads
        if (file.mimetype !== 'text/csv' || !file.originalname.toLowerCase().endsWith('.csv')) {
            return cb(new Error('Only valid CSV files are allowed'), false);
        }
        cb(null, true);
    }
});

// Admin login rate limiter
const adminLoginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, max: 10,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

// ===== Admin Auth Routes (BEFORE isAdmin middleware) =====
router.post('/login', adminLoginLimiter, verifyTurnstile, asyncHandler(adminAuth.adminLogin));

// ===== All routes below require admin authentication =====
router.use(isAdmin);

// ==========================================
// ELECTION MANAGEMENT
// ==========================================
router.post('/elections', asyncHandler(admin.createElection));
router.patch('/elections/:id/status', asyncHandler(admin.updateElectionStatus));
router.get('/elections', asyncHandler(admin.getElections));

// ==========================================
// CANDIDATE / BALLOT MANAGEMENT
// ==========================================
router.post('/elections/:id/candidates', asyncHandler(admin.addCandidate));
router.delete('/elections/:id/candidates/:candidateId', asyncHandler(admin.deleteCandidate));

// ==========================================
// VOTER LIST MANAGEMENT
// ==========================================
router.post(['/elections/:id/voters/upload', '/elections/:id/voters/bulk'], upload.single('file'), asyncHandler(admin.uploadElectionVoters));

// ==========================================
// ROLE MANAGEMENT (SUPER_ADMIN ONLY)
// ==========================================
router.get('/admins', asyncHandler(admin.getAdmins));
router.patch('/users/:id/role', asyncHandler(admin.updateUserRole));

// ==========================================
// AUDIT LOGS
// ==========================================
router.get('/audit', asyncHandler(admin.getAuditLogs));

// ==========================================
// EMAIL BROADCASTING
// ==========================================
router.post('/elections/:id/notify', asyncHandler(admin.broadcastElectionEmail));

// ==========================================
// ADMIN STATS (Dashboard Overview)
// ==========================================
router.get('/stats', asyncHandler(admin.getStats));

// ==========================================
// VOTER REGISTRATION APPROVALS
// ==========================================
router.get('/voter-registrations', asyncHandler(admin.getPendingRegistrations));
router.post('/voter-registrations/:id/approve', asyncHandler(admin.approveVoterRegistration));
router.post('/voter-registrations/:id/reject', asyncHandler(admin.rejectVoterRegistration));

// ==========================================
// APPROVED VOTER WHITELIST/BLACKLIST
// ==========================================
router.get('/approved-voters', asyncHandler(admin.getApprovedVoters));
router.post('/approved-voters', asyncHandler(admin.addApprovedVoter));
router.patch('/approved-voters/:id', asyncHandler(admin.toggleApprovedVoterStatus));
router.delete('/approved-voters/:id', asyncHandler(admin.deleteApprovedVoter));
router.post('/approved-voters/bulk', upload.single('file'), asyncHandler(admin.bulkUploadApprovedVoters));

module.exports = router;
