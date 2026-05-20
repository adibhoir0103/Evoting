const express = require('express');
const router = express.Router();
const { createRateLimiter } = require('../middleware/rateLimiter');
const prisma = require('../lib/prisma');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const emailService = require('../services/emailService');
const { isAdmin } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const { verifyTurnstile } = require('../middleware/turnstile');
const { logAdminAction: logAction } = require('../utils/helpers');
const adminAuth = require('../controllers/adminAuthController');

// Configure Multer for CSV Uploads with security limits
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
            return cb(new Error('Only CSV files are allowed'), false);
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
router.post('/verify-mfa', adminLoginLimiter, asyncHandler(adminAuth.adminVerifyMfa));

// ===== All routes below require admin authentication =====
router.use(isAdmin);

// ==========================================
// ELECTION MANAGEMENT
// ==========================================

// Create new election
router.post('/elections', async (req, res) => {
    try {
        const { name, description, instructions, start_time, end_time, rules } = req.body;
        
        const election = await prisma.election.create({
            data: {
                name,
                description,
                instructions,
                start_time: start_time ? new Date(start_time) : null,
                end_time: end_time ? new Date(end_time) : null,
                rules: rules ? rules : {},
                status: 'DRAFT'
            }
        });

        await logAction(req.adminUser.email, 'CREATE_ELECTION', `Created election ${election.id}: ${name}`, req.ip);
        res.status(201).json(election);
    } catch (err) {
        console.error('Election creation error:', err.message);
        res.status(500).json({ error: 'Failed to create election' });
    }
});

// Update election status (Publish, Pause, Close)
// HOD→Principal Approval Flow: Only SUPER_ADMIN can move to ACTIVE
router.patch('/elections/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, override_reason } = req.body;
        
        const validStatuses = ['DRAFT', 'PUBLISHED', 'AWAITING_APPROVAL', 'ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED'];
        if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        const electionId = parseInt(id);
        if (isNaN(electionId)) return res.status(400).json({ error: 'Invalid election ID' });

        const election = await prisma.election.findUnique({ where: { id: electionId } });
        if (!election) return res.status(404).json({ error: 'Election not found' });

        // ===== HOD → PRINCIPAL APPROVAL GATE =====
        // ELECTION_OFFICER (HOD) can only draft and submit for approval
        // SUPER_ADMIN (Principal) is required to activate the election
        if (status === 'ACTIVE' && req.adminUser.role !== 'SUPER_ADMIN') {
            await logAction(req.adminUser.email, 'ACTIVATION_DENIED', `Election Officer attempted to activate Election ${id} without Principal approval`, req.ip);
            return res.status(403).json({ 
                error: 'Activation Denied: Only the Super Admin (Principal) can activate an election. Please submit for approval first.',
                requiredAction: 'AWAITING_APPROVAL'
            });
        }

        // ELECTION_OFFICER must submit for approval before activation
        if (status === 'AWAITING_APPROVAL' && election.status !== 'PUBLISHED') {
            return res.status(400).json({ error: 'Election must be in PUBLISHED state before submitting for approval.' });
        }

        // TIME-LOCK HEURISTIC: No critical configuration changes allowed within 60 minutes of start_time
        // Only exceptions: Admin emergency PAUSE or CLOSE
        if (election.start_time && ['DRAFT', 'PUBLISHED'].includes(status)) {
            const timeUntilStart = new Date(election.start_time).getTime() - Date.now();
            const ONE_HOUR = 60 * 60 * 1000;
            
            if (timeUntilStart <= ONE_HOUR) {
                 return res.status(403).json({ 
                     error: 'Time-Lock Active. Structural changes are strictly prohibited within 60 minutes of the election start time and during the election.'
                 });
            }
        }

        // Require Explicit Audit Reasons for Dangerous States
        if (['PAUSED', 'CLOSED'].includes(status) && status !== election.status && !override_reason) {
            return res.status(400).json({ error: 'An override_reason is strictly required to forcefully PAUSE or CLOSE an election for audit trails.' });
        }

        const updatedElection = await prisma.election.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        await logAction(req.adminUser.email, `UPDATE_ELECTION_STATUS_${status}`, `Election ${id} updated to ${status}. Reason: ${override_reason || 'Standard lifecycle'}. Approver Role: ${req.adminUser.role}`, req.ip);
        res.json(updatedElection);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update election status' });
    }
});

// ==========================================
// CANDIDATE / BALLOT MANAGEMENT
// ==========================================

