/**
 * ZKP Controller (Cryptographic Ballot Privacy)
 * Handles Pedersen Commitment generation and Schnorr-style eligibility verification.
 */

const zkpService = require('../services/zkpService');
const { sanitize, isValidHex } = require('../utils/helpers');

exports.getStatus = (req, res) => {
    res.json({
        zkpEnabled: true,
        electionId: 'bharat-evote-2026',
        features: ['pedersen-commitments', 'schnorr-challenges', 'nullifier-privacy', 'ipfs-metadata', 'erc2771-metatx']
    });
};

exports.generateCommitment = (req, res) => {
    const { candidateId } = req.body;
    if (!candidateId || candidateId < 1) return res.status(400).json({ error: 'Valid candidateId is required' });
    const result = zkpService.generateCommitment(candidateId);
    res.json({ commitment: result.commitment, randomness: result.randomness, message: 'Commitment generated. Keep your randomness secret!' });
};

exports.generateProof = (req, res) => {
    const { candidateId, randomness, candidatesCount, commitment, nullifierHash, voterAddress } = req.body;
    if (!candidateId || !randomness || !candidatesCount || !commitment || !nullifierHash || !voterAddress) {
        return res.status(400).json({ error: 'All proof parameters are required' });
    }
    if (!isValidHex(randomness) || !isValidHex(commitment) || !isValidHex(nullifierHash)) {
        return res.status(400).json({ error: 'Invalid hex format for cryptographic parameters' });
    }
    const result = zkpService.generateVoteProof(candidateId, randomness, candidatesCount, commitment, nullifierHash, voterAddress);
    res.json({ proof: result.proof, message: 'ZK proof generated successfully' });
};

exports.generateNullifier = (req, res) => {
    const { voterSecret, electionId } = req.body;
    if (!voterSecret || typeof voterSecret !== 'string') return res.status(400).json({ error: 'Voter secret is required' });
    const cleanElectionId = sanitize(electionId || 'bharat-evote-2026');
    const nullifier = zkpService.generateNullifier(voterSecret, cleanElectionId);
    const identity = zkpService.generateIdentityCommitment(voterSecret);
    res.json({ nullifierHash: nullifier.nullifierHash, identityCommitment: identity.identityCommitment, message: 'Nullifier and identity commitment generated' });
};

exports.verifyProof = (req, res) => {
    const { commitment, nullifierHash, proof, candidatesCount, voterAddress } = req.body;
    if (!commitment || !nullifierHash || !proof || !candidatesCount || !voterAddress) return res.status(400).json({ error: 'All verification parameters are required' });
    if (!isValidHex(commitment) || !isValidHex(nullifierHash)) return res.status(400).json({ error: 'Invalid hex format for commitment or nullifier' });
    if (!Array.isArray(proof) || !proof.every(p => isValidHex(p) || typeof p === 'string')) return res.status(400).json({ error: 'Invalid proof format' });
    const result = zkpService.verifyProof(commitment, nullifierHash, proof, candidatesCount, voterAddress);
    res.json({ valid: result.valid, reason: result.reason || 'Proof is valid', message: result.valid ? 'ZK proof verified successfully' : 'ZK proof verification failed' });
};

exports.generateVotePackage = (req, res) => {
    const { candidateId, voterSecret, candidatesCount, electionId, voterAddress } = req.body;
    if (!candidateId || !voterSecret || !candidatesCount || !voterAddress) return res.status(400).json({ error: 'candidateId, voterSecret, candidatesCount, and voterAddress are required' });
    const cleanElectionId = sanitize(electionId || 'bharat-evote-2026');
    const votePackage = zkpService.generateVotePackage(candidateId, voterSecret, candidatesCount, cleanElectionId, voterAddress);
    res.json({ ...votePackage, message: 'Complete ZKP vote package generated' });
};
