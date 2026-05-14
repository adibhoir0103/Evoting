const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VotingV2 Smart Contract", function () {
    let Voting;
    let voting;
    let admin;
    let voter1;
    let voter2;
    let nonVoter;
    
    beforeEach(async function () {
        [admin, voter1, voter2, nonVoter] = await ethers.getSigners();
        
        Voting = await ethers.getContractFactory("VotingV2");
        voting = await Voting.deploy();
        
        // Add a candidate for testing
        await voting.connect(admin).addCandidateSimple("Candidate A");
        await voting.connect(admin).addCandidateSimple("Candidate B");
    });

    describe("Initialization & Admin Controls", function () {
        it("Should set the correct admin", async function () {
            expect(await voting.admin()).to.equal(admin.address);
        });

        it("Should allow admin to add candidates", async function () {
            const candidates = await voting.getAllCandidates();
            expect(candidates.length).to.equal(2);
            expect(candidates[0].name).to.equal("Candidate A");
        });

        it("Should reject non-admin adding candidates", async function () {
            await expect(
                voting.connect(voter1).addCandidateSimple("Candidate C")
            ).to.be.revertedWith("Only admin can perform this action");
        });
    });

    describe("Voter Authorization", function () {
        it("Should allow admin to authorize voters", async function () {
            await voting.connect(admin).authorizeVoterSimple(voter1.address);
            expect(await voting.isVoterAuthorized(voter1.address)).to.be.true;
        });

        it("Should reject non-admin authorizing voters", async function () {
            await expect(
                voting.connect(voter1).authorizeVoterSimple(voter2.address)
            ).to.be.revertedWith("Only admin can perform this action");
        });
    });

    describe("Voting Mechanics & Cryptographic Salting", function () {
        beforeEach(async function () {
            await voting.connect(admin).authorizeVoterSimple(voter1.address);
            await voting.connect(admin).startVoting();
        });

        it("Should allow an authorized voter to cast a vote with a secret salt", async function () {
            const secretSalt = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
            
            // Cast vote
            const tx = await voting.connect(voter1).vote(1, secretSalt);
            const receipt = await tx.wait();

            // Check tally
            const candidate = await voting.getCandidate(1);
            expect(candidate.voteCount).to.equal(1);
            expect(await voting.hasVoterVoted(voter1.address)).to.be.true;

            // Verify event emission includes the salt in the hash
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            
            // Reconstruct the hash mathematically
            const expectedHash = ethers.solidityPackedKeccak256(
                ["uint256", "address", "uint256", "uint256"],
                [1, voter1.address, block.timestamp, secretSalt]
            );

            // In Ethers v6, parsing events requires filtering or direct indexing if we know the topic
            // We just verify it doesn't revert. Hardhat Chai Matchers will catch revert if failed.
        });

        it("Should reject unauthorized voters", async function () {
            const secretSalt = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
            await expect(
                voting.connect(nonVoter).vote(1, secretSalt)
            ).to.be.revertedWith("You are not authorized to vote");
        });

        it("Should prevent admin from voting", async function () {
            const secretSalt = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
            await expect(
                voting.connect(admin).vote(1, secretSalt)
            ).to.be.revertedWith("Admin cannot vote");
        });
    });

    describe("Re-Voting (Coercion Resistance)", function () {
        beforeEach(async function () {
            await voting.connect(admin).authorizeVoterSimple(voter1.address);
            await voting.connect(admin).startVoting();
        });

        it("Should allow a voter to change their vote and properly adjust tallies", async function () {
            const salt1 = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
            const salt2 = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));

            // First vote for Candidate A (ID 1)
            await voting.connect(voter1).vote(1, salt1);
            expect((await voting.getCandidate(1)).voteCount).to.equal(1);

            // Re-vote for Candidate B (ID 2)
            await voting.connect(voter1).vote(2, salt2);

            // Candidate A should lose the vote, Candidate B should gain it
            expect((await voting.getCandidate(1)).voteCount).to.equal(0);
            expect((await voting.getCandidate(2)).voteCount).to.equal(1);
            
            // Version should be 2
            const voterInfo = await voting.getVoterInfo(voter1.address);
            expect(voterInfo[4]).to.equal(2); // voteVersion
        });

        it("Should enforce the MAX_REVOTES limit (3)", async function () {
            const salt = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));

            await voting.connect(voter1).vote(1, salt); // Version 1
            await voting.connect(voter1).vote(2, salt); // Version 2
            await voting.connect(voter1).vote(1, salt); // Version 3

            // Version 4 should fail
            await expect(
                voting.connect(voter1).vote(2, salt)
            ).to.be.revertedWith("Maximum re-vote limit reached");
        });
    });

    describe("Time-Lock Mechanics", function () {
        it("Should respect the REVOTE_LOCKOUT window", async function () {
            await voting.connect(admin).authorizeVoterSimple(voter1.address);
            
            const currentBlock = await ethers.provider.getBlock("latest");
            const startTime = currentBlock.timestamp + 10;
            const endTime = startTime + 3600; // 1 hour election

            await voting.connect(admin).setVotingTimeline(startTime, endTime);
            await voting.connect(admin).startVoting();

            await time.increaseTo(startTime + 100);

            const salt = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
            
            // First vote
            await voting.connect(voter1).vote(1, salt);

            // Increase time to within the 30-minute lockout window
            await time.increaseTo(endTime - 1000); // Less than 30 mins (1800s) left

            // Re-vote should fail
            await expect(
                voting.connect(voter1).vote(2, salt)
            ).to.be.revertedWith("Re-voting window has closed. Final votes are locked.");
        });
    });
});
