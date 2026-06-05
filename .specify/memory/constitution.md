<!--
  SYNC IMPACT REPORT
  ==================================================
  Version change: (none) → 1.0.0 (initial ratification)
  
  Added principles:
    - I. Modular MVC Architecture
    - II. Test-First for Smart Contracts (NON-NEGOTIABLE)
    - III. User Experience Consistency
    - IV. Performance & Scalability
    - V. Security-by-Default (NON-NEGOTIABLE)
    - VI. Blockchain Integrity & Transparency
    - VII. Simplicity & YAGNI
  
  Added sections:
    - Security & Compliance Standards
    - Development Workflow & Quality Gates
  
  Removed sections: (none — initial creation)
  
  Templates requiring updates:
    ✅ .specify/templates/plan-template.md — Constitution Check
         section references align with 7 principles
    ✅ .specify/templates/spec-template.md — Functional requirements
         and success criteria sections are compatible
    ✅ .specify/templates/tasks-template.md — Task categorization
         accommodates security, testing, and observability tasks
  
  Follow-up TODOs: (none)
  ==================================================
-->

# Bharat E-Vote Constitution

## Core Principles

### I. Modular MVC Architecture

All backend code MUST follow the Modular MVC pattern established in
Session 8. Every feature MUST be decomposed into:

- **Controllers** (`backend/controllers/`): Business logic only. No
  route definitions, no middleware wiring.
- **Routes** (`backend/routes/`): Thin route declarations that map
  HTTP verbs to controller methods and attach middleware.
- **Middleware** (`backend/middleware/`): Cross-cutting concerns
  (auth, rate-limiting, error handling) as reusable Express middleware.
- **Services** (`backend/services/`): Shared infrastructure (Redis,
  email, blockchain listeners, IPFS, queues) as standalone modules.

Frontend code MUST use page-based architecture with self-contained
pages in `frontend/src/pages/` and reusable components in
`frontend/src/components/`. All API calls MUST route through
`fetchWithRetry.js`; all blockchain calls MUST route through
`services/blockchainService.js`.

No file MUST exceed 500 lines. If a controller or component grows
beyond this threshold, it MUST be split into focused sub-modules.

**Rationale**: The Session 8 modularization reduced `server.js` from
1,624 to 143 lines. Monolithic files are a proven maintenance hazard
in this codebase.

### II. Test-First for Smart Contracts (NON-NEGOTIABLE)

Every Solidity smart contract MUST have a corresponding test file in
`test/`. The Red-Green-Refactor cycle is strictly enforced:

1. Tests MUST be written before or alongside contract modifications.
2. Tests MUST fail before implementation changes are applied.
3. All 49+ existing tests MUST continue to pass after any change.
4. New contract functions MUST include at minimum:
   - Happy-path test
   - Access-control/revert test
   - Edge-case test (zero values, overflow, re-entrancy guards)

Backend API tests are RECOMMENDED for all new controller endpoints but
not gated. Frontend unit tests are OPTIONAL but encouraged for
critical flows (vote casting, ZKP verification).

**Rationale**: Smart contracts are immutable once deployed.
A single untested code path can permanently compromise election
integrity. The 49/49 test baseline (Session 9) MUST never regress.

### III. User Experience Consistency

All user-facing interfaces MUST adhere to these standards:

- **Design system**: Tailwind CSS with the `gov-*` custom palette
  defined in `tailwind.config.js`. No ad-hoc colors outside the
  palette.
- **Typography**: Consistent font stack via Tailwind config. No
  inline font overrides.
- **Responsive**: Every page MUST render correctly on viewports from
  360px (mobile) to 1920px (desktop).
- **Loading states**: All async operations MUST show a skeleton or
  spinner. No blank screens or layout shifts.
- **Error states**: All API failures MUST surface user-friendly
  messages from `utils/errorMessages.js`. Raw error objects MUST
  never reach the UI.
- **Accessibility**: Interactive elements MUST have unique IDs,
  visible focus indicators, and `aria-label` attributes where
  semantic HTML is insufficient.
- **Internationalization**: All user-facing strings MUST use the
  `i18n` translation system (`locales/`). No hardcoded English
  strings in JSX.

**Rationale**: An e-voting platform serves citizens of all
technical abilities. Inconsistent UX erodes voter confidence and
increases support burden.

### IV. Performance & Scalability

All features MUST meet these performance baselines:

- **Frontend**: Largest Contentful Paint (LCP) < 2.5s on 4G.
  Bundle size MUST NOT exceed 500KB gzipped without justification.
- **Backend**: API response time < 200ms p95 for authenticated
  endpoints. Database queries MUST use indexed fields (enforced
  via Prisma `@@index` directives).
- **Blockchain**: Smart contract function gas costs MUST be
  documented in deployment logs. Any function exceeding 500,000
  gas MUST include an optimization rationale.
- **Caching**: Session lookups and repeated reads MUST use Upstash
  Redis. Direct database hits for hot-path data (session
  validation, election status) are prohibited.
- **Compression**: All HTTP responses MUST be gzip-compressed via
  the `compression` middleware (established in Session 8).

**Rationale**: Election day traffic is bursty and unpredictable.
Performance regressions under load directly disenfranchise voters.

### V. Security-by-Default (NON-NEGOTIABLE)

Every change MUST preserve the 8-layer security architecture:

1. **Authentication**: JWT + bcrypt (native, not bcryptjs) + MFA
   (Email OTP). No plaintext secrets in source or logs.
2. **Sessions**: Single active session per user enforced via Redis.
   Password resets MUST invalidate all active sessions.
3. **Input validation**: All user input MUST be sanitized via
   `utils/helpers.js`. Aadhaar numbers MUST be HMAC-SHA256 hashed
   with pepper before storage.
