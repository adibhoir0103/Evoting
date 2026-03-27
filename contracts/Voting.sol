// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Voting
 * @dev Enhanced blockchain-based e-voting system with constituency support,
 *      party info, timeline controls, and vote receipts
 * @notice Inspired by GeekyAnts/sample-e-voting-system-ethereum and Krish-Depani
 */
contract Voting {
    // ============ State Variables ============
    
    address public admin;
    bool public votingActive;
    
    // Timeline controls
    uint256 public votingStartTime;
    uint256 public votingEndTime;
    bool public timelineEnabled;

    // ZKP mode: when enabled, plain vote() reverts — must use ZKP path
    bool public zkpEnabled;

    // ERC-2771 trusted forwarder for gasless meta-transactions
    address public trustedForwarder;

    // IPFS metadata hash for election-level data
    string public electionIPFSHash;
    
    // ============ Data Structures ============
    
    struct Candidate {
        uint256 id;
        string name;
        string partyName;
        string partySymbol;
        uint8 stateCode;
        uint8 constituencyCode;
        uint256 voteCount;
    }
    
    struct Voter {
        bool isAuthorized;
        bool hasVoted;
        uint8 stateCode;
        uint8 constituencyCode;
    }
    
    // ============ Mappings & Arrays ============
    
    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;
    uint256 public candidatesCount;
    
    // ============ Events ============
    
    event CandidateAdded(uint256 indexed candidateId, string name, string partyName, uint8 stateCode, uint8 constituencyCode);
    event VoterAuthorized(address indexed voter, uint8 stateCode, uint8 constituencyCode);
    event VoteCast(uint256 indexed candidateId, uint256 timestamp);
    event VotingStatusChanged(bool isActive);
    event VotingTimelineSet(uint256 startTime, uint256 endTime);
    
    // ============ Modifiers ============
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier votingIsActive() {
        require(votingActive, "Voting is not active");
        if (timelineEnabled) {
            require(block.timestamp >= votingStartTime, "Voting has not started yet");
            require(block.timestamp <= votingEndTime, "Voting period has ended");
        }
        _;
    }
    
    modifier votingIsNotActive() {
        require(!votingActive, "Voting is currently active");
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {
        admin = msg.sender;
        votingActive = false;
        timelineEnabled = false;
        zkpEnabled = false;
        trustedForwarder = address(0);
    }

    // ============ ERC-2771 Meta-Transaction Support ============

    /**
     * @dev Check if an address is the trusted forwarder
     */
    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == trustedForwarder;
    }

    /**
     * @dev Override msg.sender for ERC-2771 compatibility
     */
    function _msgSender() internal view returns (address sender) {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
        }
    }

    /**
     * @dev Set trusted forwarder for gasless meta-transactions
     */
    function setTrustedForwarder(address _forwarder) external onlyAdmin votingIsNotActive {
        trustedForwarder = _forwarder;
    }

    /**
     * @dev Enable/disable ZKP mode
     * When ZKP is enabled, plain vote() is disabled — voters must use ZKP contract
     */
    function setZKPMode(bool _enabled) external onlyAdmin votingIsNotActive {
        zkpEnabled = _enabled;
    }

    /**
     * @dev Set election-level IPFS metadata hash
     */
    function setElectionIPFSHash(string memory _hash) external onlyAdmin {
        electionIPFSHash = _hash;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Add a new candidate with party and constituency info
     * @param _name Name of the candidate
     * @param _partyName Name of the political party
     * @param _partySymbol Party symbol/abbreviation
     * @param _stateCode Indian state code (0 = any/all states)
     * @param _constituencyCode Constituency number (0 = any/all)
     */
    function addCandidate(
        string memory _name,
        string memory _partyName,
        string memory _partySymbol,
        uint8 _stateCode,
        uint8 _constituencyCode
    ) public onlyAdmin votingIsNotActive {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        
        candidatesCount++;
        candidates[candidatesCount] = Candidate(
            candidatesCount,
            _name,
            _partyName,
            _partySymbol,
            _stateCode,
            _constituencyCode,
            0
        );
        
        emit CandidateAdded(candidatesCount, _name, _partyName, _stateCode, _constituencyCode);
    }

    /**
     * @dev Legacy addCandidate for backward compatibility (no party/constituency)
     */
    function addCandidateSimple(string memory _name) public onlyAdmin votingIsNotActive {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        
        candidatesCount++;
        candidates[candidatesCount] = Candidate(
            candidatesCount,
            _name,
            "",    // no party
            "",    // no symbol
            0,     // all states
            0,     // all constituencies
            0
        );
        
        emit CandidateAdded(candidatesCount, _name, "", 0, 0);
    }
    
    /**
     * @dev Authorize a voter with constituency info
     * @param _voter Address of the voter
     * @param _stateCode Voter's state code
     * @param _constituencyCode Voter's constituency code
     */
    function authorizeVoter(
        address _voter,
        uint8 _stateCode,
        uint8 _constituencyCode
    ) public onlyAdmin {
        require(_voter != address(0), "Invalid voter address");
        require(!voters[_voter].isAuthorized, "Voter is already authorized");
        
        voters[_voter].isAuthorized = true;
        voters[_voter].hasVoted = false;
        voters[_voter].stateCode = _stateCode;
        voters[_voter].constituencyCode = _constituencyCode;
        
        emit VoterAuthorized(_voter, _stateCode, _constituencyCode);
    }

    /**
     * @dev Legacy authorizeVoter for backward compatibility (no constituency)
     */
    function authorizeVoterSimple(address _voter) public onlyAdmin {
        require(_voter != address(0), "Invalid voter address");
        require(!voters[_voter].isAuthorized, "Voter is already authorized");
        
        voters[_voter].isAuthorized = true;
        voters[_voter].hasVoted = false;
        voters[_voter].stateCode = 0;
        voters[_voter].constituencyCode = 0;
        
        emit VoterAuthorized(_voter, 0, 0);
    }
    
    /**
     * @dev Authorize multiple voters at once (simple, no constituency)
     */
    function authorizeVotersBatch(address[] memory _voters) public onlyAdmin {
        require(_voters.length <= 100, "Batch size exceeds maximum of 100");
        for (uint256 i = 0; i < _voters.length; i++) {
            if (!voters[_voters[i]].isAuthorized && _voters[i] != address(0)) {
                voters[_voters[i]].isAuthorized = true;
                voters[_voters[i]].hasVoted = false;
                voters[_voters[i]].stateCode = 0;
                voters[_voters[i]].constituencyCode = 0;
                emit VoterAuthorized(_voters[i], 0, 0);
            }
        }
    }

    /**
     * @dev Set voting timeline
     * @param _startTime Unix timestamp for voting start
     * @param _endTime Unix timestamp for voting end
     */
    function setVotingTimeline(uint256 _startTime, uint256 _endTime) public onlyAdmin votingIsNotActive {
        require(_endTime > _startTime, "End time must be after start time");
        votingStartTime = _startTime;
        votingEndTime = _endTime;
        timelineEnabled = true;
        emit VotingTimelineSet(_startTime, _endTime);
    }

    /**
     * @dev Disable timeline (voting controlled manually)
     */
    function disableTimeline() public onlyAdmin votingIsNotActive {
        timelineEnabled = false;
        votingStartTime = 0;
        votingEndTime = 0;
    }
    
    /**
     * @dev Start the voting process
     */
    function startVoting() public onlyAdmin votingIsNotActive {
        require(candidatesCount > 0, "No candidates added yet");
        votingActive = true;
        emit VotingStatusChanged(true);
    }
    
    /**
     * @dev End the voting process
     */
    function endVoting() public onlyAdmin votingIsActive {
        votingActive = false;
        emit VotingStatusChanged(false);
    }
    
    // ============ Voting Functions ============
    
    /**
     * @dev Cast a vote for a candidate
     * @param _candidateId ID of the candidate to vote for
     * @notice Voter must be authorized, can only vote once, and constituency must match
     */
    function vote(uint256 _candidateId) public votingIsActive {
        require(!zkpEnabled, "ZKP mode is active: use the ZKP voting contract instead");
        require(_msgSender() != admin, "Admin cannot vote");
        Voter storage voter = voters[_msgSender()];
        
        // Security Check 1: Ensure voter is authorized
        require(voter.isAuthorized, "You are not authorized to vote");
        
        // Security Check 2: Prevent double voting
        require(!voter.hasVoted, "You have already voted");
        
        // Security Check 3: Validate candidate exists
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        
        // Security Check 4: Constituency match (if both voter and candidate have constituency set)
        Candidate storage candidate = candidates[_candidateId];
        if (voter.stateCode != 0 && candidate.stateCode != 0) {
            require(voter.stateCode == candidate.stateCode, "You can only vote for candidates in your state");
        }
        if (voter.constituencyCode != 0 && candidate.constituencyCode != 0) {
            require(voter.constituencyCode == candidate.constituencyCode, "You can only vote for candidates in your constituency");
        }
        
        // Mark voter as having voted (prevents re-entrancy and double voting)
        voter.hasVoted = true;
        
        // Increment candidate vote count (vote choice NOT stored — secret ballot)
        candidate.voteCount++;
        
        emit VoteCast(_candidateId, block.timestamp);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get all candidates with their vote counts
     */
    function getAllCandidates() public view returns (Candidate[] memory) {
        Candidate[] memory allCandidates = new Candidate[](candidatesCount);
        
        for (uint256 i = 1; i <= candidatesCount; i++) {
            allCandidates[i - 1] = candidates[i];
        }
        
        return allCandidates;
    }

    /**
     * @dev Get candidates filtered by constituency
     */
    function getCandidatesByConstituency(uint8 _stateCode, uint8 _constituencyCode) public view returns (Candidate[] memory) {
        // First count matching candidates
        uint256 count = 0;
        for (uint256 i = 1; i <= candidatesCount; i++) {
            if ((candidates[i].stateCode == _stateCode || candidates[i].stateCode == 0) &&
                (candidates[i].constituencyCode == _constituencyCode || candidates[i].constituencyCode == 0)) {
                count++;
            }
        }

        // Build result array
        Candidate[] memory result = new Candidate[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= candidatesCount; i++) {
            if ((candidates[i].stateCode == _stateCode || candidates[i].stateCode == 0) &&
                (candidates[i].constituencyCode == _constituencyCode || candidates[i].constituencyCode == 0)) {
                result[idx] = candidates[i];
                idx++;
            }
        }

        return result;
    }
    
    /**
     * @dev Get a specific candidate's details
     */
    function getCandidate(uint256 _candidateId) public view returns (Candidate memory) {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        return candidates[_candidateId];
    }
    
    /**
     * @dev Check if an address is authorized to vote
     */
    function isVoterAuthorized(address _voter) public view returns (bool) {
        return voters[_voter].isAuthorized;
    }
    
    /**
     * @dev Check if a voter has already voted
     */
    function hasVoterVoted(address _voter) public view returns (bool) {
        return voters[_voter].hasVoted;
    }
    
    /**
     * @dev Get voter's constituency info (vote choice is NOT exposed — secret ballot)
     */
    function getVoterInfo(address _voter) public view returns (
        bool isAuthorized,
        bool hasVoted,
        uint8 stateCode,
        uint8 constituencyCode
    ) {
        Voter memory v = voters[_voter];
        return (v.isAuthorized, v.hasVoted, v.stateCode, v.constituencyCode);
    }
    
    /**
     * @dev Get the winning candidate
     */
    function getWinner() public view returns (Candidate memory) {
        require(candidatesCount > 0, "No candidates available");
        
        uint256 winningVoteCount = 0;
        uint256 winningCandidateId = 0;
        
        for (uint256 i = 1; i <= candidatesCount; i++) {
            if (candidates[i].voteCount > winningVoteCount) {
                winningVoteCount = candidates[i].voteCount;
                winningCandidateId = i;
            }
        }
        
        require(winningCandidateId > 0, "No votes cast yet");
        return candidates[winningCandidateId];
    }
    
    /**
     * @dev Get total number of votes cast
     */
    function getTotalVotes() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 1; i <= candidatesCount; i++) {
            total += candidates[i].voteCount;
        }
        return total;
    }

    /**
     * @dev Get a vote receipt hash (proof of participation without revealing choice)
     * @param _voter Address of the voter
     * @return receiptHash A keccak256 hash that proves the voter participated
     */
    function getVoteReceipt(address _voter) public view returns (bytes32 receiptHash) {
        require(voters[_voter].hasVoted, "Voter has not voted yet");
        return keccak256(abi.encodePacked(_voter, block.chainid, "voted"));
    }

    /**
     * @dev Get voting timeline info
     */
    function getVotingTimeline() public view returns (
        bool _timelineEnabled,
        uint256 _startTime,
        uint256 _endTime,
        bool _isActive
    ) {
        return (timelineEnabled, votingStartTime, votingEndTime, votingActive);
    }
}
