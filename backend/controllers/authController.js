/**
 * Auth Controller
 * Extracted from server.js — handles registration, login, MFA, QR tickets,
 * keystroke dynamics, profile, and wallet linking.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const redisService = require('../services/redisService');
const { sanitize } = require('../utils/helpers');
const { EFFECTIVE_JWT_SECRET, setTokenCookie, clearTokenCookie } = require('../middleware/authenticate');

// ===================== REGISTER =====================
exports.register = async (req, res) => {
    const { fullname, email, password, voter_id, aadhaar_number, father_name, gender, dob, mobile_number, state_code, constituency_code, address } = req.body;

    if (!fullname || !email || !password || !voter_id) {
        return res.status(400).json({ error: 'Full name, email, password, and voter ID are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanVoterId = voter_id.trim().toUpperCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    if (aadhaar_number && !/^\d{12}$/.test(aadhaar_number.replace(/\s/g, ''))) {
        return res.status(400).json({ error: 'Aadhaar number must be exactly 12 digits' });
    }

    const approvedVoter = await prisma.approvedVoter.findUnique({ where: { email: cleanEmail } });
    if (!approvedVoter) {
        return res.status(403).json({ error: 'You are not in the approved voter list. Please contact your local Election Officer to get whitelisted.', code: 'NOT_WHITELISTED' });
    }
    if (approvedVoter.status === 'BLACKLIST') {
        return res.status(403).json({ error: 'Your voter registration has been suspended. Please contact ECI helpline 1950.', code: 'BLACKLISTED' });
    }

    const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email: cleanEmail }, { voter_id: cleanVoterId }] }
    });
    if (existingUser) {
        return res.status(409).json({ error: 'An account with these credentials already exists. Please login instead.' });
    }

    // Hash Aadhaar with HMAC-SHA256 pepper for PII protection
    let hashedAadhaar = null;
    if (aadhaar_number) {
        const cleanAadhaar = aadhaar_number.replace(/\s/g, '');
        const pepper = process.env.AADHAAR_PEPPER || 'dev-local-aadhaar-pepper';
        hashedAadhaar = crypto.createHmac('sha256', pepper).update(cleanAadhaar).digest('hex');

        const existingAadhaar = await prisma.user.findUnique({ where: { aadhaar_number: hashedAadhaar } });
        if (existingAadhaar) {
            return res.status(409).json({ error: 'This Aadhaar number is already linked to another account.' });
        }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
        data: {
            fullname: sanitize(fullname), email: cleanEmail, password: hashedPassword,
            voter_id: cleanVoterId, aadhaar_number: hashedAadhaar,
            father_name: father_name ? sanitize(father_name) : null,
            gender: gender ? sanitize(gender) : null, dob: dob || null,
            mobile_number: mobile_number ? sanitize(mobile_number) : null,
            state_code: state_code ? parseInt(state_code) : null,
            constituency_code: constituency_code ? parseInt(constituency_code) : null,
            address: address ? sanitize(address) : null, role: 'VOTER'
        }
    });

    const token = jwt.sign(
        { id: user.id, email: user.email, voterId: user.voter_id, role: 'VOTER' },
        EFFECTIVE_JWT_SECRET, { expiresIn: '30m' }
    );

    await prisma.loginHistory.create({
        data: { voter_id: user.voter_id, ip_address: req.ip, status: 'REGISTERED' }
    });

    // Set JWT as httpOnly cookie (primary auth) — closes localStorage XSS vulnerability
    setTokenCookie(res, 'token', token, 30 * 60 * 1000);

    res.status(201).json({
        message: 'Registration successful! Welcome to Bharat E-Vote.', token,
        user: { id: user.id, fullname: user.fullname, email: user.email, voterId: user.voter_id, hasVoted: false }
    });
};

// ===================== LOGIN (Step 1) =====================
exports.login = async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
        return res.status(400).json({ error: 'Email/Voter ID and password are required' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const user = await prisma.user.findFirst({
        where: { OR: [{ email: cleanIdentifier }, { voter_id: cleanIdentifier.toUpperCase() }] }
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials. Please check your email/Voter ID and password.' });
    if (!user.password) return res.status(401).json({ error: 'This account was created without a password. Please contact support.' });

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        await prisma.loginHistory.create({ data: { voter_id: user.voter_id, ip_address: req.ip, status: 'FAILED' } }).catch(() => {});
        return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }

    const approvedVoter = await prisma.approvedVoter.findUnique({ where: { email: user.email } });
    if (approvedVoter && approvedVoter.status === 'BLACKLIST') {
        return res.status(403).json({ error: 'Your account has been suspended. Contact ECI helpline 1950.' });
    }

    // MFA: Generate and send OTP
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.mfaToken.updateMany({
        where: { user_email: user.email, verified: false },
        data: { verified: true }
    });
    await prisma.mfaToken.create({
        data: { user_email: user.email, otp_hash: otpHash, purpose: 'LOGIN', expires_at: expiresAt, verified: false, attempts: 0 }
    });

    const emailService = require('../services/emailService');
    await emailService.sendOTP(user.email, otp, user.fullname || 'Voter');

    const preAuthToken = jwt.sign(
        { id: user.id, email: user.email, voterId: user.voter_id, step: 'mfa_pending' },
        EFFECTIVE_JWT_SECRET, { expiresIn: '10m' }
    );

    await prisma.loginHistory.create({
        data: { voter_id: user.voter_id, ip_address: req.ip, device_info: req.headers['user-agent']?.slice(0, 200), status: 'MFA_PENDING' }
    }).catch(() => {});

    res.json({
        message: 'Password verified. OTP sent to your registered email.', mfaRequired: true, preAuthToken,
        maskedEmail: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        user: { id: user.id, fullname: user.fullname, voterId: user.voter_id, hasVoted: user.has_voted, walletAddress: user.wallet_address }
    });
};

// ===================== VERIFY OTP (Step 2) =====================
exports.verifyOtp = async (req, res) => {
    const { preAuthToken, otp } = req.body;
    if (!preAuthToken || !otp) return res.status(400).json({ error: 'Pre-auth token and OTP are required' });

    let decoded;
    try { decoded = jwt.verify(preAuthToken, EFFECTIVE_JWT_SECRET); }
    catch (err) { return res.status(401).json({ error: 'Session expired. Please login again.' }); }

    if (decoded.step !== 'mfa_pending') return res.status(400).json({ error: 'Invalid authentication step.' });

    const mfaToken = await prisma.mfaToken.findFirst({
        where: { user_email: decoded.email, purpose: 'LOGIN', verified: false, expires_at: { gte: new Date() } },
        orderBy: { created_at: 'desc' }
    });
    if (!mfaToken) return res.status(400).json({ error: 'OTP expired. Please request a new one.' });

    if (mfaToken.attempts >= 5) {
        await prisma.mfaToken.update({ where: { id: mfaToken.id }, data: { verified: true } });
        return res.status(429).json({ error: 'Too many failed OTP attempts. Please login again.' });
    }

    const isValidOtp = await bcrypt.compare(otp.trim(), mfaToken.otp_hash);
    if (!isValidOtp) {
        await prisma.mfaToken.update({ where: { id: mfaToken.id }, data: { attempts: mfaToken.attempts + 1 } });
        return res.status(401).json({ error: `Invalid OTP. ${5 - (mfaToken.attempts + 1)} attempts remaining.`, attemptsRemaining: 5 - (mfaToken.attempts + 1) });
    }

    await prisma.mfaToken.update({ where: { id: mfaToken.id }, data: { verified: true } });

    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sessionToken = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    await redisService.setActiveSession(user.id, sessionToken, 1200);

    const token = jwt.sign(
        { id: user.id, email: user.email, voterId: user.voter_id, voter_id: user.voter_id, role: user.role, mfa: true, active_session_token: sessionToken },
        EFFECTIVE_JWT_SECRET, { expiresIn: '20m' }
    );

    await prisma.loginHistory.create({
        data: { voter_id: user.voter_id, ip_address: req.ip, device_info: req.headers['user-agent']?.slice(0, 200), status: 'SUCCESS' }
    }).catch(() => {});

    // Set JWT as httpOnly cookie (primary auth)
    setTokenCookie(res, 'token', token, 20 * 60 * 1000);

    res.json({
        message: 'MFA verification successful. Login complete.', mfaVerified: true, token,
        user: { id: user.id, fullname: user.fullname, email: user.email, voterId: user.voter_id, hasVoted: user.has_voted, walletAddress: user.wallet_address }
    });
};

// ===================== RESEND OTP =====================
exports.resendOtp = async (req, res) => {
    const { preAuthToken } = req.body;
    if (!preAuthToken) return res.status(400).json({ error: 'Pre-auth token is required' });

    let decoded;
    try { decoded = jwt.verify(preAuthToken, EFFECTIVE_JWT_SECRET); }
    catch (err) { return res.status(401).json({ error: 'Session expired. Please login again.' }); }

    if (decoded.step !== 'mfa_pending') return res.status(400).json({ error: 'Invalid authentication step.' });

    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.mfaToken.updateMany({ where: { user_email: user.email, verified: false }, data: { verified: true } });

    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.mfaToken.create({
        data: { user_email: user.email, otp_hash: otpHash, purpose: 'LOGIN', expires_at: expiresAt, verified: false, attempts: 0 }
    });

    const emailService = require('../services/emailService');
    await emailService.sendOTP(user.email, otp, user.fullname || 'Voter');

    res.json({ message: 'New OTP sent to your registered email.', email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') });
};

// ===================== LOGOUT =====================
exports.logout = async (req, res) => {
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Not authenticated' });
    await Promise.all([
        redisService.clearActiveSession(req.user.id),
        prisma.user.update({ where: { id: req.user.id }, data: { active_session_token: null, active_session_expires: null } })
    ]);
    // Clear httpOnly JWT cookie
    clearTokenCookie(res, 'token');
    res.json({ message: 'Logged out successfully' });
};

// ===================== FORGOT PASSWORD =====================
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email address is required' });

    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) return res.json({ message: 'If an account exists with this email, an OTP has been sent.' });

    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.mfaToken.updateMany({ where: { user_email: cleanEmail, purpose: 'PASSWORD_RESET', verified: false }, data: { verified: true } });
    await prisma.mfaToken.create({
        data: { user_email: cleanEmail, otp_hash: otpHash, purpose: 'PASSWORD_RESET', expires_at: expiresAt, verified: false, attempts: 0 }
    });

    const emailService = require('../services/emailService');
    await emailService.sendOTP(cleanEmail, otp, user.fullname || 'Voter', 'Password Reset');

    const resetToken = jwt.sign({ email: cleanEmail, purpose: 'password_reset' }, EFFECTIVE_JWT_SECRET, { expiresIn: '10m' });

    res.json({ message: 'If an account exists with this email, an OTP has been sent.', email: cleanEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') });
};

// ===================== RESET PASSWORD =====================
exports.resetPassword = async (req, res) => {
    const { resetToken, otp, newPassword } = req.body;
    if (!resetToken || !otp || !newPassword) return res.status(400).json({ error: 'Reset token, OTP, and new password are required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long' });

    let decoded;
    try { decoded = jwt.verify(resetToken, EFFECTIVE_JWT_SECRET); }
    catch (err) { return res.status(401).json({ error: 'Reset session expired. Please request a new OTP.' }); }

    if (decoded.purpose !== 'password_reset') return res.status(400).json({ error: 'Invalid reset token.' });

    const mfaToken = await prisma.mfaToken.findFirst({
        where: { user_email: decoded.email, purpose: 'PASSWORD_RESET', verified: false, expires_at: { gte: new Date() } },
        orderBy: { created_at: 'desc' }
    });
    if (!mfaToken) return res.status(400).json({ error: 'OTP expired. Please request a new one.' });

    if (mfaToken.attempts >= 5) {
        await prisma.mfaToken.update({ where: { id: mfaToken.id }, data: { verified: true } });
        return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    const isValidOtp = await bcrypt.compare(otp.trim(), mfaToken.otp_hash);
    if (!isValidOtp) {
        await prisma.mfaToken.update({ where: { id: mfaToken.id }, data: { attempts: mfaToken.attempts + 1 } });
        return res.status(401).json({ error: `Invalid OTP. ${5 - (mfaToken.attempts + 1)} attempts remaining.`, attemptsRemaining: 5 - (mfaToken.attempts + 1) });
    }

    await prisma.mfaToken.update({ where: { id: mfaToken.id }, data: { verified: true } });
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const userToReset = await prisma.user.findUnique({ where: { email: decoded.email } });
    
    // STRICT SECURITY: Log out all active sessions upon password reset
    if (userToReset && userToReset.id) {
        await Promise.all([
            redisService.clearActiveSession(userToReset.id),
            prisma.user.update({ 
                where: { email: decoded.email }, 
                data: { 
                    password: hashedPassword,
                    active_session_token: null,
                    active_session_expires: null
                } 
            })
        ]);
    } else {
        await prisma.user.update({ where: { email: decoded.email }, data: { password: hashedPassword } });
    }

    await prisma.loginHistory.create({ data: { voter_id: userToReset?.voter_id || 'UNKNOWN', ip_address: req.ip, status: 'PASSWORD_RESET' } }).catch(() => {});

    res.json({ message: 'Password reset successful! You can now login with your new password.' });
};

// ===================== QR TICKET =====================
exports.generateQrTicket = async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, voter_id: true, has_voted: true, fullname: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.has_voted) return res.status(400).json({ error: 'You have already voted. QR ticket cannot be issued.' });

    await prisma.qrVoteTicket.updateMany({ where: { user_email: user.email, used: false }, data: { used: true } });

    const ticketExpiry = new Date(Date.now() + 5 * 60 * 1000);
    const ticketToken = jwt.sign(
        { type: 'QR_VOTE_TICKET', userId: user.id, email: user.email, voterId: user.voter_id, issuedAt: Date.now(), nonce: crypto.randomBytes(16).toString('hex') },
        EFFECTIVE_JWT_SECRET, { expiresIn: '5m' }
    );

    await prisma.qrVoteTicket.create({ data: { user_email: user.email, ticket_token: ticketToken, expires_at: ticketExpiry, used: false } });

    res.json({ message: 'QR Voting Ticket issued. Valid for 5 minutes.', ticketToken, expiresAt: ticketExpiry.toISOString(), validitySeconds: 300, voterName: user.fullname });
};

exports.validateQrTicket = async (req, res) => {
    const { ticketToken } = req.body;
    if (!ticketToken) return res.status(400).json({ error: 'QR ticket token is required' });

    let ticketPayload;
    try { ticketPayload = jwt.verify(ticketToken, EFFECTIVE_JWT_SECRET); }
    catch (err) { return res.status(401).json({ error: 'QR ticket has expired or is invalid. Please generate a new one.', expired: true }); }

    if (ticketPayload.type !== 'QR_VOTE_TICKET') return res.status(400).json({ error: 'Invalid ticket type' });
    if (ticketPayload.email !== req.user.email) return res.status(403).json({ error: 'This ticket does not belong to you' });

    const ticket = await prisma.qrVoteTicket.findUnique({ where: { ticket_token: ticketToken } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found in records' });
    if (ticket.used) return res.status(400).json({ error: 'This ticket has already been used' });
    if (new Date() > ticket.expires_at) return res.status(401).json({ error: 'Ticket has expired', expired: true });

    await prisma.qrVoteTicket.update({ where: { id: ticket.id }, data: { used: true } });
    res.json({ valid: true, message: 'QR ticket validated. You may proceed to vote.', voterId: ticketPayload.voterId, email: ticketPayload.email });
};

// ===================== KEYSTROKE DYNAMICS =====================
exports.keystrokeEnroll = async (req, res) => {
    const { holdTimes, flightTimes, meanSpeed, stdDeviation } = req.body;
    if (!holdTimes || !flightTimes) return res.status(400).json({ error: 'Keystroke timing data is required' });

    const userEmail = req.user.email;
    const MIN_SAMPLES = 3;
    let profile = await prisma.keystrokeProfile.findUnique({ where: { user_email: userEmail } });

    if (!profile) {
        profile = await prisma.keystrokeProfile.create({
            data: { user_email: userEmail, hold_times: JSON.stringify(holdTimes), flight_times: JSON.stringify(flightTimes), mean_speed: meanSpeed || 0, std_deviation: stdDeviation || 0, sample_count: 1, is_enrolled: false }
        });
    } else {
        const existingHold = JSON.parse(profile.hold_times);
        const existingFlight = JSON.parse(profile.flight_times);
        const newCount = profile.sample_count + 1;
        const avgHold = holdTimes.map((val, i) => { const prev = existingHold[i] || 0; return ((prev * profile.sample_count) + val) / newCount; });
        const avgFlight = flightTimes.map((val, i) => { const prev = existingFlight[i] || 0; return ((prev * profile.sample_count) + val) / newCount; });
        const avgSpeed = ((profile.mean_speed * profile.sample_count) + (meanSpeed || 0)) / newCount;
        const avgStd = ((profile.std_deviation * profile.sample_count) + (stdDeviation || 0)) / newCount;

        profile = await prisma.keystrokeProfile.update({
            where: { user_email: userEmail },
            data: { hold_times: JSON.stringify(avgHold), flight_times: JSON.stringify(avgFlight), mean_speed: avgSpeed, std_deviation: avgStd, sample_count: newCount, is_enrolled: newCount >= MIN_SAMPLES }
        });
    }

    res.json({ message: profile.is_enrolled ? 'Keystroke profile enrolled successfully' : `Sample ${profile.sample_count}/${MIN_SAMPLES} recorded`, isEnrolled: profile.is_enrolled, sampleCount: profile.sample_count, samplesNeeded: MIN_SAMPLES });
};

exports.keystrokeVerify = async (req, res) => {
    const { email, holdTimes, flightTimes, meanSpeed } = req.body;
    if (!email || !holdTimes || !flightTimes) return res.status(400).json({ error: 'Email and keystroke data required' });
    
    // SECURITY: Ensure user can only probe their own keystroke profile
    if (req.user && req.user.email !== email.trim().toLowerCase()) {
        return res.status(403).json({ error: 'Cannot verify keystroke profile for another user' });
    }

    const profile = await prisma.keystrokeProfile.findUnique({ where: { user_email: email.trim().toLowerCase() } });
    if (!profile || !profile.is_enrolled) return res.json({ verified: true, score: 0, reason: 'No enrolled profile — skipping verification', enrolled: false });

    const storedHold = JSON.parse(profile.hold_times);
    const storedFlight = JSON.parse(profile.flight_times);
    let holdDistance = 0, flightDistance = 0;
    for (let i = 0; i < Math.min(holdTimes.length, storedHold.length); i++) holdDistance += Math.pow((holdTimes[i] - storedHold[i]), 2);
    for (let i = 0; i < Math.min(flightTimes.length, storedFlight.length); i++) flightDistance += Math.pow((flightTimes[i] - storedFlight[i]), 2);

    const totalDistance = Math.sqrt(holdDistance + flightDistance);
    const speedDiff = Math.abs((meanSpeed || 0) - profile.mean_speed);
    const score = parseFloat((totalDistance + speedDiff * 10).toFixed(2));
    const THRESHOLD = 500;
    const verified = score < THRESHOLD;

    await prisma.keystrokeProfile.update({
        where: { user_email: email.trim().toLowerCase() },
        data: { last_verified: new Date(), last_score: score, flagged_count: verified ? profile.flagged_count : profile.flagged_count + 1 }
    });

    if (!verified) console.warn(`⚠️ Keystroke mismatch for ${email} — Score: ${score} (threshold: ${THRESHOLD})`);

    res.json({ verified, score, threshold: THRESHOLD, enrolled: true, reason: verified ? 'Keystroke pattern matches enrolled profile' : 'Keystroke pattern differs significantly from enrolled profile' });
};

// ===================== USER PROFILE =====================
exports.getMe = async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, fullname: true, voter_id: true, email: true, wallet_address: true, has_voted: true, father_name: true, gender: true, dob: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, fullname: user.fullname, voterId: user.voter_id, email: user.email, hasVoted: user.has_voted, walletAddress: user.wallet_address, fatherName: user.father_name, gender: user.gender, dob: user.dob });
};

exports.updateProfile = async (req, res) => {
    const { fatherName, gender, dob, address } = req.body;
    const updates = {};
    if (fatherName !== undefined) updates.father_name = sanitize(fatherName);
    if (gender !== undefined) updates.gender = sanitize(gender);
    if (dob !== undefined) updates.dob = sanitize(dob);
    if (address !== undefined) updates.address = sanitize(address);
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });
    await prisma.user.update({ where: { id: req.user.id }, data: updates });
    res.json({ message: 'Profile updated successfully' });
};

exports.linkWallet = async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: 'Wallet address is required' });
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) return res.status(400).json({ error: 'Invalid Ethereum address format' });
    const existing = await prisma.user.findFirst({ where: { wallet_address: walletAddress, id: { not: req.user.id } } });
    if (existing) return res.status(409).json({ error: 'This wallet address is already linked to another account' });
    await prisma.user.update({ where: { id: req.user.id }, data: { wallet_address: walletAddress } });
    res.json({ message: 'Wallet linked successfully' });
};
