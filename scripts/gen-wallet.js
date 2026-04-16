const { ethers } = require("ethers");
const wallet = ethers.Wallet.createRandom();
console.log("ADDRESS:", wallet.address);
console.log("PRIVATE_KEY:", wallet.privateKey);
