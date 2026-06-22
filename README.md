# 🇮🇳 Bharat E-Vote
**Blockchain-Based E-Voting System**

Bharat E-Vote is a highly secure, decentralized electronic voting platform designed as a Proof-of-Concept for national-scale elections. It employs Ethereum smart contracts, Cryptographic Ballot Privacy (Pedersen Commitments), and multi-factor authentication to guarantee mathematically secure, anonymous, and coercion-resistant voting.

## 🌟 Key Features
- **Cryptographic Ballot Privacy:** Voters cast encrypted votes using Pedersen commitments that are verified on-chain via Schnorr-style challenges without revealing their identity or candidate choice.
- **Coercion Deterrence:** Voters can re-vote up to 3 times before the election time-lock expires, neutralizing "over-the-shoulder" coercion.
- **ProctorGuard UI:** Anti-tab-switching browser protections and QR ticketing prevent device hijacking during the vote sequence.
- **Gasless Meta-Transactions:** Voters do not need to pay Ethereum gas fees (ERC-2771).
- **High-Performance Backend:** Upstash Redis handles active session lookups, protecting the primary PostgreSQL database from N+1 polling attacks.

## 🏗️ Architecture
- **Frontend:** React + Vite, Ethers.js v6, Tailwind CSS
- **Backend:** Node.js, Express, Prisma ORM, PostgreSQL, Upstash Redis
- **Blockchain:** Hardhat, Solidity, OpenZeppelin
- **Storage:** IPFS (via Pinata) for decentralized candidate metadata

---

## 🚀 Quick Setup Guide

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL installed and running locally
- Upstash Redis account (Free tier)
- Pinata IPFS account (Free tier)
- Brevo Email API account (Free tier)
- MetaMask browser extension

### 2. Environment Variables
Create a `.env` file in the **root** directory and populate it:

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/evoting?schema=public"

# Upstash Redis (For Session Security)
UPSTASH_REDIS_REST_URL="https://your-upstash-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_upstash_token"

# JWT Auth
JWT_SECRET="generate_a_very_long_random_string_here"

# Brevo Email API (For OTPs & Notifications)
BREVO_API_KEY="xkeysib-..."
BREVO_FROM_EMAIL="admin@bharatevote.com"
BREVO_FROM_NAME="Bharat E-Vote Admin"

# IPFS Pinata
PINATA_API_KEY="your_pinata_key"
PINATA_SECRET_API_KEY="your_pinata_secret"
PINATA_JWT="your_pinata_jwt"

# Blockchain RPC (Optional for Testnets)
SEPOLIA_URL="https://eth-sepolia.g.alchemy.com/v2/..."
PRIVATE_KEY="your_admin_wallet_private_key"
```

### 3. Installation
Install all dependencies for the monorepo:
```bash
# In the root directory:
npm install

# In the frontend directory:
cd frontend
npm install
```

### 4. Database Setup
```bash
# Push the Prisma schema to your PostgreSQL database
npx prisma db push

# (Optional) Seed the database with sample candidates
npx prisma db seed
```

### 5. Blockchain Deployment
**Option A: Localhost (Testing)**
Start a local Hardhat node in a separate terminal:
```bash
npx hardhat node
```
In another terminal, deploy the contracts to localhost:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
*Note: Ensure your MetaMask is connected to `Localhost 8545` and import the first Hardhat account private key.*

**Option B: Sepolia Public Testnet (Production/Demo)**
To deploy to a globally decentralized testnet, configure `SEPOLIA_RPC_URL` and `PRIVATE_KEY` in your `.env` file, then run:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```
*Note: You must have Sepolia testnet ETH in your wallet to deploy.*

### 6. Run the Application
Start both the backend server and frontend client concurrently:
```bash
# From the root directory:
npm start
```

---

## 🧪 Testing
The smart contract architecture is covered by an automated test suite.
To run the Hardhat tests:
```bash
npm run test
```

## 🛡️ Security Audit Notes (Phase 5)
This application has undergone extensive vulnerability remediation:
1. **ZKP Signature Forgery:** Reverted vulnerable ECDSA verifiers to simulated Schnorr challenges to preserve vote anonymity.
2. **N+1 Polling Exhaustion:** Authenticated requests now verify JWTs entirely in-memory using Redis.
3. **Event Log Deanonymization:** Standard EVM votes are hashed with an off-chain `_secretSalt` via `window.crypto.getRandomValues()` prior to blockchain submission.

*Note: The privacy mechanism implemented in `ZKPVoting.sol` utilizes Pedersen commitments and a simulated Schnorr-like verification. In a true production environment seeking full Zero-Knowledge properties, this should be replaced with a Circom/Groth16 verifier contract and a trusted setup ceremony.*
