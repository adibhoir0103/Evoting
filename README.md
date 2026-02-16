# Blockchain E-Voting System

A secure, transparent, and immutable blockchain-based electronic voting system built with Ethereum, Solidity, React, and Tailwind CSS.

## 🚀 Features

- **Secure Voting**: Blockchain-based immutable vote storage
- **Access Control**: Admin-controlled voter authorization
- **Double Voting Prevention**: Cryptographically secure vote tracking
- **Real-time Updates**: Live vote count updates using blockchain events
- **Modern UI**: Beautiful responsive interface with Tailwind CSS
- **MetaMask Integration**: Seamless wallet connection
- **Comprehensive Testing**: Full test coverage with Hardhat

## 📋 Prerequisites

- Node.js (v16 or higher)
- MetaMask browser extension
- npm or yarn

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
# Install blockchain dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Compile Smart Contract

```bash
npx hardhat compile
```

### 3. Run Tests

```bash
npx hardhat test
```

## 🚀 Running Locally

### Start Local Blockchain

```bash
npx hardhat node
```
Keep this terminal running.

### Deploy Contract

In a new terminal:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

### Configure MetaMask

1. Add network:
   - Network Name: Hardhat Local
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 1337
   - Currency: ETH

2. Import test account using private key from Hardhat node output

### Start Frontend

```bash
cd frontend
npm start
```

Visit `http://localhost:3000`

## 📚 Usage

### Admin Functions
- Add candidates
- Authorize voters
- Start/stop voting
- View results

### Voter Functions
- Connect wallet
- Vote for candidates (once)
- View real-time results

## 🧪 Testing

Run the comprehensive test suite:

```bash
npx hardhat test
```

View test coverage:

```bash
npx hardhat coverage
```

## 📖 Documentation

See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for:
- Smart contract architecture
- Security mechanisms
- Frontend integration guide
- Testing strategy
- Deployment instructions
- Viva/oral exam preparation

## 🏗️ Tech Stack

- **Blockchain**: Ethereum, Solidity ^0.8.19
- **Framework**: Hardhat
- **Frontend**: React.js
- **Styling**: Tailwind CSS
- **Web3 Library**: Ethers.js v6
- **Wallet**: MetaMask

## 📁 Project Structure

```
evoting/
├── contracts/          # Smart contracts
├── scripts/           # Deployment scripts
├── test/              # Test files
├── frontend/          # React application
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── contracts/
└── hardhat.config.js
```

## 🔒 Security Features

- **Double Voting Prevention**: Each address can vote only once
- **Access Control**: onlyAdmin modifier for sensitive functions
- **Immutability**: Votes cannot be changed after casting
- **Input Validation**: Comprehensive checks on all inputs
- **Reentrancy Protection**: Checks-Effects-Interactions pattern

## 🌐 Testnet Deployment

1. Get testnet ETH from faucet
2. Configure `.env` with RPC URL and private key
3. Deploy:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

## 📝 License

MIT

## 👨‍💻 Author

Final Year Computer Science Project - 2026

## 🤝 Contributing

This is an academic project. Feel free to fork and modify for learning purposes.

## 📞 Support

For questions or issues, please refer to the comprehensive documentation.
