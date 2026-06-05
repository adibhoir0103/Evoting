# Feature Specification: Blockchain-Based E-Voting Platform

**Feature Branch**: `001-blockchain-evoting-platform`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Build a blockchain-based e-voting platform
with multi-layer security, ZKP vote privacy, gasless meta-transactions,
coercion deterrence, and admin election management for national-scale
elections in India."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voter Registration & Authentication (Priority: P1)

A citizen registers on the platform by providing their personal details
(name, email, Aadhaar number, constituency). After admin approval, the
voter can log in using email/password, complete multi-factor
authentication via email OTP, and pass behavioral biometric verification
(keystroke dynamics). The system enforces a single active session per
voter to prevent credential sharing.

**Why this priority**: Without authenticated voters, no election can
proceed. This is the foundational gate for every downstream user flow.

**Independent Test**: A voter can register, receive admin approval,
log in with MFA, and reach their dashboard — all verifiable without
any election existing.

**Acceptance Scenarios**:

1. **Given** a new citizen, **When** they submit a valid registration
   form with Aadhaar, email, and constituency, **Then** the system
   creates an account in "pending approval" status and sends a
   confirmation email.
2. **Given** an approved voter, **When** they enter correct email and
   password, **Then** the system sends an OTP to their registered
   email for second-factor authentication.
3. **Given** a voter with a valid OTP, **When** they enter the OTP
   within the expiry window, **Then** they are authenticated and
   redirected to their voter dashboard.
4. **Given** a voter already logged in on another device, **When**
   they log in on a new device, **Then** the previous session is
   invalidated and only the new session remains active.
5. **Given** an inactive voter session, **When** the inactivity
   timeout elapses, **Then** the session is automatically terminated
   and the voter must re-authenticate.

---

### User Story 2 - Election Lifecycle Management by Admin (Priority: P1)

An election officer (admin) creates elections through a multi-step
wizard: defining election metadata (name, description, dates),
assigning constituencies, adding candidates with party affiliation
and symbols, and publishing the election. The admin can then open
voting, pause it for emergency situations, resume, and finally close
voting at the scheduled end time. After closing, results are
automatically tallied.

**Why this priority**: Elections are the core domain object. Without
election creation and lifecycle management, the platform has no
purpose.

**Independent Test**: An admin can create a draft election, add
candidates, publish, open, pause, resume, close, and view tallied
results — all verifiable with test voter data.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they complete the
   election creation wizard with valid data, **Then** the election
   is created in DRAFT status on the blockchain.
2. **Given** a DRAFT election, **When** the admin publishes it,
   **Then** the election moves to PUBLISHED status and eligible
   voters receive email notifications.
3. **Given** a PUBLISHED election at start time, **When** the admin
   opens voting, **Then** the election moves to ACTIVE status and
   voters can cast ballots.
4. **Given** an ACTIVE election, **When** the admin pauses voting,
   **Then** no new votes are accepted until voting resumes.
5. **Given** a CLOSED election, **When** results are tallied,
   **Then** candidate vote counts are available to all users with
   NOTA votes counted separately.

---

### User Story 3 - Secure Vote Casting (Priority: P1)

An authenticated voter navigates to an active election, views the
candidate list for their constituency, selects a candidate (or NOTA),
and submits their encrypted vote. The vote is recorded immutably on
the blockchain. The voter receives a cryptographic receipt (QR-based
vote ticket) that they can later use to verify their vote was counted
without revealing their candidate choice. Voters pay zero transaction
fees (gasless voting).

**Why this priority**: Vote casting is the primary value proposition.
Without it, the platform is a voter database with no electoral
function.

**Independent Test**: A voter can view candidates, cast a vote, receive
a receipt, and verify the vote — all verifiable with a single active
election.

**Acceptance Scenarios**:

1. **Given** an authenticated voter in an active election, **When**
   they view the voting page, **Then** they see candidates for their
   constituency including a NOTA option.
2. **Given** a voter selecting a candidate, **When** they confirm
   and submit their vote, **Then** the vote is encrypted, submitted
   to the blockchain, and a transaction hash is returned.
3. **Given** a successful vote submission, **When** the transaction
   is confirmed, **Then** the voter receives a QR-based vote ticket
   as a cryptographic receipt.
4. **Given** a voter casting a vote, **When** the blockchain records
   it, **Then** no gas fees are charged to the voter (the system
   relays the transaction).
5. **Given** a voter who has already voted, **When** they attempt to
   re-vote, **Then** the system allows up to 3 re-votes (coercion
   deterrence) and only the final vote counts.

---

### User Story 4 - Zero-Knowledge Proof Vote Privacy (Priority: P2)

