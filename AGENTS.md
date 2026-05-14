# AGENTS.md — Bharat E-Vote Project Context Graph
<!-- Last Updated: 2026-05-14 by Antigravity (Claude Opus 4.6 Thinking) -->
<!-- 
  PURPOSE: This file is the universal handoff document for AI coding agents.
  Any AI agent (Antigravity, Cursor, Copilot, Windsurf, Cline, Aider, etc.)
  should read this file FIRST to understand the project, its architecture,
  conventions, current state, and pending work items.
  
  HOW TO USE: Place this file in the project root. AI agents that support
  AGENTS.md, CLAUDE.md, .cursorrules, or similar conventions will
  auto-detect and read this file. For agents that don't auto-detect,
  instruct them to "read AGENTS.md first" in your prompt.
  
  KEEP UPDATED: After every significant work session, update the 
  "Session Log" and "Current State" sections so the next agent knows
  exactly where you left off.
-->

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Project Name** | Bharat E-Vote |
| **Type** | Blockchain-Based E-Voting Platform (Proof-of-Concept) |
| **Domain** | Election Security / Civic Tech |
| **Academic Context** | Savitribai Phule Pune University — B.E. Final Year Project |
| **Repository** | `c:\Users\HP\Downloads\evoting` |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    BHARAT E-VOTE                         │
├──────────────┬──────────────┬────────────────────────────┤
│   Frontend   │   Backend    │      Blockchain Layer      │
│  React+Vite  │  Express.js  │  Hardhat + Solidity 0.8.19 │
│  Tailwind    │  Prisma ORM  │  Voting.sol                │
│  Ethers.js   │  PostgreSQL  │  ZKPVoting.sol             │
│              │  Redis       │  MinimalForwarder.sol       │
└──────┬───────┴──────┬───────┴────────────┬───────────────┘
       │              │                    │
       │    REST API  │   JSON-RPC / ABI   │
       └──────────────┴────────────────────┘
