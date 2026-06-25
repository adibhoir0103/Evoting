// Email service for sending OTP via Brevo (formerly Sendinblue)
// Switched from Resend to Brevo for better free tier (300 emails/day, no domain verification needed)

const logger = require('../lib/logger');
const emailLog = logger.child('email');

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'bharat-evote@gmail.com';
const FROM_NAME = process.env.BREVO_FROM_NAME || 'Bharat E-Vote';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Escape HTML entities to prevent injection in email templates
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

class EmailService {
    constructor() {
        this.isReady = false;

        if (BREVO_API_KEY && BREVO_API_KEY.startsWith('xkeysib-')) {
            this.isReady = true;
            emailLog.info(`Brevo initialized | From: ${FROM_NAME} <${FROM_EMAIL}> | Key: xkeysib-****${BREVO_API_KEY.slice(-4)}`);
        } else if (BREVO_API_KEY) {
            emailLog.error('BREVO_API_KEY is set but does not start with "xkeysib-". Check your .env file.');
        }
    }

    /**
     * Internal: Send email via Brevo REST API
     */
    async _sendBrevo({ to, toName, subject, htmlContent }) {
        const response = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: FROM_NAME, email: FROM_EMAIL },
                to: [{ email: to, name: toName || to }],
                subject,
                htmlContent
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Brevo API error: ${response.status}`);
        }

        return data; // { messageId: "..." }
    }

    /**
     * Send OTP via email using Brevo
     * @param {string} email - Recipient email
     * @param {string} otp - 6-digit OTP
     * @param {string} userName - User's name for personalization
     * @returns {{ success: boolean, messageId: string, email: string, demo?: boolean }}
     */
    async sendOTP(email, otp, userName = 'Voter', subject = 'Login Verification') {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        font-family: 'Inter', 'Segoe UI', sans-serif; 
                        background: #f5f7fa; 
                        padding: 20px; 
                    }
                    .container { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        background: white; 
                        border-radius: 8px; 
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                        overflow: hidden;
                    }
                    .header { 
                        background: #000080; 
                        color: white; 
                        padding: 30px 20px; 
                        text-align: center; 
                    }
                    .header h1 { 
                        margin: 0; 
                        font-size: 24px; 
                    }
                    .badge {
                        background: #FF9933;
                        padding: 4px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 600;
                        display: inline-block;
                        margin-bottom: 10px;
                    }
                    .content { 
                        padding: 40px 30px; 
                    }
                    .otp-box { 
                        background: #f0f7ff; 
                        border: 2px solid #000080; 
                        border-radius: 8px; 
                        padding: 20px; 
                        text-align: center; 
                        margin: 30px 0; 
                    }
                    .otp-code { 
                        font-size: 36px; 
                        font-weight: 700; 
                        color: #000080; 
                        letter-spacing: 8px; 
                        margin: 10px 0;
                    }
                    .warning { 
                        background: #fff8e6; 
                        border-left: 4px solid #FF9933; 
                        padding: 15px; 
                        margin: 20px 0; 
                    }
                    .footer { 
                        background: #f5f7fa; 
                        padding: 20px; 
                        text-align: center; 
                        font-size: 12px; 
                        color: #777; 
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <span class="badge">SECURE OTP</span>
                        <h1>\ud83c\uddee\ud83c\uddf3 Bharat E-Vote</h1>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">Blockchain Voting System</p>
                    </div>
                    
                    <div class="content">
                        <h2 style="color: #000080; margin-top: 0;">Hello, ${escapeHtml(userName)}!</h2>
                        <p>You have requested to login to your Bharat E-Vote account using OTP authentication.</p>
                        
                        <div class="otp-box">
                            <p style="margin: 0; color: #555; font-size: 14px;">Your One-Time Password (OTP)</p>
                            <div class="otp-code">${otp}</div>
                            <p style="margin: 0; color: #777; font-size: 13px;">Valid for 5 minutes</p>
                        </div>
                        
                        <div class="warning">
                            <strong>\u26a0\ufe0f Security Notice:</strong>
                            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                <li>Never share this OTP with anyone</li>
                                <li>Bharat E-Vote will never ask for your OTP via call or SMS</li>
                                <li>This OTP expires in 5 minutes</li>
                                <li>If you didn't request this, please ignore this email</li>
                            </ul>
                        </div>
                        
                        <p style="color: #777; font-size: 14px; margin-top: 30px;">
                            This is an automated email from Bharat E-Vote. 
                            Please do not reply to this message.
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p style="margin: 0;">\u00a9 2026 Bharat E-Vote | Blockchain-Based E-Voting System</p>
                        <p style="margin: 5px 0 0 0;">Powered by Brevo Transactional Email</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Try sending real email via Brevo
        if (this.isReady) {
            try {
                emailLog.info(`Attempting Brevo email: from=${FROM_EMAIL} to=${email}`);
                const data = await this._sendBrevo({
                    to: email,
                    toName: userName,
                    subject: `Bharat E-Vote - ${subject}`,
                    htmlContent
                });

                emailLog.info(`OTP email sent via Brevo to: ${email} (ID: ${data.messageId})`);
                return {
                    success: true,
                    messageId: data.messageId,
                    email: email
                };
            } catch (error) {
                // Do NOT fall back to demo mode if Brevo is configured — surface the real error
                emailLog.error('Brevo send FAILED', { error: error.message, to: email });
                throw new Error(`Failed to send OTP email: ${error.message}`);
            }
        }

        // Demo mode — only when Brevo is NOT configured
        emailLog.debug(`[DEMO] OTP for ${email.slice(0, 3)}***: Brevo not configured, using demo mode`);
        return {
            success: true,
            messageId: 'demo-' + Date.now(),
            email: email,
            demo: true
        };
    }

    /**
     * Verify email configuration
     */
    async verifyConnection() {
        if (!this.isReady) {
            emailLog.warn('Email service (Brevo) not configured. Using demo mode.');
            emailLog.warn('   To enable: set BREVO_API_KEY and BREVO_FROM_EMAIL in .env');
            return false;
        }
        
        emailLog.info('Email service (Brevo) is ready — 300 free emails/day');
        return true;
    }

    /**
     * Send Vote Receipt via email using Brevo
     * @param {string} email - Recipient email
     * @param {string} userName - User's name
     * @param {string} txHash - Blockchain transaction hash
     */
    async sendVoteReceipt(email, userName, txHash) {
        const shortHash = txHash ? `${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}` : 'N/A';
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Inter', sans-serif; background: #070e20; color: white; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b; }
                    .header { background: #162a5c; padding: 30px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; color: white; }
                    .content { padding: 40px; }
                    .hash-box { background: #000; border: 1px solid #334155; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; font-family: monospace; color: #4ade80; }
                    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Digital Vote Safely Cast!</h1>
                    </div>
                    <div class="content">
                        <h2 style="margin-top: 0; color: #fff;">Namaste, ${escapeHtml(userName)}</h2>
                        <p style="color: #cbd5e1;">Your cryptographic vote has been successfully mined onto the blockchain network. Your identity has been completely decoupled from your vote using advanced Zero-Knowledge Proofs.</p>
                        <div class="hash-box">${shortHash}</div>
                        <p style="color: #94a3b8; font-size: 14px;">You can verify this transaction hash on the local block explorer to mathematically prove your vote was cast without revealing your candidate choice.</p>
                    </div>
                    <div class="footer">© 2026 Bharat E-Vote | Powered by Brevo</div>
                </div>
            </body>
            </html>
        `;

