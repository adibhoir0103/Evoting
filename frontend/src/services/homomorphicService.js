/**
 * Homomorphic Encryption Service — Educational Paillier Simulation
 * 
 * Demonstrates the concept of tallying votes while they remain encrypted.
 * Uses a simplified Paillier cryptosystem with small parameters for browser performance.
 * 
 * ⚠️ EDUCATIONAL ONLY — Real-world FHE uses TFHE/BGV/CKKS with 128-bit security.
 * This simulation uses small primes to demonstrate the CONCEPT, not production security.
 * 
 * Key Properties Demonstrated:
 * 1. E(m1) × E(m2) mod n² = E(m1 + m2) — Additive homomorphism
 * 2. Individual votes are never decrypted
 * 3. Only the final SUM is decrypted
 */

// Simple modular arithmetic helpers
function modPow(base, exp, mod) {
    base = BigInt(base);
    exp = BigInt(exp);
    mod = BigInt(mod);
    if (mod === 1n) return 0n;

    let result = 1n;
    base = ((base % mod) + mod) % mod;

    while (exp > 0n) {
        if (exp % 2n === 1n) {
            result = (result * base) % mod;
        }
        exp = exp >> 1n;
        base = (base * base) % mod;
    }
    return result;
}

function modInverse(a, m) {
    a = ((BigInt(a) % BigInt(m)) + BigInt(m)) % BigInt(m);
    m = BigInt(m);

    let [old_r, r] = [a, m];
    let [old_s, s] = [1n, 0n];

    while (r !== 0n) {
        const q = old_r / r;
        [old_r, r] = [r, old_r - q * r];
        [old_s, s] = [s, old_s - q * s];
    }

    return ((old_s % m) + m) % m;
}

function gcd(a, b) {
    a = BigInt(a);
    b = BigInt(b);
    while (b !== 0n) {
        [a, b] = [b, a % b];
    }
    return a;
}

function lcm(a, b) {
    return (BigInt(a) * BigInt(b)) / gcd(a, b);
}

// L function: L(x) = (x - 1) / n
function L(x, n) {
    return (BigInt(x) - 1n) / BigInt(n);
}

// Generate a random BigInt in range [2, max-1]
function randomBigInt(max) {
    max = BigInt(max);
    const bytes = Math.ceil(max.toString(16).length / 2);
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    let val = BigInt('0x' + hex) % (max - 2n) + 2n;
    return val;
}

