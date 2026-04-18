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
        const Voting = await ethers.getContractFactory("VotingV2");
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

        it("Should initialize with timeline disabled", async function () {
            expect(await voting.timelineEnabled()).to.equal(false);
        });
    });

    describe("Adding Candidates", function () {
        it("Should allow admin to add candidates with full details", async function () {
            await voting.addCandidate("Alice", "Party A", "PA", 1, 1);
            expect(await voting.candidatesCount()).to.equal(1);

            const candidate = await voting.getCandidate(1);
            expect(candidate.name).to.equal("Alice");
            expect(candidate.partyName).to.equal("Party A");
            expect(candidate.partySymbol).to.equal("PA");
            expect(candidate.stateCode).to.equal(1);
            expect(candidate.constituencyCode).to.equal(1);
            expect(candidate.voteCount).to.equal(0);
        });

        it("Should allow admin to add simple candidates (backward compat)", async function () {
            await voting.addCandidateSimple("Bob");
            expect(await voting.candidatesCount()).to.equal(1);

            const candidate = await voting.getCandidate(1);
            expect(candidate.name).to.equal("Bob");
            expect(candidate.partyName).to.equal("");
            expect(candidate.stateCode).to.equal(0);
        });

        it("Should fail if non-admin tries to add candidate", async function () {
            await expect(
                voting.connect(voter1).addCandidate("Bob", "Party B", "PB", 1, 1)
            ).to.be.revertedWith("Only admin can perform this action");
        });

        it("Should fail to add candidate with empty name", async function () {
            await expect(
                voting.addCandidate("", "Party", "P", 0, 0)
            ).to.be.revertedWith("Candidate name cannot be empty");
        });

        it("Should fail to add candidate when voting is active", async function () {
            await voting.addCandidateSimple("Alice");
            await voting.startVoting();

            await expect(
                voting.addCandidateSimple("Bob")
            ).to.be.revertedWith("Voting is currently active");
        });

        it("Should emit CandidateAdded event with full details", async function () {
            await expect(voting.addCandidate("Alice", "Party A", "PA", 1, 2))
                .to.emit(voting, "CandidateAdded")
                .withArgs(1, "Alice", "Party A", 1, 2);
        });
    });

    describe("Authorizing Voters", function () {
        it("Should allow admin to authorize voters with constituency", async function () {
            await voting.authorizeVoter(voter1.address, 1, 5);
            expect(await voting.isVoterAuthorized(voter1.address)).to.equal(true);

            const info = await voting.getVoterInfo(voter1.address);
            expect(info.stateCode).to.equal(1);
            expect(info.constituencyCode).to.equal(5);
        });

        it("Should allow admin to authorize voters (simple)", async function () {
            await voting.authorizeVoterSimple(voter1.address);
            expect(await voting.isVoterAuthorized(voter1.address)).to.equal(true);
        });

        it("Should fail if non-admin tries to authorize voter", async function () {
            await expect(
                voting.connect(voter1).authorizeVoter(voter2.address, 0, 0)
            ).to.be.revertedWith("Only admin can perform this action");
        });

        it("Should fail to authorize zero address", async function () {
            await expect(
                voting.authorizeVoterSimple(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid voter address");
        });

        it("Should fail to authorize already authorized voter", async function () {
            await voting.authorizeVoterSimple(voter1.address);
            await expect(
                voting.authorizeVoterSimple(voter1.address)
            ).to.be.revertedWith("Voter is already authorized");
        });

        it("Should emit VoterAuthorized event with constituency info", async function () {
            await expect(voting.authorizeVoter(voter1.address, 3, 7))
                .to.emit(voting, "VoterAuthorized")
                .withArgs(voter1.address, 3, 7);
        });

        it("Should authorize multiple voters in batch", async function () {
            await voting.authorizeVotersBatch([voter1.address, voter2.address]);
            expect(await voting.isVoterAuthorized(voter1.address)).to.equal(true);
            expect(await voting.isVoterAuthorized(voter2.address)).to.equal(true);
        });

        it("Should reject batch authorization exceeding 100 addresses", async function () {
            // Create array of 101 addresses
            const addresses = Array.from({ length: 101 }, (_, i) =>
                ethers.Wallet.createRandom().address
            );
            await expect(
                voting.authorizeVotersBatch(addresses)
            ).to.be.revertedWith("Batch size exceeds maximum of 100");
        });
    });

    describe("Voting Process", function () {
        beforeEach(async function () {
            // Setup: Add candidates and authorize voters
            await voting.addCandidateSimple("Alice");
            await voting.addCandidateSimple("Bob");
            await voting.authorizeVoterSimple(voter1.address);
            await voting.authorizeVoterSimple(voter2.address);
            await voting.startVoting();
        });

        it("Should allow authorized voter to cast vote", async function () {
            await voting.connect(voter1).vote(1);
            expect(await voting.hasVoterVoted(voter1.address)).to.equal(true);

            const candidate = await voting.getCandidate(1);
            expect(candidate.voteCount).to.equal(1);
        });

        it("Should allow limited re-voting but stop at MAX_REVOTES", async function () {
            await voting.connect(voter1).vote(1); // 1st
            await voting.connect(voter1).vote(2); // 2nd
            await voting.connect(voter1).vote(1); // 3rd (MAX_REVOTES limit)

            await expect(
                voting.connect(voter1).vote(2)
            ).to.be.revertedWith("Maximum re-vote limit reached");
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

        it("Should emit VoteCast event without voter address (secret ballot)", async function () {
            const tx = await voting.connect(voter1).vote(1);
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return voting.interface.parseLog(log)?.name === 'VoteCast';
                } catch { return false; }
            });
            expect(event).to.not.be.undefined;
            const parsed = voting.interface.parseLog(event);
            expect(parsed.args[0]).to.not.equal(1); // candidateId is obfuscated into a keccak256 hash
            expect(parsed.args[2]).to.equal(1); // voteVersion should be 1
            // Verify voter address is NOT in the event (secret ballot)
            expect(parsed.args.length).to.equal(3); // only obfuscatedId, timestamp, and version
        });

        it("Should NOT expose voter's choice (secret ballot)", async function () {
            await voting.connect(voter1).vote(1);
            // getVoterChoice was removed — voter's choice is private
            // Only hasVoted is exposed, not which candidate they chose
            expect(await voting.hasVoterVoted(voter1.address)).to.equal(true);
            const info = await voting.getVoterInfo(voter1.address);
            // getVoterInfo returns 6 values: isAuthorized, hasVoted, stateCode, constituencyCode, voteVersion, canRevote
            // No votedCandidateId field
            expect(info.length).to.equal(6);
        });

        it("Should prevent admin from voting", async function () {
            await voting.authorizeVoterSimple(admin.address);
            await expect(
                voting.vote(1)
            ).to.be.revertedWith("Admin cannot vote");
        });

        it("Should increment vote count correctly", async function () {
            await voting.connect(voter1).vote(1);
            await voting.connect(voter2).vote(1);

            const candidate = await voting.getCandidate(1);
            expect(candidate.voteCount).to.equal(2);
        });
    });

    describe("Constituency-Based Voting", function () {
        beforeEach(async function () {
            // Add candidates to specific constituencies
            await voting.addCandidate("Alice", "Party A", "PA", 1, 1); // State 1, Constituency 1
            await voting.addCandidate("Bob", "Party B", "PB", 1, 2);   // State 1, Constituency 2
            await voting.addCandidate("Charlie", "Party C", "PC", 2, 1); // State 2, Constituency 1

            // Authorize voters with specific constituencies
            await voting.authorizeVoter(voter1.address, 1, 1); // State 1, Constituency 1
            await voting.authorizeVoter(voter2.address, 1, 2); // State 1, Constituency 2
            await voting.startVoting();
        });

        it("Should allow voter to vote for candidate in their constituency", async function () {
            await voting.connect(voter1).vote(1); // Alice is in same constituency
            expect(await voting.hasVoterVoted(voter1.address)).to.equal(true);
        });

        it("Should prevent voter from voting for candidate in different state", async function () {
            await expect(
                voting.connect(voter1).vote(3) // Charlie is in State 2
            ).to.be.revertedWith("You can only vote for candidates in your state");
        });

        it("Should prevent voter from voting for candidate in different constituency", async function () {
            await expect(
                voting.connect(voter1).vote(2) // Bob is in Constituency 2
            ).to.be.revertedWith("You can only vote for candidates in your constituency");
        });

        it("Should return candidates filtered by constituency", async function () {
            const candidates = await voting.getCandidatesByConstituency(1, 1);
            expect(candidates.length).to.equal(1);
            expect(candidates[0].name).to.equal("Alice");
        });
    });

    describe("Timeline Controls", function () {
        beforeEach(async function () {
            await voting.addCandidateSimple("Alice");
        });

        it("Should set voting timeline", async function () {
            const now = Math.floor(Date.now() / 1000);
            await voting.setVotingTimeline(now, now + 3600);

            expect(await voting.timelineEnabled()).to.equal(true);
            expect(await voting.votingStartTime()).to.equal(now);
            expect(await voting.votingEndTime()).to.equal(now + 3600);
        });

        it("Should fail if end time is before start time", async function () {
            const now = Math.floor(Date.now() / 1000);
            await expect(
                voting.setVotingTimeline(now + 3600, now)
            ).to.be.revertedWith("End time must be after start time");
        });

        it("Should allow disabling timeline", async function () {
            const now = Math.floor(Date.now() / 1000);
            await voting.setVotingTimeline(now, now + 3600);
            await voting.disableTimeline();

            expect(await voting.timelineEnabled()).to.equal(false);
        });

        it("Should return timeline info", async function () {
            const now = Math.floor(Date.now() / 1000);
            await voting.setVotingTimeline(now, now + 3600);

            const timeline = await voting.getVotingTimeline();
            expect(timeline._timelineEnabled).to.equal(true);
            expect(timeline._startTime).to.equal(now);
        });
    });

    describe("Voting Status Control", function () {
        it("Should allow admin to start voting", async function () {
            await voting.addCandidateSimple("Alice");
            await voting.startVoting();
            expect(await voting.votingActive()).to.equal(true);
        });

        it("Should fail to start voting without candidates", async function () {
            await expect(
                voting.startVoting()
            ).to.be.revertedWith("No candidates added yet");
        });

        it("Should allow admin to end voting", async function () {
            await voting.addCandidateSimple("Alice");
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
            await voting.addCandidateSimple("Alice");
            await voting.addCandidateSimple("Bob");
            await voting.addCandidateSimple("Charlie");
        });

        it("Should return all candidates", async function () {
            const candidates = await voting.getAllCandidates();
            expect(candidates.length).to.equal(3);
            expect(candidates[0].name).to.equal("Alice");
            expect(candidates[1].name).to.equal("Bob");
            expect(candidates[2].name).to.equal("Charlie");
        });

        it("Should return winner correctly", async function () {
            await voting.authorizeVoterSimple(voter1.address);
            await voting.authorizeVoterSimple(voter2.address);
            await voting.startVoting();

            await voting.connect(voter1).vote(2);
            await voting.connect(voter2).vote(2);

            const winner = await voting.getWinner();
            expect(winner.name).to.equal("Bob");
            expect(winner.voteCount).to.equal(2);
        });

        it("Should return total votes", async function () {
            await voting.authorizeVoterSimple(voter1.address);
            await voting.authorizeVoterSimple(voter2.address);
            await voting.startVoting();

            await voting.connect(voter1).vote(1);
            await voting.connect(voter2).vote(2);

            expect(await voting.getTotalVotes()).to.equal(2);
        });
    });

    describe("Vote Receipts", function () {
        it("Should generate a vote receipt after voting", async function () {
            await voting.addCandidateSimple("Alice");
            await voting.authorizeVoterSimple(voter1.address);
            await voting.startVoting();
            await voting.connect(voter1).vote(1);

            const receipt = await voting.getVoteReceipt(voter1.address);
            expect(receipt).to.not.equal(ethers.ZeroHash);
            expect(receipt.length).to.equal(66); // 0x + 64 hex chars
        });

        it("Should fail to get receipt for non-voter", async function () {
            await voting.addCandidateSimple("Alice");
            await voting.authorizeVoterSimple(voter1.address);
            await voting.startVoting();

            await expect(
                voting.getVoteReceipt(voter1.address)
            ).to.be.revertedWith("Voter has not voted yet");
        });
    });

    describe("Security Tests", function () {
        it("Should decrement old candidate count when re-voting", async function () {
            await voting.addCandidateSimple("Alice");
            await voting.addCandidateSimple("Bob");
            await voting.authorizeVoterSimple(voter1.address);
            await voting.startVoting();

            await voting.connect(voter1).vote(1); // Vote Alice
            expect((await voting.getCandidate(1)).voteCount).to.equal(1);
            expect((await voting.getCandidate(2)).voteCount).to.equal(0);

            // Re-vote Bob
            await voting.connect(voter1).vote(2); 
            expect((await voting.getCandidate(1)).voteCount).to.equal(0);
            expect((await voting.getCandidate(2)).voteCount).to.equal(1);
        });

        it("Should only allow admin to control voting", async function () {
            await voting.addCandidateSimple("Alice");
            await voting.startVoting();

            await expect(
                voting.connect(voter1).endVoting()
            ).to.be.revertedWith("Only admin can perform this action");
        });
    });
});
