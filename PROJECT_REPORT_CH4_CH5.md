
# CHAPTER 4: SYSTEM DESIGN

The system design chapter presents the architectural blueprint of the Bharat E-Vote platform, covering the overall system architecture, smart contract design, mathematical models underlying the cryptographic protocols, database schema, and UML diagrams.

---

## 4.1 System Architecture

The Bharat E-Vote system follows a **three-tier decentralized architecture** comprising a React frontend, a Node.js backend, and an Ethereum blockchain layer. Unlike traditional client-server architectures where the database is the final authority, in Bharat E-Vote the **blockchain smart contract is the ultimate trust boundary**.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│  LandingPage │ LoginPage │ VotingPage │ ResultsPage │ AdminPanel│
│         MetaMask Wallet Provider  │  zkpService.js (Browser)    │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS (JWT Auth)
┌──────────────────────▼──────────────────────────────────────────┐
│                     BACKEND (Node.js + Express)                  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │ Auth API │ │ Vote API │ │  ZKP API  │ │ Election Notifier│  │
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └────────┬─────────┘  │
│       │             │             │                 │            │
│  ┌────▼─────────────▼─────────────▼─────────────────▼────────┐  │
│  │              Prisma ORM + Security Middleware              │  │
│  │    Helmet.js │ Rate Limiter │ Sentry │ Input Sanitizer    │  │
│  └──────────────────────┬────────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
              ┌───────────┼───────────┐
              ▼           ▼           ▼
    ┌──────────────┐ ┌─────────┐ ┌──────────────────────────┐
    │  Supabase    │ │ Upstash │ │   Ethereum Blockchain    │
    │  PostgreSQL  │ │  Redis  │ │  ┌────────────────────┐  │
    │  (14 Models) │ │ (Cache) │ │  │   VotingV2.sol     │  │
    └──────────────┘ └─────────┘ │  │   ZKPVoting.sol    │  │
                                 │  │   MinimalForwarder  │  │
                                 │  └────────────────────┘  │
                                 └──────────────────────────┘
