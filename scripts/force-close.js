const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const addressPath = path.join(__dirname, "../frontend/src/contracts/contract-address.json");
    if (!fs.existsSync(addressPath)) {
        console.error("Contract address file not found!");
        process.exit(1);
    }

    const { address } = JSON.parse(fs.readFileSync(addressPath, "utf8"));
    console.log(`Connecting to VotingV2 contract at: ${address}`);

    const Voting = await hre.ethers.getContractFactory("VotingV2");
    const voting = Voting.attach(address);

    const isActive = await voting.votingActive();
    if (!isActive) {
        console.log("No election is currently active on the blockchain. You're good to go!");
        return;
    }

    console.log("Election is ACTIVE. Force closing it now...");
    const tx = await voting.endVoting();
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Voting has been successfully FORCE CLOSED on the blockchain.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