        if (!this.isReady) {
            emailLog.debug(`[DEMO MODE] Vote Receipt -> ${email}: ${txHash}`);
            return { success: true, messageId: 'demo-receipt', email, demo: true };
        }

        try {
            const data = await this._sendBrevo({
                to: email,
                toName: userName,
                subject: '🔒 Secure Vote Cast Receipt',
                htmlContent
            });
            return { success: true, messageId: data.messageId, email };
        } catch (error) {
            emailLog.error('Brevo receipt error', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    async sendBroadcastEmail(email, userName, subject, body) {
        if (!this.isReady) {
            emailLog.debug(`[DEMO] Broadcast to ${email}: ${subject}`);
            return { success: true, demo: true };
        }

        try {
            const data = await this._sendBrevo({
                to: email,
                toName: userName,
                subject: subject,
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2>Namaste, ${escapeHtml(userName)}</h2>
                        <p>${escapeHtml(body)}</p>
                        <br/>
                        <p style="color: #888; font-size: 12px;">This is an automated administrative notification from Bharat E-Vote.</p>
                    </div>
                `
            });
            return { success: true, messageId: data.messageId };
        } catch (error) {
            emailLog.error('Broadcast email error', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Send election notification email (reminders, voting started, last call)
     */
    async sendElectionNotification(email, userName, subject, bodyText, electionName) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #f5f7fa; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
                    .header { background: #000080; color: white; padding: 30px 20px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .content { padding: 30px 20px; }
                    .election-badge { background: #f0f9ff; border: 2px solid #000080; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0; }
                    .election-badge h3 { color: #000080; margin: 0; font-size: 18px; }
                    .body-text { white-space: pre-line; color: #333; line-height: 1.6; }
                    .cta-button { display: inline-block; background: #000080; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
                    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #777; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>\ud83c\uddee\ud83c\uddf3 Bharat E-Vote</h1>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">${subject}</p>
                    </div>
                    <div class="content">
                        <div class="election-badge">
                            <h3>\ud83d\uddf3\ufe0f ${electionName}</h3>
                        </div>
                        <div class="body-text">${bodyText}</div>
                        <div style="text-align: center;">
                            <a href="https://bharat-evote.me/${subject.includes('Results') ? 'results' : 'vote'}" class="cta-button">${subject.includes('Results') ? '📊 View Official Results' : '🗳️ Cast Your Vote Now'}</a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>\u00a9 2026 Bharat E-Vote | Blockchain-Based E-Voting System</p>
                        <p>This is an automated notification. Do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        if (this.isReady) {
            try {
                await this._sendBrevo({
                    to: email,
                    toName: userName,
                    subject: `Bharat E-Vote - ${subject}`,
                    htmlContent
                });
                return { success: true };
            } catch (error) {
                emailLog.error(`Election notification email error for ${email}`, { error: error.message });
                return { success: false, error: error.message };
            }
        } else {
            emailLog.debug(`[DEMO] Election notification to ${email}: ${subject}`);
            return { success: true, demo: true };
        }
    }

    /**
     * Send login credentials email after admin approves a voter registration
     * @param {string} email - Recipient email
     * @param {string} userName - Voter full name
     * @param {string} voterId - EPIC Voter ID
     * @param {string} tempPassword - System-generated temporary password
     */
    async sendLoginCredentials(email, userName, voterId, tempPassword) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #f5f7fa; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
                    .header { background: linear-gradient(135deg, #000080, #162a5c); color: white; padding: 30px 20px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .badge { background: #138808; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-block; margin-bottom: 10px; color: white; }
                    .content { padding: 40px 30px; }
                    .cred-box { background: #f0f7ff; border: 2px solid #000080; border-radius: 8px; padding: 24px; margin: 24px 0; }
                    .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e2eaf7; }
                    .cred-row:last-child { border-bottom: none; }
                    .cred-label { color: #555; font-size: 13px; font-weight: 600; }
                    .cred-value { font-family: monospace; font-size: 16px; font-weight: 700; color: #000080; letter-spacing: 2px; background: #fff; padding: 4px 12px; border-radius: 6px; border: 1px solid #c7d7f0; }
                    .warning { background: #fff8e6; border-left: 4px solid #FF9933; padding: 15px; margin: 20px 0; }
                    .cta-button { display: block; background: #000080; color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 15px; margin: 24px 0; }
                    .steps { background: #f8fdf8; border: 1px solid #c3e6c8; border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .step { display: flex; gap: 12px; margin-bottom: 12px; }
                    .step-num { background: #138808; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0; }
                    .footer { background: #f5f7fa; padding: 20px; text-align: center; font-size: 12px; color: #777; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <span class="badge">✅ REGISTRATION APPROVED</span>
                        <h1>🇮🇳 Bharat E-Vote</h1>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">Blockchain Voting System</p>
                    </div>
                    <div class="content">
                        <h2 style="color: #000080; margin-top: 0;">Namaste, ${escapeHtml(userName)}!</h2>
                        <p>Your voter registration has been <strong>approved</strong> by an Election Officer. You can now log in to the Bharat E-Vote portal.</p>

                        <div class="cred-box">
                            <p style="margin: 0 0 16px 0; font-size: 13px; color: #555; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Your Login Credentials</p>
                            <div class="cred-row">
                                <span class="cred-label">🪪 Voter ID (EPIC)</span>
                                <span class="cred-value">${escapeHtml(voterId)}</span>
                            </div>
                            <div class="cred-row">
                                <span class="cred-label">📧 Email</span>
                                <span class="cred-value" style="font-size:13px; letter-spacing:0;">${escapeHtml(email)}</span>
                            </div>
                            <div class="cred-row">
                                <span class="cred-label">🔑 Temporary Password</span>
                                <span class="cred-value">${escapeHtml(tempPassword)}</span>
                            </div>
                        </div>

                        <div class="steps">
                            <p style="margin: 0 0 12px 0; font-weight: 700; color: #138808;">📋 Next Steps</p>
                            <div class="step"><div class="step-num">1</div><span>Go to the Bharat E-Vote login page and enter your Voter ID or Email along with the temporary password above.</span></div>
                            <div class="step"><div class="step-num">2</div><span>You will be asked to <strong>set a new permanent password</strong> before you can access your dashboard.</span></div>
                            <div class="step"><div class="step-num">3</div><span>Complete the OTP verification sent to this email, then you're all set to vote!</span></div>
                        </div>

                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong>
                            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                <li>This temporary password expires after your first login — you must set a new one.</li>
                                <li>Never share your credentials with anyone.</li>
                                <li>Bharat E-Vote officials will never ask for your password.</li>
                                <li>If you did not register, please call ECI Helpline 1950 immediately.</li>
                            </ul>
                        </div>

                        <p style="color: #777; font-size: 14px;">This is an automated email from Bharat E-Vote. Do not reply to this message.</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 0;">© 2026 Bharat E-Vote | Blockchain-Based E-Voting System</p>
                        <p style="margin: 5px 0 0 0;">Election Commission of India</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        if (this.isReady) {
            try {
                const data = await this._sendBrevo({
                    to: email,
                    toName: userName,
                    subject: '✅ Registration Approved — Your Bharat E-Vote Login Credentials',
                    htmlContent
                });
                emailLog.info(`Login credentials sent to: ${email} (ID: ${data.messageId})`);
                return { success: true, messageId: data.messageId, email };
            } catch (error) {
                emailLog.error('Failed to send login credentials', { error: error.message, to: email });
                throw new Error(`Failed to send credentials email: ${error.message}`);
            }
        }

        // Demo mode
        emailLog.info(`[DEMO] Login credentials for ${email}: VoterID=${voterId}, TempPass=${tempPassword}`);
        return { success: true, messageId: 'demo-creds-' + Date.now(), email, demo: true };
    }

    /**
     * Send acknowledgment email when a user submits a registration application
     * @param {string} email - Recipient email
     * @param {string} userName - Voter full name
     * @param {string} voterId - EPIC Voter ID
     */
    async sendRegistrationAcknowledgment(email, userName, voterId) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #f5f7fa; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
                    .header { background: linear-gradient(135deg, #000080, #162a5c); color: white; padding: 30px 20px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .badge { background: #FF9933; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-block; margin-bottom: 10px; color: white; }
                    .content { padding: 40px 30px; }
                    .info-box { background: #f0f7ff; border: 2px solid #000080; border-radius: 8px; padding: 24px; margin: 24px 0; }
                    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e2eaf7; }
                    .info-row:last-child { border-bottom: none; }
                    .info-label { color: #555; font-size: 13px; font-weight: 600; }
                    .info-value { font-family: monospace; font-size: 16px; font-weight: 700; color: #000080; letter-spacing: 2px; background: #fff; padding: 4px 12px; border-radius: 6px; border: 1px solid #c7d7f0; }
                    .steps { background: #f8fdf8; border: 1px solid #c3e6c8; border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .step { display: flex; gap: 12px; margin-bottom: 12px; }
                    .step-num { background: #138808; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0; }
                    .footer { background: #f5f7fa; padding: 20px; text-align: center; font-size: 12px; color: #777; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <span class="badge">⏳ APPLICATION SUBMITTED</span>
                        <h1>🇮🇳 Bharat E-Vote</h1>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">Blockchain Voting System</p>
                    </div>
                    <div class="content">
                        <h2 style="color: #000080; margin-top: 0;">Namaste, ${escapeHtml(userName)}!</h2>
                        <p>We have successfully received your voter registration application on the Bharat E-Vote portal.</p>

                        <div class="info-box">
                            <p style="margin: 0 0 16px 0; font-size: 13px; color: #555; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Application Details</p>
                            <div class="info-row">
                                <span class="info-label">🪪 Voter ID (EPIC)</span>
                                <span class="info-value">${escapeHtml(voterId)}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">📅 Date</span>
                                <span class="info-value" style="font-size:14px; letter-spacing:0;">${new Date().toLocaleDateString('en-IN')}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">📊 Status</span>
                                <span class="info-value" style="color: #FF9933;">PENDING REVIEW</span>
                            </div>
                        </div>

                        <div class="steps">
                            <p style="margin: 0 0 12px 0; font-weight: 700; color: #138808;">📋 What Happens Next?</p>
                            <div class="step"><div class="step-num">1</div><span>An Election Officer will review and verify your submitted details.</span></div>
                            <div class="step"><div class="step-num">2</div><span>Once approved, you will receive another email containing your login credentials.</span></div>
                            <div class="step"><div class="step-num">3</div><span>If rejected, you will be notified and asked to contact your local election office.</span></div>
                        </div>

                        <p style="color: #777; font-size: 14px;">This process typically takes 1-2 working days.</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 0;">© 2026 Bharat E-Vote | Blockchain-Based E-Voting System</p>
                        <p style="margin: 5px 0 0 0;">Election Commission of India</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        if (this.isReady) {
            try {
                const data = await this._sendBrevo({
                    to: email,
                    toName: userName,
                    subject: '⏳ Application Received — Bharat E-Vote Registration',
                    htmlContent
                });
                emailLog.info(`Registration acknowledgment sent to: ${email} (ID: ${data.messageId})`);
                return { success: true, messageId: data.messageId, email };
            } catch (error) {
                emailLog.error('Failed to send registration acknowledgment', { error: error.message, to: email });
                // We don't throw an error here to prevent blocking the registration flow
                return { success: false, error: error.message };
            }
        }

        // Demo mode
        emailLog.info(`[DEMO] Registration acknowledgment for ${email}: VoterID=${voterId}`);
        return { success: true, messageId: 'demo-ack-' + Date.now(), email, demo: true };
    }

    /**
     * Send account lockout notification
     * @param {string} email - Recipient email
     * @param {string} userName - Voter full name
     */
    async sendAccountLockoutNotification(email, userName) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #f5f7fa; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
                    .header { background: #800000; color: white; padding: 30px 20px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .badge { background: #FF0000; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-block; margin-bottom: 10px; color: white; }
                    .content { padding: 40px 30px; }
                    .warning-box { background: #fff0f0; border: 2px solid #ffcccc; border-radius: 8px; padding: 24px; margin: 24px 0; }
                    .cta-button { display: block; background: #800000; color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 15px; margin: 24px 0; }
                    .footer { background: #f5f7fa; padding: 20px; text-align: center; font-size: 12px; color: #777; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <span class="badge">SECURITY ALERT</span>
                        <h1>🇮🇳 Bharat E-Vote</h1>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">Account Locked</p>
                    </div>
                    <div class="content">
                        <h2 style="color: #800000; margin-top: 0;">Namaste, ${escapeHtml(userName)}</h2>
                        
                        <div class="warning-box">
                            <p style="margin: 0; color: #cc0000; font-weight: bold;">Too many failed login attempts.</p>
                            <p style="margin: 10px 0 0 0; color: #555;">To protect your account, we have temporarily locked your login access for 15 minutes.</p>
                        </div>

                        <p>If you forgot your password, you can reset it securely using the link below:</p>

                        <a href="https://bharat-evote.me/forgot-password" class="cta-button">Reset My Password</a>

                        <p style="color: #555; font-size: 14px; margin-top: 20px;">
                            <strong>Didn't try to log in?</strong><br/>
                            Someone may be trying to access your account. Your account remains safe, but we recommend resetting your password if you suspect malicious activity.
                        </p>
                    </div>
                    <div class="footer">
                        <p style="margin: 0;">© 2026 Bharat E-Vote | Security System</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        if (this.isReady) {
            try {
                const data = await this._sendBrevo({
                    to: email,
                    toName: userName,
                    subject: '⚠️ Security Alert: Your Account is Temporarily Locked',
                    htmlContent
                });
                emailLog.info(`Lockout notification sent to: ${email} (ID: ${data.messageId})`);
                return { success: true, messageId: data.messageId, email };
            } catch (error) {
                emailLog.error('Failed to send lockout notification', { error: error.message, to: email });
                return { success: false, error: error.message };
            }
        }

        emailLog.info(`[DEMO] Lockout notification for ${email}`);
        return { success: true, messageId: 'demo-lockout-' + Date.now(), email, demo: true };
    }

}

// Singleton instance
const emailService = new EmailService();

// Verify on startup
emailService.verifyConnection().catch(() => {
    // Ignore errors in demo mode
});

module.exports = emailService;
