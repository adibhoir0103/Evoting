/**
 * User Routes
 * Profile updates and wallet linking (require authentication).
 */

const express = require('express');
const router = express.Router();
const { injectUser } = require('../middleware/authenticate');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../controllers/authController');

router.put('/profile', injectUser, asyncHandler(auth.updateProfile));
router.post('/link-wallet', injectUser, asyncHandler(auth.linkWallet));

module.exports = router;
