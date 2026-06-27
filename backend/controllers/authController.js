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

// ===================== APPLY FOR REGISTRATION (no password — admin approves) =====================
exports.register = async (req, res) => {
    // Inputs are already validated and sanitized by Zod & sanitizeHtml
    const { fullname, email, voter_id, aadhaar_number, father_name, gender, dob, mobile_number, state_code, constituency_code, address } = req.body;

    // Check for existing application / account
    const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email }, { voter_id }] }
    });
    if (existingUser) {
        // Prevent enumeration: always return the identical success message
        return res.status(201).json({
            message: 'Application submitted! You will receive your login credentials by email once an Election Officer approves your registration.',
            applied: true
        });
    }

    // Hash Aadhaar with HMAC-SHA256 pepper for PII protection
    let hashedAadhaar = null;
    if (aadhaar_number) {
        const cleanAadhaar = aadhaar_number.replace(/\s/g, '');
        const pepper = process.env.AADHAAR_PEPPER || 'dev-local-aadhaar-pepper';
        hashedAadhaar = crypto.createHmac('sha256', pepper).update(cleanAadhaar).digest('hex');

        const existingAadhaar = await prisma.user.findUnique({ where: { aadhaar_number: hashedAadhaar } });
        if (existingAadhaar) {
            return res.status(409).json({ error: 'This Aadhaar number is already linked to another application.' });
        }
    }

    // Create user in PENDING state — no password yet
    await prisma.user.create({
        data: {
            fullname, email, voter_id, aadhaar_number: hashedAadhaar,
            father_name, gender, dob, mobile_number,
            state_code: state_code ? parseInt(state_code) : null,
            constituency_code: constituency_code ? parseInt(constituency_code) : null,
            address,
            role: 'VOTER',
            registration_status: 'PENDING',
            must_change_password: false
        }
    });

    await prisma.loginHistory.create({
        data: { voter_id, ip_address: req.ip, status: 'REGISTERED' }
    }).catch(() => {});

    // Send acknowledgment email using Brevo
    const emailService = require('../services/emailService');
    // We don't await this so it doesn't block the API response
    emailService.sendRegistrationAcknowledgment(email, fullname, voter_id).catch(() => {});

    res.status(201).json({
        message: 'Application submitted! You will receive your login credentials by email once an Election Officer approves your registration.',
        applied: true
    });
};

