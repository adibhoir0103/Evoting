const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MinimalForwarder Contract", function () {
    let forwarder;
    let voting;
    let admin;
    let voter1;
    let relayer;

    async function signForwardRequest(signer, request) {
        const domain = {
            name: "MinimalForwarder",
            version: "1",
            chainId: (await ethers.provider.getNetwork()).chainId,
            verifyingContract: await forwarder.getAddress(),
        };

        const types = {
            ForwardRequest: [
                { name: "from", type: "address" },
                { name: "to", type: "address" },
                { name: "value", type: "uint256" },
                { name: "gas", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "data", type: "bytes" },
            ],
        };

        return signer.signTypedData(domain, types, request);
    }

    beforeEach(async function () {
        [admin, voter1, relayer] = await ethers.getSigners();

        const Forwarder = await ethers.getContractFactory("MinimalForwarder");
        forwarder = await Forwarder.deploy();
        await forwarder.waitForDeployment();

        const Voting = await ethers.getContractFactory("Voting");
        voting = await Voting.deploy();
        await voting.waitForDeployment();
        expect(await voting.admin()).to.equal(admin.address);

        await voting.addCandidateSimple("Alice");
        await voting.authorizeVoterSimple(voter1.address);
        await voting.setTrustedForwarder(await forwarder.getAddress());
        await voting.startVoting();
    });

    it("Should verify a valid signed forward request", async function () {
        const nonce = await forwarder.getNonce(voter1.address);
        const request = {
            from: voter1.address,
            to: await voting.getAddress(),
            value: 0,
            gas: 1_000_000,
            nonce,
            data: voting.interface.encodeFunctionData("vote", [1]),
        };

        const signature = await signForwardRequest(voter1, request);
        expect(await forwarder.verify(request, signature)).to.equal(true);
    });

    it("Should reject requests with mismatched nonce", async function () {
        const nonce = await forwarder.getNonce(voter1.address);
        const request = {
            from: voter1.address,
            to: await voting.getAddress(),
            value: 0,
            gas: 1_000_000,
            nonce,
            data: voting.interface.encodeFunctionData("vote", [1]),
        };
        const signature = await signForwardRequest(voter1, request);

        const tamperedRequest = { ...request, nonce: nonce + 1n };
        expect(await forwarder.verify(tamperedRequest, signature)).to.equal(false);
    });

    it("Should revert verify for invalid signature length", async function () {
        const nonce = await forwarder.getNonce(voter1.address);
        const request = {
            from: voter1.address,
            to: await voting.getAddress(),
            value: 0,
            gas: 1_000_000,
            nonce,
            data: voting.interface.encodeFunctionData("vote", [1]),
        };

        await expect(
            forwarder.verify(request, "0x1234")
        ).to.be.revertedWith("MinimalForwarder: invalid signature length");
    });

    it("Should execute a valid meta-transaction and emit event", async function () {
        const nonce = await forwarder.getNonce(voter1.address);
        const request = {
            from: voter1.address,
            to: await voting.getAddress(),
            value: 0,
            gas: 1_000_000,
            nonce,
            data: voting.interface.encodeFunctionData("vote", [1]),
        };
        const signature = await signForwardRequest(voter1, request);

        await expect(
            forwarder.connect(relayer).execute(request, signature)
        ).to.emit(forwarder, "MetaTransactionExecuted")
            .withArgs(voter1.address, await voting.getAddress(), true);

        expect(await forwarder.getNonce(voter1.address)).to.equal(1);
        expect(await voting.hasVoterVoted(voter1.address)).to.equal(true);
        const candidate = await voting.getCandidate(1);
        expect(candidate.voteCount).to.equal(1);
    });

    it("Should prevent replay of the same signed request", async function () {
        const nonce = await forwarder.getNonce(voter1.address);
        const request = {
            from: voter1.address,
            to: await voting.getAddress(),
            value: 0,
            gas: 1_000_000,
            nonce,
            data: voting.interface.encodeFunctionData("vote", [1]),
        };
        const signature = await signForwardRequest(voter1, request);

        await forwarder.connect(relayer).execute(request, signature);
        await expect(
            forwarder.connect(relayer).execute(request, signature)
        ).to.be.revertedWith("MinimalForwarder: signature mismatch");
    });

    it("Should revert execute when signature is from the wrong signer", async function () {
        const nonce = await forwarder.getNonce(voter1.address);
        const request = {
            from: voter1.address,
            to: await voting.getAddress(),
            value: 0,
            gas: 1_000_000,
            nonce,
            data: voting.interface.encodeFunctionData("vote", [1]),
        };
        const signature = await signForwardRequest(relayer, request);

        await expect(
            forwarder.connect(relayer).execute(request, signature)
        ).to.be.revertedWith("MinimalForwarder: signature mismatch");
    });

    it("Should bubble revert reason from target contract and keep nonce unchanged", async function () {
        const nonce = await forwarder.getNonce(voter1.address);
        const request = {
            from: voter1.address,
            to: await voting.getAddress(),
            value: 0,
            gas: 1_000_000,
            nonce,
            data: voting.interface.encodeFunctionData("vote", [999]),
        };
        const signature = await signForwardRequest(voter1, request);

        await expect(
            forwarder.connect(relayer).execute(request, signature)
        ).to.be.revertedWith("Invalid candidate ID");
        expect(await forwarder.getNonce(voter1.address)).to.equal(0);
    });
});
