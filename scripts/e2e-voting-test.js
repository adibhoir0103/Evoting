const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const prisma = require("../backend/lib/prisma");

async function main() {
    console.log("=========================================================================");
    console.log("🗳️ INITIATING E2E VOTING SIMULATION (5 VOTERS) WITH DB SYNC 🗳️");
    console.log("=========================================================================\n");

    const signers = await hre.ethers.getSigners();
    const admin = signers[0];
    const voters = signers.slice(1, 6); // The 5 voters

    // Load Smart Contract
    const Voting = await hre.ethers.getContractFactory("VotingV2");
    console.log("   Deploying fresh VotingV2 contract to ephemeral network...");
    const votingContract = await Voting.deploy();
    await votingContract.waitForDeployment();

    console.log(`✅ Connected to Smart Contract at: ${votingContract.target}`);

    // ==========================================
    // 1. SETUP CANDIDATES (BLOCKCHAIN)
    // ==========================================
    console.log("\n[PHASE 1: CANDIDATE & ELECTION SETUP]");
    let isActiveInitially = await votingContract.votingActive();
    if (isActiveInitially) {
        console.log("   (Election currently active. Closing it to add candidates...)");
        await (await votingContract.endVoting()).wait();
    }

    const candidatesCount = await votingContract.candidatesCount();
    if (candidatesCount == 0) {
       await (await votingContract.addCandidate("Dr. A.P.J. Abdul Kalam", "Independent", "IND", 0, 0)).wait();
       await (await votingContract.addCandidate("Vikram Sarabhai", "Science Party", "SCI", 0, 0)).wait();
       await (await votingContract.addCandidate("Homi J. Bhabha", "Atomic Party", "ATM", 0, 0)).wait();
    }
    const candidateArray = await votingContract.getAllCandidates();
    console.log(`✅ Ensure Candidates exist (Found ${candidateArray.length}).`);

    // ==========================================
    // 2. REGISTER 5 VOTERS IN DATABASE (BYPASS AUTH)
    // ==========================================
    console.log("\n[PHASE 2: REGISTERING 5 VOTERS IN POSTGRESQL & BLOCKCHAIN]");
    
    // We will clear out any old test users starting with TESTVOTER to keep it clean
    await prisma.vote.deleteMany({ where: { voter_id: { startsWith: 'TESTVOTER' } } });
    await prisma.user.deleteMany({ where: { voter_id: { startsWith: 'TESTVOTER' } } });

    const dbVoters = [];
    for (let i = 0; i < 5; i++) {
        const voterId = `TESTVOTER${i+1}`;
        const email = `testvoter${i+1}@example.com`;
        
        // 2a. Insert into DB (Bypassing Registration + Admin Approval + Password Flow)
        const user = await prisma.user.create({
            data: {
                voter_id: voterId,
                email: email,
                fullname: `Simulation Voter ${i+1}`,
                aadhaar_number: crypto.createHash('sha256').update(`12345678901${i}`).digest('hex'),
                role: 'VOTER',
                registration_status: 'APPROVED',
                has_voted: false
            }
        });
        dbVoters.push(user);
        console.log(`   ✔️ Registered in DB: ${user.fullname} (${voterId})`);
    }

    // 2b. Authorize on Blockchain
    const voterAddresses = voters.map(v => v.address);
    await (await votingContract.authorizeVotersBatch(voterAddresses)).wait();
    console.log(`✅ Successfully whitelisted all ${voters.length} wallets on the Smart Contract.`);

    // ==========================================
    // 3. START VOTING ELECTION
    // ==========================================
    console.log("\n[PHASE 3: STARTING 10-MINUTE ELECTION]");
    let isActive = await votingContract.votingActive();
    if (!isActive) {
        await (await votingContract.startVoting()).wait();
    }
    console.log(`✅ Election Phase ACTIVE on Smart Contract.`);
    console.log(`   (Simulating a 10-minute voting window...)`);

    // ==========================================
    // 4. E2E VOTING PROCESS
    // ==========================================
    console.log("\n[PHASE 4: VOTERS CASTING BALLOTS]");
    
    for (let i = 0; i < 5; i++) {
        const randomCandidateId = Number(candidateArray[Math.floor(Math.random() * candidateArray.length)].id);
        const candidateName = candidateArray.find(c => Number(c.id) === randomCandidateId).name;
        const voter = dbVoters[i];

        console.log(`   ⏳ ${voter.fullname} is voting for ${candidateName}...`);
        
        // 4a. Execute Smart Contract Transaction (Blockchain)
        const secretSalt = 12345;
        const tx = await votingContract.connect(voters[i]).vote(randomCandidateId, secretSalt);
        const receipt = await tx.wait();
        const txHash = receipt.hash;
        console.log(`      🔗 Tx Mined! Hash: ${txHash.substring(0,10)}...`);

        // 4b. Sync with Backend Database (Bypass API directly via Prisma for speed, but mimicking API logic)
        await prisma.$transaction(async (txPrisma) => {
            // Check if already voted
            const currentUser = await txPrisma.user.findUnique({ where: { id: voter.id } });
            if (currentUser.has_voted) throw new Error("Already Voted");

            // Record Vote
            await txPrisma.vote.create({
                data: {
                    voter_id: voter.voter_id,
                    tx_hash: txHash
                }
            });

            // Mark as Voted
            await txPrisma.user.update({
                where: { id: voter.id },
                data: { has_voted: true }
            });
        });

        console.log(`      ✔️ DB Synced. Marked has_voted = true for ${voter.voter_id}.`);
    }

    console.log(`\n🎉 All ${voters.length} voters successfully cast their votes.`);

    // ==========================================
    // 5. CLOSE ELECTION & GENERATE RESULTS
    // ==========================================
    console.log("\n[PHASE 5: 10 MINUTES ELAPSED - CLOSING ELECTION]");
    await (await votingContract.endVoting()).wait();
    console.log(`✅ Voting Phase is now CLOSED on Smart Contract.`);

    console.log("\n[PHASE 6: GENERATING RESULTS (AS SEEN ON RESULTS PAGE)]");
    const finalState = await votingContract.getAllCandidates();
    let totalVotesCast = 0;
    
    console.log("\n📊 FINAL TALLY REPORT:");
    for (let c of finalState) {
        const id = Number(c.id);
        const name = c.name;
        const party = c.partyName;
        const votes = Number(c.voteCount);
        totalVotesCast += votes;
        console.log(`   - [ID ${id}] ${name} (${party}): ${votes} votes`);
    }

    console.log(`\n✅ Total Recorded Votes: ${totalVotesCast}`);
    
    if (totalVotesCast > 0) {
        const winner = await votingContract.getWinner();
        console.log(`\n🏆 OFFICIAL WINNER DECLARED:`);
        console.log(`   ${winner.name} (${winner.partyName}) with ${winner.voteCount} votes!`);
    }

    console.log("\n=========================================================================");
    console.log("✅ END-TO-END SIMULATION COMPLETE.");
    console.log("=========================================================================\n");

    // Cleanup Prisma
    await prisma.$disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
});
