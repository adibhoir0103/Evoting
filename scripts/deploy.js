const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // Get the contract factory
    const Voting = await hre.ethers.getContractFactory("Voting");

    // Deploy the contract
    console.log("Deploying Voting contract...");
    const voting = await Voting.deploy();
    await voting.waitForDeployment();

    const address = await voting.getAddress();

    console.log("Voting contract deployed to:", address);

    // Get deployer address
    const [deployer] = await hre.ethers.getSigners();
    console.log("Admin address:", deployer.address);

    // Save deployment info
    const deploymentInfo = {
        address: address,
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
        "deployment-info.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("Deployment info saved to deployment-info.json");

    // Copy contract artifacts to frontend
    const contractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");

    if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
    }

    // Copy ABI
    const artifact = await hre.artifacts.readArtifact("Voting");
    fs.writeFileSync(
        path.join(contractsDir, "Voting.json"),
        JSON.stringify(artifact, null, 2)
    );

    // Copy address
    fs.writeFileSync(
        path.join(contractsDir, "contract-address.json"),
        JSON.stringify({ address: address }, null, 2)
    );

    console.log("Contract ABI copied to frontend");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
