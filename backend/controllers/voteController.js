/**
 * Vote Controller
 * Handles vote recording, status checking, and receipt retrieval.
 */

const prisma = require('../lib/prisma');
const ipfsService = require('../services/ipfsService');
const logger = require('../lib/logger');
const voteLog = logger.child('vote');

exports.recordVote = async (req, res) => {
    const { txHash, electionId } = req.body;
    if (!txHash) return res.status(400).json({ error: 'Transaction hash is required' });
    
    // SECURITY: Validate Ethereum transaction hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return res.status(400).json({ error: 'Invalid transaction hash format' });
    }

    if (!electionId) return res.status(400).json({ error: 'Election ID is required' });
    const parsedElectionId = parseInt(electionId);
    if (isNaN(parsedElectionId)) return res.status(400).json({ error: 'Invalid election ID' });

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, voter_id: true, has_voted: true, email: true, fullname: true }
    });
    if (!user) return res.status(401).json({ error: 'Authentication failed.' });

    // Serializable isolation to prevent race conditions
    await prisma.$transaction(async (tx) => {
        // Check election specific voter record first
        const electionVoter = await tx.electionVoter.findUnique({
            where: { election_id_user_id: { election_id: parsedElectionId, user_id: req.user.id } }
        });
        
        if (!electionVoter) {
            throw new Error('NOT_REGISTERED_FOR_ELECTION');
        }
        
        if (electionVoter.has_voted) {
            throw new Error('ALREADY_VOTED_IN_ELECTION');
        }

        // Create vote with proper election scope
        await tx.vote.create({ 
            data: { 
                voter_id: user.voter_id, 
                tx_hash: txHash,
                election_id: parsedElectionId
            } 
        });
        
        // Update election specific vote flag
        await tx.electionVoter.update({
            where: { election_id_user_id: { election_id: parsedElectionId, user_id: req.user.id } },
            data: { has_voted: true }
        });

        // Also update legacy global flag for backwards compatibility
        await tx.user.update({ where: { id: req.user.id }, data: { has_voted: true } });
    }, { isolationLevel: 'Serializable' }).catch((err) => {
        if (err.message === 'ALREADY_VOTED_IN_ELECTION') return res.status(400).json({ error: 'You have already voted in this election' });
        if (err.message === 'NOT_REGISTERED_FOR_ELECTION') return res.status(403).json({ error: 'You are not registered for this election' });
        throw err;
    });

    // Auto-pin vote metadata to IPFS for tamper-proof receipt
    let ipfsHash = null;
    try {
        const ipfsResult = await ipfsService.pinVoteMetadata({
            commitment: txHash,
            nullifierHash: `voter-${user.voter_id}`,
            timestamp: new Date().toISOString()
        });
        ipfsHash = ipfsResult.ipfsHash;
        voteLog.info(`Vote IPFS pinned: ${ipfsHash}`);
    } catch (ipfsErr) {
        voteLog.warn('IPFS pinning failed (non-blocking)', { error: ipfsErr.message });
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
