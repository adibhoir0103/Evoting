/**
 * Meta-Transaction Controller
 * Handles ERC-2771 meta-transaction relaying.
 */

const logger = require('../lib/logger');
const queueService = require('../services/queueService');
const serverLog = logger.child('server');

exports.relayMetaTx = async (req, res) => {
    try {
        const { request, signature } = req.body;
        
        if (!request || !signature) {
            return res.status(400).json({ error: 'Forward request and signature are required' });
        }

        // Add to queue to ensure sequential processing and prevent Nonce collisions
        const result = await queueService.addTxToQueue(request, signature);

        res.json({
            message: 'Meta-transaction queued for relay successfully',
            status: 'queued',
            ...result
        });
    } catch (error) {
        serverLog.error('Error queueing meta-transaction:', error);
        res.status(500).json({ error: 'Internal Server Error during relay' });
    }
};
