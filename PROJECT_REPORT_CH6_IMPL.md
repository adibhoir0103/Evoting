
# CHAPTER 6: PROJECT IMPLEMENTATION

## 6.1 Overview of Project Modules

The Bharat E-Vote system is organized into eight functional modules, each responsible for a distinct aspect of the election lifecycle.

### 6.1.1 Voter Registration Module

This module handles the onboarding of new voters through the `/api/v1/auth/register` endpoint.

- Voters submit personal details (name, email, Voter ID, Aadhaar, constituency codes) via the `SignupPage.jsx` form.
- All string inputs are sanitized using a custom `sanitize()` function that escapes HTML entities (`<`, `>`, `&`, `"`, `'`) to prevent stored XSS attacks.
- The system validates the voter's email against the `ApprovedVoter` whitelist table. Only voters with status `WHITELIST` can register; `BLACKLIST` entries are rejected with a specific error code.
- Uniqueness is enforced on `email`, `voter_id`, and `aadhaar_number` at both the application and database levels (Prisma `@unique` constraints).
- Upon successful registration, a JWT token (30-minute expiry) is issued and a `LoginHistory` entry with status `REGISTERED` is created.

### 6.1.2 Multi-Factor Authentication Module

Authentication proceeds in two mandatory steps:

**Step 1 — Password Verification (`/api/v1/auth/login`):**
- The voter submits their email/Voter ID and password.
- The system enforces a single-active-session constraint: if `active_session_token` is set and `active_session_expires > now()`, login is rejected with "user is active in another window."
- Password is verified using `bcrypt.compare()` against the stored hash.
- A 6-digit OTP is generated: `Math.floor(100000 + Math.random() * 900000)`.
- The OTP is hashed with bcrypt (cost factor 10) and stored in the `MfaToken` table with 5-minute expiry.
- Previous unverified OTPs for the same user are invalidated.
- A `preAuthToken` JWT (10-minute expiry, step: `mfa_pending`) is returned.

**Step 2 — OTP Verification (`/api/v1/auth/mfa/verify-otp`):**
- The voter submits the `preAuthToken` and the 6-digit OTP received via email.
- Maximum 5 failed OTP attempts are allowed; exceeding this locks the OTP.
- Upon successful verification, a final JWT (20-minute expiry) is issued containing `{ id, email, voterId, role, mfa: true, active_session_token }`.
- The `active_session_token` is stored in the `User` table to enforce single-session.

### 6.1.3 Ballot and Candidate Management Module

Administered through the `AdminPanel.jsx` interface:

- **Election Creation:** Admins create elections with name, description, voting instructions, start/end times, and custom rules stored as JSON.
- **Candidate Addition:** Candidates are added via `addCandidate(name, partyName, partySymbol, stateCode, constituencyCode)` on the smart contract. A mandatory NOTA candidate is auto-injected.
- **Voter Authorization:** Admins authorize voters on-chain using `authorizeVoter(address, stateCode, constituencyCode)` or batch-authorize up to 100 voters via `authorizeVotersBatch()`.
- All admin actions are logged to the `AdminAuditLog` table with timestamp, admin email, action description, and IP address.

### 6.1.4 Vote Casting Module (Standard Mode)

The standard voting flow through `VotingV2.sol`:

1. Voter navigates to `VotingPage.jsx` and enters the proctored voting window (`ProctorGuard.jsx`).
2. Candidates are filtered by the voter's `stateCode` and `constituencyCode` and displayed as interactive cards.
3. Voter selects a candidate and confirms their choice.
4. Frontend calls `voting.vote(candidateId)` via Ethers.js, which triggers a MetaMask transaction signature popup.
5. The smart contract executes the following checks:
   - `require(votingActive)` — election must be in progress
   - `require(voters[sender].isAuthorized)` — voter must be authorized
   - `require(sender != admin)` — admin cannot vote
   - `require(candidateId >= 1 && candidateId <= candidatesCount)` — valid candidate
   - Constituency match validation (state and constituency codes)
   - Re-vote limit check (`voteVersion < MAX_REVOTES + 1`)
