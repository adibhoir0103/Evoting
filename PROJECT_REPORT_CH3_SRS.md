
# CHAPTER 3: SOFTWARE REQUIREMENTS SPECIFICATION

The Software Requirements Specification (SRS) document defines the complete set of functional and non-functional requirements for the Bharat E-Vote system. This specification serves as a contractual agreement between the development team and the project stakeholders, providing a baseline against which the final deliverable is validated. All requirements documented herein are derived from the project objectives defined in Chapter 1, the literature survey findings in Chapter 2, and iterative discussions with the project guide.

---

## 3.1 Assumptions and Dependencies

The following assumptions underpin the design and development of the Bharat E-Vote system. If any of these assumptions are invalidated during deployment, the corresponding system behaviour may require re-evaluation.

1. **Organizational Data Readiness:** It is assumed that the deploying organization maintains an accurate and up-to-date database of all eligible voters. This database must include, at minimum, the voter's full name, email address, and a unique identifier (Voter ID). The system relies on the `ApprovedVoter` whitelist table — populated by the administrator — as the authoritative source of voter eligibility.

2. **Administrative Supervision:** The system assumes the presence of a dedicated System Administrator who holds the Ethereum admin wallet (the address that deployed the smart contracts). This administrator is responsible for managing voter eligibility lists, creating elections, adding candidates, and controlling the election lifecycle (start/end voting). The administrator possesses operational control but cannot alter individual votes due to the immutability of blockchain transactions.

3. **Infrastructure Availability:** The system requires stable internet connectivity for all users during the voting period. The backend API server (Node.js/Express), the PostgreSQL database (Supabase), the Redis cache (Upstash), and at least one Ethereum node (Hardhat local or Sepolia testnet) must remain operational throughout the election window. Any downtime in these services will prevent new votes from being cast, though previously recorded on-chain votes remain immutable.

4. **User Capabilities and Hardware:** Voters are assumed to possess basic digital literacy sufficient to navigate a web-based interface, enter credentials, and confirm a MetaMask wallet transaction. Each voter's device must be equipped with a standard keyboard (for keystroke dynamics capture) and a modern web browser (Chrome, Firefox, Safari, or Edge) with the MetaMask extension installed.

5. **Cryptographic Integrity:** The system assumes that the underlying cryptographic primitives — SHA-256 hashing, bcrypt password hashing (cost factor 12), the secp256k1 elliptic curve used by Ethereum, and the Pedersen commitment scheme parameters (generators `g` and `h`) — remain computationally secure against known attack vectors for the duration of the election.