When casting a vote, the system generates a cryptographic proof that
the vote is valid (the voter is authorized and the candidate exists)
without revealing which candidate was chosen. This proof is verified
on-chain before the vote is accepted. Even if blockchain transaction
data is publicly visible, the voter's candidate choice remains
mathematically private.

**Why this priority**: Privacy is critical for election integrity but
the core vote casting flow (US3) can function with basic encryption.
ZKP adds a stronger privacy guarantee layer.

**Independent Test**: A voter's ZKP proof can be generated client-side,
submitted with their vote, and verified on-chain — verifiable by
checking that the proof passes verification while the candidate choice
is not recoverable from the transaction data.

**Acceptance Scenarios**:

1. **Given** a voter about to cast a vote, **When** the system
   generates a zero-knowledge proof, **Then** the proof demonstrates
   vote validity without revealing the candidate choice.
2. **Given** a ZKP-accompanied vote submission, **When** the
   blockchain contract verifies the proof, **Then** the vote is
   accepted only if the proof is mathematically valid.
3. **Given** a completed election, **When** an auditor inspects
   blockchain transaction data, **Then** individual voter-candidate
   mappings cannot be derived from on-chain data.

---

### User Story 5 - Vote Verification & Results (Priority: P2)

After casting a vote, a voter can verify that their vote was correctly
recorded by using their QR vote ticket or transaction hash. The
verification confirms inclusion in the blockchain without revealing
the candidate choice. After an election closes, all users can view
aggregated results broken down by constituency, candidate, and party —
with NOTA counted as a distinct category.

**Why this priority**: Verifiability is essential for voter confidence
but depends on vote casting (US3) being functional first.

**Independent Test**: A voter can enter their receipt on the
verification page and confirm their vote is recorded; results page
shows accurate tallies after election close — both verifiable
independently.

**Acceptance Scenarios**:

1. **Given** a voter with a vote receipt, **When** they visit the
   verification page and enter their transaction hash, **Then** the
   system confirms the vote exists on the blockchain.
2. **Given** a closed election, **When** any user visits the results
   page, **Then** aggregated results are displayed per constituency
   with candidate names, party affiliations, and vote counts.
3. **Given** a closed election with NOTA votes, **When** results are
   displayed, **Then** NOTA is shown as a distinct category with
   its count.

---

### User Story 6 - Admin Voter Management & Audit (Priority: P2)

An admin manages the voter roll: approving pending registrations,
viewing voter status, and monitoring election participation. All
admin actions are logged in an immutable audit trail. The admin can
view login histories, OTP delivery logs, and support tickets.

**Why this priority**: Voter management is required for elections to
have authorized participants, but basic admin functionality depends
on the auth and election stories being in place.

**Independent Test**: An admin can approve/reject voter registrations,
view audit logs, and manage support tickets — verifiable without any
active election.

**Acceptance Scenarios**:

1. **Given** a pending voter registration, **When** an admin approves
   it, **Then** the voter's status changes to "approved" and they
   receive a notification email.
2. **Given** an admin viewing the audit log, **When** they filter by
   action type, **Then** all admin actions (voter approvals, election
   state changes) are listed with timestamps and IP addresses.
3. **Given** a voter submitting a support ticket, **When** an admin
   views it, **Then** they can reply and the voter receives the
   response via email.

---

### User Story 7 - Anti-Coercion & Proctoring (Priority: P3)

During vote casting, the system activates browser-level protections
that prevent tab switching, screen sharing, and other monitoring
vectors that could enable coercion. If a voter is forced to vote under
duress, they can re-vote up to 3 times before the election time-lock
expires, and only the final vote is counted. This mechanism neutralizes
"over-the-shoulder" coercion without the voter needing to report it.

**Why this priority**: Anti-coercion is a differentiation feature but
depends on vote casting (US3) being fully functional.

**Independent Test**: During a vote session, the proctor guard blocks
tab switches and alerts the voter; re-voting correctly overwrites
the previous vote — verifiable in a controlled test election.

**Acceptance Scenarios**:

1. **Given** a voter on the voting page, **When** they attempt to
   switch browser tabs, **Then** the system blocks the action and
   displays a warning.
2. **Given** a voter who has voted once, **When** they re-vote (up
   to 3 times), **Then** the previous vote is overwritten and only
   the latest vote is counted in the tally.
3. **Given** a voter who has re-voted 3 times, **When** they attempt
   a 4th re-vote, **Then** the system rejects the attempt and
   informs the voter their final vote is locked.

---

### Edge Cases

- What happens when a voter's OTP expires mid-authentication?
  → The voter must request a new OTP; expired tokens are rejected.
- How does the system handle a voter whose constituency is
  reassigned between elections?
  → Constituency assignment is per-election via ElectionVoter;
  changes take effect on the next election.
