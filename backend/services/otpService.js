// OTP Service for Aadhaar Authentication
// Simulates OTP generation and verification for demo purposes
const crypto = require('crypto');
const emailService = require('./emailService');

class OTPService {
    constructor() {
        // In-memory store for demo (in production, use Redis or database)
        this.otpStore = new Map();
        this.OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
        this.MAX_ATTEMPTS = 3;
    }

    /**
     * Generate a 6-digit OTP
     */
    generateOTP() {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Send OTP to email or mobile number
     * @param {string} recipient - Email or mobile number
     * @param {string} identifier - Aadhaar or user identifier
     * @param {string} method - 'email' or 'mobile'
     * @param {string} userName - User's name (optional)
     */
    async sendOTP(recipient, identifier, method = 'email', userName = 'Voter') {
        try {
            // Generate OTP
            const otp = this.generateOTP();
            const expiryTime = Date.now() + this.OTP_EXPIRY;

            // Store OTP
            this.otpStore.set(identifier, {
                otp,
                recipient,
                method,
                expiryTime,
                attempts: 0,
                createdAt: Date.now()
            });

            // Send OTP based on method
            if (method === 'email') {
                // Send via emailService (real or demo depending on config)
                const emailResult = await emailService.sendOTP(recipient, otp, userName);

                return {
                    success: true,
                    message: `OTP sent to ${recipient.slice(0, 3)}***${recipient.slice(-10)}`,
                    method: 'email',
                    // Include demoOTP in dev mode when emailService is in demo mode
                    ...(emailResult.demo && process.env.NODE_ENV !== 'production' && { demoOTP: otp })
                };
            } else {
                // Mobile SMS (simulated for demo)
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`📱 OTP sent to ${recipient.slice(0, 2)}**** (dev mode)`);
                }

                return {
                    success: true,
                    message: `OTP sent to ${recipient.slice(0, 2)}****${recipient.slice(-2)}`,
                    method: 'mobile',
                    ...(process.env.NODE_ENV !== 'production' && { demoOTP: otp })
                };
            }
        } catch (error) {
            console.error('Error sending OTP:', error);
            throw new Error('Failed to send OTP');
        }
    }

    /**
     * Verify OTP
     * @param {string} identifier - Aadhaar or user identifier
     * @param {string} enteredOTP - OTP entered by user
     */
    verifyOTP(identifier, enteredOTP) {
        const otpData = this.otpStore.get(identifier);

        if (!otpData) {
            return {
                success: false,
                message: 'OTP not found. Please request a new OTP.'
            };
        }

        // Check if OTP is expired
        if (Date.now() > otpData.expiryTime) {
            this.otpStore.delete(identifier);
            return {
                success: false,
                message: 'OTP has expired. Please request a new OTP.'
            };
        }

        // Check max attempts
        if (otpData.attempts >= this.MAX_ATTEMPTS) {
            this.otpStore.delete(identifier);
            return {
                success: false,
                message: 'Maximum attempts exceeded. Please request a new OTP.'
            };
        }

        // Increment attempts
        otpData.attempts++;

        // Verify OTP
        if (otpData.otp === enteredOTP) {
            this.otpStore.delete(identifier);
            return {
                success: true,
                message: 'OTP verified successfully'
            };
        }

        return {
            success: false,
            message: `Invalid OTP. ${this.MAX_ATTEMPTS - otpData.attempts} attempts remaining.`
        };
    }

    /**
     * Clear expired OTPs (cleanup function)
     */
    clearExpiredOTPs() {
        const now = Date.now();
        for (const [identifier, otpData] of this.otpStore.entries()) {
            if (now > otpData.expiryTime) {
                this.otpStore.delete(identifier);
            }
        }
    }

    /**
     * Get remaining time for OTP
     */
    getRemainingTime(identifier) {
        const otpData = this.otpStore.get(identifier);
        if (!otpData) return 0;

        const remaining = Math.max(0, otpData.expiryTime - Date.now());
        return Math.ceil(remaining / 1000); // Return in seconds
    }
}

// Singleton instance
const otpService = new OTPService();

// Cleanup expired OTPs every minute
setInterval(() => {
    otpService.clearExpiredOTPs();
}, 60 * 1000);

module.exports = otpService;
