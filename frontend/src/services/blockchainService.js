import { ethers } from 'ethers';
import VotingArtifact from '../contracts/Voting.json';
import contractAddress from '../contracts/contract-address.json';

/**
 * Blockchain service to interact with the Voting smart contract
 * Enhanced with constituency, party, timeline, and vote receipt support
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
     * Switch MetaMask to the Hardhat localhost network
     */
    async switchToHardhatNetwork() {
        const HARDHAT_CHAIN_ID = '0x539'; // 1337 in hex

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: HARDHAT_CHAIN_ID }],
            });
        } catch (switchError) {
            // Chain not added yet — add it
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: HARDHAT_CHAIN_ID,
                        chainName: 'Hardhat Localhost',
                        rpcUrls: ['http://127.0.0.1:8545'],
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    }],
                });
            } else {
                throw switchError;
            }
        }
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

            // Switch to Hardhat network first
            await this.switchToHardhatNetwork();

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
     */
    async isAdmin() {
        try {
            const currentAccount = await this.getCurrentAccount();
            const adminAddress = await this.contract.admin();
            console.log('Current account:', currentAccount, 'Admin address:', adminAddress);
            return currentAccount.toLowerCase() === adminAddress.toLowerCase();
        } catch (error) {
            console.error('Error checking admin status:', error);
            throw new Error('Cannot verify admin status. Make sure Hardhat node is running and contract is deployed. Error: ' + error.message);
        }
    }

    // ============ Admin Functions ============

    /**
     * Add a new candidate with full details
     */
    async addCandidate(candidateName, partyName = '', partySymbol = '', stateCode = 0, constituencyCode = 0) {
        try {
            const tx = await this.contract.addCandidate(candidateName, partyName, partySymbol, stateCode, constituencyCode);
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
     * Add a simple candidate (backward compatible)
     */
    async addCandidateSimple(candidateName) {
        try {
            const tx = await this.contract.addCandidateSimple(candidateName);
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
     * Authorize a voter with constituency info
     */
    async authorizeVoter(voterAddress, stateCode = 0, constituencyCode = 0) {
        try {
            let tx;
            if (stateCode === 0 && constituencyCode === 0) {
                tx = await this.contract.authorizeVoterSimple(voterAddress);
            } else {
                tx = await this.contract.authorizeVoter(voterAddress, stateCode, constituencyCode);
            }
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
     * Authorize multiple voters in batch
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
     * Set voting timeline
     */
    async setVotingTimeline(startTime, endTime) {
        try {
            const tx = await this.contract.setVotingTimeline(startTime, endTime);
            console.log('⏳ Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('✅ Voting timeline set');
            return receipt;
        } catch (error) {
            console.error('Error setting timeline:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Disable voting timeline
     */
    async disableTimeline() {
        try {
            const tx = await this.contract.disableTimeline();
            console.log('⏳ Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('✅ Timeline disabled');
            return receipt;
        } catch (error) {
            console.error('Error disabling timeline:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Start voting
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
     * End voting
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

    // ============ View Functions ============

    /**
     * Get all candidates
     */
    async getAllCandidates() {
        try {
            const candidates = await this.contract.getAllCandidates();
            return candidates.map(c => ({
                id: Number(c.id),
                name: c.name,
                partyName: c.partyName || '',
                partySymbol: c.partySymbol || '',
                stateCode: Number(c.stateCode),
                constituencyCode: Number(c.constituencyCode),
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
     * Get candidates by constituency
     */
    async getCandidatesByConstituency(stateCode, constituencyCode) {
        try {
            const candidates = await this.contract.getCandidatesByConstituency(stateCode, constituencyCode);
            return candidates.map(c => ({
                id: Number(c.id),
                name: c.name,
                partyName: c.partyName || '',
                partySymbol: c.partySymbol || '',
                stateCode: Number(c.stateCode),
                constituencyCode: Number(c.constituencyCode),
                voteCount: Number(c.voteCount)
            }));
        } catch (error) {
            console.error('Error getting candidates by constituency:', error);
            throw error;
        }
    }

    /**
     * Get voting status
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
     * Get voter info including constituency
     */
    async getVoterInfo(address) {
        try {
            const info = await this.contract.getVoterInfo(address);
            return {
                isAuthorized: info[0],
                hasVoted: info[1],
                stateCode: Number(info[2]),
                constituencyCode: Number(info[3]),
                votedCandidateId: Number(info[4])
            };
        } catch (error) {
            console.error('Error getting voter info:', error);
            throw error;
        }
    }

    /**
     * Get total votes cast
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
     */
    async getWinner() {
        try {
            const winner = await this.contract.getWinner();
            return {
                id: Number(winner.id),
                name: winner.name,
                partyName: winner.partyName || '',
                partySymbol: winner.partySymbol || '',
                voteCount: Number(winner.voteCount)
            };
        } catch (error) {
            console.error('Error getting winner:', error);
            throw error;
        }
    }

    /**
     * Get vote receipt
     */
    async getVoteReceipt(address) {
        try {
            return await this.contract.getVoteReceipt(address);
        } catch (error) {
            console.error('Error getting vote receipt:', error);
            throw error;
        }
    }

    /**
     * Get voting timeline
     */
    async getVotingTimeline() {
        try {
            const timeline = await this.contract.getVotingTimeline();
            return {
                timelineEnabled: timeline[0],
                startTime: Number(timeline[1]),
                endTime: Number(timeline[2]),
                isActive: timeline[3]
            };
        } catch (error) {
            console.error('Error getting timeline:', error);
            throw error;
        }
    }

    // ============ Event Listeners ============

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

    onCandidateAdded(callback) {
        if (!this.contract) return () => { };

        this.contract.on('CandidateAdded', (candidateId, name, partyName, stateCode, constituencyCode, event) => {
            callback({
                candidateId: Number(candidateId),
                name,
                partyName,
                blockNumber: event.log.blockNumber
            });
        });

        return () => this.contract.off('CandidateAdded');
    }

    removeAllListeners() {
        if (this.contract) {
            this.contract.removeAllListeners();
        }
    }

    /**
     * Handle and format blockchain errors
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

        if (error.message.includes('your state')) {
            return new Error('You can only vote for candidates in your state');
        }

        if (error.message.includes('your constituency')) {
            return new Error('You can only vote for candidates in your constituency');
        }

        if (error.message.includes('not started yet')) {
            return new Error('Voting has not started yet');
        }

        if (error.message.includes('period has ended')) {
            return new Error('Voting period has ended');
        }

        return error;
    }
}
