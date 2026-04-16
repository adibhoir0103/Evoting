/**
 * Post-Quantum Cryptography Service — CRYSTALS-Dilithium Simulation
 * 
 * Demonstrates lattice-based digital signatures that are resistant to
 * quantum computer attacks (Shor's algorithm).
 * 
 * ⚠️ EDUCATIONAL SIMULATION — Real CRYSTALS-Dilithium uses:
 *    - Module Learning With Errors (MLWE) problem
 *    - Polynomial rings Rq = Zq[X]/(X^256 + 1)
 *    - Security levels: 2 (128-bit), 3 (192-bit), 5 (256-bit)
 * 
 * This simulation demonstrates the CONCEPT with simplified math
 * to run in a browser environment.
 * 
 * NIST PQC Standard: FIPS 204 (ML-DSA, based on CRYSTALS-Dilithium)
 * Standardized: August 2024
 */

// Simplified polynomial ring operations (educational)
class PolynomialRing {
    constructor(n = 16, q = 8380417) {
        this.n = n;  // Ring dimension (real Dilithium uses 256)
        this.q = q;  // Modulus (same as real Dilithium)
    }

    // Generate random polynomial with coefficients in [-eta, eta]
    randomPoly(eta = 2) {
        const coeffs = new Array(this.n);
        const array = new Uint8Array(this.n);
        crypto.getRandomValues(array);
        for (let i = 0; i < this.n; i++) {
            coeffs[i] = (array[i] % (2 * eta + 1)) - eta;
        }
        return coeffs;
    }

    // Generate random polynomial with coefficients in [0, q-1]
    randomPolyQ() {
        const coeffs = new Array(this.n);
        const array = new Uint32Array(this.n);
        crypto.getRandomValues(array);
        for (let i = 0; i < this.n; i++) {
            coeffs[i] = array[i] % this.q;
        }
        return coeffs;
    }

    // Polynomial addition mod q
    add(a, b) {
        const result = new Array(this.n);
        for (let i = 0; i < this.n; i++) {
            result[i] = ((a[i] || 0) + (b[i] || 0)) % this.q;
            if (result[i] < 0) result[i] += this.q;
        }
        return result;
    }

    // Polynomial subtraction mod q
    sub(a, b) {
        const result = new Array(this.n);
        for (let i = 0; i < this.n; i++) {
            result[i] = ((a[i] || 0) - (b[i] || 0)) % this.q;
            if (result[i] < 0) result[i] += this.q;
        }
        return result;
    }

    // Simplified polynomial multiplication mod q (schoolbook, not NTT)
    // Real Dilithium uses NTT (Number Theoretic Transform) for O(n log n) speed
    multiply(a, b) {
        const result = new Array(this.n).fill(0);
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                const idx = (i + j) % this.n;
                const sign = (i + j) >= this.n ? -1 : 1; // X^n = -1 in the ring
                result[idx] = (result[idx] + sign * a[i] * b[j]) % this.q;
                if (result[idx] < 0) result[idx] += this.q;
            }
        }
        return result;
    }

    // Check if polynomial has "small" coefficients
    isSmall(poly, bound) {
        return poly.every(c => {
            const adjusted = c > this.q / 2 ? c - this.q : c;
            return Math.abs(adjusted) <= bound;
        });
    }

    // Get infinity norm (max absolute coefficient)
    infinityNorm(poly) {
        return Math.max(...poly.map(c => {
            const adjusted = c > this.q / 2 ? c - this.q : c;
            return Math.abs(adjusted);
        }));
    }

    // Hash to polynomial (simplified - real uses SHAKE-256)
    async hashToPoly(data) {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
        const hashArray = new Uint8Array(hashBuffer);
        const coeffs = new Array(this.n);
        for (let i = 0; i < this.n; i++) {
            coeffs[i] = hashArray[i % hashArray.length] % 60; // Small challenge
        }
        return coeffs;
    }
}

