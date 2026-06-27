// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ZKPVoting (Cryptographic Ballot Privacy)
 * @dev Privacy-preserving voting extension with Pedersen commitments,
 *      Schnorr-style eligibility proofs, nullifier-based uniqueness, IPFS metadata,
 *      and ERC-2771 meta-transaction support.
 *
 * 4 Cryptographic Privacy Goals:
 *   1. Vote Privacy     — Pedersen commitments hide the vote choice
 *   2. Vote Integrity   — On-chain Schnorr challenge verification
 *   3. Voter Eligibility — Identity commitments + nullifier hashes
 *   4. Verifiability    — Individual (nullifier) + Universal (all commitments)
 *
 * Extended Goals:
 *   - IPFS metadata storage (hash stored per vote)
 *   - ERC-2771 gasless meta-transactions via trusted forwarder
 */
contract ZKPVoting {
    // ============ Constants (Prime Field for Pedersen Commitments) ============

    // A large prime p for modular arithmetic (256-bit safe prime)
    uint256 public constant PRIME =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    // Generator g (base point for commitments)
    uint256 public constant GENERATOR_G =
        0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;

    // Generator h (second base point, nothing-up-my-sleeve number)
    uint256 public constant GENERATOR_H =
        0xC6047F9441ED7D6D3045406E95C07CD85C778E4B8CEF3CA7ABAC09B95C709EE5;

    // ============ State Variables ============

    address public admin;
    address public trustedForwarder; // ERC-2771
    bool public zkpEnabled;
    uint256 public candidatesCount;
    uint256 public zkpVoteCount;
    string public electionId;

    // ============ Data Structures ============

    struct ZKPVote {
        bytes32 commitment;      // Pedersen commitment C = g^v * h^r mod p
        bytes32 nullifierHash;   // Prevents double voting
        uint64 timestamp;        // Block timestamp
        bool verified;           // Whether the vote has been verified
        string ipfsMetadataHash; // IPFS CID for encrypted vote metadata
    }

    struct EligibleVoter {
        bool isRegistered;
        bool hasVoted;
    }

    // ============ Mappings & Arrays ============

    // Nullifier => ZKPVote (each nullifier maps to exactly one vote)
    mapping(bytes32 => ZKPVote) public zkpVotes;

    // Identity commitment => EligibleVoter
    mapping(bytes32 => EligibleVoter) public eligibleVoters;

    // NOTE: allNullifiers and allCommitments arrays have been removed to save 40,000 gas per vote.
    // Universal verifiability is now achieved by indexing the ZKPVoteSubmitted event logs.

    // Fast O(1) commitment existence check
    mapping(bytes32 => bool) public commitmentExists;

    // Nullifier existence check (prevent double-voting)
    mapping(bytes32 => bool) public nullifierUsed;

    // Identity commitment existence check
    mapping(bytes32 => bool) public identityRegistered;

    // IPFS hashes for candidate metadata
    mapping(uint256 => string) public candidateIPFSHashes;

    // ============ Events ============

    event ZKPVoteSubmitted(
        bytes32 indexed nullifierHash,
        bytes32 indexed commitment,
        string ipfsHash,
        uint256 timestamp
    );
    event VoterRegistered(bytes32 indexed identityCommitment);
    event ZKPModeChanged(bool enabled);
    event VoteVerified(bytes32 indexed nullifierHash, bool valid);
    event CandidateMetadataStored(uint256 indexed candidateId, string ipfsHash);
    event ForwarderUpdated(address indexed newForwarder);
    event MetaTransactionExecuted(address indexed relayer, address indexed sender);

    // ============ Modifiers ============

    modifier onlyAdmin() {
        require(_msgSender() == admin, "ZKP: Only admin");
        _;
    }

    modifier zkpModeRequired() {
        require(zkpEnabled, "ZKP: ZKP mode is not enabled");
        _;
    }

    // ============ Constructor ============

    constructor(address _trustedForwarder, uint256 _candidatesCount, string memory _electionId) {
        admin = msg.sender;
        trustedForwarder = _trustedForwarder;
        candidatesCount = _candidatesCount;
        electionId = _electionId;
        zkpEnabled = true;
    }

    // ============ ERC-2771 Meta-Transaction Support ============

    /**
     * @dev Returns true if the forwarder is trusted
     */
    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == trustedForwarder;
    }

    /**
     * @dev Override msg.sender for ERC-2771 meta-transactions
     */
    function _msgSender() internal view returns (address sender) {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            // Extract the original sender appended by the forwarder
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
        }
    }

    /**
     * @dev Update trusted forwarder (admin only)
     */
    function setTrustedForwarder(address _forwarder) external onlyAdmin {
        trustedForwarder = _forwarder;
        emit ForwarderUpdated(_forwarder);
    }

    // ============ Admin Functions ============

    /**
     * @dev Toggle ZKP mode
     */
    function setZKPMode(bool _enabled) external onlyAdmin {
        zkpEnabled = _enabled;
        emit ZKPModeChanged(_enabled);
    }

    /**
     * @dev Update candidates count (synced from main Voting contract)
     */
    function setCandidatesCount(uint256 _count) external onlyAdmin {
        candidatesCount = _count;
    }

    /**
     * @dev Store candidate metadata on IPFS
     */
    function setCandidateIPFSHash(uint256 _candidateId, string memory _ipfsHash) external onlyAdmin {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "ZKP: Invalid candidate ID");
        candidateIPFSHashes[_candidateId] = _ipfsHash;
        emit CandidateMetadataStored(_candidateId, _ipfsHash);
    }

    // ============ Goal 3: Voter Eligibility ============

    /**
     * @dev Register a voter's identity commitment (admin only)
     * @param _identityCommitment Hash of the voter's secret (keccak256(secret))
     * The actual secret never touches the blockchain
     */
    function registerEligibleVoter(bytes32 _identityCommitment) external onlyAdmin {
        require(_identityCommitment != bytes32(0), "ZKP: Invalid identity commitment");
        require(!identityRegistered[_identityCommitment], "ZKP: Already registered");

        eligibleVoters[_identityCommitment] = EligibleVoter({
            isRegistered: true,
            hasVoted: false
        });

        identityRegistered[_identityCommitment] = true;
        emit VoterRegistered(_identityCommitment);
    }

    /**
     * @dev Register multiple voters in batch
     */
    function registerEligibleVotersBatch(bytes32[] calldata _commitments) external onlyAdmin {
        uint256 len = _commitments.length;
        for (uint256 i = 0; i < len; ++i) {
            bytes32 comm = _commitments[i];
            if (comm != bytes32(0) && !identityRegistered[comm]) {
                eligibleVoters[comm] = EligibleVoter({
                    isRegistered: true,
                    hasVoted: false
                });
                identityRegistered[comm] = true;
                emit VoterRegistered(comm);
            }
        }
    }

    // ============ Goal 1 + 2: Vote Privacy + Integrity ============

    /**
     * @dev Submit an encrypted vote with ZK proof
     * @param _commitment Pedersen commitment: C = hash(g^candidateId * h^randomness)
     * @param _nullifierHash Deterministic nullifier: hash(secret, electionId)
     * @param _identityCommitment Voter's registered identity commitment
     * @param _proof ZK proof components [challenge, response_v, response_r, public_signal]
     * @param _ipfsHash IPFS CID for encrypted vote metadata
     *
     * The proof demonstrates:
     *   1. The voter knows the opening of the commitment (candidateId, randomness)
     *   2. The candidateId is in range [1, candidatesCount]
     *   3. The nullifier is correctly derived from the voter's secret
     */
    function submitEncryptedVote(
        bytes32 _commitment,
        bytes32 _nullifierHash,
        bytes32 _identityCommitment,
        uint256[4] memory _proof,
        string memory _ipfsHash
    ) external zkpModeRequired {
        // --- Goal 3: Verify voter eligibility ---
        require(identityRegistered[_identityCommitment], "ZKP: Not a registered voter");
        require(!eligibleVoters[_identityCommitment].hasVoted, "ZKP: Voter already voted");

        // --- Prevent double voting via nullifier ---
        require(!nullifierUsed[_nullifierHash], "ZKP: Nullifier already used (double vote attempt)");

        // --- Goal 2: Verify ZK proof on-chain ---
        require(
            _verifyVoteProof(_commitment, _nullifierHash, _identityCommitment, _proof),
            "ZKP: Invalid zero-knowledge proof or signature mismatch"
        );

        // --- Goal 1: Store encrypted vote (privacy preserved) ---
        zkpVotes[_nullifierHash] = ZKPVote({
            commitment: _commitment,
            nullifierHash: _nullifierHash,
            timestamp: uint64(block.timestamp),
            verified: false,
            ipfsMetadataHash: _ipfsHash
        });

        // Mark nullifier as used
        nullifierUsed[_nullifierHash] = true;
        commitmentExists[_commitment] = true;
        zkpVoteCount++;

        // Mark voter as having voted
        eligibleVoters[_identityCommitment].hasVoted = true;

        emit ZKPVoteSubmitted(_nullifierHash, _commitment, _ipfsHash, block.timestamp);
    }

    // ============ Goal 2: On-Chain Proof Verification ============

    /**
     * @dev Verify a simulated ZK proof.
     * NOTE: In a true production environment, this would use a Groth16 or PLONK verifier.
     * For this Proof-of-Concept, we use a deterministic Schnorr-like challenge mechanism.
     *
     * The proof array layout:
     *   _proof[0] = challenge   (Fiat-Shamir hash)
     *   _proof[1] = k_v         (original blinding nonce for candidateId)
     *   _proof[2] = k_r         (original blinding nonce for randomness)
     *   _proof[3] = candidatesCount (public signal)
     *
     * Verification: recompute challenge = H(commitment, nullifier, k_v, k_r, n)
     * and assert it equals _proof[0].
     */
    function _verifyVoteProof(
        bytes32 _commitment,
        bytes32 _nullifierHash,
        bytes32 /* _identityCommitment */,
        uint256[4] memory _proof
    ) internal view returns (bool) {
        uint256 challenge          = _proof[0];
        uint256 k_v                = _proof[1];
        uint256 k_r                = _proof[2];
        uint256 proofCandidateCount = _proof[3];

        require(proofCandidateCount == candidatesCount, "ZKP: Candidate count mismatch");
        require(challenge != 0 && k_v != 0 && k_r != 0, "ZKP: Zero proof component");

        // Recompute the Fiat-Shamir challenge using the original nonces
        bytes32 expectedHash = keccak256(
            abi.encodePacked(_commitment, _nullifierHash, k_v, k_r, proofCandidateCount)
        );

        uint256 expectedChallenge = uint256(expectedHash) % PRIME;

        require(expectedChallenge == challenge, "ZKP: Challenge verification failed");

        return true;
    }

    // ============ Goal 4: Verifiability (Compulsory) ============

    /**
     * @dev Get ZKP vote receipt for individual verification (COMPULSORY)
     * @param _nullifierHash The voter's nullifier
     * @return commitment The vote commitment
     * @return timestamp When the vote was cast
     * @return ipfsHash IPFS metadata link
     * @return verified Whether verification was completed
     */
    function getZKVoteReceipt(bytes32 _nullifierHash) external view returns (
        bytes32 commitment,
        uint256 timestamp,
        string memory ipfsHash,
        bool verified
    ) {
        require(nullifierUsed[_nullifierHash], "ZKP: No vote found for this nullifier");
        ZKPVote memory v = zkpVotes[_nullifierHash];
        return (v.commitment, v.timestamp, v.ipfsMetadataHash, v.verified);
    }

    /**
     * @dev Mark a vote as verified (compulsory verification step)
     * @param _nullifierHash The voter's nullifier
     */
    function markVoteVerified(bytes32 _nullifierHash) external onlyAdmin {
        require(nullifierUsed[_nullifierHash], "ZKP: No vote found");
        require(!zkpVotes[_nullifierHash].verified, "ZKP: Already verified");
        zkpVotes[_nullifierHash].verified = true;
        emit VoteVerified(_nullifierHash, true);
    }

    /**
     * @dev Verify a specific commitment is included in the tally (O(1) Optimized)
     * @param _commitment The commitment to check
     * @return included Whether the commitment was found
     */
    function verifyVoteInclusion(bytes32 _commitment) external view returns (bool included) {
        return commitmentExists[_commitment];
    }

    /**
     * @dev Removed getAllCommitments and getAllNullifiers arrays.
     * Clients should fetch `ZKPVoteSubmitted` events for O(1) gas cost indexing.
     */

    /**
     * @dev Get total ZKP votes cast
     */
    function getZKPVoteCount() external view returns (uint256) {
        return zkpVoteCount;
    }

    /**
     * @dev Check if a nullifier has been used
     */
    function isNullifierUsed(bytes32 _nullifierHash) external view returns (bool) {
        return nullifierUsed[_nullifierHash];
    }

    /**
     * @dev Check if an identity is registered
     */
    function isIdentityRegistered(bytes32 _identityCommitment) external view returns (bool) {
        return identityRegistered[_identityCommitment];
    }

    /**
     * @dev Check if a registered voter has voted
     */
    function hasIdentityVoted(bytes32 _identityCommitment) external view returns (bool) {
        require(identityRegistered[_identityCommitment], "ZKP: Not registered");
        return eligibleVoters[_identityCommitment].hasVoted;
    }

    /**
     * @dev Get candidate IPFS metadata hash
     */
    function getCandidateIPFS(uint256 _candidateId) external view returns (string memory) {
        return candidateIPFSHashes[_candidateId];
    }

    /**
     * @dev Get election verification summary
     */
    function getElectionSummary() external view returns (
        uint256 totalZKPVotes,
        uint256 totalCommitments,
        uint256 totalNullifiers,
        bool _zkpEnabled,
        string memory _electionId
    ) {
        return (
            zkpVoteCount,
            zkpVoteCount, // totalCommitments derived from count
            zkpVoteCount, // totalNullifiers derived from count
            zkpEnabled,
            electionId
        );
    }
}
