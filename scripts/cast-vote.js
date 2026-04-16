const { ethers } = require("ethers");
const fs = require("fs");

async function main() {
    const ALCHEMY_URL = "https://eth-sepolia.g.alchemy.com/v2/XbNu_qjjYV_V-FGBmkc3K";
    const PRIVATE_KEY = "0x15daebb7ca7fa71d3343d1f5ea39dd685f1f756c407807d55d53643d11e4a18b"; 
    const CONTRACT_ADDRESS = "0xEA9119676C0D784872AD1a9e61Ddbd810B2c21C2";

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
