// Email service for sending OTP via Resend
// Replaces nodemailer with Resend for reliable, production-grade email delivery
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

class EmailService {
    constructor() {
        this.isReady = false;

        if (RESEND_API_KEY) {
            this.resend = new Resend(RESEND_API_KEY);
            this.isReady = true;
        } else {
            this.resend = null;
        }
    }

    /**
     * Send OTP via email using Resend
     * @param {string} email - Recipient email
     * @param {string} otp - 6-digit OTP
     * @param {string} userName - User's name for personalization
     * @returns {{ success: boolean, messageId: string, email: string, demo?: boolean }}
     */
    async sendOTP(email, otp, userName = 'Voter') {
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
                        <p style="margin: 5px 0 0 0;">Powered by Resend</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Try sending real email via Resend
        if (this.isReady && this.resend) {
            try {
                const { data, error } = await this.resend.emails.send({
                    from: `Bharat E-Vote <${FROM_EMAIL}>`,
                    to: [email],
                    subject: 'Your Bharat E-Vote OTP - Secure Login',
                    html: htmlContent,
                });

                if (error) {
                    console.error('\ud83d\udce7 Resend email error:', error);
                    // Fall through to demo mode
                } else {
                    console.log('\ud83d\udce7 Email OTP sent via Resend to:', email);
                    return {
                        success: true,
                        messageId: data.id,
                        email: email
                    };
                }
            } catch (error) {
                console.error('\ud83d\udce7 Resend send failed, falling back to demo mode:', error.message);
                // Fall through to demo mode below
            }
        }

        // Demo mode — log and return
        if (process.env.NODE_ENV !== 'production') {
            console.log(`\ud83d\udce7 [DEMO] OTP for ${email.slice(0, 3)}***: Resend not configured, using demo mode`);
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
        if (!this.resend) {
            console.warn('\u26a0\ufe0f  Email service (Resend) not configured. Using demo mode.');
            console.warn('To enable real emails, set RESEND_API_KEY environment variable');
            this.isReady = false;
            return false;
        }
        
        console.log('\u2705 Email service (Resend) is ready to send emails');
        this.isReady = true;
        return true;
    }
}

// Singleton instance
const emailService = new EmailService();

// Verify on startup
emailService.verifyConnection().catch(() => {
    // Ignore errors in demo mode
});

module.exports = emailService;
