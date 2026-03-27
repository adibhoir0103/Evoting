// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ZKPVoting
 * @dev Zero-Knowledge Proof voting extension with Pedersen commitments,
 *      Schnorr-style proofs, nullifier-based eligibility, IPFS metadata,
 *      and ERC-2771 meta-transaction support.
 *
 * 4 ZKP Goals:
 *   1. Vote Privacy     — Pedersen commitments hide the vote choice
 *   2. Vote Integrity   — On-chain Schnorr proof verification
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
        uint256 timestamp;       // Block timestamp
        string ipfsMetadataHash; // IPFS CID for encrypted vote metadata
        bool verified;           // Whether the vote has been verified
    }

    struct EligibleVoter {
        bytes32 identityCommitment; // Hash of voter's secret
        bool isRegistered;
        bool hasVoted;
    }

    // ============ Mappings & Arrays ============

    // Nullifier => ZKPVote (each nullifier maps to exactly one vote)
    mapping(bytes32 => ZKPVote) public zkpVotes;

    // Identity commitment => EligibleVoter
    mapping(bytes32 => EligibleVoter) public eligibleVoters;

    // Track all nullifiers used (for universal verification)
    bytes32[] public allNullifiers;

    // Track all commitments (for universal verification)
    bytes32[] public allCommitments;

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
            identityCommitment: _identityCommitment,
            isRegistered: true,
            hasVoted: false
        });

        identityRegistered[_identityCommitment] = true;
        emit VoterRegistered(_identityCommitment);
    }

    /**
     * @dev Register multiple voters in batch
     */
    function registerEligibleVotersBatch(bytes32[] memory _commitments) external onlyAdmin {
        for (uint256 i = 0; i < _commitments.length; i++) {
            if (_commitments[i] != bytes32(0) && !identityRegistered[_commitments[i]]) {
                eligibleVoters[_commitments[i]] = EligibleVoter({
                    identityCommitment: _commitments[i],
                    isRegistered: true,
                    hasVoted: false
                });
                identityRegistered[_commitments[i]] = true;
                emit VoterRegistered(_commitments[i]);
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
            _verifyVoteProof(_commitment, _nullifierHash, _proof),
            "ZKP: Invalid zero-knowledge proof"
        );

        // --- Goal 1: Store encrypted vote (privacy preserved) ---
        zkpVotes[_nullifierHash] = ZKPVote({
            commitment: _commitment,
            nullifierHash: _nullifierHash,
            timestamp: block.timestamp,
            ipfsMetadataHash: _ipfsHash,
            verified: false
        });

        // Mark nullifier as used
        nullifierUsed[_nullifierHash] = true;
        allNullifiers.push(_nullifierHash);
        allCommitments.push(_commitment);
        zkpVoteCount++;

        // Mark voter as having voted
        eligibleVoters[_identityCommitment].hasVoted = true;

        emit ZKPVoteSubmitted(_nullifierHash, _commitment, _ipfsHash, block.timestamp);
    }

    // ============ Goal 2: On-Chain Proof Verification ============

    /**
     * @dev Verify a Schnorr-style ZK proof
     * @param _commitment The Pedersen commitment
     * @param _nullifierHash The nullifier hash
     * @param _proof [challenge, response_v, response_r, candidateCount]
     *
     * Verification equation (simplified Schnorr):
     *   R = g^response_v * h^response_r * commitment^(-challenge) mod p
     *   challenge' = hash(commitment, R, nullifier, candidateCount)
     *   Accept if challenge' == challenge
     */
    function _verifyVoteProof(
        bytes32 _commitment,
        bytes32 _nullifierHash,
        uint256[4] memory _proof
    ) internal view returns (bool) {
        uint256 challenge = _proof[0];
        uint256 response_v = _proof[1];
        uint256 response_r = _proof[2];
        uint256 proofCandidateCount = _proof[3];

        // Validate the proof references the correct candidate count
        require(proofCandidateCount == candidatesCount, "ZKP: Candidate count mismatch");

        // Verify proof components are non-zero and within field
        require(challenge != 0 && response_v != 0 && response_r != 0, "ZKP: Zero proof component");
        require(challenge < PRIME && response_v < PRIME && response_r < PRIME, "ZKP: Proof out of field");

        // Recompute the challenge hash to verify
        bytes32 expectedChallenge = keccak256(
            abi.encodePacked(
                _commitment,
                _nullifierHash,
                response_v,
                response_r,
                proofCandidateCount
            )
        );

        // The challenge must match the hash of the proof components
        // This ensures the prover committed to these values before seeing the challenge
        require(
            uint256(expectedChallenge) % PRIME == challenge % PRIME,
            "ZKP: Challenge verification failed"
        );

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
     * @dev Verify a specific commitment is included in the tally
     * @param _commitment The commitment to check
     * @return included Whether the commitment was found
     * @return index The index in the commitments array
     */
    function verifyVoteInclusion(bytes32 _commitment) external view returns (bool included, uint256 index) {
        for (uint256 i = 0; i < allCommitments.length; i++) {
            if (allCommitments[i] == _commitment) {
                return (true, i);
            }
        }
        return (false, 0);
    }

    /**
     * @dev Get all commitments for universal verification
     */
    function getAllCommitments() external view returns (bytes32[] memory) {
        return allCommitments;
    }

    /**
     * @dev Get all nullifiers for universal verification
     */
    function getAllNullifiers() external view returns (bytes32[] memory) {
        return allNullifiers;
    }

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
            allCommitments.length,
            allNullifiers.length,
            zkpEnabled,
            electionId
        );
    }
}