```

**Data Flow Summary:**

1. Voter authenticates via backend (password → OTP → JWT).
2. Voter connects MetaMask wallet on the frontend.
3. Frontend calls smart contract `vote()` via Ethers.js through MetaMask.
4. Smart contract validates voter authorization, constituency match, and records the vote on-chain.
5. Frontend reads results directly from blockchain via `getAllCandidates()`.
6. Backend serves voter profiles, election metadata, and audit logs from Supabase.

---

## 4.2 Smart Contract Architecture

Three Solidity contracts form the blockchain layer:

### VotingV2.sol — Primary Election Logic (438 lines)

| Function | Visibility | Purpose |
|----------|-----------|---------|
| `addCandidate()` | Admin only | Add candidate with party and constituency details |
| `authorizeVoter()` | Admin only | Authorize voter with state/constituency codes |
| `authorizeVotersBatch()` | Admin only | Batch authorize up to 100 voters |
| `startVoting()` | Admin only | Activate election (requires ≥1 candidate) |
| `endVoting()` | Admin only | Close election |
| `vote()` | Authorized voter | Cast/re-vote (max 3 re-votes, secret ballot) |
| `setVotingTimeline()` | Admin only | Set start/end timestamps |
| `getAllCandidates()` | Public view | Return all candidates with vote counts |
| `getWinner()` | Public view | Return candidate with highest votes |
| `getVoteReceipt()` | Public view | Return cryptographic receipt hash |

**Key Design Decisions:**
- `votedCandidateId` is NOT stored in the Voter struct — preserving the secret ballot
- `VoteCast` event emits `keccak256(candidateId, timestamp, prevrandao)` — obfuscated
- Re-voting decrements the old candidate's count before incrementing the new one
- Admin address is explicitly blocked from casting votes

### ZKPVoting.sol — Privacy Extension (438 lines)

| Function | Visibility | Purpose |
|----------|-----------|---------|
| `registerVoter()` | Admin only | Register identity commitment on-chain |
| `submitEncryptedVote()` | Public | Submit vote with ZKP (commitment + nullifier + proof) |
| `_verifyVoteProof()` | Internal | Verify Schnorr-style sigma proof |
| `getVoteCommitment()` | Public view | Retrieve stored commitment for audit |

**Cryptographic Parameters (matching zkpService.js):**
```
PRIME  = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
GEN_G  = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
GEN_H  = 0xC6047F9441ED7D6D3045406E95C07CD85C778E4B8CEF3CA7ABAC09B95C709EE5
```

### MinimalForwarder.sol — Meta-Transactions (161 lines)

Implements ERC-2771 for gasless voting. The voter signs a `ForwardRequest` off-chain using EIP-712 typed data; a relayer submits the transaction and pays gas. The target contract extracts the real sender from the appended calldata.

---

## 4.3 Mathematical Models

### 4.3.1 Pedersen Commitment Scheme

The Pedersen commitment scheme allows a voter to commit to their candidate choice without revealing it, while enabling later verification that the commitment is valid.

**Setup:** Let `p` be a large prime (secp256k1 curve order), and let `g`, `h` be two generators of the group Z*p such that no one knows `log_g(h)`.

**Commitment Phase:**
```
C = g^v · h^r  (mod p)
```
Where:
- `v` = candidate ID (the secret vote value)
- `r` = random blinding factor (generated via Web Crypto API)
- `C` = the commitment (published on-chain)

**Properties:**
- *Hiding:* Given `C`, an adversary cannot determine `v` because `r` is randomly chosen
- *Binding:* The voter cannot open the commitment to a different value `v'` because finding `r'` such that `g^v · h^r = g^v' · h^r'` requires solving the discrete logarithm problem

**Implementation (zkpService.js line 91–106):**
```javascript
async generateCommitment(candidateId) {
    const v = BigInt(candidateId);
    const r = randomFieldElement();       // 256-bit random
    const gv = modPow(GENERATOR_G, v, PRIME);
    const hr = modPow(GENERATOR_H, r, PRIME);
    const commitment = (gv * hr) % PRIME;
    const commitmentHash = await keccak256(commitment);
    return { commitment: commitmentHash, randomness: '0x' + r.toString(16) };
}
```

### 4.3.2 Schnorr-Style Zero-Knowledge Proof

The voter must prove they know the values `(v, r)` that open commitment `C` without revealing them.

**Protocol (Sigma Protocol — 3 moves):**

| Step | Actor | Action |
|------|-------|--------|
| 1. Commit | Prover (Voter) | Choose random `k_v, k_r`; compute announcement |
| 2. Challenge | Verifier (Smart Contract) | Compute `e = H(C, nullifier, k_v, k_r, candidatesCount)` |
| 3. Response | Prover | Compute `s_v = k_v - e·v (mod p)` and `s_r = k_r - e·r (mod p)` |

**Verification (on-chain):**
The verifier checks: `e ?= H(C, nullifier, s_v, s_r, candidatesCount)`

If the equation holds, the prover knows `(v, r)` with overwhelming probability, without `v` or `r` being revealed.

**Implementation (zkpService.js line 111–137):**
```javascript
async generateVoteProof(candidateId, randomnessHex, candidatesCount, commitmentHash, nullifierHash) {
    const k_v = randomFieldElement();
    const k_r = randomFieldElement();
    const challenge = await hashToField(commitmentHash, nullifierHash, k_v, k_r, candidatesCount);
    const response_v = ((k_v - challenge * v) % PRIME + PRIME) % PRIME;
    const response_r = ((k_r - challenge * r) % PRIME + PRIME) % PRIME;
    return { proof: [challenge, response_v, response_r, candidatesCount] };
}
```

### 4.3.3 Nullifier and Identity Commitment

**Nullifier:** `N = H(voterSecret, electionId)` — deterministic per voter per election. Prevents double-voting: if `nullifierUsed[N] == true`, the vote is rejected.

**Identity Commitment:** `IC = H(voterSecret)` — registered on-chain by admin. Proves voter eligibility without revealing the secret.

### 4.3.4 OTP Generation and Expiry

```
OTP = floor(Random() × 900000) + 100000     // 6-digit: [100000, 999999]
isValid = (T_current − T_generated) ≤ 300    // 5-minute expiry window
```

The OTP is hashed with bcrypt before storage in the `MfaToken` table, ensuring that even database access cannot reveal the OTP value.

### 4.3.5 Password Hashing (Bcrypt)

```
Hash = Bcrypt(Password || Salt, CostFactor=12)
isMatch = Bcrypt.compare(EnteredPassword, StoredHash)
```

Cost factor 12 ensures approximately 2^12 = 4,096 iterations of the Blowfish cipher, making brute-force attacks computationally infeasible.

### 4.3.6 Vote Percentage Calculation

```
Vote%(C) = (Votes(C) / TotalVotes) × 100
Winner = argmax_C { Votes(C) }
```

---

## 4.4 Database Schema Design

The Prisma schema defines 14 interconnected models. Key relationships:

```
User ──────────┬──── ElectionVoter ────── Election
               │                            │
               ├──── KeystrokeProfile       ├──── ElectionCandidate
               │                            │
               ├──── LoginHistory           ├──── ElectionNotification
               │                            │
               └──── QrVoteTicket           └──── Vote