6. State is updated: candidate vote count incremented, voter marked as `hasVoted`, `voteVersion` incremented.
7. `VoteCast` event emitted with obfuscated candidate ID: `keccak256(candidateId, timestamp, prevrandao)`.
8. Vote receipt hash generated: `keccak256(voterAddress, chainId, "voted", voteVersion)`.

### 6.1.5 ZKP Vote Casting Module (Privacy Mode)

When ZKP mode is enabled, votes are cast through `ZKPVoting.sol`:

1. **Client-Side (Browser — `zkpService.js`):**
   - Generate identity commitment: `IC = keccak256(voterSecret)`
   - Generate nullifier: `N = keccak256(voterSecret, electionId)`
   - Generate Pedersen commitment: `C = hash(g^candidateId · h^randomness mod p)`
   - Generate Schnorr proof: `π = (challenge, response_v, response_r, candidatesCount)`
2. **On-Chain (`submitEncryptedVote()`):**
   - Verify identity commitment is registered
   - Verify nullifier has not been used (prevents double-voting)
   - Verify ZK proof via `_verifyVoteProof()`
   - Store commitment on-chain, mark nullifier as used

All cryptographic operations occur in the voter's browser using the Web Crypto API. The candidate choice **never** leaves the browser in plaintext.

### 6.1.6 Result Computation and Visualization Module

- **On-Chain:** `getAllCandidates()` returns an array of all candidates with their `voteCount`. `getWinner()` returns the candidate with the highest votes. `getTotalVotes()` returns the sum of all votes cast.
- **Frontend (`ResultsPage.jsx`):** Displays results as bar charts and pie charts using the Recharts library. Vote percentages are computed as `(candidateVotes / totalVotes) × 100`.
- **PDF Export:** Admins can generate a PDF report using jsPDF with candidate-wise breakdowns.
- **Post-Election Email:** The `electionNotifier.js` service dispatches result summary emails to all registered voters upon election closure.

### 6.1.7 Admin Dashboard and Audit Module

The `AdminPanel.jsx` component provides a tabbed interface:

| Tab | Functionality |
|-----|--------------|
| Elections | Create, activate, close elections; set timelines |
| Candidates | Add candidates with party details; auto-NOTA injection |
| Voters | Authorize voters (single/batch); manage whitelist |
| Results | View live counts; export PDF reports |
| Audit Logs | Filterable log of all admin actions with timestamps and IPs |

### 6.1.8 Election Notification Scheduler

The `electionNotifier.js` background service runs on a configurable polling interval and triggers automated emails:

- **24-Hour Reminder:** Sent 24 hours before election start time
- **Voting Started:** Sent when the election enters the active phase
- **30-Minute Last Call:** Sent 30 minutes before the election end time

Each notification is tracked in the `ElectionNotification` table with a unique constraint on `(election_id, type)` to prevent duplicate sends.

---

