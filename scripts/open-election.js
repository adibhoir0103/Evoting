const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const Voting = await hre.ethers.getContractFactory("Voting");
    const deploymentInfoPath = path.join(__dirname, '..', 'deployment-info.json');
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf8'));
    const votingContract = Voting.attach(deploymentInfo.address);

    const signers = await hre.ethers.getSigners();
    
    // Authorize first 5 accounts just in case user is using them in MetaMask
    const votersStr = [];
    for(let i = 1; i <= 5; i++) {
        try {
            await (await votingContract.authorizeVoter(signers[i].address, 0, 0)).wait();
            votersStr.push(`Account ${i} (${signers[i].address}) -> AUTHORIZED`);
        } catch(e) {
            votersStr.push(`Account ${i} (${signers[i].address}) -> Already Authorized`);
        }
    }

    const isActive = await votingContract.votingActive();
    if (!isActive) {
        await (await votingContract.startVoting()).wait();
        console.log("🔓 ELECTION RE-OPENED SUCCESSFULLY!");
    } else {
        console.log("✅ Election is already open.");
    }
    
    console.log(`\nYou can now use these Hardhat accounts in MetaMask to vote:\n${votersStr.join('\n')}`);
    console.log(`\n(Make sure to use an account OTHER than Account #0 since Account #0 is the Admin and admins cannot vote!)`);
}

main().catch(console.error);
