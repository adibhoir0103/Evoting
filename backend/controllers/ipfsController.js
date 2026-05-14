/**
 * IPFS Controller
 * Handles IPFS pinning and retrieval of vote metadata.
 */

const ipfsService = require('../services/ipfsService');
const { isValidHex, isValidIPFSHash, sanitize } = require('../utils/helpers');

exports.pinVote = async (req, res) => {
    const { commitment, nullifierHash, timestamp } = req.body;
    if (!commitment || !nullifierHash) return res.status(400).json({ error: 'Commitment and nullifierHash are required' });
    if (!isValidHex(commitment) || !isValidHex(nullifierHash)) return res.status(400).json({ error: 'Invalid hex format for commitment or nullifier' });

    const cleanTimestamp = sanitize(timestamp || new Date().toISOString());
    const result = await ipfsService.pinVoteMetadata({ commitment, nullifierHash, timestamp: cleanTimestamp });
    res.json({ ipfsHash: result.ipfsHash, pinSize: result.pinSize, message: 'Vote metadata pinned to IPFS' });
};

exports.getFromIPFS = async (req, res) => {
    const hash = req.params.hash;
    if (!isValidIPFSHash(hash)) return res.status(400).json({ error: 'Invalid IPFS hash format' });
    const data = await ipfsService.getFromIPFS(hash);
    res.json({ data });
};