ApprovedVoter (independent whitelist)
AdminAuditLog (independent audit trail)
MfaToken (linked by email)
State ──── Constituency (geographic lookup)
```

**Key Constraints:**
- `User.email`, `User.voter_id`, `User.aadhaar_number` — unique
- `ElectionVoter` — `@@unique([election_id, user_id])` prevents duplicate enrollment
- `ElectionNotification` — `@@unique([election_id, type])` prevents duplicate emails
- `Vote` — `@@unique([voter_id, election_id])` enforces one-vote-per-election

---

## 4.5 Data Flow Diagrams

### 4.5.1 DFD Level 0 — Context Diagram

```
                   ┌─────────┐
   Credentials ───►│         │──► Election Results
   Vote Choice ───►│ Bharat  │──► Vote Receipt
                   │ E-Vote  │──► Email Notifications
   Election Config►│ System  │──► Audit Reports
                   │         │
   Blockchain ◄───►│         │◄──► Supabase DB
                   └─────────┘
   Actors: Voter, Admin, Auditor, Ethereum Network, Supabase
```

### 4.5.2 DFD Level 1 — System Decomposition

```
Voter ──► [1.0 Authentication] ──► JWT Token
                                      │
Voter ──► [2.0 Vote Casting] ◄────────┘
               │
               ├──► [2.1 Standard Vote] ──► VotingV2.sol ──► Blockchain
               └──► [2.2 ZKP Vote] ──► ZKPVoting.sol ──► Blockchain

Admin ──► [3.0 Election Mgmt] ──► Supabase + Blockchain
Admin ──► [4.0 Voter Mgmt] ──► ApprovedVoter Table + Smart Contract

System ──► [5.0 Notification Scheduler] ──► Email Service
Auditor ──► [6.0 Audit Logs] ──► AdminAuditLog + Blockchain Events
```

### 4.5.3 DFD Level 2 — Vote Casting Decomposition

```
Voter ──► [2.1 Load Ballot] ──► Filter by constituency
      ──► [2.2 Select Candidate] ──► Validate candidateId
      ──► [2.3 MetaMask Sign] ──► Ethers.js transaction
      ──► [2.4 Smart Contract] ──► require() checks ──► State update
      ──► [2.5 Event Emission] ──► VoteCast(obfuscatedId, timestamp, version)
      ──► [2.6 Receipt Generation] ──► keccak256 receipt hash
