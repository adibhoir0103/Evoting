# Smart Contract Interfaces

**Date**: 2026-05-26

**Source**: `contracts/*.sol` + [spec.md](file:///c:/Users/HP/Desktop/evoting/specs/001-blockchain-evoting-platform/spec.md)

## Voting.sol

### External Functions

```
createElection(string _title) → uint256 electionId
  - Access: admin only
  - Emits: ElectionCreated(electionId, title, admin)

addCandidate(uint256 _electionId, string _name) → uint256 candidateId
  - Access: admin only
  - Requires: election in DRAFT status
  - Emits: CandidateAdded(electionId, candidateId, name)

openElection(uint256 _electionId)
  - Access: admin or election officer
  - Requires: election in PUBLISHED status, has candidates
  - Emits: ElectionOpened(electionId)

pauseElection(uint256 _electionId)
  - Access: admin only
  - Requires: election is ACTIVE
  - Emits: ElectionPaused(electionId)

resumeElection(uint256 _electionId)
  - Access: admin only
  - Requires: election is PAUSED
  - Emits: ElectionResumed(electionId)

closeElection(uint256 _electionId)
  - Access: admin or election officer
  - Requires: election is ACTIVE
  - Emits: ElectionClosed(electionId)

vote(uint256 _electionId, uint256 _candidateId, bytes32 _secretHash)
  - Access: any registered voter (via trusted forwarder)
  - Requires: election ACTIVE, voter eligible, vote_count < 3
  - Effects: increments candidate voteCount, voter voteCount
  - Emits: VoteCast(electionId, voterAddress, secretHash)

getResults(uint256 _electionId) → Candidate[]
  - Access: public (after election closed)
  - Returns: array of candidates with vote counts

getElection(uint256 _electionId) → Election
  - Access: public
  - Returns: election metadata and status
```

### Events

```
ElectionCreated(uint256 indexed electionId, string title, address admin)
ElectionOpened(uint256 indexed electionId)
ElectionPaused(uint256 indexed electionId)
ElectionResumed(uint256 indexed electionId)
ElectionClosed(uint256 indexed electionId)
CandidateAdded(uint256 indexed electionId, uint256 candidateId, string name)
VoteCast(uint256 indexed electionId, address indexed voter, bytes32 secretHash)
```

---

## ZKPVoting.sol

### Additional External Functions (extends Voting.sol)

```
submitEncryptedVote(
  uint256 _electionId,
  bytes _encryptedVote,
  bytes32 _proofCommitment,
  uint256 _challenge,
  uint256 _response
)
  - Access: any registered voter
  - Requires: valid Schnorr-like proof (simulated)
  - Effects: stores encrypted vote, records proof commitment
  - Emits: ZKPVoteSubmitted(electionId, voter, proofCommitment)

verifyProof(bytes32 _commitment, uint256 _challenge, uint256 _response) → bool
  - Access: public
  - Returns: whether the simulated Schnorr proof is valid
```

### Additional Events

```
ZKPVoteSubmitted(uint256 indexed electionId, address indexed voter, bytes32 commitment)
```

---

## MinimalForwarder.sol (ERC-2771)

### External Functions

```
execute(ForwardRequest calldata req, bytes calldata signature)
  → (bool success, bytes returndata)
  - Access: public (relayer)
  - Requires: valid EIP-712 signature from req.from
  - Effects: forwards call to req.to with req.from as msg.sender
  - Increments nonce for req.from

verify(ForwardRequest calldata req, bytes calldata signature) → bool
  - Access: public (view)
  - Returns: whether signature is valid for the request

getNonce(address from) → uint256
  - Access: public (view)
  - Returns: current nonce for the address
```

### ForwardRequest Struct

```
struct ForwardRequest {
  address from;     // Original signer (voter)
  address to;       // Target contract (Voting/ZKPVoting)
  uint256 value;    // ETH value (always 0 for voting)
  uint256 gas;      // Gas limit for the call
  uint256 nonce;    // Replay protection
  bytes data;       // Encoded function call
}
```

---

## Deployed Addresses (Localhost — chainId 1337)

| Contract | Address |
|---|---|
| Voting | 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 |
| ZKPVoting | 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9 |
| MinimalForwarder | 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9 |

## Test Coverage

| Contract | Tests | Status |
|---|---|---|
| Voting.sol | Voting.test.js | 49+ tests passing ✅ |
| ZKPVoting.sol | ZKPVoting.test.js | All tests passing ✅ |
