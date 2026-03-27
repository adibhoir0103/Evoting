# Bharat E-Vote — Project Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Smart Contract Design](#smart-contract-design)
3. [ZKP Cryptographic Protocol](#zkp-cryptographic-protocol)
4. [Authentication Flow](#authentication-flow)
5. [API Endpoint Reference](#api-endpoint-reference)
6. [Security Mechanisms](#security-mechanisms)
7. [Deployment Guide](#deployment-guide)
8. [Viva Preparation](#viva-preparation)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      USER BROWSER                       │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  React App  │  │ MetaMask │  │ Cloudflare        │  │
│  │  (Vite)     │  │ Wallet   │  │ Turnstile         │  │
│  └──────┬──────┘  └────┬─────┘  └────────┬──────────┘  │
└─────────┼──────────────┼────────────────┼───────────────┘
          │              │                │
          ▼              ▼                ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Express.js     │  │  Ethereum    │  │  Cloudflare API  │
│  Backend API    │  │  Blockchain  │  │  (Siteverify)    │
│  ┌───────────┐  │  │  ┌────────┐ │  └──────────────────┘
│  │ Supabase  │  │  │  │Voting  │ │
│  │ Auth      │  │  │  │.sol    │ │
│  ├───────────┤  │  │  ├────────┤ │
│  │ Prisma DB │  │  │  │ZKP     │ │
│  ├───────────┤  │  │  │Voting  │ │
│  │ Upstash   │  │  │  │.sol    │ │
│  │ Redis     │  │  │  └────────┘ │
│  ├───────────┤  │  └──────────────┘
│  │ Resend    │  │
│  │ Email     │  │
│  └───────────┘  │
└─────────────────┘
```

### Data Flow
1. **User authenticates** via Supabase (email/phone OTP)
2. **User connects MetaMask** wallet to the dApp
3. **Admin** adds candidates and authorizes voters via smart contract
4. **Voter** casts vote → transaction sent to Ethereum → `vote()` executes
5. **Results** read directly from blockchain (no backend intermediary)

---

## Smart Contract Design

### Voting.sol (Main Contract)

| Function | Access | Description |
|----------|--------|-------------|
| `addCandidate()` | Admin only | Add candidate with party + constituency |
| `authorizeVoter()` | Admin only | Authorize a wallet to vote |
| `authorizeVotersBatch()` | Admin only | Batch authorize (max 100) |
| `startVoting()` | Admin only | Begin the election |
| `endVoting()` | Admin only | End the election |
| `vote()` | Authorized voter | Cast a vote (one-time, secret ballot) |
| `setVotingTimeline()` | Admin, pre-voting | Set start/end timestamps |
| `setZKPMode()` | Admin, pre-voting | Toggle ZKP mode |
| `getAllCandidates()` | Public | View all candidates + vote counts |
| `getVoteReceipt()` | Public | Get proof-of-participation hash |

**Security Invariants:**
- Admin cannot vote (`require(msg.sender != admin)`)
- `votedCandidateId` is NEVER stored (secret ballot)
- `VoteCast` event does NOT emit voter address
- `setZKPMode()` locked during active voting
- Batch authorization capped at 100 addresses

### ZKPVoting.sol (Privacy Extension)

Uses Pedersen commitments and Schnorr-style proofs for vote privacy:
- **Identity Commitments**: `keccak256(voterSecret)` — registered by admin
- **Nullifiers**: `keccak256(secret + electionId)` — prevents double voting
- **Commitments**: `hash(g^candidateId * h^randomness)` — hides vote choice
- **Verification**: On-chain proof verification via `_verifyVoteProof()`

---

## ZKP Cryptographic Protocol

### 4 Goals Achieved

| Goal | Mechanism |
|------|-----------|
| **Vote Privacy** | Pedersen commitment hides candidate choice |
| **Vote Integrity** | On-chain proof verification |
| **Voter Eligibility** | Identity commitment + nullifier hash |
| **Verifiability** | All commitments publicly auditable |

### Flow
```
Voter (off-chain)                    Contract (on-chain)
─────────────────                    ────────────────────
1. Generate secret
2. Compute identity = hash(secret)
3. Admin registers identity ────────► registerEligibleVoter(identity)
4. Choose candidate
5. Generate randomness r
6. Compute commitment C = hash(g^v * h^r)
7. Compute nullifier = hash(secret, electionId)
8. Generate ZK proof
9. Submit vote ─────────────────────► submitEncryptedVote(C, nullifier, identity, proof, ipfsHash)
                                      ├── Verify eligibility
                                      ├── Check nullifier unused
                                      ├── Verify ZK proof
                                      └── Store commitment + mark voted
```

---

## Authentication Flow

```
User                Frontend              Backend               Supabase
─────               ────────              ───────               ────────
Enter email ──────► Request OTP ─────────► Generate OTP ──────► Send email
                                           Store in Redis
                                           (5 min TTL)
                    ◄──── "OTP Sent" ◄────

Enter OTP ────────► Submit OTP ──────────► Verify OTP ─────────► Verify user
                                           Check Redis
                                           Rate limit check
                    ◄──── JWT Token ◄────
                    Store in localStorage
                    Identify in PostHog
                    Set user in Sentry
```

---

## API Endpoint Reference

### Authentication
| Method | Path | Rate Limit | Turnstile | Description |
|--------|------|-----------|-----------|-------------|
| POST | `/api/v1/auth/send-otp` | 10/5min + Upstash | ✅ | Send OTP via Resend |
| POST | `/api/v1/auth/verify-otp` | 10/5min + Upstash | ✅ | Verify OTP, return JWT |
| POST | `/api/v1/auth/signup` | 100/15min | ✅ | Register new user |
| POST | `/api/v1/auth/login` | 100/15min | ✅ | Login existing user |

### ZKP
| Method | Path | Rate Limit | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/zkp/generate-commitment` | 30/10min | Generate Pedersen commitment |
| POST | `/api/v1/zkp/generate-proof` | 30/10min | Generate ZK proof |
| POST | `/api/v1/zkp/verify-proof` | 30/10min | Verify ZK proof |

### IPFS
| Method | Path | Rate Limit | Description |
|--------|------|-----------|-------------|
| POST | `/api/v1/ipfs/pin` | 20/15min | Pin encrypted vote metadata |
| GET | `/api/v1/ipfs/:hash` | 200/15min | Retrieve pinned metadata |

---

## Security Mechanisms

### Defense-in-Depth Layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| L1: Bot Protection | Cloudflare Turnstile | Block automated attacks |
| L2: Rate Limiting (IP) | express-rate-limit | Per-IP throttling |
| L3: Rate Limiting (Distributed) | Upstash Redis | Sliding window rate limit |
| L4: Authentication | Supabase Auth + JWT | Identity verification |
| L5: Authorization | Smart Contract | On-chain RBAC (admin/voter) |
| L6: Input Validation | Express middleware | Payload size + type checking |
| L7: Security Headers | Helmet.js | CSP, HSTS, X-Frame-Options |
| L8: Error Monitoring | Sentry | Real-time error alerting |

### Secret Ballot Guarantee
The `Voter` struct does NOT store `votedCandidateId`. Only `hasVoted` (bool) is tracked. The `VoteCast` event emits only the candidate ID and timestamp — the voter's address is never linked to their choice on-chain.

---

## Deployment Guide

### Prerequisites
- Supabase project (free tier)
- Sentry account (free tier)
- PostHog account (free tier)
- Resend account (free tier)
- Upstash Redis database (free tier)
- Cloudflare account (free tier)
- Vercel account (free tier)
- Render or Railway account (free tier)

### 1. Deploy Smart Contracts
```bash
# For local testing
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost

# For Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
```

### 2. Deploy Backend
```bash
# Push to GitHub, then connect to Render.com
# Set all environment variables from backend/.env.example
```

### 3. Deploy Frontend
```bash
# Push to GitHub, then connect to Vercel
# Set all environment variables from frontend/.env.example
# Set VITE_API_URL to your Render backend URL
```

### 4. Configure Domain
- Point Namecheap nameservers to Cloudflare
- Add A/CNAME records for frontend (Vercel) and backend (Render)
- Cloudflare automatically provides SSL certificates

---

## Viva Preparation

### Key Questions & Answers

**Q: How does the blockchain prevent double voting?**
A: The `Voter` struct has a `hasVoted` boolean. The `vote()` function checks `require(!voter.hasVoted)` BEFORE incrementing the vote count. This follows the Checks-Effects-Interactions pattern.

**Q: Can the admin see who voted for which candidate?**
A: No. The `votedCandidateId` field was removed from the `Voter` struct. The `VoteCast` event only emits the candidate ID and timestamp, not the voter's address. This preserves the secret ballot.

**Q: Why use Supabase instead of Clerk for authentication?**
A: Clerk's Passkey/WebAuthn features required a paid Pro subscription ($25/month). Supabase provides OTP-based auth on the free tier, making it more cost-effective for an academic project while still being production-grade.

**Q: How does the ZKP system work?**
A: The voter generates a secret off-chain. The admin registers the hash of this secret (identity commitment). To vote, the voter creates a Pedersen commitment that hides their candidate choice, generates a nullifier hash (to prevent double voting), and submits a ZK proof that they know the opening of the commitment without revealing it.

**Q: What happens if MetaMask is disconnected mid-vote?**
A: The `accountsChanged` event listener in `App.jsx` detects the disconnection and updates the UI. If the user switches networks, a toast error warns them to switch back to the correct network.

**Q: Why Redis for OTP instead of in-memory storage?**
A: In-memory storage (JavaScript `Map`) is lost on server restart. Upstash Redis persists OTPs across deployments and provides atomic operations with auto-TTL (5 minute expiry).