export const homomorphicService = {
    /**
     * Generate Paillier key pair
     * Uses small primes for demonstration (real would use 2048-bit RSA modulus)
     */
    generateKeyPair(bitSize = 'demo') {
        // Small primes for educational demo (fast in browser)
        // Real Paillier would use 1024-bit primes
        let p, q;

        if (bitSize === 'demo') {
            // Known safe primes for predictable demo
            const safePrimes = [
                [1607n, 1613n],
                [2003n, 2011n],
                [3001n, 3011n],
                [4001n, 4003n],
            ];
            const pair = safePrimes[Math.floor(Math.random() * safePrimes.length)];
            p = pair[0];
            q = pair[1];
        } else {
            // Slightly larger for more realistic demo
            p = 104729n;
            q = 104743n;
        }

        const n = p * q;
        const nSquared = n * n;
        const lambda = lcm(p - 1n, q - 1n);
        const g = n + 1n; // Simplified: g = n + 1

        // Compute mu = L(g^lambda mod n²)^(-1) mod n
        const gLambda = modPow(g, lambda, nSquared);
        const lValue = L(gLambda, n);
        const mu = modInverse(lValue, n);

        return {
            publicKey: { n, nSquared, g },
            privateKey: { lambda, mu, n, nSquared },
            keyInfo: {
                p: p.toString(),
                q: q.toString(),
                n: n.toString(),
                bitLength: n.toString(2).length,
                note: 'Educational demo — real Paillier uses 2048+ bit keys'
            }
        };
    },

    /**
     * Encrypt a vote (plaintext integer)
     * E(m) = g^m × r^n mod n²
     * 
     * The randomness r ensures the same vote encrypts differently each time (semantic security)
     */
    encrypt(plaintext, publicKey) {
        const m = BigInt(plaintext);
        const { n, nSquared, g } = publicKey;

        if (m < 0n || m >= n) {
            throw new Error(`Plaintext must be in range [0, ${n - 1n}]`);
        }

        // Generate random r where gcd(r, n) = 1
        let r;
        do {
            r = randomBigInt(n);
        } while (gcd(r, n) !== 1n);

        // c = g^m × r^n mod n²
        const gm = modPow(g, m, nSquared);
        const rn = modPow(r, n, nSquared);
        const ciphertext = (gm * rn) % nSquared;

        return {
            ciphertext: ciphertext.toString(),
            randomness: r.toString(),
            plaintext: plaintext.toString(),
            info: `E(${plaintext}) = g^${plaintext} × r^n mod n²`
        };
    },

    /**
     * Decrypt a ciphertext
     * D(c) = L(c^lambda mod n²) × mu mod n
     */
    decrypt(ciphertextStr, privateKey) {
        const c = BigInt(ciphertextStr);
        const { lambda, mu, n, nSquared } = privateKey;

        const cLambda = modPow(c, lambda, nSquared);
        const lValue = L(cLambda, n);
        const plaintext = (lValue * mu) % n;

        return {
            plaintext: plaintext.toString(),
            value: Number(plaintext)
        };
    },

    /**
     * ✨ THE MAGIC: Add two encrypted values WITHOUT decrypting
     * E(m1 + m2) = E(m1) × E(m2) mod n²
     * 
     * This is the key property that allows tallying encrypted votes!
     */
    addEncrypted(ciphertext1, ciphertext2, publicKey) {
        const c1 = BigInt(ciphertext1);
        const c2 = BigInt(ciphertext2);
        const { nSquared } = publicKey;

        const result = (c1 * c2) % nSquared;

        return {
            ciphertext: result.toString(),
            info: 'E(m1+m2) = E(m1) × E(m2) mod n² — votes added while encrypted!'
        };
    },

    /**
     * Tally multiple encrypted votes
     * Multiplies all ciphertexts together (which adds the plaintexts)
     */
    tallyEncryptedVotes(encryptedVotes, publicKey) {
        const { nSquared } = publicKey;

        let tally = 1n; // multiplicative identity
        const steps = [];

        for (let i = 0; i < encryptedVotes.length; i++) {
            const c = BigInt(encryptedVotes[i]);
            tally = (tally * c) % nSquared;
            steps.push({
                step: i + 1,
                operation: `accumulator × E(vote_${i + 1}) mod n²`,
                intermediate: tally.toString().slice(0, 20) + '...'
            });
        }

        return {
            encryptedTally: tally.toString(),
            voteCount: encryptedVotes.length,
            steps,
            info: 'All votes multiplied while encrypted — no individual vote was ever decrypted'
        };
    },

    /**
     * Run a complete demonstration
     * Encrypts sample votes, tallies them while encrypted, then decrypts only the sum
     */
    runDemo(votes = [1, 0, 1, 1, 0]) {
        const startTime = performance.now();

        // Step 1: Generate keys
        const { publicKey, privateKey, keyInfo } = this.generateKeyPair('demo');

        // Step 2: Encrypt each vote
        const encryptedVotes = votes.map((v, i) => {
            const encrypted = this.encrypt(v, publicKey);
            return {
                voter: `Voter ${i + 1}`,
                plaintext: v,
                ciphertext: encrypted.ciphertext,
                ciphertextPreview: encrypted.ciphertext.slice(0, 16) + '...',
                info: encrypted.info
            };
        });

        // Step 3: Tally while encrypted (THE MAGIC)
        const tallyResult = this.tallyEncryptedVotes(
            encryptedVotes.map(v => v.ciphertext),
            publicKey
        );

        // Step 4: Decrypt ONLY the final tally
        const decryptedTally = this.decrypt(tallyResult.encryptedTally, privateKey);

        // Step 5: Verify correctness
        const expectedSum = votes.reduce((a, b) => a + b, 0);
        const isCorrect = decryptedTally.value === expectedSum;

        const elapsed = (performance.now() - startTime).toFixed(2);

        return {
            keyInfo,
            votes: votes.map((v, i) => ({
                voter: `Voter ${i + 1}`,
                vote: v === 1 ? '✓ Yes' : '✗ No',
                encrypted: encryptedVotes[i].ciphertextPreview
            })),
            encryptedVotes: encryptedVotes.map(v => v.ciphertext),
            tallySteps: tallyResult.steps,
            encryptedTally: tallyResult.encryptedTally.slice(0, 20) + '...',
            decryptedTally: decryptedTally.value,
            expectedSum,
            correct: isCorrect,
            timingMs: elapsed,
            summary: isCorrect
                ? `✅ Correct! ${votes.length} encrypted votes tallied to ${expectedSum} — NO individual vote was ever decrypted.`
                : `❌ Error: Expected ${expectedSum}, got ${decryptedTally.value}`
        };
    }
};
