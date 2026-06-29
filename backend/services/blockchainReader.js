const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');
const bcLog = logger.child('blockchainReader');

class BlockchainReader {
    constructor() {
        this.provider = null;
        this.contract = null;
        
        // Resolve paths from this file's location (backend/services/)
        const addressPath = path.join(__dirname, '../../frontend/src/contracts/contract-address.json');
        const artifactPath = path.join(__dirname, '../../frontend/src/contracts/Voting.json');
        
        this.contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
        if (fs.existsSync(addressPath)) {
            const contractConfig = JSON.parse(fs.readFileSync(addressPath, 'utf8'));
            if (contractConfig.address) {
                this.contractAddress = contractConfig.address;
            }
        }
        
        let VotingABI = [];
        if (fs.existsSync(artifactPath)) {
            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            VotingABI = artifact.abi;
        }

        // RPC config
        this.rpcUrl = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || "http://127.0.0.1:8545";
        
        if (VotingABI.length > 0) {
            try {
                this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
                this.contract = new ethers.Contract(this.contractAddress, VotingABI, this.provider);
                bcLog.info(`BlockchainReader initialized on ${this.rpcUrl} at ${this.contractAddress}`);
            } catch (err) {
                bcLog.error(`BlockchainReader init failed: ${err.message}`);
            }
        } else {
            bcLog.warn("BlockchainReader: ABI not found. Ensure contracts are compiled and copied to frontend.");
        }
    }

    async getAllCandidates() {
        if (!this.contract) return [];
        try {
            const candidates = await this.contract.getAllCandidates();
            return candidates.map(c => ({
                id: Number(c.id),
                name: c.name,
                partyName: c.partyName,
                partySymbol: c.partySymbol,
                stateCode: Number(c.stateCode),
                constituencyCode: Number(c.constituencyCode),
                voteCount: Number(c.voteCount)
            }));
        } catch (err) {
            bcLog.error(`Error in getAllCandidates: ${err.message}`);
            return [];
        }
    }

    async hasVoterVoted(voterAddress) {
        if (!this.contract || !voterAddress) return false;
        try {
            const voterData = await this.contract.voters(voterAddress);
            return voterData.hasVoted;
        } catch (err) {
            bcLog.error(`Error in hasVoterVoted for ${voterAddress}: ${err.message}`);
            return false;
        }
    }
}

module.exports = new BlockchainReader();
