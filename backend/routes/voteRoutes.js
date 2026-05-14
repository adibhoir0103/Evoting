/**
 * Vote Routes
 */

const express = require('express');
const router = express.Router();
const { injectUser } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const vote = require('../controllers/voteController');

router.post('/record', injectUser, asyncHandler(vote.recordVote));
router.get('/status', injectUser, asyncHandler(vote.getVoteStatus));
router.get('/receipt', injectUser, asyncHandler(vote.getVoteReceipt));

module.exports = router;