// Add a Candidate Profile (Only allowable in DRAFT state)
router.post('/elections/:id/candidates', async (req, res) => {
    try {
        const { id } = req.params;
        const { candidate_name, party_name, party_symbol, state_code, constituency_code } = req.body;

        const electionId = parseInt(id);
        if (isNaN(electionId)) return res.status(400).json({ error: 'Invalid election ID' });

        const election = await prisma.election.findUnique({ where: { id: electionId }, select: { status: true } });
        if (!election) return res.status(404).json({ error: 'Election not found' });

        // STRICT ZERO-TRUST GUARDRAIL: No modifying ballot options after DRAFT Phase
        if (election.status !== 'DRAFT') {
            await logAction(req.adminUser.email, 'UNAUTHORIZED_CANDIDATE_ATTEMPT', `Attempted to inject candidate to non-DRAFT election ${id}`, req.ip);
            return res.status(403).json({ error: 'Forbidden: You cannot append candidates or manipulate the ballot once the Draft phase is finalized.' });
        }

        const candidate = await prisma.electionCandidate.create({
            data: {
                election_id: electionId,
                candidate_name,
                party_name,
                party_symbol,
                state_code: state_code ? parseInt(state_code) : 0,
                constituency_code: constituency_code ? parseInt(constituency_code) : 0
            }
        });

        await logAction(req.adminUser.email, 'ADD_CANDIDATE', `Appended candidate ${candidate.id} (${candidate_name}) to Election ${id}`, req.ip);
        res.status(201).json(candidate);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to append candidate' });
    }
});

