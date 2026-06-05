# Quickstart: Bharat E-Vote

**Date**: 2026-05-26

## Prerequisites

- Node.js v18+
- PostgreSQL installed and running
- MetaMask browser extension
- Accounts: Upstash Redis, Pinata IPFS, Brevo Email (all free tier)

## Setup (5 minutes)

### 1. Install Dependencies

```bash
# Root (Hardhat + smart contracts)
npm install

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure Environment

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/evoting"
JWT_SECRET="<generate-random-64-char-string>"
UPSTASH_REDIS_REST_URL="<your-upstash-url>"
UPSTASH_REDIS_REST_TOKEN="<your-upstash-token>"
BREVO_API_KEY="<your-brevo-key>"
PINATA_API_KEY="<your-pinata-key>"
PINATA_JWT="<your-pinata-jwt>"
```

### 3. Initialize Database

```bash
cd backend
npx prisma db push
```

### 4. Deploy Smart Contracts

**Terminal 1** — Start local blockchain:
```bash
npx hardhat node
```

**Terminal 2** — Deploy contracts:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

This generates `deployment-info.json` with contract addresses.

### 5. Start the Application

**Terminal 3** — Backend:
```bash
cd backend && node server.js
# → http://localhost:5000
```

**Terminal 4** — Frontend:
```bash
cd frontend && npm run dev
# → http://localhost:5173
```

### 6. Connect MetaMask

1. Open MetaMask → Add Network
2. Network: Localhost 8545, Chain ID: 1337
3. Import Hardhat Account #0 private key (from `npx hardhat node` output)

## Verify Setup

1. Visit `http://localhost:5173` — Landing page loads ✅
2. Navigate to `/signup` — Registration form renders ✅
3. Navigate to `/admin-login` — Admin login renders ✅
4. Check backend: `curl http://localhost:5000/api/v1/health` → 200 ✅

## Run Tests

```bash
# Smart contract tests (49+ tests)
npm run test

# Expected output: 49 passing
```

## Common Issues

| Issue | Solution |
|---|---|
| Prisma connection error | Ensure PostgreSQL is running and DATABASE_URL is correct |
| MetaMask wrong network | Switch to Localhost 8545 (chainId 1337) |
| Contract deployment fails | Ensure `npx hardhat node` is running in Terminal 1 |
| OTP email not received | Check BREVO_API_KEY in .env; verify sender email in Brevo dashboard |
| Redis connection timeout | Verify UPSTASH_REDIS_REST_URL and token are correct |
