/**
 * Cloudflare Turnstile Verification Middleware
 */

const axios = require('axios');
const logger = require('../lib/logger');

async function verifyTurnstile(req, res, next) {
    const turnstileToken = req.body.turnstileToken;

    // If Turnstile is not configured, skip verification to allow local dev
    if (!process.env.TURNSTILE_SECRET_KEY) {
        return next();
    }

    if (!turnstileToken) {
        logger.warn('Turnstile token missing from request body');
        return res.status(403).json({ error: 'Please complete the anti-bot verification.' });
    }

    try {
        const formData = new URLSearchParams();
        formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
        formData.append('response', turnstileToken);
        formData.append('remoteip', req.ip);

        const result = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if (result.data.success) {
            return next();
        } else {
            logger.warn('Turnstile verification failed', result.data['error-codes']);
            return res.status(403).json({ error: 'Anti-bot verification failed. Please try again.' });
        }
    } catch (err) {
        logger.error('Error verifying Turnstile token:', err.message || err);
        // Fallback open: If Cloudflare API is down/unreachable, we shouldn't block legitimate users.
        // We log the error but allow the request to proceed.
        return next();
    }
}

module.exports = { verifyTurnstile };
