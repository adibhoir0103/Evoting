/**
 * Meta-Transaction Routes
 */

const express = require('express');
const router = express.Router();
const { createRateLimiter } = require('../middleware/rateLimiter');
const { injectUser } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const metaTx = require('../controllers/metaTxController');

const metaTxLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000, max: 10,
    message: { error: 'Too many meta-transaction requests. Please try again later.' }
});

router.post('/relay', metaTxLimiter, injectUser, asyncHandler(metaTx.relayMetaTx));

module.exports = router;