```

### Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| **Frontend** | React + Vite | JSX, Tailwind CSS, Ethers.js v6 |
| **Backend** | Node.js + Express | Modular MVC (controllers + routes + middleware) |
| **Database** | PostgreSQL | Via Prisma ORM, Supabase-compatible |
| **Cache** | Upstash Redis | Session management, anti-N+1 polling |
| **Blockchain** | Hardhat + Solidity 0.8.19 | Localhost (chainId 1337) / Sepolia testnet |
| **Storage** | IPFS via Pinata | Candidate metadata |
| **Email** | Brevo (Sendinblue) API | OTPs and election notifications |
| **Auth** | JWT + bcrypt | Single active session enforcement |
| **Testing** | Hardhat test suite | Mocha/Chai for smart contracts |

---

## 3. Directory Map

```
evoting/                          # Monorepo root
├── AGENTS.md                     # ← THIS FILE (AI handoff context)
├── README.md                     # Setup guide
├── package.json                  # Root: Hardhat dependencies
├── hardhat.config.js             # Solidity compiler + network config
├── deployment-info.json          # Deployed contract addresses
│
├── contracts/                    # Solidity smart contracts
│   ├── Voting.sol                # Standard voting contract
│   ├── ZKPVoting.sol             # ZKP-enhanced voting (Schnorr simulation)
│   └── MinimalForwarder.sol      # ERC-2771 meta-transaction forwarder
│
├── scripts/                      # Deployment & test scripts
│   ├── deploy.js                 # Main deployment script
│   ├── cast-vote.js              # CLI vote casting helper
│   ├── open-election.js          # CLI election opener
│   ├── gen-wallet.js             # Wallet generator utility
│   ├── test-10-voters-results.js # Load test: 10 voters
│   ├── test-hardcore-voting.js   # Stress test
│   └── test-roles-and-flow.js    # Role-based flow test
│
├── test/                         # Smart contract unit tests
│   ├── Voting.test.js
│   └── ZKPVoting.test.js
│
├── backend/                      # Express.js API server
│   ├── server.js                 # ✅ Slim entry point (~143 lines)
│   ├── ecosystem.config.js       # PM2 production config
│   ├── package.json
│   ├── .env / .env.example
│   ├── prisma/
│   │   └── schema.prisma         # Database schema (17 models)
│   ├── controllers/              # Business logic (MVC)
│   │   ├── authController.js     # Auth, MFA, QR tickets, keystroke
│   │   ├── adminAuthController.js# Admin login + MFA
│   │   ├── voteController.js     # Vote recording + receipts
│   │   ├── zkpController.js      # ZKP generation + verification
│   │   ├── ipfsController.js     # IPFS pinning + retrieval
│   │   └── metaTxController.js   # ERC-2771 relay
│   ├── routes/                   # Route definitions
│   │   ├── authRoutes.js         # /api/v1/auth/*
│   │   ├── userRoutes.js         # /api/v1/user/*
│   │   ├── voteRoutes.js         # /api/v1/vote/*
│   │   ├── zkpRoutes.js          # /api/v1/zkp/*
│   │   ├── ipfsRoutes.js         # /api/v1/ipfs/*
│   │   ├── metaTxRoutes.js       # /api/v1/meta-tx/*
│   │   └── admin.js              # /api/v1/admin/* (elections, voters)
│   ├── middleware/               # Express middleware
│   │   ├── authenticate.js       # JWT + Redis session (voter + admin)
│   │   └── errorHandler.js       # asyncHandler + centralized errors
│   ├── utils/
│   │   └── helpers.js            # sanitize, validators, audit logger
│   ├── services/
│   │   ├── blockchainListener.js # On-chain event listener
│   │   ├── electionNotifier.js   # Scheduled email notifications
│   │   ├── emailService.js       # Brevo email integration
│   │   ├── ipfsService.js        # Pinata IPFS integration
│   │   ├── redisService.js       # Upstash Redis wrapper
│   │   └── zkpService.js         # Zero-knowledge proof service
│   ├── lib/
│   │   ├── logger.js             # Structured logging with HTTP stream
│   │   └── prisma.js             # Prisma client singleton
│   ├── tests/                    # Backend API tests
│   ├── uploads/                  # File upload storage
│   └── ipfs_mock/                # IPFS mock for local dev
│
├── frontend/                     # React + Vite SPA
│   ├── index.html                # Entry HTML
│   ├── vite.config.js            # Vite bundler config
│   ├── tailwind.config.js        # Tailwind CSS config
│   ├── vercel.json               # Vercel deployment config
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx               # Root component + React Router
│   │   ├── index.jsx             # Entry point
│   │   ├── index.css             # Global styles
│   │   ├── i18n.js               # Internationalization setup
│   │   ├── config/
│   │   │   └── api.js            # API base URL config
│   │   ├── contracts/            # ABI files + deployed addresses
│   │   │   ├── Voting.json
│   │   │   ├── ZKPVoting.json
│   │   │   └── contract-address.json
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx   # Public homepage
│   │   │   ├── LoginPage.jsx     # Voter login (MFA + Keystroke)
│   │   │   ├── SignupPage.jsx    # Voter registration
│   │   │   ├── DashboardPage.jsx # Voter dashboard
│   │   │   ├── VotingPage.jsx    # Vote casting UI
│   │   │   ├── ResultsPage.jsx   # Election results display
│   │   │   ├── VerifyVotePage.jsx# Vote verification
│   │   │   ├── AdminLoginPage.jsx# Admin authentication
│   │   │   ├── AdminPanel.jsx    # Admin dashboard
│   │   │   ├── TechnologyPage.jsx# Technical architecture showcase
│   │   │   ├── HelpPage.jsx      # User help/FAQ
│   │   │   └── NotFoundPage.jsx  # 404 page
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── ProctorGuard.jsx       # Anti-cheating browser lockdown
│   │   │   ├── QRVoteTicket.jsx       # QR-based vote ticket
│   │   │   ├── ZKPVerificationPanel.jsx # ZKP proof UI
│   │   │   ├── KeystrokeDynamics.jsx  # Behavioral biometrics
│   │   │   └── Admin/
│   │   │       ├── ElectionWizard.jsx # Multi-step election creation
│   │   │       ├── VoterRolls.jsx     # Voter management
│   │   │       └── AuditLogs.jsx      # Admin activity log
│   │   ├── services/
│   │   │   ├── authService.js         # JWT auth helpers
│   │   │   ├── blockchainService.js   # Ethers.js contract calls
│   │   │   ├── zkpService.js          # Client-side ZKP generation
│   │   │   ├── homomorphicService.js  # Homomorphic encryption sim
│   │   │   └── postQuantumService.js  # Post-quantum crypto sim
│   │   ├── hooks/
│   │   │   ├── useElectionTimer.js    # Election countdown hook
│   │   │   └── useInactivityTimer.js  # Session timeout hook
│   │   ├── utils/
│   │   │   ├── validators.js          # Form validation
│   │   │   ├── errorMessages.js       # User-facing error strings
│   │   │   ├── fetchWithRetry.js      # Resilient HTTP client
│   │   │   └── indianStates.js        # State/constituency data
│   │   ├── styles/
│   │   │   └── proctor-guard.css      # ProctorGuard styles
│   │   └── locales/                   # i18n translation files
│   └── public/                        # Static assets
│
├── subgraph/                     # The Graph protocol (indexing)
│   ├── schema.graphql
│   ├── subgraph.yaml
│   └── src/
│
├── artifacts/                    # Hardhat compilation output
├── cache/                        # Hardhat cache
│
├── main.tex                      # LaTeX project report (Blackbook)
├── research_paper.tex            # IEEE research paper
├── PROJECT_DOCUMENTATION.md      # Comprehensive project docs
├── PROJECT_REPORT_*.md           # Report chapters (markdown)
├── project_evaluation_report.md  # Evaluation metrics
├── testing_evaluation_report.md  # Testing report
└── Bharat-EVote.postman_collection.json  # API testing collection
```

---

## 4. Database Schema Summary (Prisma)

**17 models** defined in `backend/prisma/schema.prisma`:

| Model | Purpose | Key Fields |
|---|---|---|
| `User` | Voter/Admin accounts | voter_id, aadhaar_number, wallet_address, role (VOTER/SUPER_ADMIN/ELECTION_OFFICER/AUDITOR) |
| `Election` | Election lifecycle | status (DRAFT→PUBLISHED→ACTIVE→CLOSED→ARCHIVED), start/end times |
| `ElectionCandidate` | Candidates per election | state_code, constituency_code |
| `ElectionVoter` | Voter-election junction | has_voted flag |
| `Vote` | Vote records | tx_hash (blockchain), voter_id, election_id |
| `AdminAuditLog` | Admin action tracking | action, ip_address |
| `LoginHistory` | Login attempt tracking | device_info, status |
| `OtpDeliveryLog` | OTP send tracking | success, error_msg |
| `MfaToken` | Multi-factor auth tokens | otp_hash, purpose, expires_at |
| `QrVoteTicket` | QR-based vote tickets | ticket_token, expires_at, used |
| `KeystrokeProfile` | Behavioral biometrics | hold_times, flight_times, mean_speed |
| `ApprovedVoter` | Voter whitelist/blacklist | email, status |
| `SupportTicket` | Help desk tickets | issue_type, admin_reply |
| `State` | Indian states | code, name, total_seats |
| `Constituency` | Electoral constituencies | state_code, code, name |
| `ElectionNotification` | Notification tracking | type (REMINDER_24H, VOTING_STARTED, LAST_CALL_30M) |

---

## 5. Smart Contracts

### Voting.sol
- Standard election management (create, open, close, pause, tally)
- Role-based access: admin, election officers
- Supports NOTA (None of the Above) injection
- Re-voting capability (coercion deterrence: up to 3 re-votes)
- ERC-2771 meta-transaction support (gasless voting)

### ZKPVoting.sol
- Extended contract with **simulated Schnorr-like ZKP verification**
- Encrypted vote submissions with on-chain proof verification
- ⚠️ **Known Limitation**: Uses simulated ZKP, not production Circom/Groth16

### MinimalForwarder.sol
- ERC-2771 compliant trusted forwarder
- Enables gasless meta-transactions for voters

### Deployed Addresses (Localhost)
```json
{
  "Voting": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "ZKPVoting": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  "Forwarder": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
}
```

---

## 6. Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  SECURITY LAYERS                         │
├─────────────────────────────────────────────────────────┤
│ L1: Authentication    — JWT + bcrypt + MFA (Email OTP)  │
│ L2: Behavioral        — Keystroke Dynamics biometrics   │
│ L3: Session           — Single-session + Redis + Timeout│
│ L4: Anti-Coercion     — Re-voting (3x) + ProctorGuard  │
│ L5: Cryptographic     — ZKP (simulated Schnorr)        │
│ L6: Blockchain        — Ethereum immutability + events  │
│ L7: Anti-Tampering    — QR Vote Tickets + secretSalt   │
│ L8: Admin Audit       — Full audit trail logging        │
└─────────────────────────────────────────────────────────┘
```