```

---

## 4.6 UML Diagrams

### 4.6.1 Use Case Diagram

```
┌──────────────────────────────────────────────────────┐
│                    Bharat E-Vote                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ Register Account                             │◄── Voter
│  │ Login (Password + OTP)                       │◄── Voter
│  │ Connect MetaMask Wallet                      │◄── Voter
│  │ View Ballot (Constituency Filtered)          │◄── Voter
│  │ Cast Vote / Re-Vote                          │◄── Voter
│  │ View Results                                 │◄── Voter / Auditor
│  │ Verify Vote (ZKP Receipt)                    │◄── Voter
│  │                                              │    │
│  │ Create Election                              │◄── Admin
│  │ Add Candidates (+ Auto NOTA)                 │◄── Admin
│  │ Authorize Voters (Single / Batch)            │◄── Admin
│  │ Start / End Voting                           │◄── Admin
│  │ Set Timeline                                 │◄── Admin
│  │ View Audit Logs                              │◄── Admin / Auditor
│  │ Export Results (PDF)                         │◄── Admin
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### 4.6.2 Sequence Diagram — Vote Casting Flow

```
Voter          Frontend        MetaMask       Smart Contract     Blockchain
  │               │               │               │                 │
  │──Select Candidate──►          │               │                 │
  │               │──vote(id)────►│               │                 │
  │               │               │──Sign Tx─────►│                 │
  │               │               │               │──require checks │
  │               │               │               │  (authorized?)  │
  │               │               │               │  (votingActive?)│
  │               │               │               │  (constituency?)│
  │               │               │               │──Update State───►
  │               │               │               │──Emit VoteCast──►
  │               │               │◄──Tx Receipt──│                 │
  │               │◄──Confirmation─│              │                 │
  │◄──Vote Receipt─│               │              │                 │
```

### 4.6.3 State Diagram — Election Lifecycle

```
    ┌─────────┐  addCandidate()   ┌──────────┐  startVoting()  ┌────────┐
    │  DRAFT  │──────────────────►│ PREPARED │────────────────►│ ACTIVE │
    └─────────┘  authorizeVoter() └──────────┘                 └───┬────┘
                                                                   │
                                                          endVoting() or
                                                         timeline expiry
                                                                   │
                                                              ┌────▼────┐
                                                              │ CLOSED  │
                                                              └─────────┘
                                                              getWinner()
                                                              getAllCandidates()
```

### 4.6.4 Class Diagram (Smart Contract)

```
┌──────────────────────────────┐     ┌──────────────────────────┐
│        VotingV2              │     │       ZKPVoting          │
├──────────────────────────────┤     ├──────────────────────────┤
│ - admin: address             │     │ - zkpEnabled: bool       │
│ - votingActive: bool         │     │ - PRIME: uint256         │
│ - candidatesCount: uint256   │     │ - GENERATOR_G: uint256   │
│ - MAX_REVOTES: uint8 = 3     │     │ - GENERATOR_H: uint256   │
│ - voters: mapping            │     │ - commitments: mapping   │
│ - candidates: mapping        │     │ - nullifierUsed: mapping │
├──────────────────────────────┤     ├──────────────────────────┤
│ + addCandidate()             │     │ + registerVoter()        │
│ + authorizeVoter()           │     │ + submitEncryptedVote()  │
│ + vote()                     │     │ + _verifyVoteProof()     │
│ + startVoting()              │     │ + getVoteCommitment()    │
│ + endVoting()                │     └──────────────────────────┘
│ + getAllCandidates()         │
│ + getWinner()                │     ┌──────────────────────────┐
│ + getVoteReceipt()           │     │   MinimalForwarder       │
└──────────────────────────────┘     ├──────────────────────────┤
                                     │ - _nonces: mapping       │
                                     │ - _DOMAIN_SEPARATOR      │
                                     ├──────────────────────────┤
                                     │ + verify()               │
                                     │ + execute()              │
                                     │ + getNonce()             │
                                     └──────────────────────────┘
```

---
---

# CHAPTER 5: PROJECT PLAN

## 5.1 Project Estimates

### 5.1.1 Reconciled Estimates

Project estimates were derived by combining three estimation approaches:

- **Expert Judgment:** Based on team members' prior experience with Node.js, React, and database-driven web applications.
- **Analogous Estimation:** Referenced similar blockchain-based authentication and voting systems documented in the literature survey.
- **Bottom-Up Estimation:** Individual modules (Authentication, Blockchain, Frontend, ZKP, Admin) were estimated separately and aggregated.

