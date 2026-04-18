// Email service for sending OTP via Brevo (formerly Sendinblue)
// Switched from Resend to Brevo for better free tier (300 emails/day, no domain verification needed)

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'bharat-evote@gmail.com';
const FROM_NAME = process.env.BREVO_FROM_NAME || 'Bharat E-Vote';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

class EmailService {
    constructor() {
        this.isReady = false;

        if (BREVO_API_KEY && BREVO_API_KEY.startsWith('xkeysib-')) {
            this.isReady = true;
            console.log(`📧 Brevo initialized | From: ${FROM_NAME} <${FROM_EMAIL}> | Key: xkeysib-****${BREVO_API_KEY.slice(-4)}`);
        } else if (BREVO_API_KEY) {
            console.error('❌ BREVO_API_KEY is set but does not start with "xkeysib-". Check your .env file.');
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
                        <h2 style="color: #000080; margin-top: 0;">Hello, ${userName}!</h2>
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
                console.log(`📧 Attempting Brevo email: from=${FROM_EMAIL} to=${email}`);
                const data = await this._sendBrevo({
                    to: email,
                    toName: userName,
                    subject: `Bharat E-Vote - ${subject}`,
                    htmlContent
                });

                console.log(`📧 ✅ OTP email sent via Brevo to: ${email} (ID: ${data.messageId})`);
                return {
                    success: true,
                    messageId: data.messageId,
                    email: email
                };
            } catch (error) {
                console.error('📧 Brevo send failed, falling back to demo mode:', error.message);
                // Fall through to demo mode below
            }
        }

        // Demo mode — log and return
        if (process.env.NODE_ENV !== 'production') {
            console.log(`📧 [DEMO] OTP for ${email.slice(0, 3)}***: Brevo not configured, using demo mode`);
        }
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
            console.warn('⚠️  Email service (Brevo) not configured. Using demo mode.');
            console.warn('   To enable real emails:');
            console.warn('   1. Sign up at https://app.brevo.com/');
            console.warn('   2. Go to https://app.brevo.com/settings/keys/api');
            console.warn('   3. Create an API key and set BREVO_API_KEY in your .env');
            console.warn('   4. Set BREVO_FROM_EMAIL to your verified sender email');
            return false;
        }
        
        console.log('✅ Email service (Brevo) is ready — 300 free emails/day');
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
                        <h2 style="margin-top: 0; color: #fff;">Namaste, ${userName}</h2>
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
            console.log(`[DEMO MODE] Vote Receipt -> ${email}: ${txHash}`);
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
            console.error('Brevo receipt error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendBroadcastEmail(email, userName, subject, body) {
        if (!this.isReady) {
            console.log(`[DEMO] Broadcast to ${email}: ${subject}`);
            return { success: true, demo: true };
        }

        try {
            const data = await this._sendBrevo({
                to: email,
                toName: userName,
                subject: subject,
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2>Namaste, ${userName}</h2>
                        <p>${body}</p>
                        <br/>
                        <p style="color: #888; font-size: 12px;">This is an automated administrative notification from Bharat E-Vote.</p>
                    </div>
                `
            });
            return { success: true, messageId: data.messageId };
        } catch (error) {
            console.error('Broadcast email error:', error);
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
                            <a href="https://bharat-evote.netlify.app/vote" class="cta-button">\ud83d\uddf3\ufe0f Cast Your Vote Now</a>
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
                console.error(`Election notification email error for ${email}:`, error.message);
                return { success: false, error: error.message };
            }
        } else {
            console.log(`[DEMO] Election notification to ${email}: ${subject}`);
            return { success: true, demo: true };
        }
    }
}

// Singleton instance
const emailService = new EmailService();

// Verify on startup
emailService.verifyConnection().catch(() => {
    // Ignore errors in demo mode
});

module.exports = emailService;
