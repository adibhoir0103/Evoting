import { ethers } from 'ethers';
import VotingArtifact from '../contracts/Voting.json';
import contractAddress from '../contracts/contract-address.json';

// Environment detection: if VITE_API_URL points to localhost, we use local Hardhat node
const _apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const IS_LOCAL = _apiUrl.includes('localhost') || _apiUrl.includes('127.0.0.1');
const LOCAL_RPC = 'http://127.0.0.1:8545';
const SEPOLIA_RPC = 'https://eth-sepolia.g.alchemy.com/v2/XbNu_qjjYV_V-FGBmkc3K';
const LOCAL_CHAIN_ID = '0x539';   // 1337
const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111

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

    async getReadOnlyContract() {
        if (this.contract) return this.contract;
        const rpcUrl = IS_LOCAL ? LOCAL_RPC : SEPOLIA_RPC;
        const fallbackProvider = new ethers.JsonRpcProvider(rpcUrl);
        return new ethers.Contract(this.contractAddress, VotingArtifact.abi, fallbackProvider);
    }

    /**
     * Switch MetaMask to the correct network based on environment.
     * - Local dev: Hardhat localhost (chainId 1337 / 0x539)
     * - Production: Sepolia Testnet (chainId 11155111 / 0xaa36a7)
     */
    async switchToCorrectNetwork() {
        const targetChainId = IS_LOCAL ? LOCAL_CHAIN_ID : SEPOLIA_CHAIN_ID;

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetChainId }],
            });
        } catch (switchError) {
            // Chain not added yet — add it
            if (switchError.code === 4902) {
                const chainParams = IS_LOCAL
                    ? {
                        chainId: LOCAL_CHAIN_ID,
                        chainName: 'Localhost 8545 (Hardhat)',
                        rpcUrls: [LOCAL_RPC],
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    }
                    : {
                        chainId: SEPOLIA_CHAIN_ID,
                        chainName: 'Sepolia Testnet',
                        rpcUrls: [SEPOLIA_RPC],
                        nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
                        blockExplorerUrls: ['https://sepolia.etherscan.io'],
                    };
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [chainParams],
                });
            } else {
                throw switchError;
            }
        }
    }

    /**
     * Connect to MetaMask wallet
     * @param {boolean} forceSelect - If true, forces MetaMask to ask user to select an account
     * @returns {Promise<string>} Connected wallet address
     */
    async connectWallet(forceSelect = false) {
        try {
            if (!window.ethereum) {
                throw new Error('MetaMask is not installed. Please install MetaMask to use this application.');
            }

            // Switch to correct network (localhost or Sepolia) first
            await this.switchToCorrectNetwork();

            if (forceSelect) {
                await window.ethereum.request({
                    method: 'wallet_requestPermissions',
                    params: [{ eth_accounts: {} }]
                });
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
            throw new Error('Cannot verify admin status. Make sure you are connected to Sepolia testnet and the contract is deployed. Error: ' + error.message);
        }
    }

    /**
     * Ensure MetaMask is connected before performing write operations
     */
    async ensureConnection() {
        if (!this.contract) {
            await this.connectWallet();
        }
    }

    // ============ Admin Functions ============

    /**
     * Add a new candidate with full details
     */
    async addCandidate(candidateName, partyName = '', partySymbol = '', stateCode = 0, constituencyCode = 0) {
        try {
            await this.ensureConnection();
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
            await this.ensureConnection();
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
            await this.ensureConnection();
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
            await this.ensureConnection();
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
            await this.ensureConnection();
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
            await this.ensureConnection();
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
            await this.ensureConnection();
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
            await this.ensureConnection();
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

    /**
     * Simulate transaction to estimate gas limitations
     */
    async estimateVoteGas(candidateId) {
        try {
            if (!this.contract) throw new Error("Contract not initialized");
            const gasEstimate = await this.contract.estimateGas.vote(candidateId);
            return gasEstimate;
        } catch (error) {
            console.error('Gas estimation failed:', error);
            const msg = error.message || '';
            if (msg.includes('insufficient funds') || msg.includes('gas')) {
                throw new Error("Insufficient gas: Please add funds to your wallet to cover Ethereum network fees.");
            }
            throw new Error("Transaction simulation reverted: " + this.handleError(error).message);
        }
    }

    // ============ View Functions ============

    /**
     * Get all candidates
     */
    async getAllCandidates() {
        try {
            const contract = await this.getReadOnlyContract();
            const candidates = await contract.getAllCandidates();
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
            const contract = await this.getReadOnlyContract();
            return await contract.votingActive();
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
                constituencyCode: Number(info[3])
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
            const contract = await this.getReadOnlyContract();
            const total = await contract.getTotalVotes();
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
            const contract = await this.getReadOnlyContract();
            const winner = await contract.getWinner();
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

        this.contract.on('VoteCast', (candidateId, timestamp, event) => {
            callback({
                candidateId: Number(candidateId),
                timestamp: Number(timestamp),
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

        if (error.message.includes('ZKP mode')) {
            return new Error('ZKP mode is active: use the ZKP voting contract instead');
        }

        return error;
    }

    // ============ ZKP Functions ============

    /**
     * Check if ZKP mode is enabled on the main Voting contract
     */
    async isZKPEnabled() {
        try {
            return await this.contract.zkpEnabled();
        } catch (error) {
            console.error('Error checking ZKP mode:', error);
            return false;
        }
    }

    /**
     * Enable/disable ZKP mode (admin only)
     */
    async setZKPMode(enabled) {
        try {
            const tx = await this.contract.setZKPMode(enabled);
            await tx.wait();
            console.log(`✅ ZKP mode ${enabled ? 'enabled' : 'disabled'}`);
            return true;
        } catch (error) {
            console.error('Error setting ZKP mode:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Set trusted forwarder for ERC-2771 meta-transactions
     */
    async setTrustedForwarder(forwarderAddress) {
        try {
            const tx = await this.contract.setTrustedForwarder(forwarderAddress);
            await tx.wait();
            console.log('✅ Trusted forwarder set:', forwarderAddress);
            return true;
        } catch (error) {
            console.error('Error setting trusted forwarder:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Set election IPFS metadata hash
     */
    async setElectionIPFSHash(ipfsHash) {
        try {
            const tx = await this.contract.setElectionIPFSHash(ipfsHash);
            await tx.wait();
            console.log('✅ Election IPFS hash set:', ipfsHash);
            return true;
        } catch (error) {
            console.error('Error setting IPFS hash:', error);
            throw this.handleError(error);
        }
    }

    // ============ ZKP Contract Functions ============

    /**
     * Initialize the ZKP voting contract
     */
    async initZKPContract(zkpContractAddress, zkpAbi) {
        try {
            if (!this.signer) {
                await this.connectWallet();
            }
            this.zkpContract = new ethers.Contract(zkpContractAddress, zkpAbi, this.signer);
            console.log('✅ ZKP contract initialized at:', zkpContractAddress);
            return true;
        } catch (error) {
            console.error('Error initializing ZKP contract:', error);
            throw error;
        }
    }

    /**
     * Submit an encrypted ZKP vote
     */
    async submitEncryptedVote(commitment, nullifierHash, identityCommitment, proof, ipfsHash) {
        try {
            const contract = this.zkpContract || this.contract;
            const proofArray = proof.map(p => BigInt(p));
            
            const tx = await contract.submitEncryptedVote(
                commitment,
                nullifierHash,
                identityCommitment,
                proofArray,
                ipfsHash || ''
            );
            console.log('⏳ ZKP vote transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('✅ ZKP vote submitted successfully');
            return receipt;
        } catch (error) {
            console.error('Error submitting ZKP vote:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Register an eligible voter via identity commitment (admin)
     */
    async registerEligibleVoter(identityCommitment) {
        try {
            const contract = this.zkpContract || this.contract;
            const tx = await contract.registerEligibleVoter(identityCommitment);
            await tx.wait();
            console.log('✅ Voter registered with ZKP identity commitment');
            return true;
        } catch (error) {
            console.error('Error registering ZKP voter:', error);
            throw this.handleError(error);
        }
    }

    /**
     * Get ZKP vote receipt
     */
    async getZKVoteReceipt(nullifierHash) {
        try {
            const contract = this.zkpContract || this.contract;
            const receipt = await contract.getZKVoteReceipt(nullifierHash);
            return {
                commitment: receipt[0],
                timestamp: Number(receipt[1]),
                ipfsHash: receipt[2],
                verified: receipt[3]
            };
        } catch (error) {
            console.error('Error getting ZKP receipt:', error);
            throw error;
        }
    }

    /**
     * Verify vote inclusion in the tally
     */
    async verifyVoteInclusion(commitment) {
        try {
            const contract = this.zkpContract || this.contract;
            const result = await contract.verifyVoteInclusion(commitment);
            return {
                included: result[0],
                index: Number(result[1])
            };
        } catch (error) {
            console.error('Error verifying inclusion:', error);
            throw error;
        }
    }

    /**
     * Get all commitments for universal verification
     */
    async getAllZKPCommitments() {
        try {
            const contract = this.zkpContract || this.contract;
            return await contract.getAllCommitments();
        } catch (error) {
            console.error('Error getting commitments:', error);
            throw error;
        }
    }

    /**
     * Get ZKP election summary
     */
    async getElectionSummary() {
        try {
            const contract = this.zkpContract || this.contract;
            const summary = await contract.getElectionSummary();
            return {
                totalZKPVotes: Number(summary[0]),
                totalCommitments: Number(summary[1]),
                totalNullifiers: Number(summary[2]),
                zkpEnabled: summary[3],
                electionId: summary[4]
            };
        } catch (error) {
            console.error('Error getting election summary:', error);
            throw error;
        }
    }

    /**
     * Check if a nullifier has been used
     */
    async isNullifierUsed(nullifierHash) {
        try {
            const contract = this.zkpContract || this.contract;
            return await contract.isNullifierUsed(nullifierHash);
        } catch (error) {
            console.error('Error checking nullifier:', error);
            return false;
        }
    }

    /**
     * Mark a vote as verified
     */
    async markVoteVerified(nullifierHash) {
        try {
            const contract = this.zkpContract || this.contract;
            const tx = await contract.markVoteVerified(nullifierHash);
            await tx.wait();
            console.log('✅ Vote marked as verified');
            return true;
        } catch (error) {
            console.error('Error marking verified:', error);
            throw this.handleError(error);
        }
    }
}

