// Upstash-powered distributed rate limiter
// Uses @upstash/ratelimit for persistent, distributed rate limiting
// Falls back to express-rate-limit if Upstash is not configured
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis = null;
if (UPSTASH_URL && UPSTASH_TOKEN) {
    redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
    console.log('✅ Upstash Rate Limiter: Redis connected');
}

/**
 * Create an Upstash rate limiter middleware
 * @param {Object} options
 * @param {number} options.maxRequests - Max requests allowed in the window
 * @param {string} options.window - Time window (e.g., '5 m', '1 h', '10 s')
 * @param {string} options.prefix - Redis key prefix for this limiter
 * @returns Express middleware function
 */
function createUpstashLimiter({ maxRequests = 5, window = '5 m', prefix = 'ratelimit' }) {
    if (!redis) {
        // Return a pass-through middleware if Redis is not configured
        console.warn(`⚠️  Upstash limiter [${prefix}]: not configured, skipping`);
        return (req, res, next) => next();
    }

    const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxRequests, window),
        prefix: `bharat-evote:${prefix}`,
    });

    return async (req, res, next) => {
        try {
            // Use IP address as identifier
            const identifier = req.ip || req.connection.remoteAddress || 'unknown';
            const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

            // Set standard rate limit headers
            res.set({
                'X-RateLimit-Limit': limit,
                'X-RateLimit-Remaining': remaining,
                'X-RateLimit-Reset': reset,
            });

            if (!success) {
                const retryAfter = Math.ceil((reset - Date.now()) / 1000);
                res.set('Retry-After', retryAfter);
                return res.status(429).json({
                    error: `Too many requests. Please try again in ${retryAfter} seconds.`
                });
            }

            next();
        } catch (error) {
            console.error('Upstash rate limiter error:', error);
            // On error, allow the request through (fail-open)
            next();
        }
    };
}

// Pre-configured limiters for different endpoints
const otpLimiterUpstash = createUpstashLimiter({
    maxRequests: 5,
    window: '5 m',
    prefix: 'otp'
});

const authLimiterUpstash = createUpstashLimiter({
    maxRequests: 10,
    window: '5 m',
    prefix: 'auth'
});

const zkpLimiterUpstash = createUpstashLimiter({
    maxRequests: 15,
    window: '10 m',
    prefix: 'zkp'
});

module.exports = {
    createUpstashLimiter,
    otpLimiterUpstash,
    authLimiterUpstash,
    zkpLimiterUpstash
};
