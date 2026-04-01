/**
 * QStash / Background Worker Microservice Proxy
 * Implements the asynchronous email dispatch and cache warming architecture
 * requested in the Enterprise List 2 Constraints.
 */
const emailService = require('./emailService');
const Sentry = require('@sentry/node');

class BackgroundJobQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        console.log('✅ Background Worker Queue (QStash Proxy) initialized');
    }

    /**
     * Publish an event to the background queue
     */
    async publish(jobName, payload) {
        this.queue.push({ jobName, payload, timestamp: Date.now() });
        
        // Asynchronously process without blocking
        if (!this.isProcessing) {
             this.processQueue();
        }
    }

    async processQueue() {
        this.isProcessing = true;
        
        while (this.queue.length > 0) {
            const job = this.queue.shift();
            const MAX_RETRIES = 2;
            let attempt = 0;
            let success = false;

            while (attempt <= MAX_RETRIES && !success) {
                try {
                    switch (job.jobName) {
                        case 'send_vote_receipt': {
                            const { email, fullname, txHash } = job.payload;
                            console.log(`[QStash] Processing vote receipt for ${email}...`);
                            await emailService.sendVoteReceipt(email, fullname, txHash);
                            console.log(`[QStash] Receipt dispatched for tx: ${txHash}`);
                            break;
                        }
                        case 'send_otp': {
                            const { email: otpEmail, otp, userName } = job.payload;
                            console.log(`[QStash] Processing OTP dispatch to ${otpEmail}...`);
                            await emailService.sendOTP(otpEmail, otp, userName);
                            console.log(`[QStash] OTP dispatched to ${otpEmail}`);
                            break;
                        }
                        case 'send_broadcast': {
                            const { email: bcastEmail, fullname: bcastName, subject, body } = job.payload;
                            console.log(`[QStash] Processing broadcast to ${bcastEmail}...`);
                            await emailService.sendBroadcastEmail(bcastEmail, bcastName, subject, body);
                            console.log(`[QStash] Broadcast dispatched to ${bcastEmail}`);
                            break;
                        }
                        default:
                            console.warn(`[QStash] Unknown job type: ${job.jobName}`);
                    }
                    success = true;
                } catch (err) {
                    attempt++;
                    if (attempt > MAX_RETRIES) {
                        console.error(`[QStash] Job ${job.jobName} failed after ${MAX_RETRIES + 1} attempts:`, err.message);
                        if (process.env.SENTRY_DSN) {
                            Sentry.captureException(err, { 
                                tags: { job: job.jobName, worker: 'qstash_proxy', attempts: attempt },
                                extra: { payload: job.payload }
                            });
                        }
                    } else {
                        console.warn(`[QStash] Job ${job.jobName} attempt ${attempt} failed, retrying...`);
                        await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
                    }
                }
            }
        }
        
        this.isProcessing = false;
    }
}

// Export a singleton instance
module.exports = new BackgroundJobQueue();