- What happens if the blockchain node is unreachable during
  vote submission?
  → The system shows a retry prompt with exponential backoff;
  the vote is not marked as cast until blockchain confirmation.
- How does the system handle concurrent re-vote attempts?
  → Blockchain nonce ordering ensures only one transaction
  succeeds; the client retries on nonce conflict.
- What happens when an election's end time passes while a voter
  is mid-vote?
  → If the vote transaction is submitted before close, it is
  accepted; otherwise the voter is informed the election has closed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow citizens to register with personal
  details and Aadhaar verification.
- **FR-002**: System MUST enforce multi-factor authentication
  (password + email OTP) for all voter logins.
- **FR-003**: System MUST enforce single active session per voter
  across all devices.
- **FR-004**: System MUST support behavioral biometric verification
  (keystroke dynamics) as an authentication factor.
- **FR-005**: System MUST allow admins to create elections with
  configurable candidates, constituencies, and time windows.
- **FR-006**: System MUST support the full election lifecycle:
  DRAFT → PUBLISHED → ACTIVE → CLOSED → ARCHIVED.
- **FR-007**: System MUST record votes immutably on a blockchain
  with cryptographic receipts.
- **FR-008**: System MUST provide gasless voting so voters incur
  zero transaction fees.
- **FR-009**: System MUST support NOTA (None of the Above) as a
  candidate option in every election.
- **FR-010**: System MUST allow voters to re-vote up to 3 times
  as a coercion deterrence mechanism.
- **FR-011**: System MUST generate zero-knowledge proofs for vote
  privacy (proof of valid vote without revealing choice).
- **FR-012**: System MUST provide vote verification via QR-based
  tickets and transaction hashes.
- **FR-013**: System MUST display aggregated election results by
  constituency after election closure.
- **FR-014**: System MUST log all admin actions in an auditable
  trail with timestamps and IP addresses.
- **FR-015**: System MUST send email notifications for election
  events (24h reminder, voting started, 30-min last call).
- **FR-016**: System MUST support browser-level anti-coercion
  protections during vote casting.
- **FR-017**: System MUST hash Aadhaar numbers before storage
  to protect personally identifiable information.
- **FR-018**: System MUST support internationalization for
  multi-language voter interfaces.

### Key Entities

- **Voter**: A citizen registered on the platform with identity
  credentials, constituency assignment, and authentication
  profile. Can be in pending/approved/rejected status.
- **Admin**: An election officer or super-admin who manages
  elections, voter rolls, and audit operations.
- **Election**: A time-bounded voting event with a lifecycle
  (draft through archived), assigned candidates and constituencies.
- **Candidate**: A participant in an election representing a
  political party in a specific constituency.
- **Vote**: An immutable record linking a voter's encrypted choice
  to a blockchain transaction, with cryptographic receipt.
- **Constituency**: An electoral division within a state, each
  with a unique code and assigned voters.
- **QR Vote Ticket**: A cryptographic receipt token issued after
  vote submission for later verification.
- **Audit Log**: An immutable record of admin actions with
  metadata (action type, timestamp, IP, actor).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Voters can complete the full registration-to-vote
  flow in under 10 minutes on first attempt.
- **SC-002**: System supports at least 1,000 concurrent voters
  casting ballots without degradation.
- **SC-003**: 100% of cast votes are verifiable via the
  verification page using the receipt.
- **SC-004**: Zero votes can be traced back to individual voters
  through publicly visible blockchain data.
- **SC-005**: Election results are available within 5 minutes of
  election closure.
- **SC-006**: All admin actions are logged with no gaps in the
  audit trail.
- **SC-007**: Voters experience zero transaction costs when
  casting votes.
- **SC-008**: The system correctly counts only the final vote
  when a voter re-votes (coercion deterrence).
- **SC-009**: Multi-factor authentication blocks unauthorized
  access with zero false positives for valid credentials.
- **SC-010**: The platform is accessible on mobile devices
  (360px viewport) and desktop (1920px viewport) without
  layout breakage.

## Assumptions

- Voters have access to a modern web browser with a compatible
  crypto wallet extension (e.g., MetaMask) installed.
- Voters have a valid Aadhaar number for identity verification.
- Voters have access to their registered email for OTP delivery.
- Admin users are pre-provisioned by the system (no self-service
  admin registration).
- The blockchain network (local or testnet) is operational and
  accessible during election periods.
- Internet connectivity is available to voters during the voting
  window (offline voting is out of scope).
- The platform is a proof-of-concept; production deployment
  requires upgraded cryptographic primitives (e.g., replacing
  simulated ZKP with Circom/Groth16).
- IPFS storage for candidate metadata is accessible via Pinata
  API during election setup.
