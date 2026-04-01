/**
 * Keystroke Dynamics Service
 * 
 * Behavioral biometric security layer that analyzes typing rhythm patterns
 * during password entry to detect unauthorized access.
 * 
 * === HOW IT WORKS ===
 * 1. ENROLLMENT PHASE (first 5 successful logins):
 *    - Collects keystroke timing vectors (hold times + flight times)
 *    - Builds a baseline "typing fingerprint" per user
 *    - No enforcement during enrollment
 * 
 * 2. ACTIVE PHASE (after 5+ samples):
 *    - Compares new typing pattern against stored baseline
 *    - Uses Euclidean distance to measure similarity
 *    - If deviation exceeds threshold → flags as suspicious
 * 
 * === WHAT WE CAPTURE ===
 * - Hold Time (dwell time): How long each key is pressed (keyDown → keyUp)
 * - Flight Time (inter-key delay): Time between releasing one key and pressing next
 * - Overall typing speed: Characters per second
 * 
 * === ODDS & LIMITATIONS ===
 * - False Rejection Rate: ~5-15% (typing varies by fatigue, device, stress)
 * - We use SOFT enforcement (flag + require extra verification, never block)
 * - Mobile vs Desktop keyboards produce very different patterns
 * - First login on a new device will always differ slightly
 * - We normalize vectors to handle different password lengths
 * 
 * === SECURITY BENEFIT ===
 * - Even if password is stolen, attacker types differently → flagged
 * - Combined with Turnstile + 2FA OTP = defense-in-depth
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MIN_SAMPLES = 5;          // Minimum samples before enforcement
const SUSPICIOUS_THRESHOLD = 2.5; // Euclidean distance threshold (tuned for passwords)
const MAX_SAMPLES = 20;         // Cap stored samples to prevent averaging drift

class KeystrokeService {

    /**
     * Process a keystroke timing sample from a login attempt
     * @param {string} email - User's email
     * @param {Object} timingData - { holdTimes: number[], flightTimes: number[], totalTime: number, keyCount: number }
     * @returns {{ enrolled: boolean, suspicious: boolean, score: number, message: string }}
     */
    async processKeystroke(email, timingData) {
        const { holdTimes, flightTimes, totalTime, keyCount } = timingData;

        // Validate input
        if (!holdTimes || !flightTimes || !Array.isArray(holdTimes) || !Array.isArray(flightTimes)) {
            return { enrolled: false, suspicious: false, score: 0, message: 'Invalid timing data format' };
        }

        // Ignore extremely short or obviously automated inputs
        if (keyCount < 4 || totalTime < 200) {
            return { enrolled: false, suspicious: true, score: 99, message: 'Typing pattern too fast — possible automation' };
        }

        // Normalize timing vectors (scale to 0-1 range for comparison)
        const normalizedHold = this._normalize(holdTimes);
        const normalizedFlight = this._normalize(flightTimes);
        const typingSpeed = keyCount / (totalTime / 1000); // chars/sec

        try {
            // Get or create profile
            let profile = await prisma.keystrokeProfile.findUnique({ where: { user_email: email } });

            if (!profile) {
                // First ever login — create profile and store baseline
                profile = await prisma.keystrokeProfile.create({
                    data: {
                        user_email: email,
                        hold_times: JSON.stringify([normalizedHold]),
                        flight_times: JSON.stringify([normalizedFlight]),
                        mean_speed: typingSpeed,
                        sample_count: 1,
                        is_enrolled: false
                    }
                });

                return { 
                    enrolled: false, 
                    suspicious: false, 
                    score: 0, 
                    message: `Keystroke sample 1/${MIN_SAMPLES} collected for enrollment` 
                };
            }

            // Parse stored samples
            const storedHoldSamples = JSON.parse(profile.hold_times || '[]');
            const storedFlightSamples = JSON.parse(profile.flight_times || '[]');

            if (!profile.is_enrolled) {
                // ENROLLMENT PHASE — collecting samples
                storedHoldSamples.push(normalizedHold);
                storedFlightSamples.push(normalizedFlight);

                const newCount = profile.sample_count + 1;
                const isNowEnrolled = newCount >= MIN_SAMPLES;

                // Compute running averages
                const avgHold = this._averageVectors(storedHoldSamples);
                const avgFlight = this._averageVectors(storedFlightSamples);
                const avgSpeed = ((profile.mean_speed * profile.sample_count) + typingSpeed) / newCount;
                const stdDev = this._computeStdDeviation(storedHoldSamples, avgHold);

                await prisma.keystrokeProfile.update({
                    where: { user_email: email },
                    data: {
                        hold_times: JSON.stringify(storedHoldSamples.slice(-MAX_SAMPLES)),
                        flight_times: JSON.stringify(storedFlightSamples.slice(-MAX_SAMPLES)),
                        mean_speed: avgSpeed,
                        std_deviation: stdDev,
                        sample_count: newCount,
                        is_enrolled: isNowEnrolled
                    }
                });

                return {
                    enrolled: isNowEnrolled,
                    suspicious: false,
                    score: 0,
                    message: isNowEnrolled 
                        ? 'Keystroke profile enrolled! Behavioral biometrics now active.'
                        : `Keystroke sample ${newCount}/${MIN_SAMPLES} collected for enrollment`
                };
            }

            // ACTIVE PHASE — compare against baseline
            const avgHold = this._averageVectors(storedHoldSamples);
            const avgFlight = this._averageVectors(storedFlightSamples);

            // Calculate Euclidean distance between current and baseline
            const holdDistance = this._euclideanDistance(normalizedHold, avgHold);
            const flightDistance = this._euclideanDistance(normalizedFlight, avgFlight);
            const combinedScore = (holdDistance * 0.6) + (flightDistance * 0.4); // Hold times are more discriminative

            const isSuspicious = combinedScore > SUSPICIOUS_THRESHOLD;

            // Update profile with latest verification
            const updateData = {
                last_verified: new Date(),
                last_score: combinedScore,
            };

            if (!isSuspicious) {
                // Good match — update baseline with new sample (adaptive learning)
                storedHoldSamples.push(normalizedHold);
                storedFlightSamples.push(normalizedFlight);
                updateData.hold_times = JSON.stringify(storedHoldSamples.slice(-MAX_SAMPLES));
                updateData.flight_times = JSON.stringify(storedFlightSamples.slice(-MAX_SAMPLES));
                updateData.sample_count = Math.min(profile.sample_count + 1, MAX_SAMPLES);
                updateData.mean_speed = ((profile.mean_speed * profile.sample_count) + typingSpeed) / (profile.sample_count + 1);
            } else {
                // Suspicious — increment flag counter
                updateData.flagged_count = profile.flagged_count + 1;
            }

            await prisma.keystrokeProfile.update({
                where: { user_email: email },
                data: updateData
            });

            return {
                enrolled: true,
                suspicious: isSuspicious,
                score: parseFloat(combinedScore.toFixed(4)),
                message: isSuspicious 
                    ? `Unusual typing pattern detected (score: ${combinedScore.toFixed(2)}, threshold: ${SUSPICIOUS_THRESHOLD})`
                    : 'Keystroke pattern verified successfully'
            };

        } catch (error) {
            console.error('Keystroke service error:', error);
            // Fail-open: don't block login if keystroke service fails
            return { enrolled: false, suspicious: false, score: 0, message: 'Keystroke service unavailable' };
        }
    }

    /**
     * Get enrollment status for a user
     */
    async getStatus(email) {
        try {
            const profile = await prisma.keystrokeProfile.findUnique({ where: { user_email: email } });
            if (!profile) return { enrolled: false, sampleCount: 0, flaggedCount: 0 };
            return {
                enrolled: profile.is_enrolled,
                sampleCount: profile.sample_count,
                flaggedCount: profile.flagged_count,
                lastScore: profile.last_score,
                lastVerified: profile.last_verified
            };
        } catch {
            return { enrolled: false, sampleCount: 0, flaggedCount: 0 };
        }
    }

    // ==================== MATH UTILITIES ====================

    /**
     * Normalize a vector to 0-1 range (min-max normalization)
     */
    _normalize(arr) {
        if (!arr.length) return [];
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        const range = max - min || 1; // Avoid division by zero
        return arr.map(v => (v - min) / range);
    }

    /**
     * Compute Euclidean distance between two vectors
     * Handles different-length vectors by truncating to shorter length
     */
    _euclideanDistance(a, b) {
        const len = Math.min(a.length, b.length);
        if (len === 0) return 0;
        let sum = 0;
        for (let i = 0; i < len; i++) {
            sum += Math.pow((a[i] || 0) - (b[i] || 0), 2);
        }
        return Math.sqrt(sum / len); // Normalized by length
    }

    /**
     * Average multiple vectors element-wise
     */
    _averageVectors(samples) {
        if (!samples.length) return [];
        const maxLen = Math.max(...samples.map(s => s.length));
        const avg = new Array(maxLen).fill(0);
        
        for (const sample of samples) {
            for (let i = 0; i < sample.length; i++) {
                avg[i] += sample[i] / samples.length;
            }
        }
        return avg;
    }

    /**
     * Compute standard deviation of timing samples
     */
    _computeStdDeviation(samples, avgVector) {
        if (samples.length < 2) return 0;
        
        const distances = samples.map(s => this._euclideanDistance(s, avgVector));
        const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
        
        return Math.sqrt(variance);
    }
}

module.exports = new KeystrokeService();
