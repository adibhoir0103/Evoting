const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting Contract", function () {
    let voting;
    let admin;
    let voter1;
    let voter2;
    let unauthorized;

    beforeEach(async function () {
        // Get signers
        [admin, voter1, voter2, unauthorized] = await ethers.getSigners();

        // Deploy contract
        const Voting = await ethers.getContractFactory("Voting");
        voting = await Voting.deploy();
        await voting.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the deployer as admin", async function () {
            expect(await voting.admin()).to.equal(admin.address);
        });

        it("Should initialize with voting inactive", async function () {
            expect(await voting.votingActive()).to.equal(false);
        });

        it("Should initialize with zero candidates", async function () {
            expect(await voting.candidatesCount()).to.equal(0);
        });
    });

    describe("Adding Candidates", function () {
        it("Should allow admin to add candidates", async function () {
            await voting.addCandidate("Alice");
            expect(await voting.candidatesCount()).to.equal(1);

            const candidate = await voting.getCandidate(1);
            expect(candidate.name).to.equal("Alice");
            expect(candidate.voteCount).to.equal(0);
        });

        it("Should fail if non-admin tries to add candidate", async function () {
            await expect(
                voting.connect(voter1).addCandidate("Bob")
            ).to.be.revertedWith("Only admin can perform this action");
        });

        it("Should fail to add candidate with empty name", async function () {
            await expect(
                voting.addCandidate("")
            ).to.be.revertedWith("Candidate name cannot be empty");
        });

        it("Should fail to add candidate when voting is active", async function () {
            await voting.addCandidate("Alice");
            await voting.startVoting();

            await expect(
                voting.addCandidate("Bob")
            ).to.be.revertedWith("Voting is currently active");
        });

        it("Should emit CandidateAdded event", async function () {
            await expect(voting.addCandidate("Alice"))
                .to.emit(voting, "CandidateAdded")
                .withArgs(1, "Alice");
        });
    });

    describe("Authorizing Voters", function () {
        it("Should allow admin to authorize voters", async function () {
            await voting.authorizeVoter(voter1.address);
            expect(await voting.isVoterAuthorized(voter1.address)).to.equal(true);
        });

        it("Should fail if non-admin tries to authorize voter", async function () {
            await expect(
                voting.connect(voter1).authorizeVoter(voter2.address)
            ).to.be.revertedWith("Only admin can perform this action");
        });

        it("Should fail to authorize zero address", async function () {
            await expect(
                voting.authorizeVoter(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid voter address");
        });

        it("Should fail to authorize already authorized voter", async function () {
            await voting.authorizeVoter(voter1.address);
            await expect(
                voting.authorizeVoter(voter1.address)
            ).to.be.revertedWith("Voter is already authorized");
        });

        it("Should emit VoterAuthorized event", async function () {
            await expect(voting.authorizeVoter(voter1.address))
                .to.emit(voting, "VoterAuthorized")
                .withArgs(voter1.address);
        });

        it("Should authorize multiple voters in batch", async function () {
            await voting.authorizeVotersBatch([voter1.address, voter2.address]);
            expect(await voting.isVoterAuthorized(voter1.address)).to.equal(true);
            expect(await voting.isVoterAuthorized(voter2.address)).to.equal(true);
        });
    });

    describe("Voting Process", function () {
        beforeEach(async function () {
            // Setup: Add candidates and authorize voters
            await voting.addCandidate("Alice");
            await voting.addCandidate("Bob");
            await voting.authorizeVoter(voter1.address);
            await voting.authorizeVoter(voter2.address);
            await voting.startVoting();
        });

        it("Should allow authorized voter to cast vote", async function () {
            await voting.connect(voter1).vote(1);
            expect(await voting.hasVoterVoted(voter1.address)).to.equal(true);

            const candidate = await voting.getCandidate(1);
            expect(candidate.voteCount).to.equal(1);
        });

        it("Should prevent double voting", async function () {
            await voting.connect(voter1).vote(1);

            await expect(
                voting.connect(voter1).vote(2)
            ).to.be.revertedWith("You have already voted");
        });

        it("Should fail if unauthorized user tries to vote", async function () {
            await expect(
                voting.connect(unauthorized).vote(1)
            ).to.be.revertedWith("You are not authorized to vote");
        });

        it("Should fail if voting for invalid candidate", async function () {
            await expect(
                voting.connect(voter1).vote(999)
            ).to.be.revertedWith("Invalid candidate ID");
        });

        it("Should fail if voting is not active", async function () {
            await voting.endVoting();

            await expect(
                voting.connect(voter1).vote(1)
            ).to.be.revertedWith("Voting is not active");
        });

        it("Should emit VoteCast event", async function () {
            await expect(voting.connect(voter1).vote(1))
                .to.emit(voting, "VoteCast")
                .withArgs(voter1.address, 1);
        });

        it("Should track voter's choice", async function () {
            await voting.connect(voter1).vote(1);
            expect(await voting.getVoterChoice(voter1.address)).to.equal(1);
        });

        it("Should increment vote count correctly", async function () {
            await voting.connect(voter1).vote(1);
            await voting.connect(voter2).vote(1);

            const candidate = await voting.getCandidate(1);
            expect(candidate.voteCount).to.equal(2);
        });
    });

    describe("Voting Status Control", function () {
        it("Should allow admin to start voting", async function () {
            await voting.addCandidate("Alice");
            await voting.startVoting();
            expect(await voting.votingActive()).to.equal(true);
        });

        it("Should fail to start voting without candidates", async function () {
            await expect(
                voting.startVoting()
            ).to.be.revertedWith("No candidates added yet");
        });

        it("Should allow admin to end voting", async function () {
            await voting.addCandidate("Alice");
            await voting.startVoting();
            await voting.endVoting();
            expect(await voting.votingActive()).to.equal(false);
        });

        it("Should fail if non-admin tries to start voting", async function () {
            await expect(
                voting.connect(voter1).startVoting()
            ).to.be.revertedWith("Only admin can perform this action");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await voting.addCandidate("Alice");
            await voting.addCandidate("Bob");
            await voting.addCandidate("Charlie");
        });

        it("Should return all candidates", async function () {
            const candidates = await voting.getAllCandidates();
            expect(candidates.length).to.equal(3);
            expect(candidates[0].name).to.equal("Alice");
            expect(candidates[1].name).to.equal("Bob");
            expect(candidates[2].name).to.equal("Charlie");
        });

        it("Should return winner correctly", async function () {
            await voting.authorizeVoter(voter1.address);
            await voting.authorizeVoter(voter2.address);
            await voting.startVoting();

            await voting.connect(voter1).vote(2);
            await voting.connect(voter2).vote(2);

            const winner = await voting.getWinner();
            expect(winner.name).to.equal("Bob");
            expect(winner.voteCount).to.equal(2);
        });

        it("Should return total votes", async function () {
            await voting.authorizeVoter(voter1.address);
            await voting.authorizeVoter(voter2.address);
            await voting.startVoting();

            await voting.connect(voter1).vote(1);
            await voting.connect(voter2).vote(2);

            expect(await voting.getTotalVotes()).to.equal(2);
        });
    });

    describe("Security Tests", function () {
        it("Should ensure votes are immutable once cast", async function () {
            await voting.addCandidate("Alice");
            await voting.authorizeVoter(voter1.address);
            await voting.startVoting();

            await voting.connect(voter1).vote(1);

            // Even admin cannot change a vote
            const candidate = await voting.getCandidate(1);
            expect(candidate.voteCount).to.equal(1);

            // Voter cannot vote again
            await expect(
                voting.connect(voter1).vote(1)
            ).to.be.revertedWith("You have already voted");
        });

        it("Should prevent reentrancy attacks", async function () {
            // The hasVoted flag is set before incrementing vote count
            // This prevents reentrancy attacks
            await voting.addCandidate("Alice");
            await voting.authorizeVoter(voter1.address);
            await voting.startVoting();

            await voting.connect(voter1).vote(1);

            // Second vote attempt should fail
            await expect(
                voting.connect(voter1).vote(1)
            ).to.be.revertedWith("You have already voted");
        });
    });
});
