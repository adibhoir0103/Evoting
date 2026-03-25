// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MinimalForwarder
 * @dev ERC-2771 compatible minimal trusted forwarder for gasless meta-transactions.
 *      Voters sign requests off-chain; a relayer submits them and pays gas.
 *      The target contract extracts the real sender from calldata.
 */
contract MinimalForwarder {
    struct ForwardRequest {
        address from;       // Original signer
        address to;         // Target contract
        uint256 value;      // ETH to forward
        uint256 gas;        // Gas limit
        uint256 nonce;      // Replay protection
        bytes data;         // Encoded function call
    }

    // Nonce tracking per sender
    mapping(address => uint256) private _nonces;

    // Domain separator for EIP-712 typed signing
    bytes32 private constant _TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
    );

    bytes32 private immutable _DOMAIN_SEPARATOR;

    // Events
    event MetaTransactionExecuted(address indexed from, address indexed to, bool success);

    constructor() {
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MinimalForwarder"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @dev Get the current nonce for a signer
     */
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    /**
     * @dev Get the domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    /**
     * @dev Verify a forward request signature
     * @param req The forward request
     * @param signature The EIP-712 signature
     */
    function verify(ForwardRequest calldata req, bytes calldata signature)
        public
        view
        returns (bool)
    {
        address signer = _recoverSigner(req, signature);
        return signer == req.from && _nonces[req.from] == req.nonce;
    }

    /**
     * @dev Execute a meta-transaction
     * @param req The forward request
     * @param signature The EIP-712 signature from the original signer
     *
     * The relayer calls this function and pays gas.
     * The target contract sees req.from as the sender (via ERC-2771).
     */
    function execute(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        returns (bool, bytes memory)
    {
        require(verify(req, signature), "MinimalForwarder: signature mismatch");

        // Increment nonce to prevent replay
        _nonces[req.from]++;

        // Append the original sender address to calldata (ERC-2771 standard)
        (bool success, bytes memory result) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // Bubble up revert reason if the call failed
        if (!success) {
            if (result.length > 0) {
                assembly {
                    let size := mload(result)
                    revert(add(32, result), size)
                }
            } else {
                revert("MinimalForwarder: call failed");
            }
        }

        emit MetaTransactionExecuted(req.from, req.to, success);
        return (success, result);
    }

    /**
     * @dev Recover the signer from an EIP-712 signature
     */
    function _recoverSigner(ForwardRequest calldata req, bytes calldata signature)
        internal
        view
        returns (address)
    {
        require(signature.length == 65, "MinimalForwarder: invalid signature length");

        bytes32 structHash = keccak256(
            abi.encode(
                _TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash)
        );

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        // EIP-2 compliant signature check
        require(
            uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "MinimalForwarder: invalid signature s value"
        );
        require(v == 27 || v == 28, "MinimalForwarder: invalid signature v value");

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "MinimalForwarder: invalid signature");

        return signer;
    }
}
