/**
 * IPFS Routes
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { injectUser } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const ipfs = require('../controllers/ipfsController');

const ipfsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 20,
    message: { error: 'Too many IPFS requests. Please try again later.' },
    standardHeaders: true, legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 200,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true, legacyHeaders: false
});

router.post('/pin-vote', ipfsLimiter, injectUser, asyncHandler(ipfs.pinVote));
router.get('/:hash', apiLimiter, asyncHandler(ipfs.getFromIPFS));

module.exports = router;
