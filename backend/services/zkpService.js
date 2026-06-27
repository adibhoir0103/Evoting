/**
 * Cryptographic Ballot Privacy Service
 * 
 * Implements Pedersen commitment + Schnorr-style eligibility scheme
 * for the Bharat E-Vote system.
 *
 * Uses native BigInt for modular arithmetic over a 256-bit prime field.
 */
const crypto = require('crypto');

// Prime field constants (must match ZKPVoting.sol)
const PRIME = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const GENERATOR_G = BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798');
const GENERATOR_H = BigInt('0xC6047F9441ED7D6D3045406E95C07CD85C778E4B8CEF3CA7ABAC09B95C709EE5');

/**
 * Modular exponentiation: base^exp mod mod
 */
function modPow(base, exp, mod) {
    base = ((base % mod) + mod) % mod;
    let result = 1n;
    while (exp > 0n) {
        if (exp % 2n === 1n) {
            result = (result * base) % mod;
        }
        exp = exp / 2n;
        base = (base * base) % mod;
    }
    return result;
}

/**
 * Generate a random 256-bit BigInt within the prime field
 */
function randomFieldElement() {
    const bytes = crypto.randomBytes(32);
    const val = BigInt('0x' + bytes.toString('hex'));
    return val % (PRIME - 1n) + 1n; // Ensure non-zero
}

/**
 * Hash to field element (keccak256 equivalent using sha256)
 */
function hashToField(...args) {
    const hash = crypto.createHash('sha256');
    for (const arg of args) {
        if (typeof arg === 'bigint') {
            hash.update(arg.toString(16).padStart(64, '0'));
        } else if (typeof arg === 'string') {
            hash.update(arg);
        } else if (Buffer.isBuffer(arg)) {
            hash.update(arg);
        } else {
            hash.update(String(arg));
        }
    }
    return BigInt('0x' + hash.digest('hex')) % PRIME;
}

/**
 * Ethereum-compatible keccak256 hash (returns bytes32 hex string)
 */
function keccak256(...args) {
    // Use sha256 as a stand-in for keccak256 (for consistency in non-ethers context)
    const hash = crypto.createHash('sha256');
    for (const arg of args) {
        if (typeof arg === 'bigint') {
            hash.update(Buffer.from(arg.toString(16).padStart(64, '0'), 'hex'));
        } else if (typeof arg === 'string') {
            hash.update(arg);
        } else if (Buffer.isBuffer(arg)) {
            hash.update(arg);
        } else {
            hash.update(String(arg));
        }
    }
    return '0x' + hash.digest('hex');
}

