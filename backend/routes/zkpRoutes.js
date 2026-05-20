/**
 * ZKP Routes
 */

const express = require('express');
const router = express.Router();
const { createRateLimiter } = require('../middleware/rateLimiter');
const { injectUser } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const zkp = require('../controllers/zkpController');

const apiLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, max: 200,
    message: { error: 'Too many requests. Please try again later.' }
});

const zkpLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000, max: 30,
    message: { error: 'Too many ZKP requests. Please try again later.' }
});

router.get('/status', apiLimiter, zkp.getStatus);
router.post('/generate-commitment', zkpLimiter, injectUser, asyncHandler(zkp.generateCommitment));
router.post('/generate-proof', zkpLimiter, injectUser, asyncHandler(zkp.generateProof));
router.post('/generate-nullifier', zkpLimiter, injectUser, asyncHandler(zkp.generateNullifier));
router.post('/verify-proof', zkpLimiter, asyncHandler(zkp.verifyProof));
router.post('/generate-vote-package', zkpLimiter, injectUser, asyncHandler(zkp.generateVotePackage));

module.exports = router;