### Known Limitations (Documented Intentionally)
1. **ZKP is simulated** — Not a real Circom/Groth16 circuit; acceptable for academic PoC
2. **Centralized voter onboarding** — Admin whitelists voters (no decentralized identity)
3. **MetaMask dependency** — Requires browser wallet extension
4. **Standard-mode privacy** — EVM events can leak vote metadata; mitigated with secretSalt hashing
5. ~~**Monolithic backend**~~ — **RESOLVED in Session 8**: `server.js` modularized to 143-line entry point

---

## 7. Coding Conventions

### General
- **Language**: JavaScript (ES6+), JSX for React, Solidity 0.8.19 for contracts
- **No TypeScript** — Entire codebase is plain JS
- **Formatting**: 2-space indentation, single quotes preferred
- **State management**: React `useState`/`useEffect` (no Redux/Zustand)
- **Routing**: React Router v6

### Backend
- **Modular MVC**: Controllers in `controllers/`, routes in `routes/`, middleware in `middleware/`
- **Entry point**: `server.js` is a slim ~143-line file (middleware + route mounting only)
- **Auth middleware**: Centralized in `middleware/authenticate.js` (shared by voter + admin)
- **Error handling**: Centralized via `middleware/errorHandler.js` + `asyncHandler` wrapper
- **Services**: Business logic in `backend/services/` directory
- **ORM**: All DB access through Prisma — never raw SQL