**Overall Project Size:** ~15,000 lines of code across smart contracts, backend, and frontend.
**Estimated Effort:** 5 persons × 6 months = 30 person-months.
**Actual Duration:** September 2024 – March 2025 (7 months including documentation).

### 5.1.2 Human Resources

- **Number of Team Members:** 5
- **Core Skills:** Full-Stack Development, Blockchain/Solidity, Database Management, Security Engineering, UI/UX Design
- **Geographic Location:** All team members based in Pune, Maharashtra, India
- **Primary Client:** Election Commission of India (ECI) and institutional election bodies (universities, corporates, housing societies)
- **Academic Supervisors:** Dr. B. D. Phulpagar (Guide), Prof. Dr. Mrs. S. A. Itkar (HOD)

### 5.1.3 Development Resources

**Software Stack:**

| Category | Tools |
|----------|-------|
| IDE | VS Code with Solidity and Prisma extensions |
| Version Control | Git + GitHub |
| Backend | Node.js, Express.js, Prisma ORM |
| Frontend | React, Vite, TailwindCSS |
| Blockchain | Hardhat, Solidity, Ethers.js v6 |
| Database | Supabase PostgreSQL, Upstash Redis |
| Testing | Hardhat Toolbox (Chai + Mocha), Postman |
| Monitoring | Sentry, PostHog |
| Communication | WhatsApp, Google Meet, Email |

**Hardware:**
- Developer workstations (5× laptops with 8GB+ RAM)
- Supabase cloud database instance
- Upstash Redis cloud instance
- Stable broadband internet connections

---

## 5.2 Risk Management

### 5.2.1 Risk Identification

| # | Risk Type | Description |
|---|-----------|-------------|
| R1 | Scope Risk | Requirements may evolve during development (new voting features, authentication changes) |
| R2 | Schedule Risk | Blockchain integration and ZKP implementation may take longer than estimated |
| R3 | Integration Risk | Multiple technologies (Node.js, Supabase, Prisma, Redis, Hardhat, MetaMask) must work together |
| R4 | Technology Risk | Newer tools (Supabase, Prisma, Upstash) may have limited documentation or breaking updates |
| R5 | Security Risk | System handles sensitive voter data and election results — any breach is critical |
| R6 | Operational Risk | Environment differences between development and production may cause deployment failures |

### 5.2.2 Risk Analysis

1. **Scope Risk (R1):** Requirements for the Bharat E-Vote system evolved iteratively — the re-voting mechanism, ZKP mode, and election notifications were added as increments. This was managed through the incremental SDLC model where each new feature was a separate increment.

2. **Schedule Risk (R2):** Smart contract development and testing required significant ramp-up time. An extra buffer of 2 weeks was allocated for blockchain-specific challenges including gas optimization and Hardhat configuration. The 85 automated tests were developed in parallel with contract code to catch regressions early.

3. **Integration Risk (R3):** The system integrates 6+ independent services. A modular architecture with well-defined API boundaries was adopted — the frontend communicates with the backend via REST APIs and with the blockchain via Ethers.js, with no direct coupling between the two data paths.

4. **Technology Risk (R4):** Supabase and Prisma ORM were relatively newer tools for the team. Adequate time was allocated for learning, and fallback options (raw SQL, direct PostgreSQL) were identified in case Prisma limitations arose. The Prisma migration system proved stable throughout development.

5. **Security Risk (R5):** Mitigated through the 8-layer defence-in-depth architecture, 85 automated smart contract tests, STRIDE threat modeling, and continuous code review. JWT secrets, database URLs, and API keys were managed through `.env` files excluded from version control.

6. **Operational Risk (R6):** A strict environment variable management policy using `.env` files and a pre-deployment checklist was established. The `deployment-info.json` file tracks contract addresses across environments.

### 5.2.3 Risk Mitigation, Monitoring, and Management

