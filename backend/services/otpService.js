// OTP Service for Aadhaar Authentication
// Uses Upstash Redis for persistent OTP storage (survives server restarts)
// Falls back to in-memory Map if Redis is not configured
const crypto = require('crypto');
const emailService = require('./emailService');

// Upstash Redis — lazy init to avoid top-level async import issues
let redis = null;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function getRedis() {
    if (redis) return redis;
    if (UPSTASH_URL && UPSTASH_TOKEN) {
        try {
            const { Redis } = require('@upstash/redis');
            redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
            console.log('✅ OTP Service: Upstash Redis connected');
            return redis;
        } catch (e) {
            console.warn('⚠️  OTP Service: Upstash Redis failed, using in-memory fallback:', e.message);
            return null;
        }
    }
    return null;
}

class OTPService {
    constructor() {
        // In-memory fallback store
        this.otpStore = new Map();
        this.OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
        this.OTP_EXPIRY_SECONDS = 300; // 5 minutes in seconds (for Redis TTL)
        this.MAX_ATTEMPTS = 3;
    }

    /**
     * Generate a 6-digit OTP
     */
    generateOTP() {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Store OTP data (Redis or in-memory)
     */
    async _storeOTP(identifier, otpData) {
        const r = await getRedis();
        if (r) {
            const key = `otp:${identifier}`;
            await r.set(key, JSON.stringify(otpData), { ex: this.OTP_EXPIRY_SECONDS });
        } else {
            this.otpStore.set(identifier, otpData);
        }
    }

    /**
     * Get OTP data (Redis or in-memory)
     */
    async _getOTP(identifier) {
        const r = await getRedis();
        if (r) {
            const key = `otp:${identifier}`;
            const data = await r.get(key);
            if (!data) return null;
            return typeof data === 'string' ? JSON.parse(data) : data;
        } else {
            return this.otpStore.get(identifier) || null;
        }
    }

    /**
     * Delete OTP data (Redis or in-memory)
     */
    async _deleteOTP(identifier) {
        const r = await getRedis();
        if (r) {
            await r.del(`otp:${identifier}`);
        } else {
            this.otpStore.delete(identifier);
        }
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

            // Store OTP in Redis (with auto-TTL) or in-memory
            await this._storeOTP(identifier, {
                otp,
                recipient,
                method,
                expiryTime,
                attempts: 0,
                createdAt: Date.now()
            });

            // Send OTP based on method
            if (method === 'email') {
                const emailResult = await emailService.sendOTP(recipient, otp, userName);

                return {
                    success: true,
                    message: `OTP sent to ${recipient.slice(0, 3)}***${recipient.slice(-10)}`,
                    method: 'email',
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
    async verifyOTP(identifier, enteredOTP) {
        const otpData = await this._getOTP(identifier);

        if (!otpData) {
            return {
                success: false,
                message: 'OTP not found. Please request a new OTP.'
            };
        }

        // Check if OTP is expired (in-memory fallback check; Redis uses TTL auto-expiry)
        if (Date.now() > otpData.expiryTime) {
            await this._deleteOTP(identifier);
            return {
                success: false,
                message: 'OTP has expired. Please request a new OTP.'
            };
        }

        // Check max attempts
        if (otpData.attempts >= this.MAX_ATTEMPTS) {
            await this._deleteOTP(identifier);
            return {
                success: false,
                message: 'Maximum attempts exceeded. Please request a new OTP.'
            };
        }

        // Increment attempts
        otpData.attempts++;
        await this._storeOTP(identifier, otpData);

        // Verify OTP
        if (otpData.otp === enteredOTP) {
            await this._deleteOTP(identifier);
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
     * Clear expired OTPs (only needed for in-memory fallback)
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
    async getRemainingTime(identifier) {
        const otpData = await this._getOTP(identifier);
        if (!otpData) return 0;

        const remaining = Math.max(0, otpData.expiryTime - Date.now());
        return Math.ceil(remaining / 1000); // Return in seconds
    }
}

// Singleton instance
const otpService = new OTPService();

// Cleanup expired OTPs every minute (in-memory fallback only)
setInterval(() => {
    otpService.clearExpiredOTPs();
}, 60 * 1000);

module.exports = otpService;