// Delete a Candidate Profile (Only allowable in DRAFT state)
router.delete('/elections/:id/candidates/:candidateId', async (req, res) => {
    try {
        const { id, candidateId } = req.params;

        const electionId = parseInt(id);
        const candidateIdNum = parseInt(candidateId);
        if (isNaN(electionId) || isNaN(candidateIdNum)) return res.status(400).json({ error: 'Invalid ID' });

        const election = await prisma.election.findUnique({ where: { id: electionId }, select: { status: true } });
        if (!election) return res.status(404).json({ error: 'Election not found' });

        // STRICT ZERO-TRUST GUARDRAIL
        if (election.status !== 'DRAFT') {
            await logAction(req.adminUser.email, 'UNAUTHORIZED_CANDIDATE_DELETION_ATTEMPT', `Attempted to drop candidate ${candidateId} from non-DRAFT election ${id}`, req.ip);
            return res.status(403).json({ error: 'Forbidden: You cannot drop candidates from the ballot once the Draft phase is finalized.' });
        }

        await prisma.electionCandidate.delete({
            where: { id: candidateIdNum }
        });

        await logAction(req.adminUser.email, 'DELETE_CANDIDATE', `Dropped candidate ${candidateId} from Election ${id}`, req.ip);
        res.json({ message: 'Candidate securely deleted from draft ballot' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to drop candidate' });
    }
});

// Get all elections
router.get('/elections', async (req, res) => {
    try {
        const elections = await prisma.election.findMany({
            include: {
                _count: {
                    select: { candidates: true, voters: true, votes: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });
        res.json(elections);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch elections' });
    }
});

// ==========================================
// VOTER LIST MANAGEMENT
// ==========================================

// Upload CSV of Voters for a specific election
router.post(['/elections/:id/voters/upload', '/elections/:id/voters/bulk'], upload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        const electionId = parseInt(id);

        if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

        const results = [];
        const stream = fs.createReadStream(req.file.path);
        stream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                let successCount = 0;
                let errorCount = 0;

                const localPrisma = prisma; // Reuse existing Prisma client
                try {
                    for (const row of results) {
                        // CSV should have a column 'aadhaar_number' or 'email' or 'voter_id'
                        const identifier = row.aadhaar_number || row.email || row.voter_id;
                        if (!identifier) {
                            errorCount++;
                            continue;
                        }

                        // Find user in master DB
                        const user = await localPrisma.user.findFirst({
                            where: {
                                OR: [
                                    { aadhaar_number: identifier },
                                    { email: identifier },
                                    { voter_id: identifier }
                                ]
                            }
                        });

                        if (user) {
                            try {
                                // Upsert into ElectionVoter whitelist
                                await localPrisma.electionVoter.upsert({
                                    where: {
                                        election_id_user_id: {
                                            election_id: electionId,
                                            user_id: user.id
                                        }
                                    },
                                    update: {}, // Do nothing if already exists
                                    create: {
                                        election_id: electionId,
                                        user_id: user.id
                                    }
                                });
                                successCount++;
                            } catch (e) {
                                errorCount++;
                            }
                        } else {
                            errorCount++; // User not found in system
                        }
                    }
                } finally {
                    // No disconnect needed — reusing singleton
                }

                // Cleanup temp file
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

                await logAction(req.adminUser.email, 'CSV_UPLOAD_VOTERS', `Uploaded ${successCount} successful voters to Election ${electionId}. ${errorCount} errors.`, req.ip);
                
                res.json({ message: 'Upload complete', successCount, errorCount });
            })
            .on('error', (err) => {
                console.error('CSV Parsing Error:', err);
                stream.destroy(); // Prevent 'end' event from firing
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                if (!res.headersSent) res.status(500).json({ error: 'Failed to process CSV file' });
            });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to process CSV' });
    }
});

// ==========================================
// ROLE MANAGEMENT (SUPER_ADMIN ONLY)
// ==========================================

// Get all admins
router.get('/admins', async (req, res) => {
    try {
        const admins = await prisma.user.findMany({
            where: {
                role: { in: ['SUPER_ADMIN', 'ELECTION_OFFICER', 'AUDITOR'] }
            },
            select: { id: true, fullname: true, email: true, role: true }
        });
        res.json(admins);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user role
router.patch('/users/:id/role', async (req, res) => {
    try {
        if (req.adminUser.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only SUPER_ADMIN can assign roles' });
        }

        const { id } = req.params;
        const { role } = req.body;
        const userId = parseInt(id);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        const validRoles = ['VOTER', 'SUPER_ADMIN', 'ELECTION_OFFICER', 'AUDITOR'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role }
        });

        await logAction(req.adminUser.email, 'UPDATE_ROLE', `Changed user ${id} role to ${role}`, req.ip);
        res.json({ message: 'Role updated successfully', user: updatedUser });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Get Audit Logs
router.get('/audit', async (req, res) => {
    try {
        const logs = await prisma.adminAuditLog.findMany({
            orderBy: { created_at: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Broadcast Email to Election Voters (direct send via email service)
router.post('/elections/:id/notify', async (req, res) => {
    try {
        const { subject, body } = req.body;
        if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required' });

        const electionId = parseInt(req.params.id);
        if (isNaN(electionId)) return res.status(400).json({ error: 'Invalid election ID' });

        const voters = await prisma.electionVoter.findMany({
            where: { election_id: electionId },
            include: { user: true }
        });

        let sentCount = 0;
        let errorCount = 0;
        const batchSize = 10;

        for (let i = 0; i < voters.length; i += batchSize) {
            const batch = voters.slice(i, i + batchSize);
            for (const v of batch) {
                if (v.user && v.user.email) {
                    try {
                        await emailService.sendBroadcastEmail(
                            v.user.email,
                            v.user.fullname || 'Voter',
                            subject,
                            body
                        );
                        sentCount++;
                    } catch (emailErr) {
                        errorCount++;
                        console.error(`Broadcast email failed for ${v.user.email}:`, emailErr.message);
                    }
                }
            }
            // Small delay between batches to avoid rate limits
            if (i + batchSize < voters.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        await logAction(req.adminUser.email, 'BROADCAST_EMAIL', `Sent notification "${subject}" to ${sentCount} voters in Election ${electionId}`, req.ip);
        res.json({ message: 'Broadcast sent', stats: { totalVoters: voters.length, emailsSent: sentCount, errors: errorCount } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

// ==========================================
// ADMIN STATS (Dashboard Overview)
// ==========================================

// Get system-wide statistics for admin overview dashboard
router.get('/stats', async (req, res) => {
    try {
        const [totalUsers, votedUsers, totalElections, activeElections, pendingApprovals] = await Promise.all([
            prisma.user.count({ where: { role: 'VOTER' } }),
            prisma.user.count({ where: { role: 'VOTER', has_voted: true } }),
            prisma.election.count(),
            prisma.election.count({ where: { status: 'ACTIVE' } }),
            prisma.election.count({ where: { status: 'AWAITING_APPROVAL' } })
        ]);

        const totalVotes = await prisma.vote.count();
        const votingPercentage = totalUsers > 0 ? ((votedUsers / totalUsers) * 100).toFixed(1) : 0;

        // Recent audit trail (last 10 events)
        const recentAudit = await prisma.adminAuditLog.findMany({
            orderBy: { created_at: 'desc' },
            take: 10,
            select: { action: true, admin_email: true, created_at: true, details: true }
        });

        res.json({
            totalUsers,
            votedUsers,
            totalVotes,
            votingPercentage: parseFloat(votingPercentage),
            totalElections,
            activeElections,
            pendingApprovals,
            recentAudit
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ==========================================
// APPROVED VOTER WHITELIST/BLACKLIST
// ==========================================

// List all approved/blacklisted voters
router.get('/approved-voters', async (req, res) => {
    try {
        const voters = await prisma.approvedVoter.findMany({
            orderBy: { created_at: 'desc' }
        });
        res.json(voters);
    } catch (err) {
        console.error('Fetch approved voters error:', err);
        res.status(500).json({ error: 'Failed to fetch approved voters' });
    }
});

// Add a single approved voter manually
router.post('/approved-voters', async (req, res) => {
    try {
        const { email, fullname, voter_id, status } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const cleanEmail = email.trim().toLowerCase();
        const voterStatus = (status === 'BLACKLIST') ? 'BLACKLIST' : 'WHITELIST';

        const voter = await prisma.approvedVoter.upsert({
            where: { email: cleanEmail },
            update: { fullname, voter_id, status: voterStatus },
            create: {
                email: cleanEmail,
                fullname: fullname || null,
                voter_id: voter_id || null,
                status: voterStatus,
                added_by: req.adminUser.email
            }
        });

        await logAction(req.adminUser.email, 'ADD_APPROVED_VOTER', `Added ${cleanEmail} as ${voterStatus}`, req.ip);
        res.status(201).json(voter);
    } catch (err) {
        console.error('Add approved voter error:', err);
        res.status(500).json({ error: 'Failed to add voter: ' + (err.message || 'Unknown error') });
    }
});

// Toggle voter status (WHITELIST <-> BLACKLIST)
router.patch('/approved-voters/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const voterId = parseInt(id);
        if (isNaN(voterId)) return res.status(400).json({ error: 'Invalid voter ID' });

        if (!['WHITELIST', 'BLACKLIST'].includes(status)) {
            return res.status(400).json({ error: 'Status must be WHITELIST or BLACKLIST' });
        }

        const voter = await prisma.approvedVoter.update({
            where: { id: voterId },
            data: { status }
        });

        await logAction(req.adminUser.email, 'TOGGLE_VOTER_STATUS', `Changed ${voter.email} to ${status}`, req.ip);
        res.json(voter);
    } catch (err) {
        console.error('Toggle voter error:', err);
        res.status(500).json({ error: 'Failed to update voter status' });
    }
});

// Delete an approved voter entry
router.delete('/approved-voters/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const voterId = parseInt(id);
        if (isNaN(voterId)) return res.status(400).json({ error: 'Invalid voter ID' });

        const voter = await prisma.approvedVoter.delete({
            where: { id: voterId }
        });

        await logAction(req.adminUser.email, 'DELETE_APPROVED_VOTER', `Removed ${voter.email} from approved list`, req.ip);
        res.json({ message: 'Voter removed from approved list' });
    } catch (err) {
        console.error('Delete approved voter error:', err);
        res.status(500).json({ error: 'Failed to delete voter' });
    }
});

// Bulk upload approved voters via CSV
router.post('/approved-voters/bulk', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

        const results = [];
        const stream = fs.createReadStream(req.file.path);
        stream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                let successCount = 0;
                let errorCount = 0;

                for (const row of results) {
                    const email = (row.email || '').trim().toLowerCase();
                    if (!email) { errorCount++; continue; }

                    try {
                        await prisma.approvedVoter.upsert({
                            where: { email },
                            update: { 
                                fullname: row.fullname || row.name || undefined,
                                voter_id: row.voter_id || undefined,
                                status: row.status === 'BLACKLIST' ? 'BLACKLIST' : 'WHITELIST'
                            },
                            create: {
                                email,
                                fullname: row.fullname || row.name || null,
                                voter_id: row.voter_id || null,
                                status: row.status === 'BLACKLIST' ? 'BLACKLIST' : 'WHITELIST',
                                added_by: req.adminUser.email
                            }
                        });
                        successCount++;
                    } catch (e) {
                        errorCount++;
                    }
                }

                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                await logAction(req.adminUser.email, 'BULK_APPROVED_VOTERS', `Uploaded ${successCount} approved voters. ${errorCount} errors.`, req.ip);
                res.json({ message: 'Bulk upload complete', successCount, errorCount });
            })
            .on('error', (err) => {
                console.error('CSV Parsing Error:', err);
                stream.destroy(); // Prevent 'end' event from firing
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                if (!res.headersSent) res.status(500).json({ error: 'Failed to process CSV file' });
            });
    } catch (err) {
        console.error('Bulk upload error:', err);
        res.status(500).json({ error: 'Failed to process CSV' });
    }
});

module.exports = router;
