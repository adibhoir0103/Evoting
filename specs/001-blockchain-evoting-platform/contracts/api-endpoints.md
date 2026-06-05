# API Endpoint Contracts

**Date**: 2026-05-26

**Source**: `backend/routes/*.js` + [spec.md](file:///c:/Users/HP/Desktop/evoting/specs/001-blockchain-evoting-platform/spec.md)

## Base URL

```
/api/v1
```

## Authentication Routes (`/api/v1/auth`)

### POST `/auth/register`
Register a new voter account.

**Request Body**:
```json
{
  "name": "string (required)",
  "email": "string (required, RFC 5322)",
  "password": "string (required, min 8 chars)",
  "aadhaar_number": "string (required, 12 digits)",
  "phone": "string (optional)",
  "state_code": "string (required)",
  "constituency_code": "string (required)",
  "turnstileToken": "string (required)"
}
```

**Response** (201):
```json
{
  "success": true,
  "message": "Registration successful. Awaiting admin approval.",
  "voter_id": "string"
}
```

**Errors**: 400 (validation), 409 (duplicate email/Aadhaar), 429 (rate limited)

---

### POST `/auth/login`
Initiate voter login (Step 1: credentials).

**Request Body**:
```json
{
  "email": "string",
  "password": "string",
  "turnstileToken": "string",
  "keystrokeData": {
    "hold_times": "[number]",
    "flight_times": "[number]"
  }
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "OTP sent to registered email",
  "requires_mfa": true
}
```

---

### POST `/auth/verify-otp`
Complete MFA (Step 2: OTP verification).

**Request Body**:
```json
{
  "email": "string",
  "otp": "string (6 digits)"
}
```

**Response** (200):
```json
{
  "success": true,
  "token": "string (JWT)",
  "user": { "id", "name", "email", "role", "voter_id" }
}
```

---

### POST `/auth/forgot-password`
Request password reset OTP.

### POST `/auth/reset-password`
Reset password with OTP (invalidates all active sessions).

### POST `/auth/logout`
Terminate current session (clears Redis).

---

## User Routes (`/api/v1/user`)

*All require JWT authentication.*

### GET `/user/profile`
Get current user profile.

### PUT `/user/profile`
Update user profile (limited fields).

### GET `/user/elections`
List elections the voter is eligible for.

### GET `/user/vote-history`
Get voter's vote history with receipts.

---

## Vote Routes (`/api/v1/vote`)

*All require JWT authentication.*

### POST `/vote/cast`
Cast or re-cast a vote.

**Request Body**:
```json
{
  "election_id": "string (UUID)",
  "candidate_id": "string",
  "encrypted_vote": "string",
  "secret_salt": "string",
  "tx_hash": "string (0x...)",
  "block_number": "number"
}
```

**Response** (201):
```json
{
  "success": true,
  "receipt": {
    "ticket_token": "string",
    "tx_hash": "string",
    "qr_data": "string (base64)"
  },
  "vote_count": "number (1-3)"
}
```

**Errors**: 403 (not eligible), 409 (max re-votes reached), 400 (election not active)

---

### GET `/vote/verify/:txHash`
Verify a vote exists on the blockchain.

**Response** (200):
```json
{
  "verified": true,
  "block_number": "number",
  "timestamp": "string (ISO 8601)"
}
```

---

### GET `/vote/receipt/:electionId`
Get QR vote ticket for an election.

---

## ZKP Routes (`/api/v1/zkp`)

### POST `/zkp/generate`
Generate a zero-knowledge proof for a vote.

### POST `/zkp/verify`
Verify a ZKP proof.

---

## IPFS Routes (`/api/v1/ipfs`)

### POST `/ipfs/pin`
Pin candidate metadata to IPFS.

### GET `/ipfs/:cid`
Retrieve content from IPFS by CID.

---

## Meta-Transaction Routes (`/api/v1/meta-tx`)

### POST `/meta-tx/relay`
Relay a signed meta-transaction to the blockchain.

**Request Body**:
```json
{
  "request": {
    "from": "string (address)",
    "to": "string (contract address)",
    "value": "0",
    "gas": "string",
    "nonce": "string",
    "data": "string (encoded calldata)"
  },
  "signature": "string (EIP-712 signature)"
}
```

---

## Admin Routes (`/api/v1/admin`)

*All require JWT authentication + admin role.*

### POST `/admin/login`
Admin login with MFA.

### POST `/admin/verify-otp`
Admin OTP verification.

### GET `/admin/dashboard/stats`
Get admin dashboard statistics.

### Elections

- **POST** `/admin/elections` — Create election
- **GET** `/admin/elections` — List all elections
- **GET** `/admin/elections/:id` — Get election details
- **PUT** `/admin/elections/:id` — Update election
- **POST** `/admin/elections/:id/publish` — Publish election
- **POST** `/admin/elections/:id/open` — Open voting
- **POST** `/admin/elections/:id/pause` — Pause voting
- **POST** `/admin/elections/:id/resume` — Resume voting
- **POST** `/admin/elections/:id/close` — Close voting
- **GET** `/admin/elections/:id/results` — Get election results

### Voters

- **GET** `/admin/voters` — List voters (with filters)
- **POST** `/admin/voters/:id/approve` — Approve voter
- **POST** `/admin/voters/:id/reject` — Reject voter

### Audit & Support

- **GET** `/admin/audit-logs` — List admin audit logs
- **GET** `/admin/support-tickets` — List support tickets
- **POST** `/admin/support-tickets/:id/reply` — Reply to ticket

---

## Rate Limiting

| Endpoint Group | Limit |
|---|---|
| `/auth/register` | 5 requests / 15 min |
| `/auth/login` | 10 requests / 15 min |
| `/auth/verify-otp` | 5 requests / 5 min |
| `/vote/cast` | 3 requests / election (re-vote limit) |
| General API | 100 requests / min |

## Authentication

All protected endpoints require:
```
Authorization: Bearer <JWT>
```

JWT payload includes: `{ id, email, role, voter_id, iat, exp }`

Session validated against Redis on every request (single-session
enforcement).
