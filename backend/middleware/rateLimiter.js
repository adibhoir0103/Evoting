/**
 * Centralized Rate Limiter Middleware
 * Uses Upstash Redis when available (supports PM2 clustering), 
 * falls back to in-memory express-rate-limit.
 */

const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');
const standardRateLimit = require('express-rate-limit');
const logger = require('../lib/logger');

let upstashRedis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        upstashRedis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        logger.info('✅ Upstash Redis bound for Rate Limiting');
    } catch (err) {
        logger.error('Failed to initialize Upstash Redis for rate limiting:', err);
    }
}

/**
 * Factory to create rate limiters
 */
function createRateLimiter(options) {
    const { windowMs, max, message } = options;
    const windowSeconds = Math.floor(windowMs / 1000);

    // Use Upstash Redis Rate Limiter if available
    if (upstashRedis) {
        const ratelimit = new Ratelimit({
            redis: upstashRedis,
            limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
            analytics: true,
            prefix: '@evote/ratelimit',
        });

        return async (req, res, next) => {
            try {
                const identifier = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
                const { success, limit, reset, remaining } = await ratelimit.limit(`rl_${identifier}`);

                res.set('X-RateLimit-Limit', limit);
                res.set('X-RateLimit-Remaining', remaining);
                res.set('X-RateLimit-Reset', reset);

                if (!success) {
                    logger.warn(`Rate limit exceeded for IP ${identifier}`);
                    return res.status(429).json(message);
                }
                next();
            } catch (err) {
                // If Redis fails, log it and let request pass to prevent blocking legitimate traffic
                logger.error('Upstash rate limiter error:', err);
                next();
            }
        };
    }

    // Fallback to in-memory standard express-rate-limit
    return standardRateLimit(options);
}

module.exports = {
    authLimiter: createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: { error: 'Too many auth attempts. Please try again later.' }
    }),
    otpLimiter: createRateLimiter({
        windowMs: 5 * 60 * 1000,
        max: 3,
        message: { error: 'Too many OTP attempts. Account temporarily locked for 5 minutes.' }
    }),
    apiLimiter: createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: { error: 'Too many API requests. Please slow down.' }
    }),
    // Create custom rate limiter instances on the fly
    createRateLimiter
};
