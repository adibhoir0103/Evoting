const { ethers } = require("ethers");
const fs = require("fs");

async function main() {
    // SECURITY: Use environment variables for RPC URL and Private Key instead of hardcoding
    const ALCHEMY_URL = process.env.SEPOLIA_RPC_URL || "http://127.0.0.1:8545";
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    if (!PRIVATE_KEY) {
        throw new Error("Missing PRIVATE_KEY environment variable. Cannot cast vote without a wallet signature.");
    }

    const provider = new ethers.JsonRpcProvider(ALCHEMY_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const balance = await provider.getBalance(wallet.address);
    console.log(`\n======================================================`);
    console.log(`🏦 VOTER WALLET STATE`);
    console.log(`Address: ${wallet.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} SepoliaETH`);
    console.log(`======================================================\n`);

    if (balance === 0n) {
        throw new Error("Voter wallet has 0 balance! Cannot afford gas.");
    }

    const abiFile = JSON.parse(fs.readFileSync("./artifacts/contracts/Voting.sol/Voting.json", "utf8"));
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abiFile.abi, wallet);

    console.log(`[1] Pulling Candidates from Blockchain...`);
    const candidates = await contract.getAllCandidates();
    if (candidates.length === 0) {
         throw new Error("No candidates found on the Blockchain. Did you stamp one?");
    }

    console.log(`Found ${candidates.length} candidate(s)!`);
    const targetCandidate = candidates[0];
    console.log(`Targeting Candidate ID ${targetCandidate.id}: ${targetCandidate.name}\n`);

    console.log(`[2] Checking Election Status...`);
    const isActive = await contract.votingActive();
    if (!isActive) {
        throw new Error("The election is CLOSED! Did you click 'Approve & Start Voting'?");
    }
    console.log("Election is officially ACTIVE!\n");

    console.log(`[3] Checking if I am Authorized...`);
    const isAuth = await contract.isVoterAuthorized(wallet.address);
    if (!isAuth) {
        throw new Error("I am NOT authorized! You did not authorize my wallet address.");
    }
    console.log("I am successfully AUTHORIZED!\n");

    console.log(`[4] SECURELY CASTING VOTE TO THE ETHEREUM NETWORK...`);
    try {
        const tx = await contract.vote(targetCandidate.id);
        console.log(`\n🚀 TRANSACTION IN FLIGHT!`);
        console.log(`Tx Hash: ${tx.hash}`);
        console.log(`Link: https://sepolia.etherscan.io/tx/${tx.hash}\n`);
        
        console.log(`Waiting for block confirmation...`);
        const receipt = await tx.wait();
        console.log(`✅ BALLOT SUCCESSFULLY ENTERED INTO ETHEREUM BLOCK ${receipt.blockNumber}!\n`);
    } catch (err) {
        console.log(err.message);
    }
}

main().catch(console.error);
