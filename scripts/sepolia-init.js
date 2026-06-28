const hre = require("hardhat");

async function main() {
    const Voting = await hre.ethers.getContractFactory("VotingV2");
    
    // Address we just deployed
    const votingContract = Voting.attach("0x335AD7333f013cab54aa43Dc59C5fcbCcF56302f");

    console.log("Adding candidates...");
    await (await votingContract.addCandidate("Arjun Sharma", "Democratic Reform Party", "Torch", 0, 0)).wait();
    console.log("Candidate 1 added");
    
    await (await votingContract.addCandidate("Priya Patel", "National Progress Alliance", "Sun", 0, 0)).wait();
    console.log("Candidate 2 added");

    console.log("Starting voting...");
    await (await votingContract.startVoting()).wait();
    
    console.log("✅ Sepolia Election is now OPEN!");
}

main().catch(console.error);
