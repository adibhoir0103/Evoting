const { Redis } = require('@upstash/redis');
const logger = require('../lib/logger');

let redis;

try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
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
    }
};
