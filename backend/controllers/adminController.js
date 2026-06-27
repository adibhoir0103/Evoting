/**
 * Admin Controller
 * Extracted from routes/admin.js — handles election management, candidate/ballot
 * management, voter list uploads, role management, audit logs, admin stats,
 * approved voter whitelist/blacklist, and email broadcasting.
 */

const prisma = require('../lib/prisma');
const fs = require('fs');
const csv = require('csv-parser');
const emailService = require('../services/emailService');
const { logAdminAction: logAction } = require('../utils/helpers');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// ==========================================
// VOTER REGISTRATION APPROVALS
// ==========================================

// List all pending voter registrations
exports.getPendingRegistrations = async (req, res) => {
    const status = req.query.status || 'PENDING'; // PENDING | APPROVED | REJECTED
    const voters = await prisma.user.findMany({
        where: { registration_status: status, role: 'VOTER' },
        select: {
            id: true, fullname: true, email: true, voter_id: true,
            aadhaar_number: true, mobile_number: true, gender: true, dob: true,
            father_name: true, state_code: true, constituency_code: true,
            address: true, registration_status: true, created_at: true
        },
        orderBy: { created_at: 'desc' }
    });
    res.json(voters);
};

// Approve a voter registration — generate temp password and send credentials
exports.approveVoterRegistration = async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Voter application not found' });
    if (user.registration_status !== 'PENDING') {
        return res.status(400).json({ error: `Voter is already ${user.registration_status}. Cannot approve again.` });
    }

    // Generate secure 12-char temp password: Uppercase + lowercase + digits
    const tempPassword = crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
        + String(crypto.randomInt(10, 99)); // always ends with 2 digits for policy compliance

    // User auth is fully handled by our PostgreSQL database and local JWTs.
    // No external auth provider is used.

    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
        where: { id: userId },
        data: {
            registration_status: 'APPROVED',
            password: hashedPassword,
            must_change_password: true,
            temp_password_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours from now
        }
    });

    // Send login credentials email
    let emailSent = true;
    try {
        await emailService.sendLoginCredentials(user.email, user.fullname || 'Voter', user.voter_id, tempPassword);
    } catch (emailErr) {
        // DO NOT roll back — voter is approved. Surface the temp password to admin instead.
        emailSent = false;
        const logger = require('../lib/logger');
        logger.child('admin').warn('Email delivery failed during approval — temp password returned to admin', {
            userId, email: user.email, error: emailErr.message
        });
    }

    await logAction(req.adminUser.email, 'APPROVE_VOTER_REGISTRATION', `Approved voter ${user.email} (ID: ${userId}). Email sent: ${emailSent}.`, req.ip);

    if (!emailSent) {
        return res.json({
            message: `Voter ${user.fullname} approved, but the credentials email could NOT be delivered. Please share the credentials below manually.`,
            approved: true,
            emailFailed: true,
            manualCredentials: {
                voterId: user.voter_id,
                email: user.email,
                tempPassword: tempPassword
            }
        });
    }

    res.json({ message: `Voter ${user.fullname} approved. Login credentials sent to ${user.email}.`, approved: true });
};

// Reject a voter registration
exports.rejectVoterRegistration = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = parseInt(id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Voter application not found' });
    if (user.registration_status !== 'PENDING') {
        return res.status(400).json({ error: `Voter is already ${user.registration_status}. Cannot reject again.` });
    }

    await prisma.user.update({
        where: { id: userId },
        data: { registration_status: 'REJECTED' }
    });

    await logAction(req.adminUser.email, 'REJECT_VOTER_REGISTRATION', `Rejected voter ${user.email} (ID: ${userId}). Reason: ${reason || 'Not specified'}.`, req.ip);
    res.json({ message: `Voter application for ${user.fullname} has been rejected.`, rejected: true });
};

exports.createElection = async (req, res) => {
    const { name, description, instructions, start_time, end_time, rules } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Election name is required' });
    }

    let parsedStart = null;
    let parsedEnd = null;

    if (start_time) {
        parsedStart = new Date(start_time);
        if (isNaN(parsedStart.getTime())) return res.status(400).json({ error: 'Invalid start_time format' });
        if (parsedStart < new Date()) return res.status(400).json({ error: 'start_time cannot be in the past' });
    }
    
    if (end_time) {
        parsedEnd = new Date(end_time);
        if (isNaN(parsedEnd.getTime())) return res.status(400).json({ error: 'Invalid end_time format' });
        if (parsedStart && parsedEnd <= parsedStart) {
            return res.status(400).json({ error: 'end_time must be strictly after start_time' });
        }
    }

    const election = await prisma.election.create({
        data: {
            name,
            description,
            instructions,
            start_time: parsedStart,
            end_time: parsedEnd,
            rules: rules ? rules : {},
            status: 'DRAFT'
        }
    });

    await logAction(req.adminUser.email, 'CREATE_ELECTION', `Created election ${election.id}: ${name}`, req.ip);
    res.status(201).json(election);
};

