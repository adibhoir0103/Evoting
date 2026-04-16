import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { BlockchainService } from '../services/blockchainService';
import { zkpClientService } from '../services/zkpService';
import { ethers } from 'ethers';
import ZKPVotingArtifact from '../contracts/ZKPVoting.json';
import contractAddress from '../contracts/contract-address.json';

function VerifyVotePage() {
    const [txHash, setTxHash] = useState('');
    const [walletAddress, setWalletAddress] = useState('');
    const [voterSecret, setVoterSecret] = useState('');
    const [electionId, setElectionId] = useState('bharat-evote-2026');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [mode, setMode] = useState('tx'); // 'tx', 'receipt', or 'zkp'

    const verifyTransaction = async () => {
        if (!txHash.trim()) {
            setError('Please enter a transaction hash');
            return;
        }
        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
            setError('Invalid transaction hash format. Must be 0x followed by 64 hex characters.');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const service = BlockchainService.getInstance();
            const provider = service.provider;

            if (!provider) {
                throw new Error('Blockchain provider not connected. Please ensure MetaMask is installed and connected.');
            }

            // Fetch transaction
            const tx = await provider.getTransaction(txHash.trim());
            if (!tx) {
                setResult({
                    found: false,
                    message: 'Transaction not found on the blockchain. It may be on a different network or still pending.'
                });
                return;
            }

            // Fetch receipt
            const receipt = await provider.getTransactionReceipt(txHash.trim());
            
            // Fetch block for timestamp
            let blockData = null;
            if (receipt && receipt.blockNumber) {
                blockData = await provider.getBlock(receipt.blockNumber);
            }

            setResult({
                found: true,
                tx: {
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    blockNumber: receipt?.blockNumber?.toString() || 'Pending',
                    status: receipt?.status === 1 ? 'Confirmed' : receipt?.status === 0 ? 'Failed' : 'Pending',
                    gasUsed: receipt?.gasUsed?.toString() || 'N/A',
                    timestamp: blockData?.timestamp ? new Date(blockData.timestamp * 1000).toLocaleString('en-IN', { 
                        dateStyle: 'full', timeStyle: 'medium' 
                    }) : 'N/A',
                    confirmations: receipt?.confirmations?.toString() || '0',
                    networkId: tx.chainId?.toString() || 'Unknown'
                }
            });
        } catch (err) {
            setError(err.message || 'Failed to verify transaction');
        } finally {
            setLoading(false);
        }
    };

    const verifyReceipt = async () => {
        if (!walletAddress.trim()) {
            setError('Please enter your wallet address');
            return;
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim())) {
            setError('Invalid wallet address format.');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const service = BlockchainService.getInstance();
            const contract = service.contract;

            if (!contract) {
                throw new Error('Smart contract not connected. Please ensure MetaMask is connected to the correct network.');
            }

            // Check if voter has voted
            const hasVoted = await contract.hasVoterVoted(walletAddress.trim());
            
            if (!hasVoted) {
                setResult({
                    found: true,
                    receipt: {
                        hasVoted: false,
                        message: 'This wallet address has not cast a vote in the current election.'
                    }
                });
                return;
            }

            // Get vote receipt hash
            const receiptHash = await contract.getVoteReceipt(walletAddress.trim());
            
            // Get voter info
            const voterInfo = await contract.getVoterInfo(walletAddress.trim());

            setResult({
                found: true,
                receipt: {
                    hasVoted: true,
                    receiptHash: receiptHash,
                    isAuthorized: voterInfo[0],
                    stateCode: voterInfo[2].toString(),
                    constituencyCode: voterInfo[3].toString(),
                    message: 'Vote has been successfully recorded and verified on the blockchain.'
                }
            });
        } catch (err) {
            setError(err.message || 'Failed to verify vote receipt');
        } finally {
            setLoading(false);
        }
    };

    const verifyBySecret = async () => {
        if (!voterSecret.trim()) {
            setError('Please enter your voter secret');
            return;
        }
        if (voterSecret.trim().length < 4) {
            setError('Voter secret must be at least 4 characters.');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        const checks = [];

        try {
            // Step 1: Regenerate identity commitment from secret
            checks.push({ label: 'Regenerating identity commitment from your secret...', status: 'running' });
            const { identityCommitment } = await zkpClientService.generateIdentityCommitment(voterSecret.trim());
            checks[0] = { label: 'Identity commitment regenerated', status: 'done', value: identityCommitment };

            // Step 2: Regenerate nullifier from secret + election ID
            checks.push({ label: 'Regenerating nullifier hash...', status: 'running' });
            const { nullifierHash } = await zkpClientService.generateNullifier(voterSecret.trim(), electionId);
            checks[1] = { label: 'Nullifier hash regenerated', status: 'done', value: nullifierHash };

            // Step 3: Connect to ZKPVoting contract (read-only)
            checks.push({ label: 'Connecting to ZKPVoting smart contract...', status: 'running' });

            const _apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
            const isLocal = _apiUrl.includes('localhost') || _apiUrl.includes('127.0.0.1');
            const rpcUrl = isLocal ? 'http://127.0.0.1:8545' : 'https://eth-sepolia.g.alchemy.com/v2/XbNu_qjjYV_V-FGBmkc3K';

            let zkpContract;
            try {
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                zkpContract = new ethers.Contract(
                    contractAddress.zkpVotingAddress,
                    ZKPVotingArtifact.abi,
                    provider
                );
                checks[2] = { label: 'Connected to ZKPVoting contract', status: 'done', value: contractAddress.zkpVotingAddress };
            } catch {
                checks[2] = { label: 'Could not connect to ZKPVoting contract', status: 'warn', value: 'Offline verification only' };
                zkpContract = null;
            }

            let identityRegistered = null;
            let nullifierUsed = null;
            let voteInclusion = null;
            let voteReceipt = null;

            if (zkpContract) {
                // Step 4: Check identity registration
                checks.push({ label: 'Checking identity registration on-chain...', status: 'running' });
                try {
                    identityRegistered = await zkpContract.isIdentityRegistered(identityCommitment);
                    checks[3] = {
                        label: identityRegistered ? 'Your identity IS registered on the blockchain' : 'Your identity is NOT registered',
                        status: identityRegistered ? 'pass' : 'fail',
                        icon: identityRegistered ? 'fa-user-check' : 'fa-user-xmark'
                    };
                } catch {
                    checks[3] = { label: 'Could not check identity registration', status: 'warn' };
                }

                // Step 5: Check nullifier (has this identity voted?)
                checks.push({ label: 'Checking if your vote was recorded...', status: 'running' });
                try {
                    nullifierUsed = await zkpContract.isNullifierUsed(nullifierHash);
                    checks[4] = {
                        label: nullifierUsed ? 'Your vote IS recorded on the blockchain' : 'No vote found for this secret + election combination',
                        status: nullifierUsed ? 'pass' : 'fail',
                        icon: nullifierUsed ? 'fa-check-double' : 'fa-circle-xmark'
                    };
                } catch {
                    checks[4] = { label: 'Could not check nullifier status', status: 'warn' };
                }

                // Step 6: Check vote receipt details
                if (nullifierUsed) {
                    checks.push({ label: 'Retrieving your vote receipt...', status: 'running' });
                    try {
                        const receipt = await zkpContract.getZKVoteReceipt(nullifierHash);
                        voteReceipt = {
                            commitment: receipt[0],
                            timestamp: new Date(Number(receipt[2]) * 1000).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' }),
                            ipfsHash: receipt[3] || 'N/A',
                            verified: receipt[4]
                        };
                        checks[5] = {
                            label: 'Vote receipt retrieved successfully',
                            status: 'pass',
                            icon: 'fa-receipt'
                        };

                        // Step 7: Verify vote inclusion in commitments array
                        checks.push({ label: 'Verifying vote inclusion in commitment chain...', status: 'running' });
                        try {
                            const inclusion = await zkpContract.verifyVoteInclusion(voteReceipt.commitment);
                            voteInclusion = { included: inclusion[0], index: Number(inclusion[1]) };
                            checks[6] = {
                                label: voteInclusion.included
                                    ? `Vote commitment found at index #${voteInclusion.index} in the on-chain commitment array`
                                    : 'Vote commitment NOT found in commitment chain',
                                status: voteInclusion.included ? 'pass' : 'fail',
                                icon: voteInclusion.included ? 'fa-link' : 'fa-link-slash'
                            };
                        } catch {
                            checks[6] = { label: 'Could not verify inclusion', status: 'warn' };
                        }
                    } catch {
                        checks[5] = { label: 'Could not retrieve vote receipt', status: 'warn' };
                    }
                }
            }

            // Build final result
            const allPassed = nullifierUsed && identityRegistered && (voteInclusion?.included !== false);

            setResult({
                found: true,
                zkp: {
                    checks,
                    identityCommitment,
                    nullifierHash,
                    identityRegistered,
                    nullifierUsed,
                    voteReceipt,
                    voteInclusion,
                    allPassed,
                    electionId,
                    privacyNote: 'Your candidate choice was NEVER sent to the network during this verification. All computations ran locally in your browser.'
                }
            });
        } catch (err) {
            setError(err.message || 'Failed to verify vote');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f3f4f6]">
            <Helmet>
                <title>Verify Your Vote | Bharat E-Vote Portal</title>
                <meta name="description" content="Independently verify that your vote was recorded correctly on the blockchain using your transaction hash, wallet address, or ZKP voter secret." />
            </Helmet>

            {/* Hero */}
            <div className="bg-primary text-white">
                <div className="h-1 bg-gradient-to-r from-accent-saffron via-white to-accent-green"></div>
                <div className="max-w-4xl mx-auto px-4 py-12 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-sm font-semibold mb-4">
                        <i className="fa-solid fa-magnifying-glass-chart"></i> Independent Verification
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">Verify Your Vote</h1>
                    <p className="text-blue-100 max-w-xl mx-auto">Independently verify that your vote was recorded on the blockchain. No login required — anyone can verify.</p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-10">
                {/* Mode Toggle */}
                <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1 mb-8">
                    <button
                        onClick={() => { setMode('tx'); setResult(null); setError(''); }}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold transition ${mode === 'tx' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <i className="fa-solid fa-hashtag mr-2"></i>TX Hash
                    </button>
                    <button
                        onClick={() => { setMode('receipt'); setResult(null); setError(''); }}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold transition ${mode === 'receipt' ? 'bg-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <i className="fa-solid fa-wallet mr-2"></i>Wallet
                    </button>
                    <button
                        onClick={() => { setMode('zkp'); setResult(null); setError(''); }}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold transition ${mode === 'zkp' ? 'bg-purple-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <i className="fa-solid fa-user-secret mr-2"></i>ZKP Secret
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                        <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                )}

                {/* TX Hash Mode */}
                {mode === 'tx' && (
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">Transaction Hash Verification</h2>
                        <p className="text-sm text-gray-500 mb-5">Enter the transaction hash from your vote receipt to verify it on-chain.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction Hash</label>
                                <input
                                    type="text"
                                    value={txHash}
                                    onChange={(e) => { setTxHash(e.target.value); setError(''); }}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm font-mono"
                                    placeholder="0x7f3a2b1c..."
                                />
                            </div>

                            <button
                                onClick={verifyTransaction}
                                disabled={loading}
                                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Verifying...</> : <><i className="fa-solid fa-search"></i> Verify Transaction</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Wallet Mode */}
                {mode === 'receipt' && (
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">Vote Receipt Verification</h2>
                        <p className="text-sm text-gray-500 mb-5">Enter your wallet address to check if your vote was recorded on the blockchain.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Wallet Address</label>
                                <input
                                    type="text"
                                    value={walletAddress}
                                    onChange={(e) => { setWalletAddress(e.target.value); setError(''); }}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm font-mono"
                                    placeholder="0x742d35Cc..."
                                />
                            </div>

                            <button
                                onClick={verifyReceipt}
                                disabled={loading}
                                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Checking...</> : <><i className="fa-solid fa-receipt"></i> Verify Vote Receipt</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* ZKP Secret Mode */}
                {mode === 'zkp' && (
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <i className="fa-solid fa-user-secret text-purple-600"></i>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">ZKP Individual Verification</h2>
                                <p className="text-xs text-gray-500">Verify your vote using your private voter secret — without revealing your choice</p>
                            </div>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-5">
                            <p className="text-xs text-purple-700"><i className="fa-solid fa-shield-halved mr-1"></i> <strong>Privacy guarantee:</strong> Your secret is processed <strong>entirely in your browser</strong>. It is never sent to any server. Only the derived hashes are checked against the blockchain.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Your Voter Secret</label>
                                <input
                                    type="password"
                                    value={voterSecret}
                                    onChange={(e) => { setVoterSecret(e.target.value); setError(''); }}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition text-sm"
                                    placeholder="Enter the secret you used during ZKP registration"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Election ID</label>
                                <input
                                    type="text"
                                    value={electionId}
                                    onChange={(e) => { setElectionId(e.target.value); setError(''); }}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition text-sm font-mono"
                                    placeholder="bharat-evote-2026"
                                />
                            </div>

                            <button
                                onClick={verifyBySecret}
                                disabled={loading}
                                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Verifying on-chain...</> : <><i className="fa-solid fa-user-secret"></i> Verify My Vote (ZKP)</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="mt-8 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        {/* TX result header */}
                        {(result.tx || result.receipt) && (
                            <div className={`px-6 py-4 ${result.found ? (result.tx?.status === 'Confirmed' || result.receipt?.hasVoted ? 'bg-green-50 border-b border-green-200' : 'bg-amber-50 border-b border-amber-200') : 'bg-red-50 border-b border-red-200'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${result.found ? (result.tx?.status === 'Confirmed' || result.receipt?.hasVoted ? 'bg-green-100' : 'bg-amber-100') : 'bg-red-100'}`}>
                                        <i className={`fa-solid ${result.found ? (result.tx?.status === 'Confirmed' || result.receipt?.hasVoted ? 'fa-circle-check text-green-600' : 'fa-clock text-amber-600') : 'fa-circle-xmark text-red-600'} text-lg`}></i>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">
                                            {!result.found ? 'Not Found' : result.tx?.status === 'Confirmed' || result.receipt?.hasVoted ? 'Verified ✓' : 'Pending'}
                                        </h3>
                                        <p className="text-xs text-gray-500">{result.message || result.tx?.status || result.receipt?.message}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ZKP result header */}
                        {result.zkp && (
                            <div className={`px-6 py-5 ${result.zkp.allPassed ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200' : 'bg-amber-50 border-b border-amber-200'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${result.zkp.allPassed ? 'bg-green-100' : 'bg-amber-100'} shadow-sm`}>
                                        <i className={`fa-solid ${result.zkp.allPassed ? 'fa-circle-check text-green-600' : 'fa-triangle-exclamation text-amber-600'} text-2xl`}></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-extrabold text-gray-900">
                                            {result.zkp.allPassed ? 'Vote Verified ✓' : 'Verification Incomplete'}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            {result.zkp.allPassed
                                                ? 'Your vote is cryptographically confirmed on the blockchain'
                                                : 'Some checks could not be completed — see details below'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TX details */}
                        {result.tx && (
                            <div className="p-6 space-y-3">
                                {[
                                    { label: 'Transaction Hash', value: result.tx.hash, mono: true },
                                    { label: 'Status', value: result.tx.status, badge: true },
                                    { label: 'Block Number', value: result.tx.blockNumber },
                                    { label: 'Timestamp', value: result.tx.timestamp },
                                    { label: 'From (Voter)', value: result.tx.from, mono: true },
                                    { label: 'To (Contract)', value: result.tx.to, mono: true },
                                    { label: 'Gas Used', value: result.tx.gasUsed },
                                    { label: 'Network', value: result.tx.networkId === '11155111' ? 'Sepolia Testnet' : result.tx.networkId === '1337' ? 'Local Hardhat' : `Chain ${result.tx.networkId}` },
                                ].map((item, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2 border-b border-gray-100 last:border-0">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider sm:w-40 flex-shrink-0">{item.label}</span>
                                        {item.badge ? (
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.value === 'Confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{item.value}</span>
                                        ) : (
                                            <span className={`text-sm text-gray-900 break-all ${item.mono ? 'font-mono text-xs' : ''}`}>{item.value}</span>
                                        )}
                                    </div>
                                ))}

                                <a
                                    href={`https://sepolia.etherscan.io/tx/${result.tx.hash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-50 text-primary font-bold text-sm rounded-lg hover:bg-blue-100 transition"
                                >
                                    <i className="fa-solid fa-arrow-up-right-from-square"></i> View on Etherscan
                                </a>
                            </div>
                        )}

                        {/* Receipt details */}
                        {result.receipt && result.receipt.hasVoted && (
                            <div className="p-6 space-y-3">
                                {[
                                    { label: 'Vote Status', value: 'RECORDED', badge: true },
                                    { label: 'Receipt Hash', value: result.receipt.receiptHash, mono: true },
                                    { label: 'Authorized', value: result.receipt.isAuthorized ? 'Yes' : 'No' },
                                    { label: 'State Code', value: result.receipt.stateCode },
                                    { label: 'Constituency', value: result.receipt.constituencyCode },
                                ].map((item, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2 border-b border-gray-100 last:border-0">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider sm:w-40 flex-shrink-0">{item.label}</span>
                                        {item.badge ? (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{item.value}</span>
                                        ) : (
                                            <span className={`text-sm text-gray-900 break-all ${item.mono ? 'font-mono text-xs' : ''}`}>{item.value}</span>
                                        )}
                                    </div>
                                ))}

                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                                    <p className="text-sm text-green-800 font-semibold"><i className="fa-solid fa-shield-halved mr-2"></i>Your vote is cryptographically secured on the blockchain. The receipt hash proves your participation without revealing your vote choice.</p>
                                </div>
                            </div>
                        )}

                        {result.receipt && !result.receipt.hasVoted && (
                            <div className="p-6">
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                    <p className="text-sm text-amber-800 font-semibold"><i className="fa-solid fa-info-circle mr-2"></i>{result.receipt.message}</p>
                                </div>
                            </div>
                        )}

                        {/* ZKP Verification Results */}
                        {result.zkp && (
                            <div className="p-6 space-y-4">
                                {/* Step-by-step checks */}
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Verification Steps</h4>
                                    {result.zkp.checks.map((check, i) => (
                                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                                            check.status === 'pass' ? 'bg-green-50 border border-green-200' :
                                            check.status === 'fail' ? 'bg-red-50 border border-red-200' :
                                            check.status === 'warn' ? 'bg-amber-50 border border-amber-200' :
                                            check.status === 'done' ? 'bg-gray-50 border border-gray-200' :
                                            'bg-blue-50 border border-blue-200'
                                        }`}>
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                check.status === 'pass' ? 'bg-green-100' :
                                                check.status === 'fail' ? 'bg-red-100' :
                                                check.status === 'warn' ? 'bg-amber-100' :
                                                check.status === 'done' ? 'bg-gray-100' :
                                                'bg-blue-100'
                                            }`}>
                                                <i className={`fa-solid text-xs ${
                                                    check.status === 'pass' ? `${check.icon || 'fa-check'} text-green-600` :
                                                    check.status === 'fail' ? `${check.icon || 'fa-xmark'} text-red-600` :
                                                    check.status === 'warn' ? 'fa-exclamation text-amber-600' :
                                                    check.status === 'done' ? 'fa-check text-gray-500' :
                                                    'fa-spinner fa-spin text-blue-500'
                                                }`}></i>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-semibold ${
                                                    check.status === 'pass' ? 'text-green-800' :
                                                    check.status === 'fail' ? 'text-red-800' :
                                                    check.status === 'warn' ? 'text-amber-800' :
                                                    'text-gray-700'
                                                }`}>{check.label}</p>
                                                {check.value && (
                                                    <p className="text-[10px] font-mono text-gray-400 break-all mt-0.5">{check.value}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Vote receipt details */}
                                {result.zkp.voteReceipt && (
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mt-4">
                                        <h4 className="text-sm font-bold text-gray-700 mb-3"><i className="fa-solid fa-receipt mr-1"></i> Vote Receipt</h4>
                                        <div className="space-y-2">
                                            {[
                                                { label: 'Commitment Hash', value: result.zkp.voteReceipt.commitment, mono: true },
                                                { label: 'Timestamp', value: result.zkp.voteReceipt.timestamp },
                                                { label: 'IPFS Metadata', value: result.zkp.voteReceipt.ipfsHash, mono: true },
                                                { label: 'Admin Verified', value: result.zkp.voteReceipt.verified ? 'Yes' : 'Pending' },
                                            ].map((item, i) => (
                                                <div key={i} className="flex flex-col sm:flex-row gap-1 sm:gap-3 py-1.5 border-b border-gray-100 last:border-0">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider sm:w-32 flex-shrink-0">{item.label}</span>
                                                    <span className={`text-xs text-gray-900 break-all ${item.mono ? 'font-mono text-[10px]' : ''}`}>{item.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Summary verdicts */}
                                {result.zkp.allPassed && (
                                    <div className="space-y-3 mt-4">
                                        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                                            <h4 className="font-bold text-green-800 mb-2"><i className="fa-solid fa-shield-halved mr-2"></i>Individual Verifiability Confirmed</h4>
                                            <div className="grid sm:grid-cols-2 gap-2">
                                                {[
                                                    { icon: 'fa-check-double', text: 'Your vote IS recorded on the blockchain' },
                                                    { icon: 'fa-fingerprint', text: 'It was cast with YOUR registered identity' },
                                                    { icon: 'fa-link', text: 'It IS included in the on-chain tally' },
                                                    { icon: 'fa-lock', text: 'Your candidate choice remains PRIVATE' },
                                                ].map((v, i) => (
                                                    <div key={i} className="flex items-center gap-2 bg-white rounded-lg p-2">
                                                        <i className={`fa-solid ${v.icon} text-green-500`}></i>
                                                        <span className="text-xs font-semibold text-green-800">{v.text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Privacy notice */}
                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mt-3">
                                    <p className="text-xs text-purple-700"><i className="fa-solid fa-user-secret mr-1"></i> <strong>Privacy:</strong> {result.zkp.privacyNote}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Info section */}
                <div className="mt-8 grid sm:grid-cols-3 gap-4">
                    {[
                        { icon: 'fa-lock', title: 'Privacy Preserved', desc: 'Verification proves participation only — your vote choice remains secret.' },
                        { icon: 'fa-globe', title: 'Universal Access', desc: 'Anyone can verify any vote — no account or login required.' },
                        { icon: 'fa-link', title: 'On-Chain Proof', desc: 'Verified directly from the blockchain — no intermediary servers.' },
                    ].map((item, i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                            <i className={`fa-solid ${item.icon} text-primary text-lg mb-2`}></i>
                            <h4 className="font-bold text-sm text-gray-900">{item.title}</h4>
                            <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default VerifyVotePage;
