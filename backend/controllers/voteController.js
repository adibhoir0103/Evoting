/**
 * Vote Controller
 * Handles vote recording, status checking, and receipt retrieval.
 */

const prisma = require('../lib/prisma');
const ipfsService = require('../services/ipfsService');

exports.recordVote = async (req, res) => {
    const { txHash } = req.body;
    if (!txHash) return res.status(400).json({ error: 'Transaction hash is required' });

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, voter_id: true, has_voted: true, email: true, fullname: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.has_voted) return res.status(400).json({ error: 'You have already voted' });

    // Serializable isolation to prevent race conditions
    await prisma.$transaction(async (tx) => {
        const freshUser = await tx.user.findUnique({ where: { id: req.user.id }, select: { has_voted: true } });
        if (freshUser?.has_voted) throw new Error('ALREADY_VOTED');
        await tx.vote.create({ data: { voter_id: user.voter_id, tx_hash: txHash } });
        await tx.user.update({ where: { id: req.user.id }, data: { has_voted: true } });
    }, { isolationLevel: 'Serializable' });

    // Auto-pin vote metadata to IPFS for tamper-proof receipt
    let ipfsHash = null;
    try {
        const ipfsResult = await ipfsService.pinVoteMetadata({
            commitment: txHash,
            nullifierHash: `voter-${user.voter_id}`,
            timestamp: new Date().toISOString()
        });
        ipfsHash = ipfsResult.ipfsHash;
        console.log(`📌 Vote IPFS pinned: ${ipfsHash}`);
    } catch (ipfsErr) {
        console.warn('IPFS pinning failed (non-blocking):', ipfsErr.message);
    }

    res.json({ message: 'Vote securely recorded', ipfsHash: ipfsHash || null });
};

exports.getVoteStatus = async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { has_voted: true }
    });
    res.json({ hasVoted: user ? user.has_voted : false });
};

exports.getVoteReceipt = async (req, res) => {
    const vote = await prisma.vote.findFirst({
        where: { voter_id: req.user.voterId },
        select: { tx_hash: true, voted_at: true }
    });
    res.json({ vote: vote || null });
};
