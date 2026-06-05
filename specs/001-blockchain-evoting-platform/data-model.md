# Data Model: Blockchain-Based E-Voting Platform

**Date**: 2026-05-26

**Source**: [spec.md](file:///c:/Users/HP/Desktop/evoting/specs/001-blockchain-evoting-platform/spec.md) + `backend/prisma/schema.prisma`

## Entity Relationship Overview

```
User (Voter/Admin) ──┬── MfaToken
                     ├── LoginHistory
                     ├── KeystrokeProfile
                     ├── Vote ──── Election
                     ├── QrVoteTicket
                     ├── ElectionVoter ──── Election
                     └── SupportTicket

Election ──┬── ElectionCandidate ──── Constituency ──── State
           ├── ElectionVoter
           ├── ElectionNotification
           └── Vote

AdminAuditLog (standalone — references admin by ID)
ApprovedVoter (standalone — voter whitelist)
OtpDeliveryLog (standalone — delivery tracking)
```

## Entities

### User

The central identity entity for all platform participants.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary key, auto-generated |
| voter_id | String | Unique, auto-generated voter identifier |
| name | String | Required |
| email | String | Unique, required |
| password | String | bcrypt hashed, required |
| aadhaar_number | String | HMAC-SHA256 hashed with pepper, unique |
| wallet_address | String | Ethereum address, optional |
| phone | String | Optional |
| state_code | String | Indian state code |
| constituency_code | String | Electoral constituency |
| role | Enum | VOTER, SUPER_ADMIN, ELECTION_OFFICER, AUDITOR |
| is_verified | Boolean | Default: false |
| created_at | DateTime | Auto-set |
| updated_at | DateTime | Auto-updated |

**Validation rules**:
- Email: RFC 5322 format
- Aadhaar: 12-digit numeric (validated before hashing)
- Password: Minimum 8 characters, mixed case + number
- Wallet address: Valid Ethereum address (0x prefix, 42 chars)

**State transitions**: Unverified → Verified (via admin approval)

---

### Election

The core domain entity representing a voting event.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary key |
| title | String | Required |
| description | String | Optional |
| status | Enum | DRAFT, PUBLISHED, ACTIVE, PAUSED, CLOSED, ARCHIVED |
| start_time | DateTime | Required |
| end_time | DateTime | Required, must be after start_time |
| contract_address | String | Ethereum contract address |
| created_by | UUID | FK → User (admin) |
| created_at | DateTime | Auto-set |
| updated_at | DateTime | Auto-updated |

**State transitions**:
```
DRAFT → PUBLISHED → ACTIVE ↔ PAUSED → CLOSED → ARCHIVED
```
- DRAFT → PUBLISHED: Admin publishes (triggers voter notifications)
- PUBLISHED → ACTIVE: Admin opens voting (at start_time)
- ACTIVE → PAUSED: Emergency suspension
- PAUSED → ACTIVE: Admin resumes
- ACTIVE → CLOSED: End time reached or admin closes
- CLOSED → ARCHIVED: Admin archives completed election

---

### ElectionCandidate

Candidates participating in an election, scoped by constituency.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary key |
| election_id | UUID | FK → Election |
| name | String | Required |
| party | String | Required |
| symbol | String | Party symbol identifier |
| photo_url | String | IPFS CID or URL |
| manifesto_url | String | IPFS CID, optional |
| state_code | String | Indian state code |
| constituency_code | String | FK → Constituency |
| is_nota | Boolean | Default: false (NOTA auto-injected) |

**Validation rules**:
- Unique (election_id, constituency_code, name) — no duplicate
  candidates per constituency per election
- NOTA candidate auto-injected per constituency on election publish

---

### ElectionVoter

Junction table linking voters to elections they are eligible for.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary key |
| election_id | UUID | FK → Election |
| voter_id | UUID | FK → User |
| has_voted | Boolean | Default: false |
| vote_count | Int | Default: 0, max: 3 (re-vote limit) |

**Validation rules**:
- Unique (election_id, voter_id) — one enrollment per election
- vote_count MUST NOT exceed 3 (coercion deterrence limit)

---

### Vote

Immutable vote record linking voter to election via blockchain.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary key |
| voter_id | UUID | FK → User |
| election_id | UUID | FK → Election |
| tx_hash | String | Blockchain transaction hash, unique |
| block_number | Int | Block where vote was mined |
| encrypted_vote | String | Encrypted candidate choice |
| secret_salt | String | Off-chain salt for privacy |
| created_at | DateTime | Auto-set |

**Validation rules**:
- tx_hash must be a valid Ethereum transaction hash (0x + 64 hex)
- Only the latest vote per (voter_id, election_id) counts

---

### QrVoteTicket

Cryptographic receipt for vote verification.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary key |
| voter_id | UUID | FK → User |
| election_id | UUID | FK → Election |
| ticket_token | String | Unique, cryptographically random |
| tx_hash | String | Associated vote transaction |
| expires_at | DateTime | Ticket expiry |
| used | Boolean | Default: false |
| created_at | DateTime | Auto-set |

---

### MfaToken

Multi-factor authentication tokens (email OTP).

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | FK → User |
| otp_hash | String | bcrypt-hashed OTP |
| purpose | String | LOGIN, PASSWORD_RESET, etc. |
| expires_at | DateTime | OTP expiry window |
| used | Boolean | Default: false |
| created_at | DateTime | Auto-set |

---

### KeystrokeProfile

Behavioral biometric template for keystroke dynamics.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | FK → User, unique |
| hold_times | JSON | Key hold duration patterns |
| flight_times | JSON | Inter-key flight time patterns |
| mean_speed | Float | Average typing speed |
| sample_count | Int | Number of training samples |
| created_at | DateTime | Auto-set |
| updated_at | DateTime | Auto-updated |

---

### AdminAuditLog

Immutable log of all admin actions.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary key |
| admin_id | UUID | FK → User (admin role) |
| action | String | Action type (e.g., APPROVE_VOTER) |
| target_type | String | Entity type acted upon |
| target_id | String | Entity ID acted upon |
| details | JSON | Additional context |
| ip_address | String | Request IP |
| created_at | DateTime | Auto-set |

---

### Supporting Entities

| Entity | Purpose | Key Fields |
|---|---|---|
| **LoginHistory** | Login attempt tracking | user_id, device_info, ip_address, status, created_at |
| **OtpDeliveryLog** | OTP send tracking | user_id, email, success, error_msg, created_at |
| **ApprovedVoter** | Voter whitelist/blacklist | email, status (APPROVED/REJECTED/PENDING) |
| **SupportTicket** | Help desk tickets | user_id, issue_type, description, admin_reply, status |
| **State** | Indian states | code (unique), name, total_seats |
| **Constituency** | Electoral constituencies | state_code (FK → State), code, name |
| **ElectionNotification** | Notification tracking | election_id, type (REMINDER_24H, VOTING_STARTED, LAST_CALL_30M), sent_at |

## Blockchain Data Model

### Voting.sol — On-Chain State

```
Election (on-chain struct):
  ├── id: uint256
  ├── admin: address
  ├── isOpen: bool
  ├── isPaused: bool
  ├── candidates: mapping(uint256 => Candidate)
  ├── candidateCount: uint256
  ├── voters: mapping(address => Voter)
  └── totalVotes: uint256

Candidate (on-chain struct):
  ├── id: uint256
  ├── name: string
  └── voteCount: uint256

Voter (on-chain struct):
  ├── hasVoted: bool
  ├── voteCount: uint256 (max 3)
  └── lastVotedCandidate: uint256
```

### ZKPVoting.sol — Extended On-Chain State

Extends Voting.sol with:
```
  ├── proofCommitments: mapping(bytes32 => bool)
  └── encryptedVotes: mapping(address => bytes)
```

### MinimalForwarder.sol — Meta-Transaction State

```
  ├── _nonces: mapping(address => uint256)
  └── verify(req, signature): bool
```

## Database Indexes

Critical indexes for performance (Constitution Principle IV):

| Table | Index | Purpose |
|---|---|---|
| User | email (unique) | Login lookup |
| User | voter_id (unique) | Voter identification |
| User | aadhaar_number (unique) | Aadhaar dedup |
| Election | status | Active election queries |
| ElectionVoter | (election_id, voter_id) unique | Enrollment lookup |
| Vote | tx_hash (unique) | Transaction verification |
| Vote | (voter_id, election_id) | Vote history lookup |
| QrVoteTicket | ticket_token (unique) | Receipt verification |
| AdminAuditLog | admin_id, created_at | Audit log queries |
