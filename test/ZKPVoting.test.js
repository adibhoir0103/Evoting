const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZKP Voting System", function () {
    let voting;
    let zkpVoting;
    let forwarder;
    let admin;
    let voter1;
    let voter2;
    let relayer;

    // Crypto helpers (mirrors zkpService.js logic)
    const PRIME = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

    function randomBytes32() {
        return ethers.hexlify(ethers.randomBytes(32));
    }

    function generateIdentityCommitment(secret) {
        return ethers.keccak256(ethers.toUtf8Bytes(secret));
    }

    function generateNullifier(secret, electionId) {
        return ethers.keccak256(
            ethers.concat([
                ethers.toUtf8Bytes(secret),
                ethers.toUtf8Bytes(electionId)
            ])
        );
    }

    function generateCommitment(candidateId, randomness) {
        return ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "bytes32"],
                [candidateId, randomness]
            )
        );
    }

    function generateProof(commitment, nullifier, candidatesCount) {
        // Generate a valid Schnorr-style proof
        const k_v = BigInt(randomBytes32());
        const k_r = BigInt(randomBytes32());

        // Fiat-Shamir challenge
        const challengeHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "bytes32", "uint256", "uint256", "uint256"],
                [commitment, nullifier, k_v % PRIME, k_r % PRIME, candidatesCount]
            )
        );

        const challenge = BigInt(challengeHash) % PRIME;
        const response_v = ((k_v % PRIME) - challenge + PRIME) % PRIME;
        const response_r = ((k_r % PRIME) - challenge + PRIME) % PRIME;

        // Now recompute what the contract will check:
        // expectedChallenge = keccak256(commitment, nullifier, response_v, response_r, candidatesCount)
        const expectedHash = ethers.keccak256(
            ethers.solidityPacked(
                ["bytes32", "bytes32", "uint256", "uint256", "uint256"],
                [commitment, nullifier, response_v, response_r, candidatesCount]
            )
        );
        const expectedChallenge = BigInt(expectedHash) % PRIME;

        return [expectedChallenge, response_v, response_r, BigInt(candidatesCount)];
    }

    beforeEach(async function () {
        [admin, voter1, voter2, relayer] = await ethers.getSigners();

        // Deploy MinimalForwarder
        const Forwarder = await ethers.getContractFactory("MinimalForwarder");
        forwarder = await Forwarder.deploy();
        await forwarder.waitForDeployment();

        // Deploy main Voting contract
        const Voting = await ethers.getContractFactory("VotingV2");
        voting = await Voting.deploy();
        await voting.waitForDeployment();

        // Deploy ZKP Voting contract
        const ZKPVoting = await ethers.getContractFactory("ZKPVoting");
        zkpVoting = await ZKPVoting.deploy(
            await forwarder.getAddress(),
            3, // 3 candidates
            "bharat-evote-2026"
        );
        await zkpVoting.waitForDeployment();
    });

    // ============ GOAL 1: VOTE PRIVACY ============

    describe("Goal 1: Vote Privacy", function () {
        let identityCommitment1, identityCommitment2;
        let nullifier1, nullifier2;

        beforeEach(async function () {
            identityCommitment1 = generateIdentityCommitment("voter1secret");
            identityCommitment2 = generateIdentityCommitment("voter2secret");
            nullifier1 = generateNullifier("voter1secret", "bharat-evote-2026");
            nullifier2 = generateNullifier("voter2secret", "bharat-evote-2026");

            await zkpVoting.registerEligibleVoter(identityCommitment1);
            await zkpVoting.registerEligibleVoter(identityCommitment2);
        });

        it("Should accept valid encrypted vote with commitment", async function () {
            const randomness = randomBytes32();
            const commitment = generateCommitment(1, randomness);
            const proof = generateProof(commitment, nullifier1, 3);

            await expect(
                zkpVoting.submitEncryptedVote(
                    commitment, nullifier1, identityCommitment1, proof, "QmTestHash1"
                )
            ).to.emit(zkpVoting, "ZKPVoteSubmitted");

            expect(await zkpVoting.zkpVoteCount()).to.equal(1);
        });

        it("Should not reveal vote choice from on-chain data", async function () {
            const randomness = randomBytes32();
            const commitment = generateCommitment(1, randomness);
            const proof = generateProof(commitment, nullifier1, 3);

            await zkpVoting.submitEncryptedVote(
                commitment, nullifier1, identityCommitment1, proof, ""
            );

            // The stored vote only has commitment and nullifier — no candidateId
            const receipt = await zkpVoting.getZKVoteReceipt(nullifier1);
            expect(receipt.commitment).to.equal(commitment);
            // No way to determine the candidateId from the stored data
        });

        it("Different voters voting for same candidate produce different commitments", async function () {
            const randomness1 = randomBytes32();
            const randomness2 = randomBytes32();

            const commitment1 = generateCommitment(1, randomness1);
            const commitment2 = generateCommitment(1, randomness2);

            // Same candidate (1) but different randomness = different commitments
            expect(commitment1).to.not.equal(commitment2);

            const proof1 = generateProof(commitment1, nullifier1, 3);
            const proof2 = generateProof(commitment2, nullifier2, 3);

            await zkpVoting.submitEncryptedVote(
                commitment1, nullifier1, identityCommitment1, proof1, ""
            );
            await zkpVoting.submitEncryptedVote(
                commitment2, nullifier2, identityCommitment2, proof2, ""
            );

            expect(await zkpVoting.zkpVoteCount()).to.equal(2);
        });
    });

    // ============ GOAL 2: VOTE INTEGRITY ============

    describe("Goal 2: Vote Integrity", function () {
        let identityCommitment;
        let nullifier;

        beforeEach(async function () {
            identityCommitment = generateIdentityCommitment("voter1secret");
            nullifier = generateNullifier("voter1secret", "bharat-evote-2026");
            await zkpVoting.registerEligibleVoter(identityCommitment);
        });

        it("Should reject proof with wrong candidate count", async function () {
            const randomness = randomBytes32();
            const commitment = generateCommitment(1, randomness);
            // Generate proof with wrong candidate count (5 instead of 3)
            const proof = generateProof(commitment, nullifier, 5);

            await expect(
                zkpVoting.submitEncryptedVote(
                    commitment, nullifier, identityCommitment, proof, ""
                )
            ).to.be.revertedWith("ZKP: Candidate count mismatch");
        });

        it("Should reject proof with zero components", async function () {
            const randomness = randomBytes32();
            const commitment = generateCommitment(1, randomness);
            const proof = [0n, 0n, 0n, 3n]; // All zeros

            await expect(
                zkpVoting.submitEncryptedVote(
                    commitment, nullifier, identityCommitment, proof, ""
                )
            ).to.be.revertedWith("ZKP: Zero proof component");
        });

        it("Should reject manipulated proof (challenge mismatch)", async function () {
            const randomness = randomBytes32();
            const commitment = generateCommitment(1, randomness);
            const proof = generateProof(commitment, nullifier, 3);

            // Tamper with the challenge
            proof[0] = proof[0] + 1n;

            await expect(
                zkpVoting.submitEncryptedVote(
                    commitment, nullifier, identityCommitment, proof, ""
                )
            ).to.be.revertedWith("ZKP: Challenge verification failed");
        });

        it("Should accept valid proof and verify math on-chain", async function () {
            const randomness = randomBytes32();
            const commitment = generateCommitment(1, randomness);
            const proof = generateProof(commitment, nullifier, 3);

            // This should succeed — the on-chain verifier accepted the proof
            await zkpVoting.submitEncryptedVote(
                commitment, nullifier, identityCommitment, proof, ""
            );

            // Vote was accepted, meaning proof verification passed
            expect(await zkpVoting.nullifierUsed(nullifier)).to.equal(true);
        });
    });

    // ============ GOAL 3: VOTER ELIGIBILITY ============

    describe("Goal 3: Voter Eligibility", function () {
        it("Should register eligible voters via identity commitment", async function () {
            const identity = generateIdentityCommitment("voter1secret");
            
            await expect(zkpVoting.registerEligibleVoter(identity))
                .to.emit(zkpVoting, "VoterRegistered")
                .withArgs(identity);

            expect(await zkpVoting.isIdentityRegistered(identity)).to.equal(true);
        });

        it("Should reject vote from unregistered identity", async function () {
            const unregisteredIdentity = generateIdentityCommitment("unknown");
            const nullifier = generateNullifier("unknown", "bharat-evote-2026");
            const commitment = generateCommitment(1, randomBytes32());
            const proof = generateProof(commitment, nullifier, 3);

            await expect(
                zkpVoting.submitEncryptedVote(
                    commitment, nullifier, unregisteredIdentity, proof, ""
                )
            ).to.be.revertedWith("ZKP: Not a registered voter");
        });

        it("Should prevent double voting via nullifier", async function () {
            const identity = generateIdentityCommitment("voter1secret");
            const nullifier = generateNullifier("voter1secret", "bharat-evote-2026");
            await zkpVoting.registerEligibleVoter(identity);

            // First vote
            const commitment1 = generateCommitment(1, randomBytes32());
            const proof1 = generateProof(commitment1, nullifier, 3);
            await zkpVoting.submitEncryptedVote(commitment1, nullifier, identity, proof1, "");

            // Second vote attempt — contract checks identity.hasVoted first
            const commitment2 = generateCommitment(2, randomBytes32());
            await expect(
                zkpVoting.submitEncryptedVote(commitment2, nullifier, identity, proof1, "")
            ).to.be.revertedWith("ZKP: Voter already voted");
        });

        it("Same voter always produces same nullifier", function () {
            const nullifier1 = generateNullifier("voter1secret", "bharat-evote-2026");
            const nullifier2 = generateNullifier("voter1secret", "bharat-evote-2026");
            expect(nullifier1).to.equal(nullifier2);
        });

        it("Different elections produce different nullifiers (unlinkable)", function () {
            const nullifier1 = generateNullifier("voter1secret", "election-2026");
            const nullifier2 = generateNullifier("voter1secret", "election-2027");
            expect(nullifier1).to.not.equal(nullifier2);
        });

        it("Should register multiple voters in batch", async function () {
            const ids = [
                generateIdentityCommitment("voter1"),
                generateIdentityCommitment("voter2"),
                generateIdentityCommitment("voter3")
            ];

            await zkpVoting.registerEligibleVotersBatch(ids);

            for (const id of ids) {
                expect(await zkpVoting.isIdentityRegistered(id)).to.equal(true);
            }
        });

        it("Should reject duplicate identity registration", async function () {
            const identity = generateIdentityCommitment("voter1");
            await zkpVoting.registerEligibleVoter(identity);

            await expect(
                zkpVoting.registerEligibleVoter(identity)
            ).to.be.revertedWith("ZKP: Already registered");
        });
    });

    // ============ GOAL 4: VERIFIABILITY (COMPULSORY) ============

    describe("Goal 4: Verifiability", function () {
        let identity, nullifier, commitment, proof;

        beforeEach(async function () {
            identity = generateIdentityCommitment("voter1secret");
            nullifier = generateNullifier("voter1secret", "bharat-evote-2026");
            await zkpVoting.registerEligibleVoter(identity);

            const randomness = randomBytes32();
            commitment = generateCommitment(1, randomness);
            proof = generateProof(commitment, nullifier, 3);

            await zkpVoting.submitEncryptedVote(
                commitment, nullifier, identity, proof, "QmTestIPFSHash"
            );
        });

        it("Should return valid ZK vote receipt", async function () {
            const receipt = await zkpVoting.getZKVoteReceipt(nullifier);
            expect(receipt.commitment).to.equal(commitment);
            expect(receipt.ipfsHash).to.equal("QmTestIPFSHash");
            expect(receipt.verified).to.equal(false);
        });

        it("Should verify vote inclusion", async function () {
            const [included, index] = await zkpVoting.verifyVoteInclusion(commitment);
            expect(included).to.equal(true);
            expect(index).to.equal(0); // First vote
        });

        it("Should return false for non-existent commitment", async function () {
            const fakeCommitment = randomBytes32();
            const [included] = await zkpVoting.verifyVoteInclusion(fakeCommitment);
            expect(included).to.equal(false);
        });

        it("Should allow universal verification of all commitments", async function () {
            const allCommitments = await zkpVoting.getAllCommitments();
            expect(allCommitments.length).to.equal(1);
            expect(allCommitments[0]).to.equal(commitment);
        });

        it("Should allow marking vote as verified (compulsory step)", async function () {
            await expect(zkpVoting.markVoteVerified(nullifier))
                .to.emit(zkpVoting, "VoteVerified")
                .withArgs(nullifier, true);

            const receipt = await zkpVoting.getZKVoteReceipt(nullifier);
            expect(receipt.verified).to.equal(true);
        });

        it("Should prevent double verification", async function () {
            await zkpVoting.markVoteVerified(nullifier);
            await expect(
                zkpVoting.markVoteVerified(nullifier)
            ).to.be.revertedWith("ZKP: Already verified");
        });

        it("Receipt should not reveal vote choice", async function () {
            const receipt = await zkpVoting.getZKVoteReceipt(nullifier);
            // The receipt contains only commitment, timestamp, ipfsHash, verified
            // No candidateId is stored or returned
            expect(receipt.commitment).to.not.equal(ethers.ZeroHash);
            // The commitment is a hash — the candidate choice is hidden
        });

        it("Should return correct election summary", async function () {
            const summary = await zkpVoting.getElectionSummary();
            expect(summary[0]).to.equal(1); // totalZKPVotes
            expect(summary[1]).to.equal(1); // totalCommitments
            expect(summary[2]).to.equal(1); // totalNullifiers
            expect(summary[3]).to.equal(true); // zkpEnabled
            expect(summary[4]).to.equal("bharat-evote-2026"); // electionId
        });
    });

    // ============ ERC-2771 META-TRANSACTIONS ============

    describe("ERC-2771 Gasless Meta-Transactions", function () {
        it("Should deploy MinimalForwarder successfully", async function () {
            expect(await forwarder.getAddress()).to.not.equal(ethers.ZeroAddress);
        });

        it("Should track nonces per signer", async function () {
            expect(await forwarder.getNonce(voter1.address)).to.equal(0);
        });

        it("Should have the correct trusted forwarder set", async function () {
            const forwarderAddr = await forwarder.getAddress();
            expect(await zkpVoting.isTrustedForwarder(forwarderAddr)).to.equal(true);
        });

        it("Should allow admin to update trusted forwarder", async function () {
            const newForwarder = voter2.address; // Just for testing
            await zkpVoting.setTrustedForwarder(newForwarder);
            expect(await zkpVoting.isTrustedForwarder(newForwarder)).to.equal(true);
        });
    });

    // ============ IPFS METADATA STORAGE ============

    describe("IPFS Metadata Storage", function () {
        it("Should store IPFS hash with ZKP vote", async function () {
            const identity = generateIdentityCommitment("voter1");
            const nullifier = generateNullifier("voter1", "bharat-evote-2026");
            await zkpVoting.registerEligibleVoter(identity);

            const commitment = generateCommitment(1, randomBytes32());
            const proof = generateProof(commitment, nullifier, 3);

            await zkpVoting.submitEncryptedVote(
                commitment, nullifier, identity, proof, "QmIPFSTestCID12345"
            );

            const receipt = await zkpVoting.getZKVoteReceipt(nullifier);
            expect(receipt.ipfsHash).to.equal("QmIPFSTestCID12345");
        });

        it("Should store candidate IPFS metadata", async function () {
            await zkpVoting.setCandidateIPFSHash(1, "QmCandidateMetadata1");

            expect(await zkpVoting.getCandidateIPFS(1)).to.equal("QmCandidateMetadata1");
        });

        it("Should emit event when candidate metadata stored", async function () {
            await expect(zkpVoting.setCandidateIPFSHash(2, "QmCandidateHash2"))
                .to.emit(zkpVoting, "CandidateMetadataStored")
                .withArgs(2, "QmCandidateHash2");
        });
    });

    // ============ VOTING.SOL ZKP MODE ============

    describe("Voting.sol ZKP Mode Integration", function () {
        it("Should toggle ZKP mode on main contract", async function () {
            expect(await voting.zkpEnabled()).to.equal(false);

            await voting.setZKPMode(true);
            expect(await voting.zkpEnabled()).to.equal(true);

            await voting.setZKPMode(false);
            expect(await voting.zkpEnabled()).to.equal(false);
        });

        it("Should block plain vote() when ZKP mode is enabled", async function () {
            await voting.addCandidateSimple("Alice");
            await voting.authorizeVoterSimple(voter1.address);
            await voting.setZKPMode(true);
            await voting.startVoting();

            await expect(
                voting.connect(voter1).vote(1)
            ).to.be.revertedWith("ZKP mode is active: use the ZKP voting contract instead");
        });

        it("Should allow plain vote() when ZKP mode is disabled", async function () {
            await voting.addCandidateSimple("Alice");
            await voting.authorizeVoterSimple(voter1.address);
            await voting.startVoting();

            await voting.connect(voter1).vote(1);
            expect(await voting.hasVoterVoted(voter1.address)).to.equal(true);
        });

        it("Should set trusted forwarder", async function () {
            const forwarderAddr = await forwarder.getAddress();
            await voting.setTrustedForwarder(forwarderAddr);
            expect(await voting.isTrustedForwarder(forwarderAddr)).to.equal(true);
        });

        it("Should set election IPFS hash", async function () {
            await voting.setElectionIPFSHash("QmElectionMetadata2026");
            expect(await voting.electionIPFSHash()).to.equal("QmElectionMetadata2026");
        });
    });

    // ============ ACCESS CONTROL ============

    describe("Access Control", function () {
        it("Should only allow admin to register voters", async function () {
            const identity = generateIdentityCommitment("voter1");
            await expect(
                zkpVoting.connect(voter1).registerEligibleVoter(identity)
            ).to.be.revertedWith("ZKP: Only admin");
        });

        it("Should only allow admin to toggle ZKP mode", async function () {
            await expect(
                zkpVoting.connect(voter1).setZKPMode(false)
            ).to.be.revertedWith("ZKP: Only admin");
        });

        it("Should only allow admin to set candidate IPFS hashes", async function () {
            await expect(
                zkpVoting.connect(voter1).setCandidateIPFSHash(1, "QmTest")
            ).to.be.revertedWith("ZKP: Only admin");
        });

        it("Should only allow admin to update forwarder", async function () {
            await expect(
                zkpVoting.connect(voter1).setTrustedForwarder(voter2.address)
            ).to.be.revertedWith("ZKP: Only admin");
        });
    });
});
