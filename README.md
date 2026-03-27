# Blockchain E-Voting System — Bharat E-Vote

A secure, transparent, and privacy-preserving blockchain-based electronic voting system built with Ethereum, Solidity, React (Vite), and Supabase. Features Zero-Knowledge Proof (ZKP) voting, constituency-based elections, and enterprise-grade monitoring.

## 🚀 Features

### Core Voting
- **Blockchain-Based Voting**: Immutable vote storage on Ethereum smart contracts
- **Secret Ballot**: Vote choices are never stored on-chain (voter privacy preserved)
- **Double Voting Prevention**: Cryptographic enforcement at the contract level
- **Constituency-Based Elections**: State and constituency-level candidate filtering
- **Real-Time Results**: Live vote count updates via blockchain events
- **Vote Receipts**: Cryptographic proof of participation without revealing choice

### Zero-Knowledge Proofs (ZKP)
- **Pedersen Commitments**: Vote privacy via commitment schemes
- **Nullifier-Based Eligibility**: Prevents double voting without linking identity
- **Universal Verifiability**: Anyone can verify election integrity
- **IPFS Metadata**: Encrypted vote metadata stored off-chain

### Security & Monitoring
- **Sentry**: Error monitoring for frontend (React) and backend (Node.js)
- **PostHog**: Analytics and session replay
- **Cloudflare Turnstile**: Invisible bot protection (CAPTCHA alternative)
- **Upstash Redis**: Distributed rate limiting + persistent OTP storage
- **Helmet**: Security headers (CSP, HSTS, etc.)
- **Resend**: Production-grade transactional email delivery

### Authentication
- **Supabase Auth**: Email/phone OTP-based authentication
- **MetaMask Integration**: Seamless wallet connection with network detection
- **Admin RBAC**: Contract-level admin access control

## 📋 Prerequisites

- Node.js v16+
- MetaMask browser extension
- npm

## 🛠️ Installation

```bash
# 1. Install blockchain dependencies (root)
npm install

# 2. Install frontend dependencies
cd frontend && npm install && cd ..

# 3. Install backend dependencies
cd backend && npm install && cd ..

# 4. Compile smart contracts
npx hardhat compile
```

## ⚙️ Environment Setup

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in your Supabase, Sentry, Resend, Upstash, and Turnstile keys

# Frontend
cp frontend/.env.example frontend/.env.local
# Fill in your Sentry DSN, PostHog key, and Turnstile site key
```

## 🚀 Running Locally

### 1. Start Local Blockchain
```bash
npx hardhat node
```

### 2. Deploy Contracts (new terminal)
```bash
npx hardhat run scripts/deploy.js --network localhost
```

### 3. Start Backend (new terminal)
```bash
cd backend && npm run dev
```

### 4. Start Frontend (new terminal)
```bash
cd frontend && npm run dev
```

Visit `http://localhost:5173`

### 5. Configure MetaMask
The app auto-prompts to add the Hardhat network. Alternatively:
- **Network Name**: Hardhat Localhost
- **RPC URL**: `http://127.0.0.1:8545`
- **Chain ID**: `1337`
- **Currency**: ETH

Import a test account using any private key from the Hardhat node output.

## 🧪 Testing

```bash
# Run all 85 tests (Voting + ZKPVoting)
npx hardhat test

# View test coverage
npx hardhat coverage

# View gas report
REPORT_GAS=true npx hardhat test
```

## 📁 Project Structure

```
evoting/
├── contracts/
│   ├── Voting.sol              # Main voting contract
│   ├── ZKPVoting.sol           # Zero-Knowledge Proof extension
│   └── MinimalForwarder.sol    # ERC-2771 meta-transaction forwarder
├── scripts/
│   └── deploy.js               # Deploys all 3 contracts
├── test/
│   ├── Voting.test.js           # 45 tests for Voting contract
│   └── ZKPVoting.test.js        # 40 tests for ZKP contract
├── backend/
│   ├── server.js                # Express API server
│   ├── services/
│   │   ├── emailService.js      # Resend email delivery
│   │   ├── otpService.js        # Upstash Redis OTP store
│   │   └── rateLimiter.js       # Upstash distributed rate limiter
│   └── prisma/                  # Database schema
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── pages/               # 13 pages (Landing, Login, Voting, Admin, etc.)
│   │   ├── services/            # Blockchain + Auth services
│   │   └── contracts/           # Auto-copied ABIs from deploy
│   └── index.html
├── .github/workflows/           # CI pipeline
└── hardhat.config.js
```

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Ethereum, Solidity ^0.8.19, Hardhat |
| **Frontend** | React 19 (Vite), Vanilla CSS, Ethers.js v6 |
| **Backend** | Node.js, Express, Prisma ORM |
| **Auth** | Supabase Auth (Email/Phone OTP) |
| **Database** | PostgreSQL (Supabase) |
| **Wallet** | MetaMask |
| **Monitoring** | Sentry (errors), PostHog (analytics) |
| **Email** | Resend |
| **Cache/Rate Limiting** | Upstash Redis |
| **Bot Protection** | Cloudflare Turnstile |

## 🔒 Security Features

- **Secret Ballot**: `votedCandidateId` is never stored on-chain
- **Double Voting Prevention**: `hasVoted` flag + `require()` checks
- **Admin Cannot Vote**: Explicit `require(msg.sender != admin)`
- **Constituency Enforcement**: Voters can only vote in their assigned constituency
- **Timeline Controls**: Time-locked voting windows with `block.timestamp`
- **State Guards**: `setZKPMode()` and `setTrustedForwarder()` locked during active voting
- **Rate Limiting**: Per-IP and distributed Redis-based throttling
- **CSP Headers**: Helmet.js with strict Content Security Policy
- **Input Validation**: Comprehensive checks on all inputs
- **Reentrancy Protection**: Checks-Effects-Interactions pattern

## 📖 Documentation

See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for:
- Smart contract architecture diagrams
- Security audit report
- ZKP cryptographic protocol details
- API endpoint reference
- Deployment guide

## 📝 License

MIT

## 👨‍💻 Author

Final Year Computer Science Project — 2026