6. **Blockchain Network Stability:** The effectiveness of the system depends on the Ethereum network (Sepolia testnet or local Hardhat node) processing transactions within a predictable timeframe (~12–15 seconds for Sepolia, ~1 second for Hardhat). The smart contracts are assumed to execute deterministically, and the network consensus mechanism is assumed to be resistant to 51% attacks (a reasonable assumption for Ethereum's Proof-of-Stake consensus with 900,000+ validators).

---

## 3.2 Functional Requirements

### 3.2.1 User Authentication and Registration

This module ensures secure voter onboarding and identity verification through a multi-step process:

- **Voter Registration:** New voters submit their personal details (full name, email, Voter ID, Aadhaar number, father's name, gender, date of birth, mobile number, state code, constituency code, and residential address) through the `/api/v1/auth/register` endpoint. All inputs are sanitized against XSS attacks before storage.
- **Whitelist Enforcement:** Before registration is accepted, the system verifies that the voter's email exists in the `ApprovedVoter` table with status `WHITELIST`. If the email is not found, registration is rejected with error code `NOT_WHITELISTED`. If the status is `BLACKLIST`, registration is rejected with code `BLACKLISTED`.
- **Duplicate Prevention:** The system enforces uniqueness constraints on `email`, `voter_id`, and `aadhaar_number` at the database level (Prisma `@unique` constraints). Duplicate submissions return HTTP 409 (Conflict).
- **Password Security:** Passwords are hashed using bcrypt with a cost factor of 12 before storage. Plain-text passwords are never persisted or logged.
- **Two-Step MFA Login:** Login proceeds in two phases:
  - *Step 1 (Password Verification):* The voter submits their email/Voter ID and password. If valid, a 6-digit OTP is generated, hashed with bcrypt, and stored in the `MfaToken` table with a 5-minute expiry. The OTP is sent to the voter's registered email via the Resend email service. A `preAuthToken` (JWT, 10-minute expiry) is returned to the client.
  - *Step 2 (OTP Verification):* The voter submits the `preAuthToken` and the received OTP. The system verifies the OTP against the stored hash, checks expiry, and enforces a maximum of 5 failed attempts. Upon successful verification, a final JWT (20-minute expiry) is issued with single-active-session enforcement.
- **Single Active Session:** Only one active session per voter is permitted at any time. The `active_session_token` and `active_session_expires` fields in the `User` table enforce this constraint. A login attempt while an active session exists returns HTTP 403.

### 3.2.2 Blockchain Integration and Vote Recording

This module governs the interaction between the application layer and the Ethereum blockchain:

- **Smart Contract Deployment:** Three Solidity contracts are deployed via the Hardhat framework:
  - `VotingV2.sol` — Primary voting logic (candidate management, voter authorization, vote casting, result computation)
  - `ZKPVoting.sol` — Zero-Knowledge Proof voting extension (Pedersen commitments, nullifier tracking, proof verification)
  - `MinimalForwarder.sol` — ERC-2771 meta-transaction forwarder for gasless voting
- **Vote Immutability:** Once a vote is cast via the `vote()` function, it is recorded as a permanent state change on the blockchain. The transaction is included in a block and becomes part of the immutable ledger.
- **Secret Ballot Enforcement:** The `Voter` struct does NOT contain a `votedCandidateId` field. Only `hasVoted` (boolean), `lastCandidateId` (for re-voting decrements), and `voteVersion` are stored. The `VoteCast` event emits an obfuscated hash — `keccak256(candidateId, timestamp, prevrandao)` — not the raw candidate ID.
- **Admin Isolation:** The contract enforces `require(_msgSender() != admin)` in the `vote()` function, preventing the admin wallet from casting votes.

### 3.2.3 Secure Vote Casting with Proctored Window

This feature provides a tamper-resistant voting environment:

- **Proctored Window:** The `ProctorGuard.jsx` component activates during the vote casting process, implementing:
  - Tab-switch detection (warns voter if they navigate away)
  - Copy-paste prevention within the ballot area
  - Session timeout enforcement (auto-logout after inactivity)
  - Screenshot deterrence through CSS overlay techniques
- **Constituency Filtering:** When a voter accesses the ballot, only candidates matching their `stateCode` and `constituencyCode` are displayed. This filtering is enforced both at the frontend (display) and at the smart contract level (`require(voter.stateCode == candidate.stateCode)`).
- **Re-Voting Support:** Authorized voters may change their vote up to 3 times (`MAX_REVOTES = 3`). Each re-vote decrements the previous candidate's count and increments the new candidate's count. The re-voting window closes 30 minutes before `votingEndTime` to ensure clean final tallies.
- **Vote Receipt:** After successful vote casting, the voter receives a cryptographic receipt hash — `keccak256(voterAddress, chainId, "voted", voteVersion)` — which proves participation without revealing the candidate chosen.

### 3.2.4 Zero-Knowledge Proof Voting Mode

When ZKP mode is enabled by the admin (`setZKPMode(true)`), votes are cast through the `ZKPVoting.sol` contract using the following protocol:

- **Identity Commitment:** The voter generates a secret locally in the browser. The hash of this secret (`keccak256(secret)`) is registered on-chain by the admin as the voter's `identityCommitment`.
- **Pedersen Commitment:** The voter computes `C = hash(g^candidateId * h^randomness mod p)` locally using the `zkpService.js` client-side module. The commitment hides the candidate choice.
- **Nullifier Generation:** A deterministic nullifier `hash(secret, electionId)` is computed to prevent double voting without linking the voter's identity to the vote.
- **Proof Generation:** A Schnorr-style sigma proof is generated locally, proving knowledge of the commitment opening without revealing the candidate ID or randomness.
- **On-Chain Verification:** The `submitEncryptedVote()` function verifies: (a) the voter's identity commitment is registered, (b) the nullifier has not been used, and (c) the ZK proof passes `_verifyVoteProof()`. Only then is the vote recorded.
- **IPFS Metadata:** Encrypted vote metadata is optionally pinned to IPFS, with the content-addressed hash stored alongside the vote commitment for archival purposes.

### 3.2.5 Keystroke Dynamics Analysis

This module provides behavioural biometric verification:

- **Enrollment Phase:** During the voter's first several logins, the `KeystrokeDynamics.jsx` component captures typing timing data (key hold durations, inter-key flight times) and transmits it to the backend. The backend accumulates samples and computes a statistical profile (mean speed, standard deviation) stored in the `KeystrokeProfile` table.
- **Verification Phase:** Once the `is_enrolled` flag is set (after sufficient samples are collected), subsequent login attempts compare the current typing pattern against the enrolled profile. A distance score is computed; scores exceeding the threshold increment the `flagged_count` and generate an admin alert.
- **Continuous Monitoring:** Unlike traditional single-point authentication, keystroke dynamics provides session-level identity assurance — any significant deviation in typing behaviour during a session can trigger re-authentication.

### 3.2.6 Result Computation and Verification

- **On-Chain Tallying:** Vote counts are maintained as `voteCount` fields within the `Candidate` struct on-chain. The `getAllCandidates()` function returns an array of all candidates with their current vote counts. The `getWinner()` function iterates through all candidates and returns the one with the highest `voteCount`.
- **Vote Percentage:** The frontend `ResultsPage.jsx` computes `Vote%(C) = (Votes(C) / TotalVotes) × 100` for display in bar charts and pie charts using the Recharts library.
- **PDF Report Generation:** Administrators can export election results as PDF documents using the jsPDF library, including candidate-wise breakdowns and participation statistics.
- **Post-Election Email:** Upon election completion, automated result notification emails are dispatched to all registered voters with a summary of the election outcome.

### 3.2.7 Election Lifecycle Management

The admin dashboard (`AdminPanel.jsx`) provides complete control over the election lifecycle:

- **Election Creation:** Admins create elections with a name, description, instructions, start time, end time, and custom rules (JSON).
- **Candidate Management:** Candidates are added with full details (name, party name, party symbol, state code, constituency code). A mandatory NOTA (None of the Above) candidate is automatically injected.
- **Voter Authorization:** Admins authorize voters on-chain via `authorizeVoter()` or in batch via `authorizeVotersBatch()` (max 100 per transaction). Voter whitelist management is available through CSV upload.
- **Timeline Control:** Voting start and end times are set via `setVotingTimeline()`. The admin can start (`startVoting()`) and end (`endVoting()`) the election manually.
- **Audit Logging:** Every admin action (voter authorization, election creation, candidate addition, status changes) is logged to the `AdminAuditLog` table with timestamp, admin email, action type, details, and IP address.

### 3.2.8 Automated Email Notifications

The `electionNotifier.js` background service polls active elections and dispatches emails at three critical milestones:

| Trigger | Timing | Email Type |
|---------|--------|-----------|
| `REMINDER_24H` | 24 hours before election start | Reminder to all registered voters |
| `VOTING_STARTED` | When voting phase begins | Notification with ballot link |
| `LAST_CALL_30M` | 30 minutes before election end | Urgent last-call reminder |

Each notification type is sent only once per election, tracked via the `ElectionNotification` table with a `@@unique([election_id, type])` constraint.

---

## 3.3 External Interface Requirements

### 3.3.1 User Interfaces

The system provides three distinct user interfaces:

**1. Voter Interface (12 Pages)**

| Page | Component | Purpose |
|------|-----------|---------|
| Landing Page | `LandingPage.jsx` | National portal homepage with citizen services grid |
| Registration | `SignupPage.jsx` | New voter registration with Aadhaar validation |
| Login | `LoginPage.jsx` | Password + OTP two-step MFA login |
| Dashboard | `DashboardPage.jsx` | Voter home with election status and profile |
| Voting | `VotingPage.jsx` | Proctored ballot with candidate cards |
| Results | `ResultsPage.jsx` | Live vote counts with charts and graphs |
| Verify Vote | `VerifyVotePage.jsx` | ZKP vote verification and receipt lookup |
| Technology | `TechnologyPage.jsx` | Technical documentation for examiners |
| Help | `HelpPage.jsx` | FAQ and voter assistance |
| Admin Login | `AdminLoginPage.jsx` | Separate admin authentication portal |
| Admin Panel | `AdminPanel.jsx` | Full election management dashboard |
| 404 | `NotFoundPage.jsx` | Custom error page |

**2. Administrator Interface**
The admin panel provides tabbed sections for: Election Management, Candidate Management, Voter Authorization, Audit Logs, Violation Data, and System Monitoring.

**3. Auditor Interface**
The audit logs tab provides filterable, searchable records of all admin actions with transaction hashes linked to the blockchain explorer, CSV/JSON export capability, and timestamp correlation.

### 3.3.2 Hardware Interfaces

**Client-Side Requirements:**
- Desktop or laptop with minimum dual-core processor and 4GB RAM
- Standard keyboard for keystroke dynamics capture
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+) with MetaMask extension
- Stable internet connection (minimum 2 Mbps)

**Server-Side Requirements:**
- Node.js application server (v16+)
- PostgreSQL database (Supabase cloud or self-hosted)
- Redis instance for OTP caching and rate limiting (Upstash cloud or Docker)
- Ethereum node access (Hardhat local node or Sepolia/mainnet RPC provider)

---

## 3.4 Non-Functional Requirements

### 3.4.1 Performance Requirements

1. Login authentication (password verification + OTP generation) shall complete within 3 seconds under normal load.
2. Vote casting (frontend submission → MetaMask confirmation → blockchain finality) shall complete within 30 seconds on Sepolia testnet and within 2 seconds on Hardhat local node.
3. API response time for read operations (candidate list, voter status, results) shall remain below 200ms, monitored via Sentry Performance.
4. The system shall support a minimum of 100 concurrent authenticated users without degradation.
5. Database query response time shall remain below 100ms for indexed queries, enforced through Prisma connection pooling (connection_limit=3 on Supabase free tier).

### 3.4.2 Security Requirements

The system implements an eight-layer defence-in-depth security architecture:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| L1: Bot Protection | Cloudflare Turnstile | Block automated attacks and bot-driven vote stuffing |
| L2: IP Rate Limiting | express-rate-limit | Per-IP throttling (200 req/15min API, 20 req/15min auth) |
| L3: Distributed Rate Limiting | Upstash Redis | Sliding window rate limit across multiple server instances |
| L4: Authentication | Password + OTP + JWT | Three-factor identity verification |
| L5: Behavioural Biometric | Keystroke Dynamics | Continuous session-level identity assurance |
| L6: Authorization | Smart Contract RBAC | On-chain admin/voter role enforcement |
| L7: Input Validation | Express middleware | Payload size limiting (10KB), XSS sanitization |
| L8: Security Headers | Helmet.js | CSP, HSTS (1 year), X-Frame-Options, X-Content-Type-Options |

Additional security measures:
- Sentry real-time error monitoring with environment-specific DSN configuration
- PostHog analytics with session replay for security incident investigation
- Admin audit trail (`AdminAuditLog`) for all privileged operations
- Single-active-session enforcement preventing concurrent logins

### 3.4.3 Software Quality Attributes

| Attribute | Target | Implementation |
|-----------|--------|---------------|
| **Reliability** | 99.9% uptime during election window | Supabase managed PostgreSQL with automatic failover |
| **Usability** | WCAG AA compliance | aria-labels on all interactive elements, keyboard navigation, 200% zoom support, screen reader compatibility |
| **Maintainability** | Modular architecture | Separation of concerns (contracts / backend / frontend), Prisma schema migrations |
| **Portability** | Cross-browser, cross-platform | Tested on Chrome, Firefox, Safari, Edge; responsive CSS |
| **Testability** | >80% smart contract coverage | 85 automated tests across VotingV2 and ZKPVoting contracts |
| **Integrity** | Immutable vote records | Blockchain-backed storage; every state change emits a permanent event |
| **Transparency** | Public audit capability | All smart contract source code verified; events are publicly queryable |
| **Internationalization** | Multi-language support | i18next integration with language detection and translation files |

---

## 3.5 System Requirements

### 3.5.1 Database Requirements

**Primary Database — Supabase PostgreSQL:**
The system uses a PostgreSQL database hosted on Supabase, accessed through Prisma ORM. The schema comprises 14 relational models:

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `User` | Voter profiles and credentials | fullname, email, voter_id, aadhaar_number, wallet_address, role |
| `Election` | Election configuration | name, description, start_time, end_time, status (DRAFT→ACTIVE→CLOSED) |
| `ElectionCandidate` | Candidates per election | candidate_name, party_name, state_code, constituency_code |
| `ElectionVoter` | Voter-election enrollment | election_id, user_id, has_voted |
| `Vote` | Vote audit records | voter_id, election_id, tx_hash, voted_at |
| `AdminAuditLog` | Admin action trail | admin_email, action, details, ip_address |
| `LoginHistory` | Login attempt records | voter_id, ip_address, device_info, status |
| `MfaToken` | OTP storage | otp_hash, purpose, expires_at, attempts |
| `KeystrokeProfile` | Typing biometric data | hold_times, flight_times, mean_speed, std_deviation |
| `ApprovedVoter` | Voter whitelist | email, status (WHITELIST/BLACKLIST), added_by |
| `QrVoteTicket` | QR-code voting tickets | ticket_token, expires_at, used |
| `ElectionNotification` | Notification tracking | election_id, type, sent_count |
| `State` | Indian state codes | code, name, total_seats |
| `Constituency` | Constituency codes | code, state_code, name, voters_count |

**Blockchain Database — Ethereum Distributed Ledger:**
All vote records, candidate data, and voter authorization status are stored on-chain as smart contract state variables and emitted as indexed events.

**Caching Layer — Upstash Redis:**
Used for OTP temporary storage with auto-TTL (5-minute expiry), distributed rate limiting counters, and session caching.

### 3.5.2 Software Requirements

| Category | Technology | Version |
|----------|-----------|---------|
| **Blockchain Framework** | Hardhat | ^2.19.0 |
| **Smart Contract Language** | Solidity | ^0.8.19 |
| **Blockchain Library** | Ethers.js | ^6.9.0 |
| **Backend Runtime** | Node.js | v16+ |
| **Backend Framework** | Express.js | ^4.18.2 |
| **ORM** | Prisma Client | ^6.4.1 |
| **Database** | PostgreSQL (Supabase) | 14+ |
| **Cache** | Upstash Redis | Cloud |
| **Frontend Framework** | React | ^18.2.0 |
| **Build Tool** | Vite | ^8.0.2 |
| **CSS Framework** | TailwindCSS | ^3.4.0 |
| **Wallet Provider** | MetaMask | Latest |
| **Email Service** | Resend / Nodemailer | Latest |
| **Error Monitoring** | Sentry | ^10.46.0 |
| **Analytics** | PostHog | ^1.363.6 |
| **Bot Protection** | Cloudflare Turnstile | Latest |
| **IDE** | VS Code | Latest |
| **Version Control** | Git + GitHub | Latest |
| **API Testing** | Postman | Latest |
| **Testing Framework** | Hardhat Toolbox (Chai + Mocha) | ^4.0.0 |

### 3.5.3 Hardware Requirements

| Component | Specification |
|-----------|--------------|
| **Developer Workstation** | Intel i5/AMD Ryzen 5 or above, 8GB RAM, 256GB SSD |
| **Application Server** | 2+ vCPU, 4GB RAM, 20GB SSD (Render/Railway free tier or VPS) |
| **Database Server** | Supabase free tier (500MB storage, 50K monthly active users) |
| **Redis Instance** | Upstash free tier (10K commands/day) |
| **Blockchain Node** | Hardhat local node (runs on developer machine) or Alchemy/Infura Sepolia RPC |
| **Client Devices** | Dual-core processor, 4GB RAM, standard keyboard, modern browser with MetaMask |
| **Network** | Minimum 2 Mbps stable internet for voters; 10 Mbps for servers |

---

## 3.6 SDLC Model: Incremental Development

The Bharat E-Vote system was developed using the **Incremental Model** of the Software Development Life Cycle (SDLC). This model was chosen because the project involves multiple independent modules (authentication, voting, blockchain, ZKP, admin dashboard) that can be designed, developed, tested, and delivered in sequential increments.

### Why Incremental Model?

1. **Early Delivery:** Core voting functionality was delivered in the first increment, allowing early stakeholder feedback before advanced features (ZKP, keystroke dynamics) were implemented.
2. **Risk Reduction:** Each increment underwent independent testing, ensuring that defects were caught early before they could propagate across modules.
3. **Flexibility:** New requirements identified during development (e.g., re-voting mechanism, election notifications) were incorporated as additional increments without disrupting completed modules.
4. **Parallel Development:** Team members could work on separate increments concurrently (e.g., frontend and smart contracts developed in parallel).

### Increment Breakdown

| Increment | Module | Key Deliverables |
|-----------|--------|-----------------|
| **Increment 1** | Core Authentication | Voter registration, password hashing, JWT session management |
| **Increment 2** | Smart Contract Development | VotingV2.sol, deployment scripts, Hardhat test suite |
| **Increment 3** | Vote Casting & Results | Ballot interface, MetaMask integration, on-chain vote recording, result visualization |
| **Increment 4** | Admin Dashboard | Election lifecycle management, candidate CRUD, voter authorization, audit logs |
| **Increment 5** | MFA & Security Hardening | OTP-based two-step login, rate limiting, Helmet.js headers, Turnstile bot protection |
| **Increment 6** | ZKP Privacy Extension | ZKPVoting.sol, Pedersen commitments, Schnorr proofs, nullifier tracking |
| **Increment 7** | Advanced Features | Keystroke dynamics, QR vote tickets, meta-transactions, election notifications, i18n |
| **Increment 8** | Testing & Documentation | 85 unit tests, STRIDE threat model, project report, deployment documentation |

Each increment followed the standard phases: Requirements Analysis → Design → Implementation → Testing → Integration. Once an increment was completed and tested, it was integrated into the main system and the next increment began.

---