4. **Rate limiting**: All public endpoints MUST have rate limiters
   configured in `middleware/rateLimiter.js`.
5. **Bot protection**: Cloudflare Turnstile MUST gate all auth
   endpoints.
6. **Anti-coercion**: Re-voting (up to 3×) and ProctorGuard MUST
   remain functional.
7. **Audit trail**: All admin actions MUST be logged via
   `AdminAuditLog`.
8. **HTTP hardening**: HPP middleware, CORS whitelist, and Helmet
   headers MUST be active.

No security layer may be bypassed, weakened, or temporarily disabled
— even in development mode.

**Rationale**: This is an election integrity system. A single
security gap can undermine democratic outcomes. The Session 6
audit achieved score 85+; regression below this is unacceptable.

### VI. Blockchain Integrity & Transparency

All on-chain operations MUST follow these rules:

- **Immutability respect**: Deployed contract addresses in
  `deployment-info.json` and `frontend/src/contracts/` MUST stay
  synchronized. Manual edits to ABI files are prohibited; always
  regenerate from `artifacts/`.
- **Event emission**: Every state-changing contract function MUST
  emit an event for off-chain indexing (The Graph subgraph
  compatibility).
- **Privacy**: Standard-mode votes MUST be hashed with
  `_secretSalt` before on-chain submission to prevent EVM event
  log deanonymization.
- **Gas management**: Meta-transactions via `MinimalForwarder.sol`
  MUST remain the default voter transaction path. Voters MUST NOT
  be required to hold ETH.
- **ZKP transparency**: The simulated Schnorr ZKP MUST be clearly
  documented as a PoC simulation in all user-facing and academic
  materials. No claim of production-grade zero-knowledge security.

**Rationale**: Blockchain is the trust anchor of the entire system.
Mismatched ABIs or undocumented privacy gaps directly undermine
the verifiability promise.

### VII. Simplicity & YAGNI

- **No TypeScript**: The entire codebase is plain JavaScript.
  Do not introduce TypeScript, Flow, or other type systems.
- **No new state management**: React `useState`/`useEffect` only.
  Do not add Redux, Zustand, MobX, or similar libraries.
- **No ORM switching**: All database access goes through Prisma.
  No raw SQL, no Sequelize, no Knex.
- **Minimal dependencies**: Every new `npm install` MUST be
  justified. Prefer native APIs (Fetch, Crypto) over third-party
  polyfills.
- **Pin versions**: Prisma stays at v6.x (v7 requires TypeScript
  config). Hardhat stays at v2.x. Tailwind stays at v3.4.x
  (v4 breaks `gov-*` palette). Version bumps require explicit
  compatibility verification.

**Rationale**: Complexity is the enemy of a PoC on an academic
timeline. Sessions 9-11 established version pins after extensive
compatibility testing. Undoing those decisions wastes effort.

## Security & Compliance Standards

All development MUST comply with:

- **Data Protection**: Aadhaar data is PII under India's Digital
  Personal Data Protection Act. HMAC hashing with pepper is the
  minimum bar. No Aadhaar number may appear in logs, error
  messages, or API responses.
- **Election Integrity**: Vote secrecy MUST be preserved at every
  layer. No API endpoint may return the mapping between a voter
  and their candidate choice.
- **Dependency Security**: `npm audit` MUST report zero critical
  vulnerabilities before any deployment. High-severity
  vulnerabilities MUST be resolved within 48 hours.
- **Environment Secrets**: All secrets (`JWT_SECRET`,
  `DATABASE_URL`, API keys) MUST be in `.env` files listed in
  `.gitignore`. Secrets MUST NOT appear in committed code,
  comments, or documentation.

## Development Workflow & Quality Gates

### Code Review Requirements

- All changes MUST be reviewed against this constitution before
  merge.
- Smart contract changes require test suite pass (49+ tests,
  zero failures).
- Backend changes MUST not break existing API contracts
  (backward compatibility).
- Frontend changes MUST be verified on both mobile (360px) and
  desktop (1920px) viewports.

### Deployment Approval

- **Local/Dev**: No approval needed. `npx hardhat node` +
  `node server.js` + `npm run dev`.
- **Sepolia Testnet**: Requires `SEPOLIA_URL` and `PRIVATE_KEY`
  configuration. Contract deployment MUST be logged with tx hash
  and block number.
- **Production (`bharat-evote.me`)**: Requires full test suite pass,
  security audit checklist review, and PM2 cluster-mode
  verification.

### Branching & Commits

- Feature branches MUST follow `<NNN>-feature-name` convention.
- Commits MUST use conventional commit format:
  `type(scope): description` (e.g., `fix(auth): resolve MFA
  token expiry race condition`).
- Each commit SHOULD be atomic — one logical change per commit.

## Governance

This constitution is the supreme development authority for the
Bharat E-Vote project. All pull requests, code reviews, and AI
agent sessions MUST verify compliance with these principles.

**Amendment procedure**:
1. Propose amendment with rationale and impact analysis.
2. Verify no downstream template breakage (plan, spec, tasks).
3. Increment version per semantic versioning rules (see below).
4. Update `LAST_AMENDED_DATE` to amendment date.

**Versioning policy**:
- MAJOR: Principle removal or backward-incompatible redefinition.
- MINOR: New principle or materially expanded guidance.
- PATCH: Clarifications, wording fixes, non-semantic refinements.

**Compliance review**: Every AI agent session MUST read `AGENTS.md`
and this constitution before making changes. The `AGENTS.md`
Session Log MUST be updated after every significant work session.

**Version**: 1.0.0 | **Ratified**: 2026-05-26 | **Last Amended**: 2026-05-26
