# Tasks: Blockchain-Based E-Voting Platform

**Input**: Design documents from `specs/001-blockchain-evoting-platform/`

**Prerequisites**: plan.md (✅), spec.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅), quickstart.md (✅)

**Tests**: Smart contract tests are NON-NEGOTIABLE per Constitution Principle II. Backend/frontend tests are included where spec user stories define acceptance scenarios.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/` for server, `frontend/src/` for client
- **Blockchain**: `contracts/` for Solidity, `test/` for contract tests, `scripts/` for deployment

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependency installation, and build verification

- [x] T001 Install root dependencies with `npm install` in project root
- [x] T002 [P] Install backend dependencies with `npm install` in `backend/`
- [x] T003 [P] Install frontend dependencies with `npm install` in `frontend/`
- [x] T004 Configure environment variables by copying `backend/.env.example` to `backend/.env` and populating required values (DATABASE_URL, JWT_SECRET, UPSTASH_REDIS_*, BREVO_API_KEY, PINATA_*)
- [x] T005 Initialize database schema by running `npx prisma db push` in `backend/`
- [x] T006 Start local Hardhat node with `npx hardhat node`
- [x] T007 Deploy smart contracts with `npx hardhat run scripts/deploy.js --network localhost`
- [x] T008 Verify deployment-info.json contains correct addresses for Voting, ZKPVoting, and MinimalForwarder contracts
- [x] T009 [P] Copy contract ABIs from `artifacts/contracts/` to `frontend/src/contracts/` (Voting.json, ZKPVoting.json)
- [x] T010 [P] Update `frontend/src/contracts/contract-address.json` with deployed addresses from `deployment-info.json`

**Checkpoint**: All dependencies installed, database ready, contracts deployed, ABIs synced.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can proceed

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T011 Verify Prisma schema defines all 16 models in `backend/prisma/schema.prisma` matching data-model.md entities (User, Election, ElectionCandidate, ElectionVoter, Vote, QrVoteTicket, MfaToken, KeystrokeProfile, AdminAuditLog, LoginHistory, OtpDeliveryLog, ApprovedVoter, SupportTicket, State, Constituency, ElectionNotification)
- [x] T012 [P] Verify Prisma client singleton is configured in `backend/lib/prisma.js`
- [x] T013 [P] Verify structured logger is configured in `backend/lib/logger.js`
- [x] T014 [P] Verify Redis service wrapper is functional in `backend/services/redisService.js` with Upstash connection
- [x] T015 [P] Verify email service is functional in `backend/services/emailService.js` with Brevo API
- [x] T016 Verify JWT authentication middleware in `backend/middleware/authenticate.js` handles both voter and admin token validation with Redis session check
- [x] T017 [P] Verify centralized error handler in `backend/middleware/errorHandler.js` with asyncHandler wrapper
- [x] T018 [P] Verify rate limiter configurations in `backend/middleware/rateLimiter.js` (register: 5/15min, login: 10/15min, OTP: 5/5min, general: 100/min)
- [x] T019 [P] Verify Cloudflare Turnstile middleware in `backend/middleware/turnstile.js`
- [x] T020 Verify Express server entry point in `backend/server.js` mounts all middleware (cors, compression, hpp, morgan, helmet) and all route modules
- [x] T021 [P] Verify API base URL configuration in `frontend/src/config/api.js` points to backend
- [x] T022 [P] Verify fetchWithRetry utility in `frontend/src/utils/fetchWithRetry.js` handles retries with exponential backoff
- [x] T023 [P] Verify blockchain service in `frontend/src/services/blockchainService.js` connects to Ethers.js v6 with contract ABIs
- [x] T024 Verify React Router configuration in `frontend/src/App.jsx` defines routes for all 12 pages
- [x] T025 [P] Verify Tailwind CSS with gov-* custom palette in `frontend/tailwind.config.js`
- [x] T026 [P] Verify i18n setup in `frontend/src/i18n.js` with locale files in `frontend/src/locales/`

**Checkpoint**: Foundation ready — all services connected, middleware active, frontend scaffold verified. User story implementation can now begin.

---

## Phase 3: User Story 1 — Voter Registration & Authentication (Priority: P1) 🎯 MVP

**Goal**: Citizens can register, get admin approval, log in with MFA (password + OTP + keystroke biometrics), and reach their dashboard with single-session enforcement.

**Independent Test**: A voter registers → admin approves → voter logs in with MFA → reaches dashboard. Session is enforced across devices.

### Implementation for User Story 1

- [x] T027 [P] [US1] Verify User model in `backend/prisma/schema.prisma` includes all fields: voter_id, name, email, password (bcrypt), aadhaar_number (HMAC-SHA256), wallet_address, phone, state_code, constituency_code, role enum, is_verified
- [x] T028 [P] [US1] Verify MfaToken model in `backend/prisma/schema.prisma` includes: user_id FK, otp_hash, purpose, expires_at, used
- [x] T029 [P] [US1] Verify KeystrokeProfile model in `backend/prisma/schema.prisma` includes: user_id FK (unique), hold_times JSON, flight_times JSON, mean_speed, sample_count
- [x] T030 [P] [US1] Verify LoginHistory model in `backend/prisma/schema.prisma` includes: user_id FK, device_info, ip_address, status, created_at
- [x] T031 [US1] Verify registration endpoint in `backend/controllers/authController.js` — POST /api/v1/auth/register: validates input, hashes password with bcrypt, hashes Aadhaar with HMAC-SHA256+pepper, creates User in pending status, sends confirmation email via emailService
- [x] T032 [US1] Verify login endpoint (Step 1) in `backend/controllers/authController.js` — POST /api/v1/auth/login: validates credentials, checks keystroke biometrics, generates OTP, sends via email, stores hashed OTP in MfaToken
- [x] T033 [US1] Verify OTP verification endpoint (Step 2) in `backend/controllers/authController.js` — POST /api/v1/auth/verify-otp: validates OTP against MfaToken, issues JWT, stores session in Redis (single-session enforcement), logs in LoginHistory
- [x] T034 [US1] Verify logout endpoint in `backend/controllers/authController.js` — POST /api/v1/auth/logout: clears Redis session, invalidates JWT
- [x] T035 [US1] Verify password reset endpoints in `backend/controllers/authController.js` — POST /api/v1/auth/forgot-password and /reset-password: sends reset OTP, validates, updates password, invalidates ALL active sessions
- [x] T036 [US1] Verify auth routes are mounted in `backend/routes/authRoutes.js` with rate limiters and Turnstile middleware on register/login
- [x] T037 [US1] Verify keystroke dynamics component in `frontend/src/components/KeystrokeDynamics.jsx` captures hold_times and flight_times during login
- [x] T038 [P] [US1] Verify signup page in `frontend/src/pages/SignupPage.jsx` renders registration form with fields: name, email, password, Aadhaar, phone, state, constituency + Turnstile widget
- [x] T039 [P] [US1] Verify login page in `frontend/src/pages/LoginPage.jsx` renders email/password form with OTP step, keystroke capture, and autoComplete="new-password" for biometrics
- [x] T040 [US1] Verify dashboard page in `frontend/src/pages/DashboardPage.jsx` displays voter profile, eligible elections, and vote history after successful login
- [x] T041 [US1] Verify inactivity timer hook in `frontend/src/hooks/useInactivityTimer.js` auto-terminates session after timeout
- [x] T042 [US1] Verify auth service in `frontend/src/services/authService.js` handles JWT storage, token refresh, and session management

**Checkpoint**: Voter can register → get approved → login with MFA → reach dashboard → session enforced. US1 is independently functional and testable.

---

## Phase 4: User Story 2 — Election Lifecycle Management (Priority: P1)

**Goal**: Admin creates elections via wizard, manages lifecycle (DRAFT → PUBLISHED → ACTIVE → PAUSED → CLOSED → ARCHIVED), adds candidates with constituencies, triggers notifications.

**Independent Test**: Admin logs in → creates election → adds candidates → publishes → opens voting → pauses/resumes → closes → views tallied results.

### Implementation for User Story 2

- [x] T043 [P] [US2] Verify Election model in `backend/prisma/schema.prisma` with status enum (DRAFT, PUBLISHED, ACTIVE, PAUSED, CLOSED, ARCHIVED), start_time, end_time, contract_address
- [x] T044 [P] [US2] Verify ElectionCandidate model with election_id FK, name, party, symbol, photo_url, manifesto_url, state_code, constituency_code, is_nota
- [x] T045 [P] [US2] Verify ElectionNotification model with election_id FK, type enum (REMINDER_24H, VOTING_STARTED, LAST_CALL_30M), sent_at
- [x] T046 [US2] Verify admin authentication in `backend/controllers/adminAuthController.js` — POST /api/v1/admin/login and /verify-otp with admin role validation
- [x] T047 [US2] Verify election CRUD in `backend/controllers/adminController.js` — create, read, update elections with status validation and state transition enforcement (DRAFT→PUBLISHED→ACTIVE↔PAUSED→CLOSED→ARCHIVED)
- [x] T048 [US2] Verify candidate management in `backend/controllers/adminController.js` — add/remove candidates per election per constituency, auto-inject NOTA candidate on publish
- [x] T049 [US2] Verify election lifecycle actions in `backend/controllers/adminController.js` — publish, open, pause, resume, close operations with smart contract state sync
- [x] T050 [US2] Verify admin dashboard stats endpoint in `backend/controllers/adminController.js` — GET /api/v1/admin/dashboard/stats returns election counts, voter counts, recent activity
- [x] T051 [US2] Verify admin routes are mounted in `backend/routes/admin.js` with admin auth middleware on all routes
- [x] T052 [US2] Verify election notifier service in `backend/services/electionNotifier.js` sends scheduled emails (24h reminder, voting started, 30-min last call)
- [x] T053 [US2] Verify IPFS service in `backend/services/ipfsService.js` pins candidate metadata (photos, manifestos) to Pinata
- [x] T054 [US2] Verify blockchain listener service in `backend/services/blockchainListener.js` listens for on-chain election events (ElectionCreated, ElectionOpened, ElectionClosed)
- [x] T055 [P] [US2] Verify admin login page in `frontend/src/pages/AdminLoginPage.jsx` with MFA flow
- [x] T056 [US2] Verify admin panel in `frontend/src/pages/AdminPanel.jsx` renders dashboard with election management, voter management, and audit log tabs
- [x] T057 [US2] Verify election wizard component in `frontend/src/components/Admin/ElectionWizard.jsx` implements multi-step creation: metadata → constituencies → candidates → review → publish
- [x] T058 [P] [US2] Verify voter rolls component in `frontend/src/components/Admin/VoterRolls.jsx` displays voter list with approval/rejection actions

**Checkpoint**: Admin can create, configure, and manage the full election lifecycle. Notifications are sent. US2 is independently functional.

---

## Phase 5: User Story 3 — Secure Vote Casting (Priority: P1) 🎯 Core

**Goal**: Authenticated voters view candidates, cast encrypted votes on blockchain via gasless meta-transactions, receive QR receipts, and can re-vote up to 3 times for coercion deterrence.

**Independent Test**: Voter views candidates → selects candidate → vote encrypted and submitted to blockchain → gasless (no ETH required) → receives QR receipt → re-vote works up to 3 times.

### Smart Contract Tests (NON-NEGOTIABLE per Constitution Principle II) ⚠️

- [x] T059 [P] [US3] Verify vote casting tests in `test/Voting.test.js` cover: happy path vote, access control (only eligible voters), re-vote up to 3 times, reject 4th re-vote, NOTA vote counting, election-not-active rejection
- [x] T060 [P] [US3] Verify meta-transaction tests cover: gasless vote via MinimalForwarder, signature verification, nonce replay protection

### Implementation for User Story 3

- [x] T061 [P] [US3] Verify Vote model in `backend/prisma/schema.prisma` with voter_id FK, election_id FK, tx_hash (unique), block_number, encrypted_vote, secret_salt
- [x] T062 [P] [US3] Verify QrVoteTicket model with voter_id FK, election_id FK, ticket_token (unique), tx_hash, expires_at, used flag
- [x] T063 [P] [US3] Verify ElectionVoter model with election_id FK, voter_id FK, has_voted flag, vote_count (max 3)
- [x] T064 [US3] Verify vote casting in `backend/controllers/voteController.js` — POST /api/v1/vote/cast: validates election is ACTIVE, voter is eligible, vote_count < 3, records Vote with tx_hash, generates QrVoteTicket, updates ElectionVoter
- [x] T065 [US3] Verify meta-transaction relay in `backend/controllers/metaTxController.js` — POST /api/v1/meta-tx/relay: validates EIP-712 signature, relays transaction via MinimalForwarder contract
- [x] T066 [US3] Verify vote routes in `backend/routes/voteRoutes.js` and meta-tx routes in `backend/routes/metaTxRoutes.js` with auth middleware
- [x] T067 [US3] Verify Voting.sol contract in `contracts/Voting.sol` implements: createElection, addCandidate, openElection, vote (with secretHash), getResults, re-vote up to 3 times, NOTA support, ERC-2771 trusted forwarder
- [x] T068 [US3] Verify MinimalForwarder.sol in `contracts/MinimalForwarder.sol` implements ERC-2771: execute, verify, getNonce with EIP-712 signature validation
- [x] T069 [US3] Verify voting page in `frontend/src/pages/VotingPage.jsx` displays candidate list for voter's constituency, selection UI, vote confirmation modal, and submission with MetaMask signing
- [x] T070 [US3] Verify blockchain service in `frontend/src/services/blockchainService.js` handles: connect wallet, sign meta-transaction, submit vote via forwarder, listen for transaction confirmation
- [x] T071 [US3] Verify QR vote ticket component in `frontend/src/components/QRVoteTicket.jsx` generates and displays QR code from ticket_token for receipt

**Checkpoint**: Voters can cast gasless votes on blockchain with re-voting and QR receipts. 49+ contract tests pass. US3 is the core voting flow.

---

## Phase 6: User Story 4 — Zero-Knowledge Proof Vote Privacy (Priority: P2)

**Goal**: Votes are accompanied by ZKP proving validity without revealing candidate choice. Proofs are verified on-chain.

**Independent Test**: ZKP proof generated client-side → submitted with vote → verified on ZKPVoting contract → candidate choice not recoverable from tx data.

### Smart Contract Tests ⚠️

- [x] T072 [P] [US4] Verify ZKP tests in `test/ZKPVoting.test.js` cover: valid proof acceptance, invalid proof rejection, proof commitment uniqueness, encrypted vote storage

### Implementation for User Story 4

- [x] T073 [US4] Verify ZKPVoting.sol in `contracts/ZKPVoting.sol` implements: submitEncryptedVote with simulated Schnorr proof verification, proofCommitments mapping, encryptedVotes mapping
- [x] T074 [US4] Verify ZKP controller in `backend/controllers/zkpController.js` — POST /api/v1/zkp/generate and /verify endpoints
- [x] T075 [US4] Verify ZKP service in `backend/services/zkpService.js` implements server-side Schnorr-like proof generation and verification
- [x] T076 [US4] Verify ZKP routes in `backend/routes/zkpRoutes.js` with auth middleware
- [x] T077 [US4] Verify client-side ZKP service in `frontend/src/services/zkpService.js` generates Schnorr-like proof parameters (commitment, challenge, response)
- [x] T078 [US4] Verify ZKP verification panel in `frontend/src/components/ZKPVerificationPanel.jsx` displays proof generation status and verification result to voter

**Checkpoint**: ZKP proofs are generated, submitted, and verified on-chain. Vote privacy is preserved. US4 extends US3 with stronger privacy.

---

## Phase 7: User Story 5 — Vote Verification & Results (Priority: P2)

**Goal**: Voters verify their vote via QR receipt/tx hash. Public results displayed after election close with per-constituency breakdown.

**Independent Test**: Voter enters receipt on verification page → confirmed on blockchain. After election close → results page shows accurate tallies with NOTA.

### Implementation for User Story 5

- [x] T079 [US5] Verify vote verification endpoint in `backend/controllers/voteController.js` — GET /api/v1/vote/verify/:txHash: checks blockchain for transaction existence and confirmation
- [x] T080 [US5] Verify vote receipt endpoint in `backend/controllers/voteController.js` — GET /api/v1/vote/receipt/:electionId: returns QrVoteTicket for the authenticated voter
- [x] T081 [US5] Verify results endpoint — GET /api/v1/admin/elections/:id/results returns aggregated vote counts per candidate per constituency with NOTA counted separately
- [x] T082 [US5] Verify verify vote page in `frontend/src/pages/VerifyVotePage.jsx` accepts tx hash or QR scan input, displays verification status (confirmed/pending/not found)
- [x] T083 [US5] Verify results page in `frontend/src/pages/ResultsPage.jsx` displays election results with candidate names, parties, vote counts, constituency breakdown, and NOTA tally using recharts for visualization

**Checkpoint**: Vote verification and results display fully functional. US5 is independently testable after any election closes.

---

## Phase 8: User Story 6 — Admin Voter Management & Audit (Priority: P2)

**Goal**: Admin manages voter approvals, views audit trails, handles support tickets.

**Independent Test**: Admin approves pending voter → voter notified. Admin views audit log → all actions listed. Support ticket flow works.

### Implementation for User Story 6

- [x] T084 [P] [US6] Verify ApprovedVoter model in `backend/prisma/schema.prisma` with email, status enum (APPROVED, REJECTED, PENDING)
- [x] T085 [P] [US6] Verify AdminAuditLog model with admin_id, action, target_type, target_id, details JSON, ip_address
- [x] T086 [P] [US6] Verify SupportTicket model with user_id FK, issue_type, description, admin_reply, status
- [x] T087 [US6] Verify voter management endpoints in `backend/controllers/adminController.js` — GET /api/v1/admin/voters (list with filters), POST /approve/:id, POST /reject/:id with email notification on status change
- [x] T088 [US6] Verify audit log endpoint in `backend/controllers/adminController.js` — GET /api/v1/admin/audit-logs with filtering by action type, date range, admin_id
- [x] T089 [US6] Verify support ticket endpoints in `backend/controllers/adminController.js` — GET /api/v1/admin/support-tickets, POST /:id/reply with email notification to voter
- [x] T090 [US6] Verify audit helper in `backend/utils/helpers.js` logs all admin actions to AdminAuditLog with IP address extraction
- [x] T091 [US6] Verify audit logs component in `frontend/src/components/Admin/AuditLogs.jsx` displays filterable admin action history

**Checkpoint**: Admin can manage voters and review audit trail. US6 is independently functional.

---

## Phase 9: User Story 7 — Anti-Coercion & Proctoring (Priority: P3)

**Goal**: ProctorGuard blocks tab switching during vote casting. Re-voting (up to 3×) neutralizes coercion. Only final vote counts.

**Independent Test**: ProctorGuard activates on voting page → tab switch blocked. Re-vote overwrites previous vote. 4th re-vote rejected.

### Implementation for User Story 7

- [x] T092 [US7] Verify ProctorGuard component in `frontend/src/components/ProctorGuard.jsx` implements: tab visibility change detection, fullscreen enforcement, screen capture prevention, warning overlay on violation
- [x] T093 [US7] Verify ProctorGuard CSS in `frontend/src/styles/proctor-guard.css` styles the warning overlay and lockdown UI
- [x] T094 [US7] Verify VotingPage.jsx wraps the voting flow with ProctorGuard when election is active
- [x] T095 [US7] Verify re-vote logic in `contracts/Voting.sol` — voter.voteCount tracks re-votes, previous candidateId voteCount decremented, new candidateId voteCount incremented, max 3 enforced
- [x] T096 [US7] Verify re-vote UX in `frontend/src/pages/VotingPage.jsx` — voter sees re-vote option with remaining count, confirmation dialog warns this is final after 3rd re-vote

**Checkpoint**: Anti-coercion protections fully active. ProctorGuard and re-voting work together. US7 extends US3 with security layer.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T097 [P] Verify Navbar component in `frontend/src/components/Navbar.jsx` shows correct navigation links based on auth state (guest/voter/admin)
- [x] T098 [P] Verify Footer component in `frontend/src/components/Footer.jsx` renders on all pages
- [x] T099 [P] Verify landing page in `frontend/src/pages/LandingPage.jsx` showcases platform features, security architecture, and call-to-action
- [x] T100 [P] Verify technology page in `frontend/src/pages/TechnologyPage.jsx` explains the blockchain/ZKP architecture for voters
- [x] T101 [P] Verify help page in `frontend/src/pages/HelpPage.jsx` provides FAQ and support ticket submission
- [x] T102 [P] Verify 404 page in `frontend/src/pages/NotFoundPage.jsx` renders for unknown routes
- [x] T103 Verify all pages render correctly on 360px (mobile) and 1920px (desktop) viewports per Constitution Principle III
- [x] T104 Verify all user-facing strings use i18n translation keys from `frontend/src/locales/` — no hardcoded English in JSX
- [x] T105 Verify error messages from `frontend/src/utils/errorMessages.js` are used consistently across all API error handlers
- [x] T106 Verify form validation in `frontend/src/utils/validators.js` covers: email RFC 5322, Aadhaar 12-digit, password strength, wallet address format
- [x] T107 Verify Indian states/constituencies data in `frontend/src/utils/indianStates.js` is complete
- [x] T108 Run full smart contract test suite with `npx hardhat test` — verify 49+ tests passing
- [x] T109 Run frontend production build with `cd frontend && npm run build` — verify zero errors, bundle < 500KB gzipped
- [x] T110 Run `npm audit` in both root and backend — verify zero critical vulnerabilities
- [x] T111 Verify quickstart.md steps by following `specs/001-blockchain-evoting-platform/quickstart.md` end-to-end on a clean setup

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — Registration & Auth
- **US2 (Phase 4)**: Depends on Foundational — Election Management
- **US3 (Phase 5)**: Depends on US1 (voters must exist) + US2 (elections must exist)
- **US4 (Phase 6)**: Depends on US3 (extends vote casting with ZKP)
- **US5 (Phase 7)**: Depends on US3 (votes must exist to verify/tally)
- **US6 (Phase 8)**: Depends on US1 (voters to manage) + US2 (elections for audit context)
- **US7 (Phase 9)**: Depends on US3 (extends voting page with proctoring)
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

```
          ┌─── US1 (Auth) ───┐
          │                   │
