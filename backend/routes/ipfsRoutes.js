/**
 * IPFS Routes
 */

const express = require('express');
const router = express.Router();
const { createRateLimiter } = require('../middleware/rateLimiter');
const { injectUser } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const ipfs = require('../controllers/ipfsController');

const ipfsLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, max: 20,
    message: { error: 'Too many IPFS requests. Please try again later.' }
});

const apiLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, max: 200,
    message: { error: 'Too many requests. Please try again later.' }
});

router.post('/pin-vote', ipfsLimiter, injectUser, asyncHandler(ipfs.pinVote));
router.get('/:hash', apiLimiter, asyncHandler(ipfs.getFromIPFS));

module.exports = router;
