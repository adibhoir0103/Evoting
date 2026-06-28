/**
 * Cloudflare Turnstile Verification Middleware
 */

const axios = require('axios');
const logger = require('../lib/logger');

async function verifyTurnstile(req, res, next) {
    const token = req.body['cf-turnstile-response'] || req.body.turnstileToken || req.headers['x-turnstile-response'];
    if (!token) {
        return res.status(400).json({ error: 'Turnstile token missing.' });
    }

    try {
        const secretKey = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';

        const params = new URLSearchParams();
        params.append('secret', secretKey);
        params.append('response', token);
        if (req.ip) params.append('remoteip', req.ip);

        const response = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (response.data.success) {
            return next();
        } else {
            logger.warn(`Turnstile validation failed: ${JSON.stringify(response.data['error-codes'])}`);
            return res.status(403).json({ error: 'Turnstile verification failed.' });
        }
    } catch (error) {
        logger.error(`Turnstile request error: ${error.message}`);
        return res.status(500).json({ error: 'Failed to verify Turnstile challenge.' });
    }
}

module.exports = { verifyTurnstile };