## 6.2 Tools and Technologies Used

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Smart Contracts** | Solidity ^0.8.19 | On-chain voting logic, ZKP verification |
| **Blockchain Framework** | Hardhat ^2.19.0 | Compilation, deployment, testing, local node |
| **Blockchain Library** | Ethers.js v6 | Frontend-to-blockchain interaction |
| **Backend Runtime** | Node.js v16+ | Server-side JavaScript execution |
| **Backend Framework** | Express.js ^4.18.2 | RESTful API routing and middleware |
| **ORM** | Prisma ^6.4.1 | Type-safe database access and migrations |
| **Database** | PostgreSQL (Supabase) | Primary data storage (14 models) |
| **Cache** | Redis (Upstash) | OTP caching, rate limiting, session store |
| **Frontend** | React ^18.2.0 | Component-based UI (12 pages) |
| **Build Tool** | Vite ^8.0.2 | Fast development server and production bundler |
| **CSS** | TailwindCSS ^3.4.0 | Utility-first responsive styling |
| **Wallet** | MetaMask | Ethereum wallet for transaction signing |
| **Auth Tokens** | JWT (jsonwebtoken) | Stateless session management |
| **Password Hashing** | bcryptjs | Adaptive password hashing (cost factor 12) |
| **Security Headers** | Helmet.js | CSP, HSTS, X-Frame-Options enforcement |
| **Bot Protection** | Cloudflare Turnstile | CAPTCHA-free bot mitigation |
| **Email** | Resend / Nodemailer | OTP delivery and election notifications |
| **Error Monitoring** | Sentry ^10.46.0 | Real-time error tracking and performance |
| **Analytics** | PostHog ^1.363.6 | Session replay and user analytics |
| **Internationalization** | i18next | Multi-language UI support |
| **Charts** | Recharts | Election result visualization |
| **PDF Generation** | jsPDF | Exportable election reports |

---

## 6.3 Algorithm and Protocol Details

### 6.3.1 Pedersen Commitment Scheme

**Purpose:** Allow a voter to commit to their candidate choice without revealing it.

**Algorithm Steps:**
```
INPUT:  candidateId (integer), PRIME p, generators g and h
OUTPUT: commitment hash C, randomness r

1. Convert candidateId to BigInt: v ← BigInt(candidateId)
2. Generate random blinding factor: r ← randomFieldElement()
     r is a 256-bit random value from Web Crypto API, reduced mod (p-1)
3. Compute g^v mod p: gv ← modPow(g, v, p)
4. Compute h^r mod p: hr ← modPow(h, r, p)
5. Compute raw commitment: C_raw ← (gv × hr) mod p
6. Hash the commitment: C ← SHA-256(C_raw)
7. RETURN (C, r)
```

**Security Properties:**
- *Computationally Hiding:* Given C, determining v requires solving the Discrete Logarithm Problem (DLP) — computationally infeasible for 256-bit keys.
- *Computationally Binding:* Finding (v', r') ≠ (v, r) such that g^v·h^r = g^v'·h^r' requires knowing log_g(h), which is unknown by construction.

### 6.3.2 Schnorr-Style Sigma Protocol (Zero-Knowledge Proof)

**Purpose:** Prove knowledge of (v, r) that open commitment C without revealing them.

**Algorithm Steps:**
```
INPUT:  candidateId v, randomness r, commitment C, nullifier N, candidatesCount
OUTPUT: proof π = (challenge, response_v, response_r, candidatesCount)

PROVER (Browser — zkpService.js):
1. Generate random nonces: k_v ← randomFieldElement(), k_r ← randomFieldElement()
2. Compute challenge via Fiat-Shamir heuristic:
     e ← H(C, N, k_v, k_r, candidatesCount)  mod p
     where H is SHA-256 mapped to the field
3. Compute responses:
     s_v ← (k_v − e·v) mod p
     s_r ← (k_r − e·r) mod p
4. RETURN π = (e, s_v, s_r, candidatesCount)

VERIFIER (Smart Contract — _verifyVoteProof):
1. Extract (e, s_v, s_r, n) from proof
2. Verify n == candidatesCount
3. Verify e ≠ 0, s_v ≠ 0, s_r ≠ 0
4. Recompute: e' ← H(C, N, s_v, s_r, n) mod p
5. CHECK: e' == e
6. If CHECK passes → proof is VALID; else → REJECT
```

**Zero-Knowledge Property:** The verifier learns nothing beyond the fact that the prover knows valid (v, r). The actual candidate choice v is never transmitted or stored.

### 6.3.3 ERC-2771 Meta-Transaction Protocol

**Purpose:** Enable gasless voting — voters sign transactions off-chain; a relayer pays gas.

