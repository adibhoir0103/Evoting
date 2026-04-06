const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const emailService = require('../services/emailService');

// Configure Multer for CSV Uploads
const upload = multer({ dest: 'uploads/' });

const jwt = require('jsonwebtoken');

// Use the EXACT same JWT secret as server.js to avoid mismatch
const EFFECTIVE_JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-key-fallback';

// Custom Middleware: Validate Custom Admin JWT (synchronous - no callback)
const isAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

        // Synchronous verify — throws on failure instead of using callback
        const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);

        req.adminUser = {
            id: decoded.id,
            email: decoded.email,
            role: 'SUPER_ADMIN'
        };

        next();
    } catch (err) {
        console.error('Admin JWT verification failed:', err.message);
        return res.status(403).json({ error: 'Forbidden: Invalid or expired Admin Token', detail: err.message });
    }
};

// Helper: Log Admin Action
const logAction = async (admin_email, action, details, ip_address) => {
    try {
        await prisma.adminAuditLog.create({
            data: { admin_email, action, details, ip_address }
        });
    } catch (e) {
        console.error('Failed to write audit log', e);
    }
};

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
        console.error('Election creation error:', err);
        res.status(500).json({ error: 'Failed to create election', detail: err.message });
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

        const election = await prisma.election.findUnique({ where: { id: parseInt(id) } });
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
            
            if (timeUntilStart <= ONE_HOUR && timeUntilStart > 0) {
                 return res.status(403).json({ 
                     error: 'Time-Lock Active. Structural changes are strictly prohibited within 60 minutes of the election start time.'
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

        const election = await prisma.election.findUnique({ where: { id: parseInt(id) }, select: { status: true } });
        if (!election) return res.status(404).json({ error: 'Election not found' });

        // STRICT ZERO-TRUST GUARDRAIL: No modifying ballot options after DRAFT Phase
        if (election.status !== 'DRAFT') {
            await logAction(req.adminUser.email, 'UNAUTHORIZED_CANDIDATE_ATTEMPT', `Attempted to inject candidate to non-DRAFT election ${id}`, req.ip);
            return res.status(403).json({ error: 'Forbidden: You cannot append candidates or manipulate the ballot once the Draft phase is finalized.' });
        }

        const candidate = await prisma.electionCandidate.create({
            data: {
                election_id: parseInt(id),
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

        const election = await prisma.election.findUnique({ where: { id: parseInt(id) }, select: { status: true } });
        if (!election) return res.status(404).json({ error: 'Election not found' });

        // STRICT ZERO-TRUST GUARDRAIL
        if (election.status !== 'DRAFT') {
            await logAction(req.adminUser.email, 'UNAUTHORIZED_CANDIDATE_DELETION_ATTEMPT', `Attempted to drop candidate ${candidateId} from non-DRAFT election ${id}`, req.ip);
            return res.status(403).json({ error: 'Forbidden: You cannot drop candidates from the ballot once the Draft phase is finalized.' });
        }

        await prisma.electionCandidate.delete({
            where: { id: parseInt(candidateId) }
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
        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                let successCount = 0;
                let errorCount = 0;

                for (const row of results) {
                    // CSV should have a column 'aadhaar_number' or 'email' or 'voter_id'
                    const identifier = row.aadhaar_number || row.email || row.voter_id;
                    if (!identifier) {
                        errorCount++;
                        continue;
                    }

                    // Find user in master DB
                    const user = await prisma.user.findFirst({
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
                            await prisma.electionVoter.upsert({
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

                // Cleanup temp file
                fs.unlinkSync(req.file.path);

                await logAction(req.adminUser.email, 'CSV_UPLOAD_VOTERS', `Uploaded ${successCount} successful voters to Election ${electionId}. ${errorCount} errors.`, req.ip);
                
                res.json({ message: 'Upload complete', successCount, errorCount });
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

        const validRoles = ['VOTER', 'SUPER_ADMIN', 'ELECTION_OFFICER', 'AUDITOR'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(id) },
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

// Broadcast Email to Election Voters (via QStash for reliability)
router.post('/elections/:id/notify', async (req, res) => {
    try {
        const { subject, body } = req.body;
        const electionId = parseInt(req.params.id);
        const qStashWorker = require('../services/qStashWorker');
        
        const voters = await prisma.electionVoter.findMany({
            where: { election_id: electionId },
            include: { user: true }
        });
        
        let queued = 0;
        for (const v of voters) {
            if (v.user && v.user.email) {
                qStashWorker.publish('send_broadcast', {
                    email: v.user.email,
                    fullname: v.user.fullname,
                    subject,
                    body
                });
                queued++;
            }
        }
        
        await logAction(req.adminUser.email, 'BROADCAST_EMAIL', `Queued notification "${subject}" to ${queued} voters in Election ${electionId} via QStash`, req.ip);
        res.json({ message: 'Broadcast queued', stats: { totalVoters: voters.length, emailsQueued: queued } });
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
        res.status(500).json({ error: 'Failed to add voter' });
    }
});

// Toggle voter status (WHITELIST <-> BLACKLIST)
router.patch('/approved-voters/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['WHITELIST', 'BLACKLIST'].includes(status)) {
            return res.status(400).json({ error: 'Status must be WHITELIST or BLACKLIST' });
        }

        const voter = await prisma.approvedVoter.update({
            where: { id: parseInt(id) },
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
        const voter = await prisma.approvedVoter.delete({
            where: { id: parseInt(id) }
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
        fs.createReadStream(req.file.path)
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

                fs.unlinkSync(req.file.path);
                await logAction(req.adminUser.email, 'BULK_APPROVED_VOTERS', `Uploaded ${successCount} approved voters. ${errorCount} errors.`, req.ip);
                res.json({ message: 'Bulk upload complete', successCount, errorCount });
            });
    } catch (err) {
        console.error('Bulk upload error:', err);
        res.status(500).json({ error: 'Failed to process CSV' });
    }
});

module.exports = router;
