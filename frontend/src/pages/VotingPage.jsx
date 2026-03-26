import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BlockchainService } from '../services/blockchainService';
import { authService } from '../services/authService';
import { zkpClientService } from '../services/zkpService';
import ZKPVerificationPanel from '../components/ZKPVerificationPanel';
import { indianStates, getStateName } from '../utils/indianStates';

function VotingPage({ user, onUserUpdate }) {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [votingActive, setVotingActive] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [txLoading, setTxLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [walletConnected, setWalletConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [voterConstituencyInfo, setVoterConstituencyInfo] = useState(null);

    // ZKP State
    const [zkpMode, setZkpMode] = useState(false);
    const [zkpVoteData, setZkpVoteData] = useState(null);
    const [showVerification, setShowVerification] = useState(false);
    const [voterSecret, setVoterSecret] = useState('');

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        if (user.walletAddress) {
            setWalletAddress(user.walletAddress);
            initializeBlockchain(user.walletAddress);
        } else {
            setLoading(false);
        }
    }, [user, navigate]);

    // BUG-023: Modal scroll lock
    useEffect(() => {
        if (selectedCandidate) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [selectedCandidate]);

    const connectWallet = async () => {
        try {
            setLoading(true);
            setError('');

            const service = BlockchainService.getInstance();
            const account = await service.connectWallet();

            await authService.linkWallet(account);

            setWalletAddress(account);
            setWalletConnected(true);

            if (onUserUpdate) {
                onUserUpdate({ ...user, walletAddress: account });
            }

            await loadBlockchainData(service, account);
        } catch (err) {
            setError(err.message || 'Failed to connect wallet');
        } finally {
            setLoading(false);
        }
    };

    const initializeBlockchain = async (address) => {
        try {
            const service = BlockchainService.getInstance();
            await service.connectWallet();
            setWalletConnected(true);
            await loadBlockchainData(service, address);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const loadBlockchainData = async (service, address) => {
        try {
            const [status, voted, authorized, vInfo] = await Promise.all([
                service.isVotingActive(),
                service.hasVoted(address),
                service.isAuthorized(address),
                service.getVoterInfo(address)
            ]);

            setVotingActive(status);
            setHasVoted(voted || user?.hasVoted);
            setIsAuthorized(authorized);
            setVoterConstituencyInfo(vInfo);

            const allCandidates = await service.getAllCandidates();
            const filteredCandidates = allCandidates.filter(c => {
                const stateMatch = c.stateCode === 0 || c.stateCode === vInfo.stateCode;
                const constituencyMatch = c.constituencyCode === 0 || c.constituencyCode === vInfo.constituencyCode;
                return stateMatch && constituencyMatch;
            });

            setCandidates(filteredCandidates);
        } catch (err) {
            setError('Failed to load voting data: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const confirmVote = (candidate) => {
        setSelectedCandidate(candidate);
    };

    const cancelVote = () => {
        setSelectedCandidate(null);
    };

    const submitVote = async () => {
        if (!selectedCandidate) return;

        try {
            setTxLoading(true);
            setError('');

            const service = BlockchainService.getInstance();

            let isZKP = false;
            try {
                isZKP = await service.isZKPEnabled();
            } catch (e) {
                // ZKP check failed, proceed with legacy
            }

            if (isZKP && voterSecret) {
                const votePackage = await zkpClientService.generateVotePackage(
                    selectedCandidate.id,
                    voterSecret,
                    candidates.length,
                    'bharat-evote-2026'
                );

                let ipfsHash = '';
                try {
                    const ipfsResult = await zkpClientService.pinVoteToIPFS(
                        votePackage.commitment,
                        votePackage.nullifierHash
                    );
                    ipfsHash = ipfsResult.ipfsHash || '';
                } catch (e) {
                    console.log('IPFS pinning skipped:', e.message);
                }

                const receipt = await service.submitEncryptedVote(
                    votePackage.commitment,
                    votePackage.nullifierHash,
                    votePackage.identityCommitment,
                    votePackage.proof,
                    ipfsHash
                );

                await authService.recordVote(selectedCandidate.id, receipt.hash);

                setZkpVoteData({
                    nullifierHash: votePackage.nullifierHash,
                    commitment: votePackage.commitment,
                    ipfsHash: ipfsHash,
                    txHash: receipt.hash
                });
                setShowVerification(true);
                setSelectedCandidate(null);
            } else {
                const receipt = await service.vote(selectedCandidate.id);
                await authService.recordVote(selectedCandidate.id, receipt.hash);

                setSuccess('Vote cast successfully! Thank you for participating.');
                setHasVoted(true);
                setSelectedCandidate(null);

                if (onUserUpdate) {
                    onUserUpdate({ ...user, hasVoted: true });
                }

                await loadBlockchainData(BlockchainService.getInstance(), walletAddress);
            }
        } catch (err) {
            setError(err.message || 'Failed to cast vote');
        } finally {
            setTxLoading(false);
        }
    };

    const handleVerificationComplete = () => {
        setShowVerification(false);
        setSuccess('Vote cast and verified successfully via Zero-Knowledge Proof! Thank you for participating.');
        setHasVoted(true);
        if (onUserUpdate) {
            onUserUpdate({ ...user, hasVoted: true });
        }
    };

    // ===== ZKP COMPULSORY VERIFICATION SCREEN =====
    if (showVerification && zkpVoteData) {
        return (
            <section className="min-h-[60vh] max-w-4xl mx-auto px-4 py-8">
                <ZKPVerificationPanel
                    nullifierHash={zkpVoteData.nullifierHash}
                    commitment={zkpVoteData.commitment}
                    ipfsHash={zkpVoteData.ipfsHash}
                    blockchainService={BlockchainService.getInstance()}
                    onVerificationComplete={handleVerificationComplete}
                />
            </section>
        );
    }

    // Render wallet connection screen
    if (!walletConnected && !loading) {
        return (
            <section className="min-h-[60vh] flex items-center justify-center px-4 py-12">
                <div className="gov-card text-center max-w-md w-full p-8">
                    <div className="text-6xl text-primary mb-4">
                        <i className="fa-solid fa-wallet"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-primary mb-2">Connect Blockchain Wallet</h2>
                    <p className="text-gray-500 mb-6">
                        To ensure vote transparency and immutability, connect your MetaMask wallet.
                    </p>
                    {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded text-sm mb-4 text-left"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</div>}
                    <button onClick={connectWallet} className="btn-primary w-full py-3 text-lg">
                        <i className="fa-solid fa-link mr-2"></i> Connect MetaMask
                    </button>
                    <div className="mt-6 pt-5 border-t border-gray-200">
                        <p className="text-gray-400 text-sm mb-1">Don't have MetaMask?</p>
                        <a
                            href="https://metamask.io/download/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-semibold hover:underline"
                        >
                            Download MetaMask →
                        </a>
                    </div>
                </div>
            </section>
        );
    }

    // Loading state
    if (loading) {
        return (
            <section className="min-h-[60vh] flex flex-col items-center justify-center px-4">
                <i className="fa-solid fa-circle-notch fa-spin text-primary text-5xl mb-4"></i>
                <p className="text-gray-500 font-medium">Loading voting terminal...</p>
            </section>
        );
    }

    // Thank you screen
    if (hasVoted) {
        return (
            <section className="min-h-[60vh] flex items-center justify-center px-4 py-12">
                <div className="gov-card text-center max-w-lg w-full p-8">
                    <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4 border-2 border-green-200">
                        <i className="fa-solid fa-check-circle text-4xl"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-primary mb-2">Thank You, {user?.fullname}!</h2>
                    <p className="text-lg text-gray-700 mb-4">Your vote has been successfully recorded.</p>
                    <div className="bg-green-50 border border-accent-green rounded-lg p-4 mb-6">
                        <p className="text-accent-green text-sm font-medium">
                            <i className="fa-solid fa-shield-halved mr-1"></i> Your vote is encrypted and stored on the blockchain. It cannot be altered or deleted.
                        </p>
                    </div>
                    <p className="text-gray-500 text-sm">
                        Results will be declared after polls close at 6:00 PM as per Election Commission guidelines.
                    </p>
                    <div className="mt-6 pt-5 border-t border-gray-200">
                        <p className="text-gray-400 text-sm">Jai Hind! 🇮🇳</p>
                    </div>
                    <Link to="/" className="btn-primary mt-6 inline-flex px-8"><i className="fa-solid fa-home mr-2"></i> Return Home</Link>
                </div>
            </section>
        );
    }

    // Main voting interface
    return (
        <section className="max-w-5xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">General Election 2026 — Voting Terminal</h1>
                <p className="text-gray-500 mt-1">Select your candidate and confirm your choice</p>
            </div>

            {/* Status Bar */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${votingActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <i className={`fa-solid ${votingActive ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                    Voting: {votingActive ? 'Active' : 'Inactive'}
                </span>
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${isAuthorized ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                    <i className={`fa-solid ${isAuthorized ? 'fa-check' : 'fa-exclamation-triangle'}`}></i>
                    Status: {isAuthorized ? 'Authorized' : 'Not Authorized'}
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-gray-200 bg-gray-50 text-gray-600">
                    <i className="fa-solid fa-wallet"></i>
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="max-w-3xl mx-auto mb-4">
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded text-sm"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</div>
                </div>
            )}
            {success && (
                <div className="max-w-3xl mx-auto mb-4">
                    <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded text-sm"><i className="fa-solid fa-check-circle mr-2"></i>{success}</div>
                </div>
            )}

            {/* Warnings */}
            {!isAuthorized && (
                <div className="max-w-3xl mx-auto mb-4">
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded text-sm font-medium">
                        <i className="fa-solid fa-exclamation-triangle mr-2"></i> You are not authorized to vote. Please contact your local Election Officer.
                    </div>
                </div>
            )}

            {!votingActive && isAuthorized && (
                <div className="max-w-3xl mx-auto mb-4">
                    <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 p-4 rounded text-sm font-medium">
                        <i className="fa-solid fa-clock mr-2"></i> Voting is not currently active. Polling hours: 7:00 AM - 6:00 PM.
                    </div>
                </div>
            )}

            {/* Constituency Info */}
            {voterConstituencyInfo && (
                <div className="max-w-3xl mx-auto mb-6">
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm">
                        <i className="fa-solid fa-map-marker-alt mr-2"></i>
                        <strong>Your Constituency:</strong> {getStateName(voterConstituencyInfo.stateCode)} — Constituency #{voterConstituencyInfo.constituencyCode}
                    </div>
                </div>
            )}

            {/* Candidates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {candidates.length === 0 ? (
                    <div className="gov-card text-center col-span-full p-8">
                        <p className="text-gray-500">No candidates available in your constituency</p>
                    </div>
                ) : (
                    candidates.map(candidate => (
                        <div
                            key={candidate.id}
                            className={`gov-card text-center transition-all duration-200 ${selectedCandidate?.id === candidate.id ? 'ring-2 ring-primary border-primary' : ''} ${votingActive && isAuthorized ? 'cursor-pointer hover:shadow-gov-hover hover:scale-[1.02]' : 'opacity-60 cursor-not-allowed'}`}
                            onClick={() => votingActive && isAuthorized && confirmVote(candidate)}
                        >
                            <div className="w-16 h-16 rounded-full bg-blue-50 text-primary flex items-center justify-center mx-auto mb-3 text-2xl font-bold border border-blue-200">
                                {candidate.partySymbol || <i className="fa-solid fa-user-tie"></i>}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">{candidate.name}</h3>
                            <p className="font-bold text-accent-green text-sm mb-1">
                                {candidate.partyName || 'Independent'}
                            </p>
                            <p className="text-xs text-gray-400">
                                Candidate #{candidate.id}
                                {candidate.stateCode ? ` | ${getStateName(candidate.stateCode)}` : ' | National'}
                            </p>
                            {votingActive && isAuthorized && (
                                <button className="btn-primary mt-4 w-full py-2 text-sm">
                                    Select Candidate
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Confirmation Modal */}
            {selectedCandidate && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={cancelVote}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 relative" onClick={e => e.stopPropagation()}>
                        <button className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-2xl" onClick={cancelVote} aria-label="Close">&times;</button>
                        <h2 className="text-xl font-bold text-primary mb-2">Confirm Your Vote</h2>
                        <p className="text-gray-500 mb-4">You are about to vote for:</p>

                        <div className="bg-[#F5F7FA] border-2 border-primary rounded-lg p-6 text-center mb-4">
                            <div className="w-16 h-16 rounded-full bg-blue-50 text-primary flex items-center justify-center mx-auto mb-3 text-3xl font-bold border border-blue-200">
                                {selectedCandidate.partySymbol || <i className="fa-solid fa-user-tie"></i>}
                            </div>
                            <h3 className="text-lg font-bold text-primary">{selectedCandidate.name}</h3>
                            <p className="font-bold text-accent-green text-base mb-1">
                                {selectedCandidate.partyName || 'Independent'}
                            </p>
                            <p className="text-gray-500 text-sm">
                                Candidate #{selectedCandidate.id}
                                {selectedCandidate.stateCode ? ` | ${getStateName(selectedCandidate.stateCode)} Constituency: ${selectedCandidate.constituencyCode}` : ' | National List'}
                            </p>
                        </div>

                        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-6 text-sm text-yellow-800">
                            <i className="fa-solid fa-exclamation-triangle mr-1"></i> Once submitted, your vote <strong>cannot be changed</strong>. This action is final.
                        </div>

                        <div className="flex gap-3">
                            <button className="btn-secondary flex-1 py-3" onClick={cancelVote} disabled={txLoading}>
                                Cancel
                            </button>
                            <button className="btn-primary flex-1 py-3" onClick={submitVote} disabled={txLoading}>
                                {txLoading ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Processing...</> : 'Confirm Vote'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default VotingPage;
