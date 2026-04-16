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
9. [Trusted Setup & Admin Power Analysis](#trusted-setup--admin-power-analysis)
10. [Front-End Trust & Code Integrity](#front-end-trust--code-integrity)
11. [The Oracle Problem](#the-oracle-problem-real-world-identity-verification)
12. [Formal Threat Model](#formal-threat-model--attack-surface-analysis)
13. [Disaster Recovery & Upgradeability](#disaster-recovery--contract-upgradeability)
14. [Technology Justification & Adversary Mapping](#technology-justification--adversary-mapping)
15. [Voter Key Management & Recovery](#voter-key-management--recovery)
16. [User Onboarding & Education Strategy](#user-onboarding--education-strategy)
17. [Auditability & Forensic Analysis](#auditability--forensic-analysis)
18. [Election Day Operations Runbook](#election-day-operations-runbook)
19. [Usability Testing Framework](#usability-testing-framework)

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

---

## Trusted Setup & Admin Power Analysis

### Current Design (Semi-Trusted Admin)

In the current implementation, the Election Commission admin calls `registerEligibleVoter(identityCommitment)` on the ZKPVoting contract. This creates a **semi-trusted setup** where the admin:
- Knows the list of all eligible voter identity commitments
- Controls when voters are registered
- Could theoretically generate secrets and vote on behalf of absent voters

**We acknowledge this is a centralized trust point.** This design was chosen to simplify the prototype while still demonstrating the core ZKP protocol.

### Proposed Improvement: Merkle Tree Whitelist

A more decentralized approach uses a **Merkle tree-based whitelist**:

```
                    Root Hash (stored on-chain)
                   /                           \
              Hash(AB)                      Hash(CD)
             /        \                    /        \
        Hash(A)     Hash(B)          Hash(C)     Hash(D)
          |            |                |            |
     Voter₁ IC    Voter₂ IC       Voter₃ IC    Voter₄ IC
```

1. **Admin** builds a Merkle tree of all voter identity commitments
2. **Only the root hash** is stored on-chain via `setVoterMerkleRoot(bytes32 root)`
3. **Voters** prove membership by submitting a **Merkle proof** (sibling hashes along their path) — the contract verifies the proof against the stored root
4. **Admin never sees individual secrets** — only the public identity commitments

This reduces the admin's role to publishing a single root hash, and the proof of membership is verified trustlessly on-chain.

### Ceremony-Based Trusted Setup (Gold Standard)

For the generation of ZKP public parameters (generators `g`, `h`), the gold standard is a **Multi-Party Computation (MPC) ceremony** (similar to Zcash's "Powers of Tau"):
- Multiple independent parties contribute randomness
- Each party destroys their contribution after use
- If even **one** participant is honest, the parameters are secure
- This ensures no single party can create a trapdoor

### Mitigation in Current System

Even with the semi-trusted setup, the following mitigations exist:
- **On-chain audit trail**: Every `registerEligibleVoter()` call emits a `VoterRegistered` event — publicly verifiable
- **AdminAuditLog**: Backend logs all admin actions with IP addresses and timestamps
- **Voter count verification**: Anyone can compare `allNullifiers.length` against the registered voter count
- **Identity commitment is one-way**: Admin registers `hash(secret)`, but cannot reverse-engineer the secret

---

## Front-End Trust & Code Integrity

### The Challenge

The ZKP proof generation (Pedersen commitment, Schnorr proof, nullifier computation) runs entirely in the voter's browser via `zkpService.js`. A maliciously altered front-end could:
- Steal the voter's secret
- Change the candidate ID before commitment generation
- Generate invalid proofs
- Send the plaintext vote to a third-party server

This is a **fundamental challenge for all dApps**, not unique to our system.

### Current Mitigations

1. **On-chain verification**: Even if the front-end is malicious, `_verifyVoteProof()` in the smart contract will **reject invalid proofs**. A tampered front-end cannot forge a valid ZKP.
2. **HTTPS/HSTS**: All traffic is encrypted with TLS. HSTS (1 year, includeSubDomains) prevents downgrade attacks.
3. **Content Security Policy (CSP)**: Helmet.js enforces strict CSP headers, preventing injection of external scripts.

### Proposed Solutions

| Solution | Description | Complexity |
|----------|-------------|------------|
| **Subresource Integrity (SRI)** | Add `integrity="sha384-..."` attributes to all `<script>` and `<link>` tags. Browsers refuse to execute scripts whose hash doesn't match. | Low |
| **Reproducible Builds** | Publish the Vite build configuration so auditors can independently compile the source code and verify the output matches the deployed bundle byte-for-byte. | Medium |
| **Code Signing** | Sign the front-end build with a known Election Commission key. A browser extension could verify the signature before execution. | Medium |
| **Hardware Wallet Integration** | Move ZKP proof generation to a hardware wallet (Trezor/Ledger) or TEE. The voter's secret never enters browser memory. | High |
| **Audited Browser Extension** | An ECI-published browser extension handles all cryptographic operations in an isolated, audited sandbox. Similar to MetaMask for transaction signing. | High |

### Key Insight

The smart contract acts as the **final trust boundary**. Even if the front-end is compromised, invalid proofs are rejected on-chain. The attacker's best outcome is denial-of-service (preventing valid votes), not vote manipulation.

---

## The Oracle Problem: Real-World Identity Verification

### Problem Statement

The blockchain stores cryptographic identities (wallet addresses, identity commitments), but it has no inherent way to verify **real-world identity** (Aadhaar, voter ID, citizenship). This is the classic "oracle problem" — getting trusted off-chain data onto the blockchain.

### Current Design

```
Real World                    Backend (Oracle)                 Blockchain
──────────                    ────────────────                 ──────────
Voter shows Aadhaar ────────► Admin verifies identity          
                               ├── Checks ApprovedVoter      
                               │   whitelist (DB)             
                               ├── Validates Aadhaar format   
                               └── Calls authorizeVoter() ──► On-chain authorization
```

### Proposed Production Architecture

```
┌──────────────────────┐      ┌──────────────────────────┐      ┌────────────────────┐
│ UIDAI/ECI            │      │ National Identity Oracle │      │ Voting Smart       │
│ (Aadhaar Authority)  │      │ (Trusted Oracle Server)  │      │ Contract           │
│                      │      │                          │      │                    │
│ • Maintains citizen  │─────►│ • Receives digitally     │─────►│ • Verifies oracle  │
│   database           │      │   signed eligibility     │      │   signature        │
│ • Issues digitally   │      │   tokens from UIDAI      │      │ • Stores voter     │
│   signed tokens      │      │ • Relays to blockchain   │      │   authorization    │
│                      │      │ • Signs messages with    │      │ • No admin needed  │
│                      │      │   oracle private key     │      │   for per-voter TX │
└──────────────────────┘      └──────────────────────────┘      └────────────────────┘
```

**How the oracle would work:**

1. **ECI issues eligibility tokens**: Digitally signed messages containing `(voterAddress, constituencyCode, electionId, timestamp)` signed with the ECI's private key
2. **Oracle contract verifies**: A separate `OracleVerifier.sol` contract stores the ECI's public key and verifies ECDSA signatures
3. **Self-service authorization**: Voters submit their ECI-signed token directly to the contract — no admin transaction needed per voter
4. **Auditable**: All eligibility tokens are publicly verifiable against the ECI's known public key

This removes the admin as a bottleneck and single point of trust for voter registration.

---

## Formal Threat Model & Attack Surface Analysis

### STRIDE Threat Classification

| # | Threat | Category | Likelihood | Impact | Mitigation | Residual Risk |
|---|--------|----------|-----------|--------|------------|---------------|
| T1 | **Voter machine compromised (keylogger)** | Spoofing | Medium | High — secret stolen, vote changed | Proctored window, MFA, keystroke biometrics detect anomalies | Requires hardware wallet for full mitigation |
| T2 | **DDoS on API backend** | Denial of Service | High | High — voters cannot authenticate | Cloudflare WAF, Upstash Redis rate limiting, multiple backend replicas | Extended DDoS may overwhelm free-tier services |
| T3 | **Malicious front-end (phishing domain)** | Tampering | Medium | Critical — secrets exfiltrated | CSP, HSTS, SRI hashes (proposed), on-chain proof verification rejects invalid proofs | User must verify domain; SRI not yet implemented |
| T4 | **Admin collusion (fake voters)** | Elevation of Privilege | Low | Critical — manufactured votes | On-chain audit log, voter count verification, Merkle tree whitelist (proposed) | Semi-trusted admin is a known limitation |
| T5 | **51% attack on blockchain** | Tampering | Very Low (Sepolia/mainnet) | Critical — vote reorg | Use established PoS network with thousands of validators | Negligible on Ethereum mainnet |
| T6 | **Smart contract vulnerability** | Tampering | Low | Critical — funds/votes at risk | 85 unit tests, Checks-Effects-Interactions pattern, UUPS proxy (proposed) | Formal verification not performed |
| T7 | **Replay attack (reuse old transactions)** | Repudiation | Low | Medium — duplicate votes | Nonce tracking in MetaMask + `hasVoted` flag + nullifier uniqueness | Covered by Ethereum protocol |
| T8 | **Sybil attack (fake identities)** | Spoofing | Medium | High — multiple fake voters | Aadhaar uniqueness constraint, voter whitelist, oracle (proposed) | Depends on identity oracle integrity |
| T9 | **MetaMask wallet theft** | Spoofing | Medium | High — vote as victim | MFA separates auth from wallet, QR ticket temporal separation | User responsible for wallet security |
| T10 | **Side-channel attack on ZKP** | Information Disclosure | Low | Medium — timing leaks | Constant-time modPow implementation, Web Crypto API for hashing | Academic-level attack; unlikely in practice |
| T11 | **IPFS metadata tampering** | Tampering | Very Low | Low — CID changes if content changes | Content-addressed storage (hash = address) | IPFS content is immutable by design |
| T12 | **JWT token theft (XSS)** | Spoofing | Low | High — session hijack | httpOnly cookies (proposed), CSP, input sanitization, short JWT expiry (24h) | Currently uses localStorage |

### Risk Heat Map

```
                    IMPACT
              Low    Medium    High    Critical
         ┌────────┬─────────┬────────┬──────────┐
  High   │        │         │        │   T2     │
         ├────────┼─────────┼────────┼──────────┤
  Medium │        │   T10   │ T1,T8  │   T3     │
  L      │        │         │  T9    │          │
  I      ├────────┼─────────┼────────┼──────────┤
  K      │   T11  │   T7    │  T12   │ T4,T6   │
  E      ├────────┼─────────┼────────┼──────────┤
  L      │        │         │        │   T5     │
  I      └────────┴─────────┴────────┴──────────┘
  H      Very Low
  O
  O
  D
```

### Key Takeaway

The highest-risk threats (T2: DDoS, T3: phishing, T1: keylogger) are **infrastructure-level challenges** common to all web applications — not unique to blockchain voting. Our defense-in-depth approach (8 security layers) mitigates most threats, with hardware wallet integration and Merkle tree whitelists proposed for future hardening.

---

## Disaster Recovery & Contract Upgradeability

### Problem

Once a Solidity smart contract is deployed, its code is **immutable**. If a critical bug is discovered in `VotingV2.sol` after deployment with active election data, there is no way to patch it.

### Proposed Solution: UUPS Proxy Pattern

The **Universal Upgradeable Proxy Standard (ERC-1822 / UUPS)** allows contract logic to be upgraded while preserving the state (storage) on-chain:

```
┌──────────────────┐       ┌──────────────────┐
│   Proxy Contract │       │  Implementation  │
│   (ERC-1967)     │──────►│  VotingV2.sol    │
│                  │       │  (Logic v1)      │
│ • Stores all     │       └──────────────────┘
│   state data     │              ↓ upgrade
│ • Delegates all  │       ┌──────────────────┐
│   calls via      │──────►│  Implementation  │
│   delegatecall   │       │  VotingV3.sol    │
│                  │       │  (Logic v2 — fix)│
└──────────────────┘       └──────────────────┘
```

**How it works:**
1. **Proxy contract** stores all election data (candidates, voters, vote counts)
2. **Implementation contract** contains only the logic (functions)
3. **Upgrade**: Deploy new implementation, call `upgradeToAndCall(newAddress)`
4. **State preserved**: All existing votes and candidates remain intact

### Proposed Governance for Upgrades

To prevent unilateral admin upgrades, implement **multi-signature governance**:

| Action | Required Signers | Timelock |
|--------|-----------------|----------|
| `upgradeToAndCall()` | 2-of-3 admin keys | 48 hours |
| `startVoting()` | 1-of-3 admin keys | None |
| `endVoting()` | 2-of-3 admin keys | None |
| `addCandidate()` | 1-of-3 admin keys | None (pre-voting only) |

**Multi-sig implementation**: Use OpenZeppelin's `TimelockController` + Gnosis Safe multi-sig wallet. Critical operations require 2-of-3 Election Commission officials to sign, with a 48-hour public timelock for contract upgrades — allowing public scrutiny before execution.

### Admin Key Loss Recovery

If the admin key is lost:
- **TimelockController**: A governance contract with multiple signers ensures no single key is a single point of failure
- **Social recovery**: 3-of-5 recovery guardians (e.g., state-level election officers) can rotate the admin key
- **Emergency pause**: A separate `pause()` function (with independent signer) halts all operations until recovery

---

## Technology Justification & Adversary Mapping

### Why ZKPs Over Simpler Privacy Techniques?

**Question the guide will ask:** *"Could you have achieved similar privacy with a simpler cryptographic commitment scheme? Why was a full ZKP necessary?"*

**Answer:** A simple commitment scheme (e.g., Pedersen commitments) can hide the vote value, but it cannot prove to a third-party verifier that the vote is valid without revealing it. Our system requires **individual verifiability** — a voter must be able to prove their vote was counted correctly without revealing their choice. This is impossible with commitments alone.

| Technique | Hides Vote? | Proves Validity? | Individual Verifiability? | Our Verdict |
|-----------|-------------|-------------------|---------------------------|-------------|
| Plaintext ballot | ❌ | N/A | ❌ | Rejected — no privacy |
| Pedersen commitment | ✅ | ❌ (needs opening) | ❌ | Rejected — can't verify without revealing |
| Homomorphic encryption | ✅ | ✅ (tallied blind) | ⚠️ (only aggregate) | Partial — used for tally, not individual proof |
| Mix-nets | ✅ | ✅ | ⚠️ (requires trusted mixers) | Rejected — introduces new trust assumptions |
| **ZKP (Groth16/SNARK)** | ✅ | ✅ | ✅ | **Selected** — proves "I voted validly" without revealing choice |

**Key insight:** ZKPs let a voter prove `hash(secret || candidateId) == onChainCommitment` without revealing `candidateId` or `secret`. No other technique provides this combination of privacy + individual verifiability + on-chain verification.

### Why Blockchain Over a Database?

A centralized database controlled by the Election Commission creates a trust problem: *who watches the watchmen?* If the EC modifies the database, there is no external evidence of tampering.

| Property | Centralized Database | Permissioned Blockchain |
|----------|---------------------|------------------------|
| **Tamper detection** | Only if logs are honest | Cryptographic — any modification breaks hash chain |
| **Public verifiability** | Requires trust in admin | Anyone can verify via block explorer |
| **Audit trail** | Deletable by admin | Immutable — every state change is a permanent event |
| **Transparency** | Behind closed doors | Open contract source, public events |
| **Single point of failure** | Yes (DB admin) | No (consensus among nodes) |

**Verdict:** We chose blockchain specifically for **public verifiability against a malicious election authority** — the exact threat model that a government voting system must defend against.

### Adversary Mapping

| Adversary | Threat | Mitigation Feature |
|-----------|--------|-------------------|
| **Malicious DB admin** | Alter vote records, fabricate results | Blockchain immutability — votes stored on-chain, not in database |
| **Network eavesdropper** | Intercept vote data in transit | TLS encryption + ZKP (vote never sent in plaintext) |
| **Coercive family member** | Force voter to prove how they voted | Receipt-freeness — ZKP secret is only known to voter, and receipt doesn't reveal candidate |
| **Rogue election officer** | Add fake voters, cast votes on their behalf | On-chain voter authorization (whitelist) + biometric MFA + keystroke dynamics |
| **Front-end attacker** | Serve malicious JavaScript that changes votes | SRI hashes (proposed), auditable open-source code, on-chain `_verifyVoteProof()` rejects invalid proofs |
| **Blockchain miner/validator** | Censor or reorder transactions | Sepolia PoS consensus — no single miner controls block inclusion |
| **Replay attacker** | Re-submit a previous valid vote | `hasVoted[msg.sender]` mapping prevents double voting |
| **Sybil attacker** | Create multiple identities to vote multiple times | Aadhaar-linked registration + on-chain wallet authorization by admin |

---

## Voter Key Management & Recovery

### The Problem

This is the **single biggest point of failure** in any crypto-based voting system. A voter who loses their MetaMask seed phrase or MFA device is effectively disenfranchised. For a national election serving 900M+ voters, this is unacceptable.

### Current State (Honest Acknowledgment)

Our current system assumes:
1. The voter maintains access to their MetaMask wallet
2. The voter has their registered email for OTP
3. The voter remembers their password

**If any of these are lost, the voter cannot vote.** We acknowledge this as a critical limitation.

### Proposed Solutions (Future Work)

#### 1. Social Recovery (Vitalik Buterin's EIP-2429 Model)

```
Voter registers 5 "Recovery Guardians" (trusted family/friends)
    ↓
If voter loses wallet key:
    3-of-5 guardians sign a recovery transaction
    ↓
    Smart contract rotates the voter's authorized wallet address
    ↓
    Voter connects a new wallet and is re-authorized
```

**Implementation sketch:**
```solidity
mapping(address => address[5]) public recoveryGuardians;
mapping(address => mapping(address => bool)) public recoveryApprovals;

function initiateRecovery(address voter, address newWallet) external {
    require(isGuardian(voter, msg.sender), "Not a guardian");
    recoveryApprovals[voter][msg.sender] = true;
    if (countApprovals(voter) >= 3) {
        authorizedVoters[voter] = false;
        authorizedVoters[newWallet] = true;
        emit VoterRecovered(voter, newWallet);
    }
}
```

#### 2. Biometric-based Key Derivation

Instead of storing a seed phrase, derive a deterministic key from biometric data:
```
key = KDF(fingerprint_template || aadhaar_hash || salt)
```
The key is **never stored** — it is re-derived each time the voter authenticates via Aadhaar biometric. This eliminates key loss entirely but requires hardware biometric readers at polling stations.

#### 3. Government-Issued Recovery (Aadhaar Re-Authentication)

For the Indian context, the most pragmatic approach:
1. Voter visits a Physical Voter Assistance Center (PVAC)
2. Authenticates via Aadhaar biometric (fingerprint + iris)
3. ECI officer issues a new wallet authorization on-chain
4. Old wallet is de-authorized (preventing double-vote from recovered key)

This is analogous to how a lost EPIC (voter ID card) is replaced today.

#### 4. Emergency Security Questions (Demo Implementation)

Our system includes rate-limited security questions as a basic recovery demo:
- 3 personalized questions set during registration
- 5-minute lockout after 3 failed attempts
- New OTP sent to registered Aadhaar-linked mobile upon successful answer

---

## User Onboarding & Education Strategy

### The Problem

A 65-year-old voter who has never used MetaMask cannot be expected to understand "Sign this transaction" or "Confirm on Blockchain." Technical jargon destroys trust.

### Micro-Copy Strategy (Already Implemented)

We replaced all technical language with voter-friendly terms:

| Technical Term | Our Micro-Copy | Rationale |
|---------------|----------------|-----------|
| "Connect MetaMask" | "Connect Secure Cryptographic Vault" | Conveys security without crypto jargon |
| "Submit Transaction" | "Confirm Your Vote" | Action-oriented, familiar |
| "Sign Message" | "Verify Your Identity" | Maps to existing mental model |
| "Transaction Hash" | "Digital Receipt Number" | Familiar from banking |
| "Block Confirmation" | "Vote Sealed in Permanent Record" | Conveys finality |
| "Gas Fee" | "Processing Fee (paid by ECI)" | Removes financial concern |
| "ZKP Verification" | "Privacy Shield Check" | Accessible metaphor |
| "Smart Contract" | "Digital Ballot Box" | Physical analogy |

### Guided Walkthrough (Pre-Voting Tutorial)

Before casting their first vote, voters see a 3-step interactive tutorial in the VotingPage:

**Step 1: "Connect Your Digital Vault"**
> Your vote will be stored in a tamper-proof digital vault (blockchain). First, we need to connect your secure identity wallet. Click the blue button below.

**Step 2: "Choose Your Candidate"**
> Select your preferred candidate from the ballot. Your choice is protected by advanced cryptography — think of it as a sealed envelope inside a locked box.

**Step 3: "Seal Your Vote Forever"**
> When you click 'Confirm', your vote is permanently recorded. No one — not even the Election Commission — can change it. You'll receive a digital receipt for your records.

### Tooltips for Advanced Features

- **ZKP Verify tab:** "This advanced option lets you prove your vote was counted correctly using cryptographic math — like a sealed envelope inside a locked box. Your actual choice is never revealed."
- **Blockchain Explorer link:** "This opens a public record of your vote's existence (not your choice) — like a tracking number for a registered letter."

---

## Auditability & Forensic Analysis

### The Step-by-Step Audit Process

If an election result is disputed, a third-party auditor can verify the entire election from raw blockchain data. Here is the exact procedure:

#### Phase 1: Data Extraction

```bash
# 1. Fetch all VoteCast events from the smart contract
cast logs --address 0xCONTRACT_ADDRESS \
  --from-block ELECTION_START_BLOCK \
  --to-block ELECTION_END_BLOCK \
  "VoteCast(address,uint256,bytes32)" \
  --rpc-url $RPC_URL > vote_events.json

# 2. Fetch all VoterAuthorized events
cast logs --address 0xCONTRACT_ADDRESS \
  "VoterAuthorized(address)" > authorized_voters.json

# 3. Fetch all AddCandidate events
cast logs --address 0xCONTRACT_ADDRESS \
  "CandidateAdded(uint256,string,string)" > candidates.json
```

#### Phase 2: Cross-Verification

| Check | Method | Expected Result |
|-------|--------|-----------------|
| **Total votes == sum of candidate votes** | Sum all `voteCount` values on-chain | Must equal total `VoteCast` events |
| **No double votes** | Check `hasVoted[address]` for each unique sender | Each address appears exactly once |
| **All voters were authorized** | Cross-reference `VoteCast.sender` with `VoterAuthorized` events | 100% match required |
| **Timeline integrity** | Check block timestamps of all `VoteCast` events | All must fall within election window |
| **ZKP validity** | Re-verify each `voteCommitment` against the ZKP circuit | All proofs must pass verification |

#### Phase 3: Statistical Analysis

- **Benford's Law test** on vote distributions per constituency
- **Turnout anomaly detection** — flag constituencies with >95% turnout
- **Temporal analysis** — check for suspicious voting patterns (e.g., 100 votes in 1 second)

### Auditor's View (Built-in Page)

Our system includes an `/admin-panel` Audit Logs tab that provides:
- Filterable, searchable table of all admin actions
- Transaction hashes linked to Etherscan
- CSV/JSON export for external analysis
- Timestamp correlation with backend audit logs

---

## Election Day Operations Runbook

### Pre-Election (T-24 hours)

| Step | Action | Owner | Verification |
|------|--------|-------|-------------|
| 1 | Deploy final smart contract to mainnet | CTO + 2 witnesses | Verify source on Etherscan |
| 2 | Set contract to `REGISTRATION` phase | Admin wallet (multi-sig) | Check `electionState()` returns 0 |
| 3 | Bulk-authorize all voters from voter roll CSV | Admin | Verify `authorizedVoterCount` matches CSV rows |
| 4 | Start frontend deployment pipeline | DevOps | Verify SRI hashes match local build |
| 5 | Test with 5 dummy votes on staging | QA team | Verify all 5 receipts on block explorer |
| 6 | Enable rate limiters (10 req/min login, 3 req/min vote) | Backend | Test with `curl` flood |

### Election Day (T=0)

| Step | Action | Owner |
|------|--------|-------|
| 1 | Toggle election to `VOTING` phase | Admin multi-sig |
| 2 | Monitor API response times (target <200ms) | NOC dashboard |
| 3 | Watch failed login rate (alert if >50/min) | Security team |
| 4 | Monitor blockchain gas usage | DevOps |

### Emergency Playbook

| Incident | Severity | Response |
|----------|----------|----------|
| **API goes down** | P0 | Switch to backup RPC provider (Alchemy → Infura fallback). Restart backend pods. |
| **Database slow** | P1 | Scale PostgreSQL read replicas. Flush connection pool. |
| **Critical frontend bug** | P0 | Revert to last known good build via CDN rollback. Do NOT redeploy during voting. |
| **Suspicious vote pattern** | P1 | Pause affected constituency. Run forensic analysis on vote timestamps. |
| **DDoS attack** | P0 | Enable Cloudflare Under Attack Mode. Rate limit all IPs to 5 req/min. |
| **Smart contract bug** | P0 | Call `pauseElection()` (multi-sig). Assess scope. If critical, invoke UUPS upgrade path. |
| **Admin key compromise** | P0 | Immediately call `pauseElection()` from backup signer. Rotate admin key via TimelockController. |

### Post-Election (T+1 day)

1. Toggle election to `COMPLETED` phase
2. Generate final results PDF with cryptographic hash
3. Publish all smart contract events to IPFS for permanent archival
4. Run full audit procedure (see §17 Auditability)
5. Publish audit report to ECI website

### Key Metrics to Monitor

| Metric | Normal Range | Alert Threshold | Tool |
|--------|-------------|----------------|------|
| API response time | <200ms | >1000ms | Sentry Performance |
| Failed logins/min | <10 | >50 | AdminAuditLog |
| Transactions/min | 10-100 | >500 (possible bot) | Etherscan API |
| Memory usage | <512MB | >1.5GB | PM2 Monitoring |
| DB connection pool | <20 active | >45 active | Prisma metrics |

---

## Usability Testing Framework

### Testing Protocol

Before final submission, conduct a **guerrilla usability test** with 3 non-technical participants:

**Script for Tester:**
> "Hello, I'm going to show you a voting website. I'd like you to register as a voter and then cast a vote for any candidate. Please think aloud — tell me what you're thinking as you go. I won't help you unless you're completely stuck."

**Tasks:**
1. Register a new account (5 min expected)
2. Navigate to the Dashboard (1 min expected)
3. Connect a MetaMask wallet (3 min expected)
4. Cast a vote for a candidate (3 min expected)
5. Verify their vote was recorded (2 min expected)

### Observation Template

| Timestamp | Action | User's Reaction | Hesitation? | Error? | Notes |
|-----------|--------|-----------------|-------------|--------|-------|
| 0:00 | Opens landing page | "This looks official" | No | No | Good first impression |
| 0:30 | Clicks "Register" | Looks for button | 5s hesitation | No | Button placement OK |
| 1:15 | Fills Aadhaar field | "What format?" | 10s hesitation | Enters wrong format | Need placeholder text |
| ... | ... | ... | ... | ... | ... |

### Known UX Issues (From Internal Testing)

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| "Connect Wallet" button unclear to non-crypto users | High | Renamed to "Connect Secure Cryptographic Vault" with tooltip |
| MetaMask popup confused users | Medium | Added pre-step instruction: "A wallet popup will appear — click Confirm" |
| "Transaction confirmed" too technical | Medium | Changed to "Vote Sealed in Permanent Record ✓" |
| OTP email delayed >30s | Low | Added "Check spam folder" hint and resend cooldown timer |
| 200% zoom broke filter dropdowns | Medium | Fixed with `overflow-x: auto` on tables and `break-word` on text |

### Accessibility Testing Summary

| Test | Method | Result |
|------|--------|--------|
| **Keyboard-only navigation** | Tab through entire voting flow | ✅ All interactive elements focusable, visible focus ring |
| **Screen reader (NVDA)** | Navigate VotingPage with eyes closed | ✅ All buttons have descriptive `aria-label`, alerts use `aria-live` |
| **200% browser zoom** | Zoom Chrome to 200% | ✅ Layout doesn't overflow, text remains readable |
| **Color contrast** | axe DevTools scan | ✅ All text meets WCAG AA (4.5:1 ratio) |
| **Reduced motion** | Enable `prefers-reduced-motion` in OS | ✅ All animations disabled instantly |
| **Font scaling** | Use GIGW A+ font control | ✅ Text scales to 20px, layout adapts |