**Algorithm Steps:**
```
INPUT:  ForwardRequest(from, to, value, gas, nonce, data), voter's private key
OUTPUT: On-chain execution of the vote function as if called by the voter

1. VOTER signs the ForwardRequest using EIP-712 typed data signing
2. RELAYER calls MinimalForwarder.execute(request, signature)
3. MinimalForwarder.verify():
   a. Recover signer from EIP-712 signature using ecrecover
   b. Check signer == request.from
   c. Check _nonces[from] == request.nonce
4. Increment nonce: _nonces[from]++
5. Forward call: request.to.call(abi.encodePacked(request.data, request.from))
   The real sender address is appended to calldata per ERC-2771 standard
6. Target contract extracts original sender from last 20 bytes of calldata
```

### 6.3.4 OTP-Based Multi-Factor Authentication

```
INPUT:  voter email, password
OUTPUT: final JWT token (20-min expiry)

Step 1 — Password Phase:
  1. Lookup user by email or voter_id
  2. Check single-active-session constraint
  3. Verify password: bcrypt.compare(input, storedHash)
  4. Generate OTP: floor(random() × 900000) + 100000
  5. Hash OTP: bcrypt.hash(otp, 10)
  6. Store in MfaToken table with 5-min expiry
  7. Send OTP via email (Resend API)
  8. Return preAuthToken (JWT, 10-min, step=mfa_pending)

Step 2 — OTP Phase:
  1. Verify preAuthToken JWT
  2. Lookup latest unverified MfaToken for user
  3. Check attempts < 5
  4. Verify OTP: bcrypt.compare(input, storedHash)
  5. Generate session token: crypto.randomUUID()
  6. Store active_session_token with 20-min expiry
  7. Issue final JWT: { id, email, voterId, role, mfa:true }
  8. Log LOGIN SUCCESS in LoginHistory
```

### 6.3.5 Keystroke Dynamics Behavioral Biometric

```
INPUT:  typing sample (array of key events with timestamps)
OUTPUT: match score and flagged status

Enrollment:
  1. Capture hold_times[]: duration each key is pressed (keydown → keyup)
  2. Capture flight_times[]: interval between consecutive keyups and keydowns
  3. Compute mean_speed = avg(flight_times)
  4. Compute std_deviation = stddev(flight_times)
  5. Store profile in KeystrokeProfile table

Verification:
  1. Capture current typing sample
  2. Compute current mean_speed and std_deviation
  3. Calculate distance = |current_mean - enrolled_mean| / enrolled_std
  4. If distance > threshold:
       flagged_count++ → alert admin
  5. Else: authentication passes silently
```

### 6.3.6 Vote Casting — Checks-Effects-Interactions Pattern

The `vote()` function in `VotingV2.sol` follows the Checks-Effects-Interactions pattern to prevent reentrancy:

```
function vote(uint256 _candidateId) public {
    // === CHECKS ===
    require(votingActive, "Voting is not active");
    require(voters[sender].isAuthorized, "Not authorized");
    require(sender != admin, "Admin cannot vote");
    require(_candidateId >= 1 && _candidateId <= candidatesCount, "Invalid candidate");
    // Constituency validation...
    // Re-vote limit check...
    // Timeline validation...

    // === EFFECTS (state changes BEFORE external calls) ===
    if (voters[sender].hasVoted) {
        candidates[voters[sender].lastCandidateId].voteCount--;  // Decrement old
    }
    candidates[_candidateId].voteCount++;  // Increment new
    voters[sender].hasVoted = true;
    voters[sender].lastCandidateId = _candidateId;
    voters[sender].voteVersion++;

    // === INTERACTIONS (events emitted AFTER state changes) ===
    emit VoteCast(obfuscatedId, block.timestamp, voters[sender].voteVersion);
}
```

This ordering ensures that even if a reentrant call were possible, the state has already been updated before any external interaction occurs.

---
