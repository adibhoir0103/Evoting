import { ethers } from 'ethers';
import VotingArtifact from '../contracts/Voting.json';
import contractAddress from '../contracts/contract-address.json';

/**
 * Blockchain service to interact with the Voting smart contract
 */
export class BlockchainService {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.contractAddress = contractAddress.address;
    }

    static getInstance() {
        if (!BlockchainService.instance) {
            BlockchainService.instance = new BlockchainService();
        }
        return BlockchainService.instance;
    }

    /**
     * Connect to MetaMask wallet
     * @returns {Promise<string>} Connected wallet address
     */
    async connectWallet() {
        try {
            if (!window.ethereum) {
                throw new Error('MetaMask is not installed. Please install MetaMask to use this application.');
            }

            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            // Create provider and signer
            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();

            // Initialize contract
            this.contract = new ethers.Contract(
                this.contractAddress,
                VotingArtifact.abi,
                this.signer
            );

            console.log('✅ Wallet connected:', accounts[0]);
            return accounts[0];
        } catch (error) {
            console.error('Error connecting wallet:', error);
            throw error;
        }
    }

    /**
     * Get the current connected account
     * @returns {Promise<string>} Current account address
     */
    async getCurrentAccount() {
        try {
            if (!this.signer) {
                await this.connectWallet();
            }
            return await this.signer.getAddress();
        } catch (error) {
            console.error('Error getting current account:', error);
            throw error;
        }
    }

    /**
     * Check if the current user is the admin
     * @returns {Promise<boolean>}
     */
    async isAdmin() {
        try {
            const currentAccount = await this.getCurrentAccount();
            const adminAddress = await this.contract.admin();
            return currentAccount.toLowerCase() === adminAddress.toLowerCase();
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    /**
     * Add a new candidate (Admin only)
     * @param {string} candidateName
     * @returns {Promise<object>} Transaction receipt
     */
    async addCandidate(candidateName) {
        try {
            const tx = await this.contract.addCandidate(candidateName);
            console.log('⏳ Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('✅ Candidate added successfully');
            return receipt;
        } catch (error) {
            console.error('Error adding candidate:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Authorize a voter (Admin only)
     * @param {string} voterAddress
     * @returns {Promise<object>} Transaction receipt
     */
    async authorizeVoter(voterAddress) {
        try {
            const tx = await this.contract.authorizeVoter(voterAddress);
            console.log('⏳ Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('✅ Voter authorized successfully');
            return receipt;
        } catch (error) {
            console.error('Error authorizing voter:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Authorize multiple voters in batch (Admin only)
     * @param {string[]} voterAddresses
     * @returns {Promise<object>} Transaction receipt
     */
    async authorizeVotersBatch(voterAddresses) {
        try {
            const tx = await this.contract.authorizeVotersBatch(voterAddresses);
            console.log('⏳ Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('✅ Voters authorized successfully');
            return receipt;
        } catch (error) {
            console.error('Error authorizing voters in batch:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Start voting (Admin only)
     * @returns {Promise<object>} Transaction receipt
     */
    async startVoting() {
        try {
            const tx = await this.contract.startVoting();
            console.log('⏳ Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('✅ Voting started successfully');
            return receipt;
        } catch (error) {
            console.error('Error starting voting:', error);
            throw this.handleError(error);
        }
    }

    /**
     * End voting (Admin only)
     * @returns {Promise<object>} Transaction receipt
     */
    async endVoting() {
        try {
            const tx = await this.contract.endVoting();
            console.log('⏳ Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('✅ Voting ended successfully');
            return receipt;
        } catch (error) {
            console.error('Error ending voting:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Cast a vote
     * @param {number} candidateId
     * @returns {Promise<object>} Transaction receipt
     */
    async vote(candidateId) {
        try {
            const tx = await this.contract.vote(candidateId);
            console.log('⏳ Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('✅ Vote cast successfully');
            return receipt;
        } catch (error) {
            console.error('Error casting vote:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Get all candidates
     * @returns {Promise<Array>} Array of candidates
     */
    async getAllCandidates() {
        try {
            const candidates = await this.contract.getAllCandidates();
            return candidates.map(c => ({
                id: Number(c.id),
                name: c.name,
                voteCount: Number(c.voteCount)
            }));
        } catch (error) {
            console.error('Error getting candidates:', error);
            throw error;
        }
    }

    // Alias for consistency
    async getCandidates() {
        return this.getAllCandidates();
    }

    /**
     * Get voting status
     * @returns {Promise<boolean>}
     */
    async isVotingActive() {
        try {
            return await this.contract.votingActive();
        } catch (error) {
            console.error('Error getting voting status:', error);
            throw error;
        }
    }

    /**
     * Check if user has voted
     * @param {string} address
     * @returns {Promise<boolean>}
     */
    async hasVoted(address) {
        try {
            return await this.contract.hasVoterVoted(address);
        } catch (error) {
            console.error('Error checking vote status:', error);
            throw error;
        }
    }

    /**
     * Check if user is authorized to vote
     * @param {string} address
     * @returns {Promise<boolean>}
     */
    async isAuthorized(address) {
        try {
            return await this.contract.isVoterAuthorized(address);
        } catch (error) {
            console.error('Error checking authorization:', error);
            throw error;
        }
    }

    /**
     * Get total votes cast
     * @returns {Promise<number>}
     */
    async getTotalVotes() {
        try {
            const total = await this.contract.getTotalVotes();
            return Number(total);
        } catch (error) {
            console.error('Error getting total votes:', error);
            throw error;
        }
    }

    /**
     * Get the winner
     * @returns {Promise<object>} Winner candidate
     */
    async getWinner() {
        try {
            const winner = await this.contract.getWinner();
            return {
                id: Number(winner.id),
                name: winner.name,
                voteCount: Number(winner.voteCount)
            };
        } catch (error) {
            console.error('Error getting winner:', error);
            throw error;
        }
    }

    /**
     * Listen to VoteCast events
     * @param {Function} callback
     */
    onVoteCast(callback) {
        if (!this.contract) return () => { };

        this.contract.on('VoteCast', (voter, candidateId, event) => {
            callback({
                voter,
                candidateId: Number(candidateId),
                blockNumber: event.log.blockNumber
            });
        });

        return () => this.contract.off('VoteCast');
    }

    /**
     * Listen to CandidateAdded events
     * @param {Function} callback
     */
    onCandidateAdded(callback) {
        if (!this.contract) return () => { };

        this.contract.on('CandidateAdded', (candidateId, name, event) => {
            callback({
                candidateId: Number(candidateId),
                name,
                blockNumber: event.log.blockNumber
            });
        });

        return () => this.contract.off('CandidateAdded');
    }

    /**
     * Remove all event listeners
     */
    removeAllListeners() {
        if (this.contract) {
            this.contract.removeAllListeners();
        }
    }

    /**
     * Handle and format blockchain errors
     * @param {Error} error
     * @returns {Error} Formatted error
     */
    handleError(error) {
        if (error.code === 'ACTION_REJECTED') {
            return new Error('Transaction was rejected by user');
        }

        if (error.message.includes('Only admin')) {
            return new Error('Only admin can perform this action');
        }

        if (error.message.includes('already voted')) {
            return new Error('You have already voted');
        }

        if (error.message.includes('not authorized')) {
            return new Error('You are not authorized to vote');
        }

        if (error.message.includes('not active')) {
            return new Error('Voting is not currently active');
        }

        return error;
    }
}
