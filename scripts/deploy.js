const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

    // ============ Deploy Voting Contract ============
    const Voting = await hre.ethers.getContractFactory("Voting");
    console.log("\n📦 Deploying Voting contract...");
    const voting = await Voting.deploy();
    await voting.waitForDeployment();
    const votingAddress = await voting.getAddress();
    console.log("✅ Voting contract deployed to:", votingAddress);

    // ============ Deploy MinimalForwarder (for meta-transactions) ============
    let forwarderAddress = hre.ethers.ZeroAddress;
    try {
        const MinimalForwarder = await hre.ethers.getContractFactory("MinimalForwarder");
        console.log("\n📦 Deploying MinimalForwarder...");
        const forwarder = await MinimalForwarder.deploy();
        await forwarder.waitForDeployment();
        forwarderAddress = await forwarder.getAddress();
        console.log("✅ MinimalForwarder deployed to:", forwarderAddress);
    } catch (error) {
        console.log("⚠️  MinimalForwarder not deployed (optional):", error.message);
    }

    // ============ Deploy ZKPVoting Contract ============
    // Get candidate count from Voting contract
    const candidatesCount = await voting.candidatesCount();
    const electionId = "bharat-evote-2026";

    const ZKPVoting = await hre.ethers.getContractFactory("ZKPVoting");
    console.log("\n📦 Deploying ZKPVoting contract...");
    const zkpVoting = await ZKPVoting.deploy(forwarderAddress, candidatesCount, electionId);
    await zkpVoting.waitForDeployment();
    const zkpVotingAddress = await zkpVoting.getAddress();
    console.log("✅ ZKPVoting contract deployed to:", zkpVotingAddress);

    // ============ Save Deployment Info ============
    const deploymentInfo = {
        address: votingAddress,
        zkpVotingAddress: zkpVotingAddress,
        forwarderAddress: forwarderAddress,
        network: hre.network.name,
        deployer: deployer.address,
        electionId: electionId,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
        "deployment-info.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n💾 Deployment info saved to deployment-info.json");

    // ============ Copy Artifacts to Frontend ============
    const contractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");
    if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
    }

    // Copy Voting ABI
    const votingArtifact = await hre.artifacts.readArtifact("Voting");
    fs.writeFileSync(
        path.join(contractsDir, "Voting.json"),
        JSON.stringify(votingArtifact, null, 2)
    );

    // Copy ZKPVoting ABI
    const zkpArtifact = await hre.artifacts.readArtifact("ZKPVoting");
    fs.writeFileSync(
        path.join(contractsDir, "ZKPVoting.json"),
        JSON.stringify(zkpArtifact, null, 2)
    );

    // Copy addresses
    fs.writeFileSync(
        path.join(contractsDir, "contract-address.json"),
        JSON.stringify({
            address: votingAddress,
            zkpVotingAddress: zkpVotingAddress,
            forwarderAddress: forwarderAddress
        }, null, 2)
    );

    console.log("📋 Contract ABIs + addresses copied to frontend/src/contracts/");

    // ============ Summary ============
    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log(`Network:          ${hre.network.name}`);
    console.log(`Admin:            ${deployer.address}`);
    console.log(`Voting:           ${votingAddress}`);
    console.log(`ZKPVoting:        ${zkpVotingAddress}`);
    console.log(`Forwarder:        ${forwarderAddress}`);
    console.log(`Election ID:      ${electionId}`);
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
