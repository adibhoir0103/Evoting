/**
 * Meta-Transaction Routes
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { injectUser } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const metaTx = require('../controllers/metaTxController');

const metaTxLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, max: 10,
    message: { error: 'Too many meta-transaction requests. Please try again later.' },
    standardHeaders: true, legacyHeaders: false
});

router.post('/relay', metaTxLimiter, injectUser, asyncHandler(metaTx.relayMetaTx));

module.exports = router;