### Frontend
- **Page-based architecture**: Each page is self-contained in `src/pages/`
- **Shared components**: Navbar, Footer, ProctorGuard, etc. in `src/components/`
- **API calls**: Via `fetchWithRetry.js` utility with automatic retry logic
- **Blockchain calls**: Through `services/blockchainService.js` → Ethers.js v6
- **CSS**: Tailwind CSS + custom CSS for ProctorGuard

### Smart Contracts
- **OpenZeppelin**: Used for access control patterns
- **Solidity**: 0.8.19, optimizer enabled (200 runs)
- **Testing**: Hardhat test suite with Mocha/Chai

---

## 8. How to Run

```bash
# 1. Install dependencies
npm install                    # Root (Hardhat)
cd backend && npm install      # Backend
cd ../frontend && npm install  # Frontend

# 2. Database
cd backend
npx prisma db push             # Sync schema to PostgreSQL

# 3. Blockchain (Terminal 1)
npx hardhat node               # Start local chain

# 4. Deploy contracts (Terminal 2)  
npx hardhat run scripts/deploy.js --network localhost

# 5. Start backend (Terminal 3)
cd backend && node server.js   # Starts on port 5000

# 6. Start frontend (Terminal 4)
cd frontend && npm run dev     # Starts on port 5173
```

### Environment Variables Required
See `backend/.env.example` and root `.env.example` for full list.
Critical ones: `DATABASE_URL`, `JWT_SECRET`, `UPSTASH_REDIS_*`, `BREVO_API_KEY`, `PINATA_*`

---

## 9. Session Log — AI Agent Work History

