const hre = require("hardhat");
const { PrismaClient } = require("../backend/node_modules/@prisma/client");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Connecting to PostgreSQL Database...");
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DIRECT_URL || "postgresql://postgres.iekwywihewufzojvfdkm:AidniSTQC%407642@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"
            }
        }
    });

    try {
        // Fetch voters who are APPROVED and have a linked wallet address
        const voters = await prisma.user.findMany({
            where: {
                registration_status: "APPROVED",
                wallet_address: {
                    not: null,
                },
            },
            select: {
                wallet_address: true,
                email: true
            }
        });

        console.log(`Found ${voters.length} approved voters with linked wallets.`);

        if (voters.length === 0) {
            console.log("No voters to authorize. Exiting.");
            return;
        }

        const addressesToAuthorize = voters.map(v => v.wallet_address);

        // Load Smart Contract
        const addressPath = path.join(__dirname, "../frontend/src/contracts/contract-address.json");
        if (!fs.existsSync(addressPath)) {
            console.error("Contract address file not found!");
            process.exit(1);
        }

        const { address } = JSON.parse(fs.readFileSync(addressPath, "utf8"));
        console.log(`Connecting to VotingV2 contract at: ${address}`);

        const Voting = await hre.ethers.getContractFactory("VotingV2");
        const voting = Voting.attach(address);

        console.log("Submitting batch authorization transaction to the blockchain...");
        
        // Note: We use authorizeVotersBatch which takes an array of addresses
        // The smart contract implementation uses stateCode=0 and constituencyCode=0
        const tx = await voting.authorizeVotersBatch(addressesToAuthorize);
        console.log(`Transaction sent: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        
        await tx.wait();
        console.log("✅ All voters successfully authorized on the blockchain!");
        
    } catch (error) {
        console.error("Error during synchronization:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