export const postQuantumService = {
    ring: new PolynomialRing(16, 8380417),

    /**
     * Generate a CRYSTALS-Dilithium-style key pair
     * 
     * Real Dilithium (NIST Level 2):
     *   - Public key: 1312 bytes
     *   - Secret key: 2528 bytes
     *   - Signature: 2420 bytes
     * 
     * Our simulation uses smaller parameters for browser performance
     */
    generateKeyPair() {
        const startTime = performance.now();
        const ring = this.ring;

        // Matrix A ∈ R_q^{k×l} (public parameter)
        // Simplified: single polynomial instead of matrix
        const A = ring.randomPolyQ();

        // Secret key: s1, s2 ∈ R_q with small coefficients
        const s1 = ring.randomPoly(2); // "short" secret
        const s2 = ring.randomPoly(2); // "short" error

        // Public key: t = A*s1 + s2 mod q
        const As1 = ring.multiply(A, s1);
        const t = ring.add(As1, s2);

        const elapsed = (performance.now() - startTime).toFixed(2);

        return {
            publicKey: {
                A: A.slice(0, 4).join(', ') + '...',
                t: t.slice(0, 4).join(', ') + '...',
                raw: { A, t }
            },
            secretKey: {
                s1: s1.slice(0, 4).join(', ') + '...',
                s2: s2.slice(0, 4).join(', ') + '...',
                raw: { s1, s2, A }
            },
            keyInfo: {
                algorithm: 'CRYSTALS-Dilithium (Simplified)',
                nistStandard: 'FIPS 204 (ML-DSA)',
                ringDimension: ring.n,
                modulus: ring.q,
                securityBasis: 'Module Learning With Errors (MLWE)',
                quantumResistant: true,
                classicalSecurity: '128-bit equivalent (simplified)',
                generationTimeMs: elapsed,
                realKeySizes: {
                    publicKey: '1312 bytes',
                    secretKey: '2528 bytes',
                    signature: '2420 bytes'
                },
                ecdsaKeySizes: {
                    publicKey: '33 bytes (compressed)',
                    secretKey: '32 bytes',
                    signature: '64 bytes'
                },
                note: 'PQ keys are ~40x larger than ECDSA — a trade-off for quantum resistance'
            }
        };
    },

    /**
     * Sign a message using Dilithium-style signature
     * 
     * Simplified version of the Fiat-Shamir with Aborts technique:
     * 1. Generate random masking vector y
     * 2. Compute w = A*y
     * 3. Compute challenge c = H(w || message)
     * 4. Compute z = y + c*s1
     * 5. If z is too large, ABORT and retry (rejection sampling)
     * 6. Signature = (z, c)
     */
    async sign(message, secretKey) {
        const startTime = performance.now();
        const ring = this.ring;
        const { s1, A } = secretKey.raw;

        let attempts = 0;
        const gamma = 100000; // Bound for rejection sampling

        while (attempts < 20) {
            attempts++;

            // Step 1: Random masking vector y
            const y = ring.randomPolyQ();

            // Step 2: w = A*y mod q
            const w = ring.multiply(A, y);

            // Step 3: Challenge c = H(w || msg)
            const challengeInput = w.join(',') + '||' + message;
            const c = await ring.hashToPoly(challengeInput);

            // Step 4: z = y + c*s1
            const cs1 = ring.multiply(c, s1);
            const z = ring.add(y, cs1);

            // Step 5: Rejection sampling — abort if z is too large
            if (ring.infinityNorm(z) < gamma) {
                const elapsed = (performance.now() - startTime).toFixed(2);

                return {
                    signature: {
                        z: z.slice(0, 4).join(', ') + '...',
                        c: c.slice(0, 4).join(', ') + '...',
                        raw: { z, c }
                    },
                    message,
                    signingInfo: {
                        attempts,
                        timeMs: elapsed,
                        rejectionSampling: attempts > 1,
                        note: attempts > 1
                            ? `Rejected ${attempts - 1} time(s) — this prevents secret key leakage through signatures`
                            : 'Accepted on first attempt'
                    }
                };
            }
        }

        throw new Error('Signing failed after maximum attempts (rejection sampling)');
    },

    /**
     * Verify a Dilithium-style signature
     * 
     * Verification: 
     * 1. Compute w' = A*z - t*c
     * 2. Compute c' = H(w' || message)  
     * 3. Accept if c' = c AND ||z|| < gamma
     */
    async verify(message, signature, publicKey) {
        const startTime = performance.now();
        const ring = this.ring;
        const { A, t } = publicKey.raw;
        const { z, c } = signature.raw;
        const gamma = 100000;

        // Step 1: w' = A*z - t*c
        const Az = ring.multiply(A, z);
        const tc = ring.multiply(t, c);
        const wPrime = ring.sub(Az, tc);

        // Step 2: Recompute challenge
        const challengeInput = wPrime.join(',') + '||' + message;
        const cPrime = await ring.hashToPoly(challengeInput);

        // Step 3: Check c' = c
        const challengeMatch = c.every((val, i) => val === cPrime[i]);

        // Step 4: Check ||z|| < gamma
        const normCheck = ring.infinityNorm(z) < gamma;

        const valid = challengeMatch && normCheck;
        const elapsed = (performance.now() - startTime).toFixed(2);

        return {
            valid,
            timeMs: elapsed,
            checks: {
                challengeMatch,
                normCheck,
                zNorm: ring.infinityNorm(z),
                gamma
            },
            result: valid
                ? '✅ Signature is VALID — message authenticity confirmed (quantum-resistant)'
                : '❌ Signature INVALID — message may have been tampered with'
        };
    },

    /**
     * Run a complete PQ crypto demonstration
     */
    async runDemo(message = 'Vote for Candidate #3 | Election 2026 | Bharat E-Vote') {
        const steps = [];

        // Step 1: Key Generation
        steps.push({ phase: 'Key Generation', status: 'running' });
        const keys = this.generateKeyPair();
        steps[0] = { phase: 'Key Generation', status: 'done', data: keys.keyInfo };

        // Step 2: Sign
        steps.push({ phase: 'Signing', status: 'running' });
        const signed = await this.sign(message, keys.secretKey);
        steps[1] = { phase: 'Signing', status: 'done', data: signed.signingInfo };

        // Step 3: Verify
        steps.push({ phase: 'Verification', status: 'running' });
        const verified = await this.verify(message, signed.signature, keys.publicKey);
        steps[2] = { phase: 'Verification', status: 'done', data: verified };

        // Step 4: Tamper test
        steps.push({ phase: 'Tamper Detection', status: 'running' });
        const tampered = await this.verify(message + ' TAMPERED', signed.signature, keys.publicKey);
        steps[3] = { phase: 'Tamper Detection', status: 'done', data: tampered };

        return {
            message,
            steps,
            publicKey: keys.publicKey,
            secretKey: '🔒 [HIDDEN]',
            signature: signed.signature,
            originalValid: verified.valid,
            tamperedValid: tampered.valid,
            summary: verified.valid && !tampered.valid
                ? '✅ Post-quantum signature scheme working correctly: authentic messages verified, tampered messages rejected.'
                : '⚠️ Unexpected result in demo',
            comparison: {
                title: 'ECDSA vs CRYSTALS-Dilithium',
                rows: [
                    { metric: 'Quantum Resistant', ecdsa: '❌ No (Shor\'s algorithm)', pq: '✅ Yes (MLWE hardness)' },
                    { metric: 'Public Key Size', ecdsa: '33 bytes', pq: '1,312 bytes' },
                    { metric: 'Signature Size', ecdsa: '64 bytes', pq: '2,420 bytes' },
                    { metric: 'Sign Speed', ecdsa: '~0.1ms', pq: `~${signed.signingInfo.timeMs}ms` },
                    { metric: 'Verify Speed', ecdsa: '~0.2ms', pq: `~${verified.timeMs}ms` },
                    { metric: 'NIST Standard', ecdsa: 'FIPS 186-4', pq: 'FIPS 204 (Aug 2024)' },
                    { metric: 'Used By', ecdsa: 'Ethereum, Bitcoin', pq: 'Future blockchain systems' },
                ]
            }
        };
    },

    /**
     * Get migration roadmap for transitioning from ECDSA to PQ
     */
    getMigrationRoadmap() {
        return {
            title: 'Post-Quantum Migration Roadmap for Bharat E-Vote',
            phases: [
                {
                    phase: '1. Crypto Agility Layer',
                    timeline: '2026-2027',
                    description: 'Abstract all cryptographic operations behind an interface that can swap between ECDSA and PQ algorithms.',
                    tasks: [
                        'Create CryptoProvider interface (sign, verify, hash)',
                        'Implement ECDSAProvider (current)',
                        'Implement DilithiumProvider (future)',
                        'Add algorithm negotiation to handshake'
                    ]
                },
                {
                    phase: '2. Hybrid Signatures',
                    timeline: '2027-2028',
                    description: 'Use both ECDSA and Dilithium signatures simultaneously. If either quantum computers arrive OR Dilithium is broken, the other still protects.',
                    tasks: [
                        'Dual-sign all vote transactions',
                        'Verify both signatures on-chain',
                        'Double the transaction data overhead',
                        'Monitor NIST PQC competition updates'
                    ]
                },
                {
                    phase: '3. Full PQ Transition',
                    timeline: '2028-2030',
                    description: 'Once PQ standards are battle-tested and quantum threats are imminent, transition fully to CRYSTALS-Dilithium.',
                    tasks: [
                        'Deprecate ECDSA signatures',
                        'Update MetaMask/wallet integration for PQ',
                        'Re-deploy smart contracts with PQ verification',
                        'Update voter key generation to PQ'
                    ]
                }
            ],
            quantumTimeline: {
                current: 'Quantum computers today: ~1000 qubits (not a threat)',
                threat: 'Estimated threat: 2030-2035 (4000+ logical qubits needed for RSA-2048)',
                action: '"Harvest now, decrypt later" attacks may target vote records TODAY for future decryption',
                urgency: 'Preparing NOW protects historical vote data from future quantum adversaries'
            }
        };
    }
};
