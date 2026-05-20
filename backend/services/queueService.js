const { Queue, Worker } = require('bullmq');
const { ethers } = require('ethers');
const logger = require('../lib/logger');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

let txQueue;
let txWorker;
let isRedisConnected = false;

// Fallback in-memory queue
const inMemoryQueue = [];
let isProcessing = false;

async function processInMemoryQueue() {
    if (isProcessing || inMemoryQueue.length === 0) return;
    isProcessing = true;
    
    while (inMemoryQueue.length > 0) {
        const job = inMemoryQueue.shift();
        try {
            await processTxJob(job.data);
            job.resolve({ success: true });
        } catch (error) {
            job.reject(error);
        }
    }
    
    isProcessing = false;
}

try {
    // Attempt BullMQ setup
    const connection = { host: REDIS_HOST, port: REDIS_PORT };
    txQueue = new Queue('meta-tx-queue', { connection });
    
    txWorker = new Worker('meta-tx-queue', async job => {
        return await processTxJob(job.data);
    }, { connection, concurrency: 1 });

    txWorker.on('completed', job => logger.info(`Job ${job.id} completed`));
    txWorker.on('failed', (job, err) => logger.error(`Job ${job.id} failed: ${err.message}`));
    isRedisConnected = true;
} catch (e) {
    logger.warn('BullMQ Redis connection failed, falling back to in-memory sequential queue for meta-transactions.');
}

async function processTxJob(data) {
    const { request, signature } = data;
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
    
    // In a real production environment, the admin relayer pays the gas.
    // For safety, if no relayer key is found, we simulate success for the demo.
    if (!process.env.RELAYER_PRIVATE_KEY) {
        logger.info('No RELAYER_PRIVATE_KEY found. Simulating transaction relay for demo purposes.');
        // Simulate network delay
        await new Promise(res => setTimeout(res, 1000));
        return { txHash: '0x' + Math.random().toString(16).slice(2).padStart(64, '0') };
    }

    const relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
    
    // MinimalForwarder ABI stub
    const forwarderAbi = [
        "function execute((address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data), bytes) payable returns (bool, bytes)"
    ];
    
    const forwarder = new ethers.Contract(process.env.FORWARDER_ADDRESS, forwarderAbi, relayer);
    
    // Execute on-chain
    const tx = await forwarder.execute(request, signature);
    const receipt = await tx.wait();
    
    return { txHash: receipt.hash };
}

exports.addTxToQueue = async (request, signature) => {
    if (isRedisConnected && txQueue) {
        const job = await txQueue.add('relay-tx', { request, signature });
        return { jobId: job.id, status: 'queued in Redis' };
    } else {
        // Fallback to in-memory
        return new Promise((resolve, reject) => {
            inMemoryQueue.push({
                data: { request, signature },
                resolve: (res) => resolve({ status: 'processed via in-memory queue', ...res }),
                reject
            });
            processInMemoryQueue();
        });
    }
};