Setup → Foundational ─┤      ├─── US3 (Voting) ──┬── US4 (ZKP)
          │                   │                    ├── US5 (Results)
          └─── US2 (Elections)┘                    └── US7 (Proctor)
                    │
                    └─── US6 (Audit) ──── (also needs US1)
```

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel (different directories)
- **Phase 2**: T012-T019 are mostly parallelizable (independent modules)
- **Phase 3 & 4**: US1 and US2 can run in parallel after Foundational
- **Phase 5**: US3 requires both US1 and US2 complete
- **Phase 6-9**: US4, US5, US6, US7 can all run in parallel after US3

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Voter Auth (P1)
4. Complete Phase 4: US2 — Election Management (P1) ← can parallel with US1
5. Complete Phase 5: US3 — Secure Vote Casting (P1)
6. **STOP and VALIDATE**: Full voting flow testable end-to-end
7. Deploy/demo if ready — this is MVP!

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US2 → Auth + Elections (can demo admin flow)
3. Add US3 → Voting works → **MVP Demo!**
4. Add US4 → ZKP privacy layer
5. Add US5 → Verification + Results
6. Add US6 → Audit trail
7. Add US7 → Anti-coercion protections
8. Polish → Production-ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Smart contract tests (T059, T060, T072) are NON-NEGOTIABLE per Constitution Principle II
- Constitution Principle V mandates all 8 security layers remain intact
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing codebase has 11 sessions of work — tasks are primarily verification-oriented since the platform is substantially built
