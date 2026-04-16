// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title VotingV2
 * @dev Enhanced blockchain-based e-voting system with:
 *      - Constituency support, party info, timeline controls
 *      - Vote Cancellation & Re-voting (coercion resistance)
 *      - Maximum re-vote limit to prevent abuse
 *      - Re-vote window closes before final tally
 *      - ZKP mode support and ERC-2771 meta-transactions
 * 
 * Coercion Resistance: A voter can change their vote up to MAX_REVOTES times.
 * Only the LAST vote counts. The re-vote window closes 30 minutes before
 * votingEndTime to allow clean final tallies.
 */
contract VotingV2 {
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

    // Re-voting configuration
    uint256 public constant MAX_REVOTES = 3;         // Max times a voter can change their vote
    uint256 public constant REVOTE_LOCKOUT = 30 minutes; // Re-voting closes 30 min before end
    
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
        uint256 lastCandidateId;    // Track last vote for re-voting (decrement old candidate)
        uint256 voteVersion;        // Number of times voted (0 = never, 1 = first vote, etc.)
    }
    
    // ============ Mappings & Arrays ============
    
    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;
    uint256 public candidatesCount;
    
    // ============ Events ============
    
    event CandidateAdded(uint256 indexed candidateId, string name, string partyName, uint8 stateCode, uint8 constituencyCode);
    event VoterAuthorized(address indexed voter, uint8 stateCode, uint8 constituencyCode);
    event VoteCast(uint256 indexed obfuscatedId, uint256 timestamp, uint256 version);
    event VoteUpdated(address indexed voter, uint256 version, uint256 timestamp);
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

    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == trustedForwarder;
    }

    function _msgSender() internal view returns (address sender) {
        if (msg.data.length >= 20 && isTrustedForwarder(msg.sender)) {
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
        }
    }

    function setTrustedForwarder(address _forwarder) external onlyAdmin votingIsNotActive {
        trustedForwarder = _forwarder;
    }

    function setZKPMode(bool _enabled) external onlyAdmin votingIsNotActive {
        zkpEnabled = _enabled;
    }

    function setElectionIPFSHash(string memory _hash) external onlyAdmin {
        electionIPFSHash = _hash;
    }
    
    // ============ Admin Functions ============
    
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
        voters[_voter].lastCandidateId = 0;
        voters[_voter].voteVersion = 0;
        
        emit VoterAuthorized(_voter, _stateCode, _constituencyCode);
    }

    function authorizeVoterSimple(address _voter) public onlyAdmin {
        require(_voter != address(0), "Invalid voter address");
        require(!voters[_voter].isAuthorized, "Voter is already authorized");
        
        voters[_voter].isAuthorized = true;
        voters[_voter].hasVoted = false;
        voters[_voter].stateCode = 0;
        voters[_voter].constituencyCode = 0;
        voters[_voter].lastCandidateId = 0;
        voters[_voter].voteVersion = 0;
        
        emit VoterAuthorized(_voter, 0, 0);
    }
    
    function authorizeVotersBatch(address[] memory _voters) public onlyAdmin {
        require(_voters.length <= 100, "Batch size exceeds maximum of 100");
        for (uint256 i = 0; i < _voters.length; i++) {
            if (!voters[_voters[i]].isAuthorized && _voters[i] != address(0)) {
                voters[_voters[i]].isAuthorized = true;
                voters[_voters[i]].hasVoted = false;
                voters[_voters[i]].stateCode = 0;
                voters[_voters[i]].constituencyCode = 0;
                voters[_voters[i]].lastCandidateId = 0;
                voters[_voters[i]].voteVersion = 0;
                emit VoterAuthorized(_voters[i], 0, 0);
            }
        }
    }

    function setVotingTimeline(uint256 _startTime, uint256 _endTime) public onlyAdmin votingIsNotActive {
        require(_endTime > _startTime, "End time must be after start time");
        votingStartTime = _startTime;
        votingEndTime = _endTime;
        timelineEnabled = true;
        emit VotingTimelineSet(_startTime, _endTime);
    }

    function disableTimeline() public onlyAdmin votingIsNotActive {
        timelineEnabled = false;
        votingStartTime = 0;
        votingEndTime = 0;
    }
    
    function startVoting() public onlyAdmin votingIsNotActive {
        require(candidatesCount > 0, "No candidates added yet");
        votingActive = true;
        emit VotingStatusChanged(true);
    }
    
    function endVoting() public onlyAdmin votingIsActive {
        votingActive = false;
        emit VotingStatusChanged(false);
    }
    
    // ============ Voting Functions (with Re-voting Support) ============
    
    /**
     * @dev Cast or re-cast a vote for a candidate
     * @param _candidateId ID of the candidate to vote for
     * @notice Voter must be authorized. Can re-vote up to MAX_REVOTES times.
     *         Re-voting window closes REVOTE_LOCKOUT before votingEndTime.
     *         If re-voting, the old candidate's count is decremented.
     */
    function vote(uint256 _candidateId) public votingIsActive {
        require(!zkpEnabled, "ZKP mode is active: use the ZKP voting contract instead");
        require(_msgSender() != admin, "Admin cannot vote");
        Voter storage voter = voters[_msgSender()];
        
        // Security Check 1: Ensure voter is authorized
        require(voter.isAuthorized, "You are not authorized to vote");
        
        // Security Check 2: Validate candidate exists
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        
        // Security Check 3: If already voted, check re-vote eligibility
        if (voter.hasVoted) {
            require(voter.voteVersion < MAX_REVOTES, "Maximum re-vote limit reached");
            
            // Re-vote window check: re-voting closes REVOTE_LOCKOUT before end
            if (timelineEnabled && votingEndTime > 0) {
                require(
                    block.timestamp < votingEndTime - REVOTE_LOCKOUT,
                    "Re-voting window has closed. Final votes are locked."
                );
            }

            // Decrement old candidate's vote count
            if (voter.lastCandidateId > 0 && voter.lastCandidateId <= candidatesCount) {
                candidates[voter.lastCandidateId].voteCount--;
            }
        }
        
        // Security Check 4: Constituency match
        Candidate storage candidate = candidates[_candidateId];
        if (voter.stateCode != 0 && candidate.stateCode != 0) {
            require(voter.stateCode == candidate.stateCode, "You can only vote for candidates in your state");
        }
        if (voter.constituencyCode != 0 && candidate.constituencyCode != 0) {
            require(voter.constituencyCode == candidate.constituencyCode, "You can only vote for candidates in your constituency");
        }
        
        // Update voter state
        voter.hasVoted = true;
        voter.lastCandidateId = _candidateId;
        voter.voteVersion++;
        
        // Increment new candidate vote count
        candidate.voteCount++;
        
        // Emit obfuscated event (no candidate info leaked)
        emit VoteCast(
            uint256(keccak256(abi.encodePacked(_candidateId, block.timestamp, block.prevrandao))),
            block.timestamp,
            voter.voteVersion
        );

        // Emit re-vote tracking event (if re-voting)
        if (voter.voteVersion > 1) {
            emit VoteUpdated(_msgSender(), voter.voteVersion, block.timestamp);
        }
    }
    
    // ============ View Functions ============
    
    function getAllCandidates() public view returns (Candidate[] memory) {
        Candidate[] memory allCandidates = new Candidate[](candidatesCount);
        for (uint256 i = 1; i <= candidatesCount; i++) {
            allCandidates[i - 1] = candidates[i];
        }
        return allCandidates;
    }

    function getCandidatesByConstituency(uint8 _stateCode, uint8 _constituencyCode) public view returns (Candidate[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= candidatesCount; i++) {
            if ((candidates[i].stateCode == _stateCode || candidates[i].stateCode == 0) &&
                (candidates[i].constituencyCode == _constituencyCode || candidates[i].constituencyCode == 0)) {
                count++;
            }
        }

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
    
    function getCandidate(uint256 _candidateId) public view returns (Candidate memory) {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        return candidates[_candidateId];
    }
    
    function isVoterAuthorized(address _voter) public view returns (bool) {
        return voters[_voter].isAuthorized;
    }
    
    function hasVoterVoted(address _voter) public view returns (bool) {
        return voters[_voter].hasVoted;
    }

    /**
     * @dev Get voter's info including re-vote status
     */
    function getVoterInfo(address _voter) public view returns (
        bool isAuthorized,
        bool hasVoted,
        uint8 stateCode,
        uint8 constituencyCode,
        uint256 voteVersion,
        bool canRevote
    ) {
        Voter memory v = voters[_voter];
        bool _canRevote = v.hasVoted && v.voteVersion < MAX_REVOTES;
        
        // Check re-vote window
        if (_canRevote && timelineEnabled && votingEndTime > 0) {
            _canRevote = block.timestamp < votingEndTime - REVOTE_LOCKOUT;
        }
        
        return (v.isAuthorized, v.hasVoted, v.stateCode, v.constituencyCode, v.voteVersion, _canRevote);
    }
    
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
    
    function getTotalVotes() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 1; i <= candidatesCount; i++) {
            total += candidates[i].voteCount;
        }
        return total;
    }

    function getVoteReceipt(address _voter) public view returns (bytes32 receiptHash) {
        require(voters[_voter].hasVoted, "Voter has not voted yet");
        return keccak256(abi.encodePacked(_voter, block.chainid, "voted", voters[_voter].voteVersion));
    }

    function getVotingTimeline() public view returns (
        bool _timelineEnabled,
        uint256 _startTime,
        uint256 _endTime,
        bool _isActive
    ) {
        return (timelineEnabled, votingStartTime, votingEndTime, votingActive);
    }

    /**
     * @dev Get re-voting configuration
     */
    function getRevoteConfig() public view returns (
        uint256 maxRevotes,
        uint256 lockoutSeconds,
        bool revoteWindowOpen
    ) {
        bool windowOpen = true;
        if (timelineEnabled && votingEndTime > 0) {
            windowOpen = block.timestamp < votingEndTime - REVOTE_LOCKOUT;
        }
        return (MAX_REVOTES, REVOTE_LOCKOUT, windowOpen);
    }
}
