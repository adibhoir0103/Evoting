/**
 * Meta-Transaction Controller
 * Handles ERC-2771 meta-transaction relaying.
 */

const logger = require('../lib/logger');
const serverLog = logger.child('server');

exports.relayMetaTx = async (req, res) => {
    const { request, signature } = req.body;
    if (!request || !signature) return res.status(400).json({ error: 'Forward request and signature are required' });

    res.json({
        message: 'Meta-transaction relay endpoint ready',
        status: 'received',
        request: { from: request.from, to: request.to, nonce: request.nonce },
        note: 'In production, this relayer submits the tx on-chain and pays gas'
    });
};