<!-- 
  INSTRUCTIONS: After each AI work session, append a new entry below.
  Format:
  ### Session N — [Date] — [Agent Name]
  **Duration**: approximate
  **Task**: what was requested
  **Changes Made**: files modified/created
  **Status**: completed / partial / blocked
  **Next Steps**: what the next agent should do
-->

### Session 1 — 2026-04-18 — Antigravity (Claude)
**Task**: Implementing session security, wallet management, and election result email notifications  
**Changes Made**: Backend session enforcement, email service, election notifier, NOTA injection  
**Status**: ✅ Completed  

### Session 2 — 2026-04-24 — Antigravity (Claude)
**Task**: Creating comprehensive project report (Blackbook) for SPPU submission  
**Changes Made**: Generated `PROJECT_REPORT_*.md` files, `main.tex`  
**Status**: ✅ Completed  

### Session 3 — 2026-04-28 to 2026-04-30 — Antigravity (Claude)
**Task**: Peer-review remediation of Blackbook, technical accuracy corrections  
**Changes Made**: Rewrote Literature Survey, corrected Schnorr ZKP documentation, transparency edits  
**Status**: ✅ Completed  

### Session 4 — 2026-04-29 to 2026-04-30 — Antigravity (Claude)
**Task**: IEEE research paper drafting and finalization  
**Changes Made**: Created `research_paper.tex`  
**Status**: ✅ Completed  

### Session 5 — 2026-05-04 — Antigravity (Claude)
**Task**: Final production-readiness, Sepolia testnet config, architectural documentation  
**Changes Made**: Documented PoC boundaries in LaTeX, Sepolia deployment guide  
**Status**: ✅ Completed  

### Session 6 — 2026-05-08 — Antigravity (Claude)
**Task**: Enterprise-grade security audit (target score 85+)  
**Changes Made**: Aadhaar encryption, database indexing, security hardening  
**Status**: ✅ Completed  

### Session 7 — 2026-05-14 — Antigravity (Claude Opus 4.6)
**Task**: Created AGENTS.md project context graph for AI agent handoff  
**Changes Made**: Created `AGENTS.md`  
**Status**: ✅ Completed  

### Session 8 — 2026-05-14 — Antigravity (Claude Opus 4.6 Thinking)
**Task**: Full backend modularization, performance optimization, production readiness  
**Changes Made**:  
- Decomposed `server.js` from 1,624 → 143 lines  
- Created 6 controllers, 7 route files, 2 middleware, 1 utils module  
- Added `compression` (gzip) and `morgan` (HTTP logging) middleware  
- Created PM2 `ecosystem.config.js` for cluster-mode production  
- Centralized JWT/auth into `middleware/authenticate.js`  
- Added Aadhaar HMAC-SHA256 hashing in authController registration  
- Centralized error handling via `asyncHandler` + `errorHandler`  
**Status**: ✅ Completed  

### Session 9 — 2026-05-14 — Antigravity (Claude Opus 4.6 Thinking)
**Task**: Full technology stack audit + dependency upgrades + security remediation  
**Changes Made**:  
- Conducted comprehensive technology stack & architecture audit  
- Replaced event-loop-blocking `bcryptjs` with native `bcrypt` (High-Severity DoS fix)  
- Updated `authController.js` and `adminAuthController.js` require statements  
- Upgraded all backend deps: `express`, `cors`, `ethers`, `@sentry/node`, `@upstash/redis`, `jsonwebtoken`, `express-rate-limit`, `dotenv`  
- Upgraded all frontend deps: React 18→19, React Router 6→7, `axios`, `ethers`, `posthog-js`, `recharts`, `i18next`  
- Pinned Tailwind at v3.4.0 (v4 breaks `tailwind.config.js` and custom `gov-*` palette)  
- Pinned Prisma at v6.x (v7 requires TypeScript config — project is JS-only)  
- Pinned Hardhat at v2.x + installed `@nomicfoundation/hardhat-toolbox@hh2` (v3 requires ESM rewrite)  
- Verified: Frontend build ✅ | Prisma generate ✅ | 49/49 smart contract tests passing ✅  
**Status**: ✅ Completed  

---

## 10. Current State & Pending Work

