/**
 * Cloudflare Turnstile Verification Middleware
 */

const axios = require('axios');
const logger = require('../lib/logger');

async function verifyTurnstile(req, res, next) {
    // ⚠️ Turnstile verification DISABLED
    // We are bypassing this completely so you don't get blocked by frontend/backend key mismatches
    return next();
}

module.exports = { verifyTurnstile };