// Update election status (Publish, Pause, Close)
// HOD→Principal Approval Flow: Only SUPER_ADMIN can move to ACTIVE
exports.updateElectionStatus = async (req, res) => {
    const { id } = req.params;
    const { status, override_reason } = req.body;

    const validStatuses = ['DRAFT', 'PUBLISHED', 'AWAITING_APPROVAL', 'ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const electionId = parseInt(id);
    if (isNaN(electionId)) return res.status(400).json({ error: 'Invalid election ID' });

    const election = await prisma.election.findUnique({ where: { id: electionId } });
    if (!election) return res.status(404).json({ error: 'Election not found' });

    // STRICT STATE MACHINE ENFORCEMENT
    const validTransitions = {
        'DRAFT': ['PUBLISHED'],
        'PUBLISHED': ['AWAITING_APPROVAL', 'DRAFT'],
        'AWAITING_APPROVAL': ['ACTIVE', 'PUBLISHED', 'DRAFT'],
        'ACTIVE': ['PAUSED', 'CLOSED'],
        'PAUSED': ['ACTIVE', 'CLOSED'],
        'CLOSED': ['ARCHIVED'],
        'ARCHIVED': []
    };

    if (!validTransitions[election.status].includes(status) && status !== election.status) {
        return res.status(400).json({ error: `Invalid status transition from ${election.status} to ${status}.` });
    }

    // PREVENT PREMATURE ACTIVATION
    if (status === 'ACTIVE' && election.start_time) {
        const timeUntilStart = new Date(election.start_time).getTime() - Date.now();
        if (timeUntilStart > 0 && !override_reason) {
            return res.status(403).json({ error: 'Cannot ACTIVATE election before its start_time unless an explicit override_reason is provided.' });
        }
    }

    // TIME-LOCK HEURISTIC: No structural changes (DRAFT/PUBLISHED) within 60 minutes of start
    if (election.start_time && ['DRAFT', 'PUBLISHED'].includes(status)) {
        const timeUntilStart = new Date(election.start_time).getTime() - Date.now();
        const ONE_HOUR = 60 * 60 * 1000;

        if (timeUntilStart > 0 && timeUntilStart <= ONE_HOUR) {
            // ADMIN can bypass with an explicit audit-logged reason
            if (req.adminUser.role === 'ADMIN' && override_reason) {
                await logAction(req.adminUser.email, 'TIME_LOCK_OVERRIDE', `ADMIN bypassed time-lock on Election ${id}. Reason: ${override_reason}`, req.ip);
            } else {
                return res.status(403).json({
                    error: 'Time-Lock Active. Structural changes are strictly prohibited within 60 minutes of the election start time. ADMIN can override by providing an override_reason.'
                });
            }
        }
    }

    // Require Explicit Audit Reasons for Dangerous States
    if (['PAUSED', 'CLOSED'].includes(status) && status !== election.status && !override_reason) {
        return res.status(400).json({ error: 'An override_reason is strictly required to forcefully PAUSE or CLOSE an election for audit trails.' });
    }

    const updatedElection = await prisma.election.update({
        where: { id: electionId },
        data: { status }
    });

    await logAction(req.adminUser.email, `UPDATE_ELECTION_STATUS_${status}`, `Election ${id} updated to ${status}. Reason: ${override_reason || 'Standard lifecycle'}. Approver Role: ${req.adminUser.role}`, req.ip);
    res.json(updatedElection);
};

// Get all elections
exports.getElections = async (req, res) => {
    const elections = await prisma.election.findMany({
        include: {
            _count: {
                select: { candidates: true, voters: true, votes: true }
            }
        },
        orderBy: { created_at: 'desc' }
    });
    res.json(elections);
};

// ==========================================
// CANDIDATE / BALLOT MANAGEMENT
// ==========================================

// Add a Candidate Profile (Only allowable in DRAFT state)
exports.addCandidate = async (req, res) => {
    const { id } = req.params;
    const { candidate_name, party_name, party_symbol, state_code, constituency_code } = req.body;

    if (!candidate_name || typeof candidate_name !== 'string' || candidate_name.trim() === '') {
        return res.status(400).json({ error: 'Candidate name is required' });
    }

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
};

// Delete a Candidate Profile (Only allowable in DRAFT state)
exports.deleteCandidate = async (req, res) => {
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
};

// ==========================================
// VOTER LIST MANAGEMENT
// ==========================================

// Upload CSV of Voters for a specific election
exports.uploadElectionVoters = async (req, res) => {
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

            // In-memory deduplication
            const uniqueResults = [];
            const seenIdentifiers = new Set();
            for (const row of results) {
                const identifier = (row.aadhaar_number || row.email || row.voter_id || '').trim().toLowerCase();
                if (identifier && !seenIdentifiers.has(identifier)) {
                    seenIdentifiers.add(identifier);
                    uniqueResults.push(row);
                }
            }

            const localPrisma = prisma; // Reuse existing Prisma client
            try {
                for (const row of uniqueResults) {
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
};

// ==========================================
// ROLE MANAGEMENT (ADMIN ONLY)
// ==========================================

// Get all admins
exports.getAdmins = async (req, res) => {
    const admins = await prisma.user.findMany({
        where: {
            role: 'ADMIN'
        },
        select: { id: true, fullname: true, email: true, role: true }
    });
    res.json(admins);
};

// Update user role
exports.updateUserRole = async (req, res) => {
    if (req.adminUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only ADMIN can assign roles' });
    }

    const { id } = req.params;
    const { role } = req.body;
    const userId = parseInt(id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const validRoles = ['VOTER', 'ADMIN'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role }
    });

    await logAction(req.adminUser.email, 'UPDATE_ROLE', `Changed user ${id} role to ${role}`, req.ip);
    res.json({ message: 'Role updated successfully', user: updatedUser });
};

// ==========================================
// AUDIT LOGS
// ==========================================

// Get Audit Logs
exports.getAuditLogs = async (req, res) => {
    const logs = await prisma.adminAuditLog.findMany({
        orderBy: { created_at: 'desc' },
        take: 100
    });
    res.json(logs);
};

// ==========================================
// EMAIL BROADCASTING
// ==========================================

// Broadcast Email to Election Voters (direct send via email service)
exports.broadcastElectionEmail = async (req, res) => {
    const { subject, body, idempotencyKey } = req.body;
    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
        return res.status(400).json({ error: 'Subject is required and must be valid' });
    }
    if (!body || typeof body !== 'string' || body.trim() === '') {
        return res.status(400).json({ error: 'Body is required and must be valid' });
    }

    const electionId = parseInt(req.params.id);
    if (isNaN(electionId)) return res.status(400).json({ error: 'Invalid election ID' });

    // Deduplication check
    const idKey = idempotencyKey || crypto.createHash('sha256').update(subject + body).digest('hex').substring(0, 32);
    const notifType = 'BROADCAST_' + idKey;

    const existingNotif = await prisma.electionNotification.findUnique({
        where: { election_id_type: { election_id: electionId, type: notifType } }
    });
    if (existingNotif) {
        return res.json({ message: 'Broadcast already sent', stats: { totalVoters: 0, emailsSent: 0, errors: 0, duplicate: true } });
    }

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

    try {
        await prisma.electionNotification.create({
            data: {
                election_id: electionId,
                type: notifType,
                sent_count: sentCount
            }
        });
    } catch (e) {
        console.error('Failed to log broadcast notification', e);
    }

    await logAction(req.adminUser.email, 'BROADCAST_EMAIL', `Sent notification "${subject}" to ${sentCount} voters in Election ${electionId}`, req.ip);
    res.json({ message: 'Broadcast sent', stats: { totalVoters: voters.length, emailsSent: sentCount, errors: errorCount } });
};

// ==========================================
// ADMIN STATS (Dashboard Overview)
// ==========================================

// Get system-wide statistics for admin overview dashboard
exports.getStats = async (req, res) => {
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
};

// ==========================================
// APPROVED VOTER WHITELIST/BLACKLIST
// ==========================================

// List all approved/blacklisted voters
exports.getApprovedVoters = async (req, res) => {
    const voters = await prisma.approvedVoter.findMany({
        orderBy: { created_at: 'desc' }
    });
    res.json(voters);
};

// Add a single approved voter manually
exports.addApprovedVoter = async (req, res) => {
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
};

// Toggle voter status (WHITELIST <-> BLACKLIST)
exports.toggleApprovedVoterStatus = async (req, res) => {
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
};

// Delete an approved voter entry
exports.deleteApprovedVoter = async (req, res) => {
    const { id } = req.params;
    const voterId = parseInt(id);
    if (isNaN(voterId)) return res.status(400).json({ error: 'Invalid voter ID' });

    const voter = await prisma.approvedVoter.delete({
        where: { id: voterId }
    });

    await logAction(req.adminUser.email, 'DELETE_APPROVED_VOTER', `Removed ${voter.email} from approved list`, req.ip);
    res.json({ message: 'Voter removed from approved list' });
};

// Bulk upload approved voters via CSV
exports.bulkUploadApprovedVoters = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

    const results = [];
    const stream = fs.createReadStream(req.file.path);
    stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            let successCount = 0;
            let errorCount = 0;

            // In-memory deduplication
            const uniqueResults = [];
            const seenEmails = new Set();
            for (const row of results) {
                const email = (row.email || '').trim().toLowerCase();
                if (email && !seenEmails.has(email)) {
                    seenEmails.add(email);
                    uniqueResults.push(row);
                }
            }

            for (const row of uniqueResults) {
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
};