### ✅ Completed
- [x] Full MERN + Blockchain architecture
- [x] Multi-layer security (JWT, MFA, Keystroke, ZKP, ProctorGuard)
- [x] Smart contract suite with tests
- [x] Admin panel with election wizard
- [x] Email notification system
- [x] QR Vote Ticket system
- [x] Aadhaar encryption (HMAC-SHA256 with pepper)
- [x] Database indexing optimization
- [x] Project report (LaTeX Blackbook)
- [x] IEEE research paper
- [x] Security audit (Score: 85+)
- [x] Backend modularization (MVC architecture)
- [x] Response compression (gzip) + HTTP logging (morgan)
- [x] PM2 production process management
- [x] Technology stack audit (principal-engineer level)
- [x] Dependency upgrades (all workspaces to latest compatible versions)
- [x] `bcryptjs` → native `bcrypt` (DoS vulnerability fix)

### 🔲 Potential Future Work (Not Started)
- [ ] Replace simulated ZKP with real Circom/Groth16 circuits
- [ ] Add TypeScript
- [ ] Production deployment (Vercel frontend + Railway backend + Sepolia mainnet)
- [ ] Mobile-responsive optimizations
- [ ] Accessibility (WCAG) audit
- [ ] Load testing with >100 concurrent voters
- [ ] CI/CD pipeline (GitHub Actions)

---

## 11. Critical Files — Quick Reference

> When an AI agent needs to make changes, these are the most commonly modified files:

| If you need to... | Edit this file |
|---|---|
| Add/modify auth routes | `backend/controllers/authController.js` + `backend/routes/authRoutes.js` |
| Add/modify vote routes | `backend/controllers/voteController.js` + `backend/routes/voteRoutes.js` |
| Add/modify admin routes | `backend/routes/admin.js` (elections, voters, stats) |
| Change auth middleware | `backend/middleware/authenticate.js` |
| Change database schema | `backend/prisma/schema.prisma` → run `npx prisma db push` |
| Add a new page | `frontend/src/pages/NewPage.jsx` + update `frontend/src/App.jsx` |
| Modify smart contract | `contracts/*.sol` → recompile → redeploy → update ABI JSONs in `frontend/src/contracts/` |
| Change blockchain interaction | `frontend/src/services/blockchainService.js` |
| Modify auth flow | `backend/controllers/authController.js` + `frontend/src/services/authService.js` |
| Update environment vars | `backend/.env` and/or root `.env` |
| Add email templates | `backend/services/emailService.js` |
| Change ZKP logic | `backend/controllers/zkpController.js` + `frontend/src/services/zkpService.js` |
| Run tests | `npx hardhat test` (from root) |

---

## 12. Common Pitfalls & Gotchas

1. **Modular backend** — Routes are in `routes/`, logic in `controllers/`, middleware in `middleware/`. `server.js` is just the entry point (~143 lines)
2. **Contract redeployment** — After modifying `.sol` files, you must: compile → deploy → copy new ABI to `frontend/src/contracts/` → update `contract-address.json`
3. **Prisma after schema changes** — Always run `npx prisma db push` AND `npx prisma generate` after editing `schema.prisma`
4. **MetaMask chain ID** — Must match `1337` for localhost or `11155111` for Sepolia
5. **Redis dependency** — Backend will fail to start without valid Upstash Redis credentials
6. **CORS** — Backend has CORS configured for `localhost:5173`; update if frontend port changes
7. **Single session enforcement** — Users can only be logged in from one device at a time

---

## 13. For the Next AI Agent

**Read this section before doing anything.**

1. **Read this entire file first** — It contains everything you need
2. **Check the Session Log** (Section 9) — See what was last done
3. **Check Current State** (Section 10) — See what's pending
4. **Follow the Coding Conventions** (Section 7) — Match existing patterns
5. **Update this file when done** — Add your session to the Session Log
6. **Don't break security** — This is a voting system; security regressions are unacceptable
7. **Test your changes** — Run `npx hardhat test` for contract changes, manual test for UI

---

*This file is the project's memory. Keep it updated.*
