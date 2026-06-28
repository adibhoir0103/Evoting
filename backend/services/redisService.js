const { Redis } = require('@upstash/redis');
const logger = require('../lib/logger');

let redis;

try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        const url = process.env.UPSTASH_REDIS_REST_URL.replace(/['"]/g, '').trim();
        const token = process.env.UPSTASH_REDIS_REST_TOKEN.replace(/['"]/g, '').trim();
        redis = new Redis({ url, token });
        logger.info('✅ Upstash Redis initialized for session management');
    } else {
        logger.warn('⚠️ Redis credentials missing. Falling back to memory storage for sessions (NOT FOR PRODUCTION).');
        // Simple in-memory fallback for local dev
        redis = {
            _store: new Map(),
            async get(key) {
                return this._store.get(key) || null;
            },
            async setex(key, seconds, value) {
                this._store.set(key, value);
                setTimeout(() => this._store.delete(key), seconds * 1000);
                return 'OK';
            },
            async del(key) {
                this._store.delete(key);
                return 1;
            }
        };
    }
} catch (error) {
    logger.error('Failed to initialize Redis:', error);
}

module.exports = {
    /**
     * Store active session token
     */
    async setActiveSession(userId, token, expirySeconds = 1200) {
        try {
            await redis.setex(`session:${userId}`, expirySeconds, token);
            return true;
        } catch (error) {
            logger.error(`Redis set session error for user ${userId}:`, error);
            return false;
        }
    },

    /**
     * Get active session token
     */
    async getActiveSession(userId) {
        try {
            return await redis.get(`session:${userId}`);
        } catch (error) {
            logger.error(`Redis get session error for user ${userId}:`, error);
            return null;
        }
    },

    /**
     * Delete active session token
     */
    async clearActiveSession(userId) {
        try {
            await redis.del(`session:${userId}`);
            return true;
        } catch (error) {
            logger.error(`Redis clear session error for user ${userId}:`, error);
            return false;
        }
    },

    /**
     * Increment failed login attempts
     */
    async incrementFailedLogin(identifier) {
        try {
            const key = `failed_login:${identifier}`;
            const count = await redis.get(key);
            let newCount = 1;
            if (count) {
                newCount = parseInt(count) + 1;
                await redis.setex(key, 900, newCount); // Refresh 15 min expiry
            } else {
                await redis.setex(key, 900, newCount); // 15 min expiry
            }
            return newCount;
        } catch (error) {
            logger.error(`Redis increment failed login error for ${identifier}:`, error);
            return 1;
        }
    },

    /**
     * Get failed login attempts
     */
    async getFailedLoginAttempts(identifier) {
        try {
            const count = await redis.get(`failed_login:${identifier}`);
            return count ? parseInt(count) : 0;
        } catch (error) {
            return 0;
        }
    },

    /**
     * Clear failed login attempts
     */
    async clearFailedLogin(identifier) {
        try {
            await redis.del(`failed_login:${identifier}`);
            await redis.del(`lockout:${identifier}`);
        } catch (error) {
            logger.error(`Redis clear failed login error for ${identifier}:`, error);
        }
    },

    /**
     * Set account lockout
     */
    async setAccountLockout(identifier, minutes = 15) {
        try {
            await redis.setex(`lockout:${identifier}`, minutes * 60, 'LOCKED');
        } catch (error) {
            logger.error(`Redis set lockout error for ${identifier}:`, error);
        }
    },

    /**
     * Check if account is locked out
     */
    async isAccountLocked(identifier) {
        try {
            const locked = await redis.get(`lockout:${identifier}`);
            return !!locked;
        } catch (error) {
            return false;
        }
    }
};
