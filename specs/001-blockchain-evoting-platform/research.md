# Research: Blockchain-Based E-Voting Platform

**Date**: 2026-05-26

**Feature**: [spec.md](file:///c:/Users/HP/Desktop/evoting/specs/001-blockchain-evoting-platform/spec.md)

## Research Summary

All technical context fields were resolved without NEEDS CLARIFICATION
markers. This research documents the decisions, rationale, and
alternatives considered for each technology choice.

---

## 1. Frontend Framework

**Decision**: React 19 + Vite

**Rationale**: React provides component-based architecture ideal for
the 12-page SPA. Vite offers sub-second HMR and optimized production
builds. React 19 adds concurrent features that improve perceived
performance for async operations (vote submission, ZKP generation).

**Alternatives considered**:
- Next.js: SSR unnecessary for this SPA; adds deployment complexity
- Vue 3: Team expertise is React-centric
- Svelte: Smaller ecosystem for blockchain/Web3 libraries

---

## 2. CSS Framework

**Decision**: Tailwind CSS 3.4.x with custom `gov-*` palette

**Rationale**: Utility-first CSS enables rapid UI iteration while
maintaining design consistency through the custom palette. v3.4.x is
pinned because v4 breaks `tailwind.config.js` syntax and the custom
palette definitions.

**Alternatives considered**:
- Tailwind v4: Incompatible with existing `gov-*` config (breaks
  `tailwind.config.js` format)
- Vanilla CSS: Too verbose for 12 pages with responsive layouts
- Chakra UI / MUI: Heavy bundle size, overkill for government UI

---

## 3. Backend Framework

**Decision**: Express.js with Modular MVC

**Rationale**: Express is lightweight, well-understood, and the
existing modularized architecture (7 controllers, 7 route files,
4 middleware) is proven stable over 11 sessions. No framework
migration justified.

**Alternatives considered**:
- Fastify: 2x faster but would require rewriting all middleware
  (authenticate, rateLimiter, turnstile, errorHandler)
- NestJS: Requires TypeScript — violates Constitution Principle VII
- Hono: Too new for a security-critical academic project

---

## 4. Database & ORM

**Decision**: PostgreSQL via Prisma ORM v6.x

**Rationale**: Prisma provides type-safe queries, auto-generated
migrations, and a schema-first approach that aligns with the 16-model
data architecture. v6.x is pinned because v7 requires TypeScript
configuration (Constitution Principle VII violation).

**Alternatives considered**:
- Prisma v7: Requires `prisma.config.ts` — TypeScript dependency
- Sequelize: More verbose, less type-safe query builder
- Drizzle: Would require full ORM migration for marginal gains
- Raw SQL: Prohibited by Constitution Principle VII

---

## 5. Blockchain Stack

**Decision**: Hardhat v2.x + Solidity 0.8.19 + OpenZeppelin

**Rationale**: Hardhat provides a mature testing/deployment framework.
v2.x is pinned because v3 requires ESM module rewrite. Solidity 0.8.19
includes overflow checks by default. OpenZeppelin provides audited
access control patterns.

**Alternatives considered**:
- Hardhat v3: Requires ESM migration of all scripts and config
- Foundry: Forge tests would require rewriting 49+ tests in Solidity
- Truffle: Deprecated by Consensys

---

## 6. Session & Caching

**Decision**: Upstash Redis (serverless)

**Rationale**: Upstash provides a REST-based Redis compatible with
serverless deployments. It handles single-session enforcement,
JWT validation caching, and election status polling without N+1
database hits.

**Alternatives considered**:
- Self-hosted Redis: Operational overhead for academic PoC
- Memcached: No pub/sub capability for real-time features
- In-memory Map: Lost on server restart; doesn't scale to PM2 cluster

---

## 7. Email Service

**Decision**: Brevo (Sendinblue) API

**Rationale**: Brevo provides 300 emails/day free tier, sufficient
for academic PoC. Handles OTPs, election notifications (24h reminder,
voting started, 30-min last call), and admin communications.

**Alternatives considered**:
- SendGrid: Higher free tier but more complex API
- AWS SES: Requires AWS account setup
- Nodemailer + SMTP: Self-hosting delivery reliability concerns

---

## 8. Decentralized Storage

**Decision**: IPFS via Pinata

**Rationale**: Candidate metadata (photos, manifestos) stored on
IPFS for decentralized availability. Pinata provides reliable
pinning with a generous free tier.

**Alternatives considered**:
- Direct IPFS node: Operational overhead
- Arweave: Permanent storage overkill for PoC
- AWS S3: Centralized — contradicts decentralization goals

---

## 9. Blockchain Interaction (Frontend)

**Decision**: Ethers.js v6

**Rationale**: Ethers.js v6 provides a clean, modular API for
contract interaction, wallet connection (MetaMask), and transaction
signing. The existing `blockchainService.js` is built on Ethers v6.

**Alternatives considered**:
- Web3.js: Larger bundle, less modular API
- Viem + Wagmi: Would require rewriting all blockchain service code
- thirdweb SDK: Too opinionated for custom contract interaction

---

## 10. Zero-Knowledge Proofs

**Decision**: Simulated Schnorr-like ZKP (academic PoC)

**Rationale**: A full Circom/Groth16 circuit would require weeks of
cryptographic engineering beyond academic scope. The simulated
Schnorr challenge demonstrates the ZKP concept while being
transparently documented as non-production.

**Alternatives considered**:
- Circom + Groth16: Production-grade but 4-6 weeks development
- snarkjs: Still requires circuit design expertise
- No ZKP: Would weaken the academic contribution

**Known limitation**: Documented in Constitution Principle VI —
ZKP is explicitly labeled as simulated in all materials.

---

## Resolved Items

All technical context fields resolved — zero NEEDS CLARIFICATION
remaining. The tech stack is fully established and version-pinned
per Constitution Principle VII and Session 9 audit.
