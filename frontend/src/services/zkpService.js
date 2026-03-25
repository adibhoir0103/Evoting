/**
 * ZKP Client-Side Service
 * 
 * Performs all cryptographic operations locally in the browser.
 * The voter's choice NEVER leaves the browser unencrypted.
 * 
 * Uses Web Crypto API + BigInt for Pedersen commitments and Schnorr proofs.
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Prime field constants (must match ZKPVoting.sol and backend zkpService.js)
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
 * Generate a random 256-bit BigInt
 */
function randomFieldElement() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    const val = BigInt('0x' + hex);
    return val % (PRIME - 1n) + 1n;
}

/**
 * SHA-256 hash to field element
 */
async function hashToField(...args) {
    let data = '';
    for (const arg of args) {
        if (typeof arg === 'bigint') {
            data += arg.toString(16).padStart(64, '0');
        } else {
            data += String(arg);
        }
    }
    const encoder = new TextEncoder();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return BigInt('0x' + hashHex) % PRIME;
}

/**
 * SHA-256 hash returning bytes32 hex string
 */
async function keccak256(...args) {
    let buffer = new Uint8Array(0);
    for (const arg of args) {
        let bytes;
        if (typeof arg === 'bigint') {
            const hex = arg.toString(16).padStart(64, '0');
            bytes = new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
        } else {
            bytes = new TextEncoder().encode(String(arg));
        }
        const merged = new Uint8Array(buffer.length + bytes.length);
        merged.set(buffer);
        merged.set(bytes, buffer.length);
        buffer = merged;
    }
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const zkpClientService = {
    /**
     * Generate a Pedersen commitment locally
     * C = g^candidateId * h^randomness mod p
     */
    async generateCommitment(candidateId) {
        const v = BigInt(candidateId);
        const r = randomFieldElement();

        const gv = modPow(GENERATOR_G, v, PRIME);
        const hr = modPow(GENERATOR_H, r, PRIME);
        const commitment = (gv * hr) % PRIME;

        const commitmentHash = await keccak256(commitment);

        return {
            commitment: commitmentHash,
            randomness: '0x' + r.toString(16).padStart(64, '0'),
            rawCommitment: '0x' + commitment.toString(16).padStart(64, '0')
        };
    },

    /**
     * Generate a ZK proof locally (Schnorr-style Sigma protocol)
     */
    async generateVoteProof(candidateId, randomnessHex, candidatesCount, commitmentHash, nullifierHash) {
        const v = BigInt(candidateId);
        const r = BigInt(randomnessHex);

        const k_v = randomFieldElement();
        const k_r = randomFieldElement();

        const challenge = await hashToField(
            BigInt(commitmentHash),
            BigInt(nullifierHash),
            k_v,
            k_r,
            BigInt(candidatesCount)
        );

        const response_v = ((k_v - challenge * v) % PRIME + PRIME) % PRIME;
        const response_r = ((k_r - challenge * r) % PRIME + PRIME) % PRIME;

        return {
            proof: [
                '0x' + challenge.toString(16).padStart(64, '0'),
                '0x' + response_v.toString(16).padStart(64, '0'),
                '0x' + response_r.toString(16).padStart(64, '0'),
                '0x' + BigInt(candidatesCount).toString(16).padStart(64, '0')
            ]
        };
    },

    /**
     * Generate nullifier hash locally
     */
    async generateNullifier(voterSecret, electionId = 'bharat-evote-2026') {
        const nullifierHash = await keccak256(BigInt('0x' + Buffer.from ? 
            Buffer.from(voterSecret).toString('hex') : 
            Array.from(new TextEncoder().encode(voterSecret)).map(b => b.toString(16).padStart(2, '0')).join('')
        ), BigInt('0x' + Array.from(new TextEncoder().encode(electionId)).map(b => b.toString(16).padStart(2, '0')).join('')));
        return { nullifierHash };
    },

    /**
     * Generate identity commitment locally
     */
    async generateIdentityCommitment(voterSecret) {
        const identityCommitment = await keccak256(
            BigInt('0x' + Array.from(new TextEncoder().encode(voterSecret)).map(b => b.toString(16).padStart(2, '0')).join(''))
        );
        return { identityCommitment };
    },

    /**
     * Generate complete vote package locally (preferred for maximum privacy)
     */
    async generateVotePackage(candidateId, voterSecret, candidatesCount, electionId = 'bharat-evote-2026') {
        const { identityCommitment } = await this.generateIdentityCommitment(voterSecret);
        const { nullifierHash } = await this.generateNullifier(voterSecret, electionId);
        const { commitment, randomness, rawCommitment } = await this.generateCommitment(candidateId);
        const { proof } = await this.generateVoteProof(
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
    },

    /**
     * Verify a ZK proof locally
     */
    async verifyProofLocally(commitmentHash, nullifierHash, proof, candidatesCount) {
        try {
            const [challengeHex, responseVHex, responseRHex, proofCountHex] = proof;
            const challenge = BigInt(challengeHex);
            const response_v = BigInt(responseVHex);
            const response_r = BigInt(responseRHex);
            const proofCount = BigInt(proofCountHex);

            if (proofCount !== BigInt(candidatesCount)) {
                return { valid: false, reason: 'Candidate count mismatch' };
            }

            if (challenge === 0n || response_v === 0n || response_r === 0n) {
                return { valid: false, reason: 'Zero proof component' };
            }

            const expectedChallenge = await hashToField(
                BigInt(commitmentHash),
                BigInt(nullifierHash),
                response_v,
                response_r,
                proofCount
            );

            if (expectedChallenge % PRIME !== challenge % PRIME) {
                return { valid: false, reason: 'Challenge verification failed' };
            }

            return { valid: true };
        } catch (err) {
            return { valid: false, reason: err.message };
        }
    },

    /**
     * Verify a proof via the backend API
     */
    async verifyProofRemote(commitment, nullifierHash, proof, candidatesCount) {
        const response = await fetch(`${API_URL}/zkp/verify-proof`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commitment, nullifierHash, proof, candidatesCount })
        });
        return response.json();
    },

    /**
     * Pin vote metadata to IPFS
     */
    async pinVoteToIPFS(commitment, nullifierHash) {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/ipfs/pin-vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ commitment, nullifierHash })
        });
        return response.json();
    },

    /**
     * Get ZKP system status
     */
    async getZKPStatus() {
        const response = await fetch(`${API_URL}/zkp/status`);
        return response.json();
    }
};