// ===================== SET NEW PASSWORD (first-login forced change) =====================
exports.setNewPassword = async (req, res) => {
    // Input is already validated by Zod
    const { newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(401).json({ error: 'Authentication failed.' });
    if (!user.must_change_password) {
        return res.status(400).json({ error: 'Password change is not required for this account.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Clear temp password, unset the flag, and kill active sessions
    await Promise.all([
        prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword, must_change_password: false, temp_password_expires_at: null, active_session_token: null, active_session_expires: null }
        }),
        redisService.clearActiveSession(user.id)
    ]);

    // Clear old session cookie — user must re-login with new password
    clearTokenCookie(res, 'token');

    await prisma.loginHistory.create({
        data: { voter_id: user.voter_id, ip_address: req.ip, status: 'PASSWORD_SET' }
    }).catch(() => {});

    res.json({ message: 'Password set successfully! Please log in with your new password.', passwordSet: true });
};


// ===================== LOGIN (Step 1) =====================
exports.login = async (req, res) => {
    // Inputs validated and sanitized by Zod
    const { identifier, password } = req.body;
    const cleanIdentifier = identifier.toLowerCase();

    // 1. Check lockout status & calculate progressive delay
    const isLocked = await redisService.isAccountLocked(cleanIdentifier);
    const failedAttempts = await redisService.getFailedLoginAttempts(cleanIdentifier);
    
    // Progressive delay: 2^attempts * 500ms, max 8000ms
    const delayMs = Math.min(Math.pow(2, failedAttempts) * 500, 8000);
    if (failedAttempts > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    if (isLocked) {
        // Return generic error so attackers don't know it's locked
        return res.status(401).json({ error: 'Incorrect email or password' });
    }

    const user = await prisma.user.findFirst({
        where: { OR: [{ email: identifier }, { voter_id: identifier.toUpperCase() }] }
    });

    if (!user) {
        await redisService.incrementFailedLogin(cleanIdentifier);
        return res.status(401).json({ error: 'Incorrect email or password' });
    }

    // Registration status gate
    if (user.registration_status === 'PENDING') {
        return res.status(401).json({ error: 'Incorrect email or password' }); // Mask pending status
    }
    if (user.registration_status === 'REJECTED') {
        return res.status(401).json({ error: 'Incorrect email or password' }); // Mask rejected status
    }

    if (!user.password) return res.status(401).json({ error: 'Incorrect email or password' }); // Mask uninitialized password

    let isValidPassword = false;
    let needsRehash = false;

    if (user.password.startsWith('$2')) {
        // It's a bcrypt hash
        isValidPassword = await bcrypt.compare(password, user.password);
        // Check if cost factor is less than 12
        if (isValidPassword && !user.password.startsWith('$2b$12$') && !user.password.startsWith('$2a$12$')) {
            needsRehash = true;
        }
    } else {
        // Legacy plain-text fallback for migration
        // Note: Use constant-time comparison even for plain text to prevent timing attacks
        try {
            isValidPassword = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(user.password));
        } catch (e) {
            // Buffers might be of unequal length
            isValidPassword = password === user.password; 
        }
        if (isValidPassword) {
            needsRehash = true;
        }
    }

    if (!isValidPassword) {
        await prisma.loginHistory.create({ data: { voter_id: user.voter_id, ip_address: req.ip, status: 'FAILED' } }).catch(() => {});
        
        const newFailedCount = await redisService.incrementFailedLogin(cleanIdentifier);
        if (newFailedCount >= 5) {
            await redisService.setAccountLockout(cleanIdentifier, 15);
            const emailService = require('../services/emailService');
            // Send email asynchronously
            emailService.sendAccountLockoutNotification(user.email, user.fullname || 'User').catch(() => {});
        }

        return res.status(401).json({ error: 'Incorrect email or password' });
    }

    // MIGRATION: Re-hash weak or plain-text passwords transparently
    if (needsRehash) {
        const newHash = await bcrypt.hash(password, 12);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: newHash }
        }).catch(err => console.error(`Migration failed for user ${user.id}:`, err.message));
    }

    // Successful login - clear failed attempts
    await redisService.clearFailedLogin(cleanIdentifier);

    // Check if temporary password has expired
    if (user.must_change_password && user.temp_password_expires_at) {
        if (new Date() > new Date(user.temp_password_expires_at)) {
            return res.status(401).json({ error: 'Your temporary password has expired. Please contact the Election Officer for a new one.' });
        }
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

    const loginResponse = {
        message: 'Password verified. OTP sent to your registered email.', mfaRequired: true, preAuthToken,
        maskedEmail: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        user: { id: user.id, fullname: user.fullname, voterId: user.voter_id, hasVoted: user.has_voted, walletAddress: user.wallet_address },
        mustChangePassword: user.must_change_password
    };

    // Include OTP in non-production for demo/testing
    if (process.env.NODE_ENV !== 'production') {
        loginResponse.otpDemo = otp;
    }

    res.json(loginResponse);
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

    const isValidOtp = (process.env.NODE_ENV !== 'production' && otp.trim() === '000000') || await bcrypt.compare(otp.trim(), mfaToken.otp_hash);
    if (!isValidOtp) {
        await prisma.mfaToken.update({ where: { id: mfaToken.id }, data: { attempts: mfaToken.attempts + 1 } });
        return res.status(401).json({ error: `Invalid OTP. ${5 - (mfaToken.attempts + 1)} attempts remaining.`, attemptsRemaining: 5 - (mfaToken.attempts + 1) });
    }

    await prisma.mfaToken.update({ where: { id: mfaToken.id }, data: { verified: true } });

    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) return res.status(401).json({ error: 'Authentication failed.' });

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
    if (!user) return res.status(401).json({ error: 'Authentication failed.' });

    await prisma.mfaToken.updateMany({ where: { user_email: user.email, verified: false }, data: { verified: true } });

    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.mfaToken.create({
        data: { user_email: user.email, otp_hash: otpHash, purpose: 'LOGIN', expires_at: expiresAt, verified: false, attempts: 0 }
    });

    const emailService = require('../services/emailService');
    await emailService.sendOTP(user.email, otp, user.fullname || 'Voter');

    const resendResponse = { message: 'New OTP sent to your registered email.', email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') };

    // Include OTP in non-production for demo/testing
    if (process.env.NODE_ENV !== 'production') {
        resendResponse.otpDemo = otp;
    }

    res.json(resendResponse);
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
    
    if (!user) {
        // Return a fake token to prevent user enumeration
        const fakeToken = jwt.sign({ email: cleanEmail, purpose: 'fake_password_reset' }, EFFECTIVE_JWT_SECRET, { expiresIn: '10m' });
        return res.json({ message: 'If that email is registered, you\'ll receive a reset link', resetToken: fakeToken });
    }

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

    res.json({ message: 'If that email is registered, you\'ll receive a reset link', resetToken });
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
                    active_session_expires: null,
                    must_change_password: false
                } 
            })
        ]);
    } else {
        await prisma.user.update({ 
            where: { email: decoded.email }, 
            data: { 
                password: hashedPassword,
                must_change_password: false
            } 
        });
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
    if (!user) return res.status(401).json({ error: 'Authentication session invalid.' });
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

/**
 * keystrokeProcess — Combined verify + auto-enroll endpoint for login flow.
 * Uses preAuthToken (JWT with step:'mfa_pending') so it works BEFORE full
 * session JWT exists. This is the primary endpoint the frontend uses.
 */
exports.keystrokeProcess = async (req, res) => {
    const { preAuthToken, holdTimes, flightTimes, meanSpeed, stdDeviation } = req.body;
    if (!preAuthToken) return res.status(400).json({ error: 'Pre-auth token is required' });
    if (!holdTimes || !flightTimes) return res.status(400).json({ error: 'Keystroke timing data is required' });

    // Decode the preAuthToken (same mechanism as verifyOtp)
    let decoded;
    try { decoded = jwt.verify(preAuthToken, EFFECTIVE_JWT_SECRET); }
    catch (err) { return res.status(401).json({ error: 'Session expired. Please login again.' }); }

    const userEmail = decoded.email;
    if (!userEmail) return res.status(400).json({ error: 'Invalid token: missing email' });

    const MIN_SAMPLES = 3;
    const THRESHOLD = 500;

    let profile = await prisma.keystrokeProfile.findUnique({ where: { user_email: userEmail } });

    // If no profile or not enrolled — enroll (collect samples)
    if (!profile) {
        profile = await prisma.keystrokeProfile.create({
            data: { user_email: userEmail, hold_times: JSON.stringify(holdTimes), flight_times: JSON.stringify(flightTimes), mean_speed: meanSpeed || 0, std_deviation: stdDeviation || 0, sample_count: 1, is_enrolled: false }
        });
        return res.json({ action: 'enrolled', verified: true, enrolled: false, sampleCount: 1, samplesNeeded: MIN_SAMPLES, message: `Keystroke sample 1/${MIN_SAMPLES} recorded`, reason: 'First sample recorded — building profile' });
    }

    if (!profile.is_enrolled) {
        // Continue enrollment
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
        return res.json({ action: 'enrolled', verified: true, enrolled: profile.is_enrolled, sampleCount: profile.sample_count, samplesNeeded: MIN_SAMPLES, message: profile.is_enrolled ? 'Keystroke profile enrolled successfully' : `Sample ${profile.sample_count}/${MIN_SAMPLES} recorded`, reason: profile.is_enrolled ? 'Profile complete — verification active from next login' : 'Building keystroke profile' });
    }

    // Profile is enrolled — verify
    const storedHold = JSON.parse(profile.hold_times);
    const storedFlight = JSON.parse(profile.flight_times);
    let holdDistance = 0, flightDistance = 0;
    for (let i = 0; i < Math.min(holdTimes.length, storedHold.length); i++) holdDistance += Math.pow((holdTimes[i] - storedHold[i]), 2);
    for (let i = 0; i < Math.min(flightTimes.length, storedFlight.length); i++) flightDistance += Math.pow((flightTimes[i] - storedFlight[i]), 2);

    const totalDistance = Math.sqrt(holdDistance + flightDistance);
    const speedDiff = Math.abs((meanSpeed || 0) - profile.mean_speed);
    const score = parseFloat((totalDistance + speedDiff * 10).toFixed(2));
    const verified = score < THRESHOLD;

    await prisma.keystrokeProfile.update({
        where: { user_email: userEmail },
        data: { last_verified: new Date(), last_score: score, flagged_count: verified ? profile.flagged_count : profile.flagged_count + 1 }
    });

    if (!verified) console.warn(`⚠️ Keystroke mismatch for ${userEmail} — Score: ${score} (threshold: ${THRESHOLD})`);

    res.json({ action: 'verified', verified, score, threshold: THRESHOLD, enrolled: true, reason: verified ? 'Keystroke pattern matches enrolled profile' : 'Keystroke pattern differs significantly from enrolled profile' });
};

// ===================== USER PROFILE =====================
exports.getMe = async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, fullname: true, voter_id: true, email: true, wallet_address: true, has_voted: true, father_name: true, gender: true, dob: true, must_change_password: true }
    });
    if (!user) return res.status(401).json({ error: 'Authentication failed.' });
    res.json({ id: user.id, fullname: user.fullname, voterId: user.voter_id, email: user.email, hasVoted: user.has_voted, walletAddress: user.wallet_address, fatherName: user.father_name, gender: user.gender, dob: user.dob, mustChangePassword: user.must_change_password });
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
