# Implementation Plan: Blockchain-Based E-Voting Platform

**Branch**: `001-blockchain-evoting-platform` | **Date**: 2026-05-26 | **Spec**: [spec.md](file:///c:/Users/HP/Desktop/evoting/specs/001-blockchain-evoting-platform/spec.md)

**Input**: Feature specification from `specs/001-blockchain-evoting-platform/spec.md`

## Summary

Build a blockchain-based e-voting platform (Bharat E-Vote) for
national-scale elections in India. The platform enables citizens to
register, authenticate via multi-factor mechanisms (password + OTP +
keystroke biometrics), and cast encrypted votes recorded immutably on
Ethereum smart contracts. Admins manage the full election lifecycle
(DRAFT → ACTIVE → CLOSED). The system provides gasless voting via
ERC-2771 meta-transactions, coercion deterrence via re-voting, and
vote privacy via simulated Schnorr-like ZKP. The tech stack is a
monorepo with React+Vite frontend, Express.js backend with Prisma ORM
and PostgreSQL, Hardhat + Solidity smart contracts, Upstash Redis for
session caching, IPFS (Pinata) for candidate metadata, and Brevo for
email notifications.

## Technical Context

**Language/Version**: JavaScript (ES6+), JSX for React, Solidity 0.8.19

**Primary Dependencies**:
- Frontend: React 19, Vite, Tailwind CSS 3.4.x, Ethers.js v6,
  React Router v7, i18next, recharts, posthog-js
- Backend: Express.js, Prisma ORM v6.x, bcrypt (native), jsonwebtoken,
  cors, compression, morgan, express-rate-limit, hpp, axios
- Blockchain: Hardhat v2.x, @nomicfoundation/hardhat-toolbox,
  OpenZeppelin Contracts, @openzeppelin/contracts
- Services: @upstash/redis, Brevo (Sendinblue) API, Pinata IPFS SDK

**Storage**: PostgreSQL via Prisma ORM (16 models), Upstash Redis for
session/cache, IPFS via Pinata for candidate metadata

**Testing**: Hardhat test suite (Mocha/Chai) — 49+ smart contract tests

**Target Platform**: Web application (modern browsers with MetaMask
extension), Node.js v18+ server

**Project Type**: Web application (monorepo: frontend + backend +
blockchain layer)

**Performance Goals**: API < 200ms p95, LCP < 2.5s on 4G, 1,000
concurrent voters, < 500KB gzipped frontend bundle

**Constraints**: No TypeScript (plain JS only), Prisma pinned at v6.x,
Hardhat at v2.x, Tailwind at v3.4.x, single active session per user,
gasless voting required

**Scale/Scope**: Proof-of-concept for national elections, ~12 pages,
16 database models, 3 smart contracts, 7 route modules, 7 controllers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|---|---|---|
| I | Modular MVC Architecture | ✅ PASS | Backend uses controllers/, routes/, middleware/, services/ separation. No file exceeds 500 lines. server.js is 143 lines. |
| II | Test-First for Smart Contracts | ✅ PASS | 49/49 tests passing in test/Voting.test.js and test/ZKPVoting.test.js. Mocha/Chai framework. |
| III | User Experience Consistency | ✅ PASS | Tailwind gov-* palette, i18n via i18next, fetchWithRetry for API calls, errorMessages.js for user-facing errors. |
| IV | Performance & Scalability | ✅ PASS | compression middleware active, Prisma @@index directives on hot fields, Redis for session lookups. |
| V | Security-by-Default | ✅ PASS | 8-layer security: JWT+bcrypt+MFA, Redis sessions, input sanitization, rate limiting, Turnstile, ProctorGuard, audit logs, HPP+CORS+Helmet. |
| VI | Blockchain Integrity | ✅ PASS | deployment-info.json synced with frontend contract-address.json, events emitted, secretSalt hashing, MinimalForwarder for gasless tx. |
| VII | Simplicity & YAGNI | ✅ PASS | Plain JS, useState/useEffect only, Prisma ORM only, versions pinned per Session 9 audit. |

**Result**: All 7 gates pass. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-blockchain-evoting-platform/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── api-endpoints.md
│   └── smart-contracts.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── server.js                 # Express entry point (143 lines)
├── prisma/
│   └── schema.prisma         # 16 database models
├── controllers/
│   ├── authController.js     # Voter auth, MFA, keystroke
│   ├── adminAuthController.js# Admin login + MFA
│   ├── adminController.js    # Election & voter management
│   ├── voteController.js     # Vote recording + receipts
│   ├── zkpController.js      # ZKP generation + verification
│   ├── ipfsController.js     # IPFS pinning + retrieval
│   └── metaTxController.js   # ERC-2771 relay
├── routes/
│   ├── authRoutes.js         # /api/v1/auth/*
│   ├── userRoutes.js         # /api/v1/user/*
│   ├── voteRoutes.js         # /api/v1/vote/*
│   ├── zkpRoutes.js          # /api/v1/zkp/*
│   ├── ipfsRoutes.js         # /api/v1/ipfs/*
│   ├── metaTxRoutes.js       # /api/v1/meta-tx/*
│   └── admin.js              # /api/v1/admin/*
├── middleware/
│   ├── authenticate.js       # JWT + Redis session
│   ├── errorHandler.js       # Centralized error handling
│   ├── rateLimiter.js        # Rate limiting config
│   └── turnstile.js          # Cloudflare bot protection
├── services/
│   ├── blockchainListener.js # On-chain event listener
│   ├── electionNotifier.js   # Scheduled notifications
│   ├── emailService.js       # Brevo integration
│   ├── ipfsService.js        # Pinata integration
│   ├── queueService.js       # BullMQ job queue
│   ├── redisService.js       # Redis wrapper
│   └── zkpService.js         # ZKP service
├── utils/
│   └── helpers.js            # Sanitization, validators
└── lib/
    ├── logger.js             # Structured logging
    └── prisma.js             # Prisma singleton

frontend/
├── src/
│   ├── App.jsx               # Root + React Router
│   ├── index.jsx             # Entry point
│   ├── index.css             # Global styles
│   ├── config/
│   │   └── api.js            # API base URL
│   ├── contracts/            # ABI files + addresses
│   ├── pages/                # 12 page components
│   ├── components/           # Shared + Admin components
│   ├── services/             # Auth, blockchain, ZKP, crypto
│   ├── hooks/                # Election timer, inactivity timer
│   ├── utils/                # Validators, error messages, fetch
│   └── locales/              # i18n translation files
└── public/                   # Static assets

contracts/
├── Voting.sol                # Standard voting contract
├── ZKPVoting.sol             # ZKP-enhanced voting
└── MinimalForwarder.sol      # ERC-2771 meta-tx forwarder

test/
├── Voting.test.js            # 49+ tests
└── ZKPVoting.test.js

scripts/
├── deploy.js                 # Contract deployment
└── [utility scripts]
```

**Structure Decision**: Web application (Option 2) — monorepo with
`backend/`, `frontend/`, and `contracts/` + `test/` at root level.
This matches the existing codebase architecture established over 11
development sessions.

## Complexity Tracking

> No constitution violations to justify — all 7 gates passed.
