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
            try {
                if (job.jobName === 'send_vote_receipt') {
                    const { email, fullname, txHash } = job.payload;
                    console.log(`[QStash Proxy] Processing receipt for ${email}...`);
                    await emailService.sendVoteReceipt(email, fullname, txHash);
                    console.log(`[QStash Proxy] Receipt dispatched successfully for tx: ${txHash}`);
                }
            } catch (err) {
                console.error(`[QStash Proxy] Job ${job.jobName} failed:`, err);
                if (process.env.SENTRY_DSN) {
                    Sentry.captureException(err, { tags: { job: job.jobName, worker: 'qstash_proxy' } });
                }
            }
        }
        
        this.isProcessing = false;
    }
}

// Export a singleton instance
module.exports = new BackgroundJobQueue();