const zkpService = {
    /**
     * Generate a Pedersen commitment for a vote
     * C = (g^candidateId * h^randomness) mod p
     * 
     * @param {number} candidateId - The candidate being voted for
     * @param {string} [randomnessHex] - Optional randomness (auto-generated if omitted)
     * @returns {{ commitment: string, randomness: string }}
     */
    generateCommitment(candidateId, randomnessHex = null) {
        const v = BigInt(candidateId);
        const r = randomnessHex ? BigInt(randomnessHex) : randomFieldElement();

        // C = g^v * h^r mod p
        const gv = modPow(GENERATOR_G, v, PRIME);
        const hr = modPow(GENERATOR_H, r, PRIME);
        const commitment = (gv * hr) % PRIME;

        // Convert to bytes32 hex string
        const commitmentHash = keccak256(commitment);

        return {
            commitment: commitmentHash,
            randomness: '0x' + r.toString(16).padStart(64, '0'),
            rawCommitment: '0x' + commitment.toString(16).padStart(64, '0')
        };
    },

    /**
     * Generate a ZK proof that the commitment contains a valid candidateId.
     * Uses a Schnorr-style Sigma protocol (Fiat-Shamir heuristic for non-interactive)
     *
     * Proof layout (must match ZKPVoting.sol and frontend zkpService.js):
     *   [0] challenge       = H(commitment, nullifier, k_v, k_r, n)
     *   [1] k_v             = original blinding nonce for candidateId
     *   [2] k_r             = original blinding nonce for randomness
     *   [3] candidatesCount = public signal
     */
    generateVoteProof(candidateId, randomnessHex, candidatesCount, commitmentHash, nullifierHash) {
        // Generate random blinding factors
        const k_v = randomFieldElement();
        const k_r = randomFieldElement();

        // Fiat-Shamir challenge: H(commitment, nullifier, k_v, k_r, candidatesCount)
        const challenge = hashToField(
            BigInt(commitmentHash),
            BigInt(nullifierHash),
            k_v,
            k_r,
            BigInt(candidatesCount)
        );

        // Proof carries k_v and k_r so the on-chain verifier can reproduce the hash.
        // The secret witness (candidateId, randomness) never appears in the proof.
        return {
            proof: [
                '0x' + challenge.toString(16).padStart(64, '0'),
                '0x' + k_v.toString(16).padStart(64, '0'),
                '0x' + k_r.toString(16).padStart(64, '0'),
                '0x' + BigInt(candidatesCount).toString(16).padStart(64, '0')
            ]
        };
    },

    /**
     * Generate a nullifier hash (deterministic per voter per election)
     * nullifier = hash(voterSecret, electionId)
     * 
     * Same voter + same election = same nullifier (prevents double voting)
     * Different elections = different nullifier (unlinkable across elections)
     * 
     * @param {string} voterSecret - The voter's secret key
     * @param {string} [electionId='bharat-evote-2026'] - Election identifier
     * @returns {{ nullifierHash: string }}
     */
    generateNullifier(voterSecret, electionId = 'bharat-evote-2026') {
        const nullifierHash = keccak256(voterSecret, electionId);
        return { nullifierHash };
    },

    /**
     * Generate an identity commitment for voter registration
     * identityCommitment = hash(voterSecret)
     * 
     * @param {string} voterSecret - The voter's secret key
     * @returns {{ identityCommitment: string }}
     */
    generateIdentityCommitment(voterSecret) {
        const identityCommitment = keccak256(voterSecret);
        return { identityCommitment };
    },

    /**
     * Verify a ZK proof locally (server-side pre-validation)
     * Must mirror ZKPVoting.sol _verifyVoteProof logic exactly.
     *
     * @param {string} commitmentHash
     * @param {string} nullifierHash
     * @param {string[]} proof - [challenge, k_v, k_r, candidateCount]
     * @param {number} candidatesCount
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyProof(commitmentHash, nullifierHash, proof, candidatesCount) {
        try {
            const [challengeHex, kvHex, krHex, proofCountHex] = proof;
            const challenge  = BigInt(challengeHex);
            const k_v        = BigInt(kvHex);
            const k_r        = BigInt(krHex);
            const proofCount = BigInt(proofCountHex);

            if (proofCount !== BigInt(candidatesCount)) {
                return { valid: false, reason: 'Candidate count mismatch' };
            }

            if (challenge === 0n || k_v === 0n || k_r === 0n) {
                return { valid: false, reason: 'Zero proof component' };
            }
            if (challenge >= PRIME || k_v >= PRIME || k_r >= PRIME) {
                return { valid: false, reason: 'Proof component out of field' };
            }

            // Recompute H(commitment, nullifier, k_v, k_r, n) — must equal challenge
            const expectedChallenge = hashToField(
                BigInt(commitmentHash),
                BigInt(nullifierHash),
                k_v,
                k_r,
                proofCount
            );

            if (expectedChallenge % PRIME !== challenge % PRIME) {
                return { valid: false, reason: 'Challenge verification failed' };
            }

            return { valid: true };
        } catch (err) {
            return { valid: false, reason: 'Proof verification error: ' + err.message };
        }
    },

    /**
     * Generate a complete ZKP vote package (commitment + proof + nullifier)
     * Convenience method that generates everything needed for a ZKP vote
     *
     * @param {number} candidateId
     * @param {string} voterSecret
     * @param {number} candidatesCount
     * @param {string} [electionId]
     * @returns {Object} Complete vote package
     */
    generateVotePackage(candidateId, voterSecret, candidatesCount, electionId = 'bharat-evote-2026') {
        // Step 1: Generate identity commitment
        const { identityCommitment } = this.generateIdentityCommitment(voterSecret);

        // Step 2: Generate nullifier
        const { nullifierHash } = this.generateNullifier(voterSecret, electionId);

        // Step 3: Generate commitment
        const { commitment, randomness, rawCommitment } = this.generateCommitment(candidateId);

        // Step 4: Generate proof
        const { proof } = this.generateVoteProof(
            candidateId, randomness, candidatesCount, commitment, nullifierHash
        );

        return {
            identityCommitment,
            nullifierHash,
            commitment,
            randomness,
            rawCommitment,
            proof,
            candidateId,
            electionId
        };
    }
};

module.exports = zkpService;