| Risk | Category | Probability | Impact | RMMM Strategy |
|------|----------|------------|--------|---------------|
| Requirements evolution during development | Project | 50% | Critical | Mitigation — Incremental SDLC with per-increment testing |
| Skilled blockchain developers availability | Technical | 50% | Critical | Monitoring — Team cross-training on Solidity and Hardhat |
| Technology meets performance expectations | Technical | 40% | Critical | Mitigation — Load testing with concurrent user simulation |
| Project scope stability | Project | 40% | Critical | Mitigation — Formal scope freeze after Increment 4 |
| Smart contract security vulnerabilities | Security | 30% | Critical | Mitigation — 85 automated tests + manual code audit |
| Production deployment failures | Operational | 30% | Marginal | Monitoring — Staging environment + deployment checklist |

---

## 5.3 Project Schedule

### 5.3.1 Project Task Set

| Task | Description | Duration | Dependencies |
|------|-------------|----------|-------------|
| T1 | Requirement Gathering and Analysis | 2 weeks | — |
| T2 | System Architecture and Database Schema Design | 2 weeks | T1 |
| T3 | Environment Setup (Node.js, Hardhat, Prisma, Redis) | 1 week | T2 |
| T4 | Smart Contract Development (VotingV2 + ZKPVoting) | 4 weeks | T3 |
| T5 | Backend API Development (Auth, Vote, Admin) | 4 weeks | T3 |
| T6 | Frontend Development (12 pages + components) | 5 weeks | T3 |
| T7 | Authentication Module (MFA + Keystroke Dynamics) | 3 weeks | T5 |
| T8 | Blockchain Integration and MetaMask Wallet Binding | 2 weeks | T4, T6 |
| T9 | ZKP Module (Client-side proof generation + on-chain verify) | 3 weeks | T4, T6 |
| T10 | Admin Dashboard and Audit System | 2 weeks | T5, T6 |
| T11 | Smart Contract Testing (85 tests) | 2 weeks | T4 |
| T12 | Integration and System Testing | 2 weeks | T7–T10 |
| T13 | Security Hardening (Helmet, Rate Limiting, Turnstile) | 1 week | T12 |
| T14 | Documentation and Project Report | 3 weeks | T13 |

### 5.3.2 Task Network

```
T1 ──► T2 ──► T3 ──┬──► T4 ──┬──► T8 ──┐
                    │         │         │
                    │         └──► T9 ──┤
                    │         │         │
                    ├──► T5 ──┼──► T7 ──┤──► T12 ──► T13 ──► T14
                    │         │         │
                    └──► T6 ──┴──► T10 ─┘
                              │
                              └──► T11 (parallel)
```

**Critical Path:** T1 → T2 → T3 → T4 → T8 → T12 → T13 → T14 (approx. 18 weeks)

---

## 5.4 Team Organization

### 5.4.1 Team Structure and Roles

| Team Member | Role | Primary Responsibilities |
|-------------|------|------------------------|
| **Aditya Bhoir** | Project Lead, Full-Stack Developer | System architecture, smart contract development, blockchain integration, project coordination |
| **Omkar Ingle** | UI/UX Designer, Database Manager | Frontend design, Prisma schema, Supabase configuration, responsive layouts |
| **Aftab Pathan** | Frontend Developer, Documentation | React pages, component development, i18n integration, project report writing |
| **Abhishek Shinde** | Backend & DevOps Engineer | API development, Redis configuration, deployment pipelines, environment management |
| **Aryan Shinde** | QA Engineer, Testing Lead | Smart contract test suite (85 tests), integration testing, security testing, test documentation |

### 5.4.2 Management Reporting and Communication

- **Guide Meetings:** Weekly meetings with Dr. B. D. Phulpagar for progress review and technical guidance
- **Team Collaboration:** Daily coordination via WhatsApp group; weekly in-person working sessions at college lab
- **Code Reviews:** Pull request-based workflow on GitHub with mandatory peer review before merge
- **Documentation:** Shared Google Drive for report drafts; version-controlled `PROJECT_DOCUMENTATION.md` in the repository
- **Issue Tracking:** GitHub Issues for bug tracking and feature requests

---
