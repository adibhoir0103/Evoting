// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Voting
 * @dev Implements a secure blockchain-based e-voting system
 * @notice This contract allows an admin to register candidates and authorize voters
 */
contract Voting {
    // ============ State Variables ============
    
    address public admin;
    bool public votingActive;
    
    // ============ Data Structures ============
    
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }
    
    struct Voter {
        bool isAuthorized;
        bool hasVoted;
        uint256 votedCandidateId;
    }
    
    // ============ Mappings & Arrays ============
    
    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;
    uint256 public candidatesCount;
    
    // ============ Events ============
    
    event CandidateAdded(uint256 indexed candidateId, string name);
    event VoterAuthorized(address indexed voter);
    event VoteCast(address indexed voter, uint256 indexed candidateId);
    event VotingStatusChanged(bool isActive);
    
    // ============ Modifiers ============
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier votingIsActive() {
        require(votingActive, "Voting is not active");
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
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Add a new candidate to the election
     * @param _name Name of the candidate
     * @notice Only admin can call this function and only when voting is not active
     */
    function addCandidate(string memory _name) public onlyAdmin votingIsNotActive {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0);
        
        emit CandidateAdded(candidatesCount, _name);
    }
    
    /**
     * @dev Authorize a voter to participate in the election
     * @param _voter Address of the voter to authorize
     * @notice Only admin can authorize voters
     */
    function authorizeVoter(address _voter) public onlyAdmin {
        require(_voter != address(0), "Invalid voter address");
        require(!voters[_voter].isAuthorized, "Voter is already authorized");
        
        voters[_voter].isAuthorized = true;
        voters[_voter].hasVoted = false;
        
        emit VoterAuthorized(_voter);
    }
    
    /**
     * @dev Authorize multiple voters at once
     * @param _voters Array of voter addresses to authorize
     */
    function authorizeVotersBatch(address[] memory _voters) public onlyAdmin {
        for (uint256 i = 0; i < _voters.length; i++) {
            if (!voters[_voters[i]].isAuthorized && _voters[i] != address(0)) {
                voters[_voters[i]].isAuthorized = true;
                voters[_voters[i]].hasVoted = false;
                emit VoterAuthorized(_voters[i]);
            }
        }
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
     * @notice Voter must be authorized and can only vote once
     */
    function vote(uint256 _candidateId) public votingIsActive {
        // Security Check 1: Ensure voter is authorized
        require(voters[msg.sender].isAuthorized, "You are not authorized to vote");
        
        // Security Check 2: Prevent double voting
        require(!voters[msg.sender].hasVoted, "You have already voted");
        
        // Security Check 3: Validate candidate exists
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        
        // Mark voter as having voted (prevents re-entrancy and double voting)
        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedCandidateId = _candidateId;
        
        // Increment candidate vote count
        candidates[_candidateId].voteCount++;
        
        emit VoteCast(msg.sender, _candidateId);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get all candidates with their vote counts
     * @return Array of all candidates
     */
    function getAllCandidates() public view returns (Candidate[] memory) {
        Candidate[] memory allCandidates = new Candidate[](candidatesCount);
        
        for (uint256 i = 1; i <= candidatesCount; i++) {
            allCandidates[i - 1] = candidates[i];
        }
        
        return allCandidates;
    }
    
    /**
     * @dev Get a specific candidate's details
     * @param _candidateId ID of the candidate
     */
    function getCandidate(uint256 _candidateId) public view returns (Candidate memory) {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        return candidates[_candidateId];
    }
    
    /**
     * @dev Check if an address is authorized to vote
     * @param _voter Address to check
     */
    function isVoterAuthorized(address _voter) public view returns (bool) {
        return voters[_voter].isAuthorized;
    }
    
    /**
     * @dev Check if a voter has already voted
     * @param _voter Address to check
     */
    function hasVoterVoted(address _voter) public view returns (bool) {
        return voters[_voter].hasVoted;
    }
    
    /**
     * @dev Get the candidate a voter voted for
     * @param _voter Address of the voter
     */
    function getVoterChoice(address _voter) public view returns (uint256) {
        require(voters[_voter].hasVoted, "Voter has not voted yet");
        return voters[_voter].votedCandidateId;
    }
    
    /**
     * @dev Get the winning candidate
     * @return Candidate with the most votes
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
}
