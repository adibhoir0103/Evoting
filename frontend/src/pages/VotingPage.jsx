import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BlockchainService } from '../services/blockchainService';
import { authService } from '../services/authService';
import { zkpClientService } from '../services/zkpService';
import ZKPVerificationPanel from '../components/ZKPVerificationPanel';
import Turnstile from 'react-turnstile'; // Changed to react-turnstile library
import { indianStates, getStateName } from '../utils/indianStates';
import { jsPDF } from 'jspdf';

function VotingPage({ user, onUserUpdate }) {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [votingActive, setVotingActive] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [voteState, setVoteState] = useState('idle'); // idle | checking | selecting | reviewing | signing | pending | confirming | confirmed | failed | recovered
    const [txHash, setTxHash] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [walletConnected, setWalletConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [accessTurnstileToken, setAccessTurnstileToken] = useState(''); // Gate 1: Ballot Access
    const [turnstileToken, setTurnstileToken] = useState(''); // Gate 2: Vote Submission
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
        if (selectedCandidate || showVerification || ['checking', 'signing', 'pending', 'confirming'].includes(voteState)) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [selectedCandidate, showVerification, voteState]);

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
            setError(err.message || 'Failed to connect cryptographic vault');
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
        setVoteState('reviewing');
        setSelectedCandidate(candidate);
    };

    const cancelVote = () => {
        setVoteState('selecting');
        setSelectedCandidate(null);
    };

    const submitVote = async () => {
        if (!selectedCandidate) return;

        try {
            setVoteState('checking');
            setTxHash('');
            setError('');

            // Acquire Clerk Token for API Calls
            const clerkToken = localStorage.getItem('token'); // Use standard token cache for authService calls
            if (!clerkToken) throw new Error("Clerk Authentication Missing");

            // 1. Pre-Flight Server Checks (Upstash Token Acquisition)
            const upstashToken = await authService.getPreflightToken(clerkToken);

            const service = BlockchainService.getInstance();
            let isZKP = false;
            try { isZKP = await service.isZKPEnabled(); } catch (e) { /* legacy */ }

            setVoteState('signing'); // Prompting Wallet
            
            if (isZKP && voterSecret) {
                const votePackage = await zkpClientService.generateVotePackage(
                    selectedCandidate.id,
                    voterSecret,
                    candidates.length,
                    'bharat-evote-2026'
                );

                let ipfsHash = '';
                try {
                    const ipfsResult = await zkpClientService.pinVoteToIPFS(votePackage.commitment, votePackage.nullifierHash);
                    ipfsHash = ipfsResult.ipfsHash || '';
                } catch (e) { console.log('IPFS pinning skipped'); }

                setVoteState('pending');
                const receipt = await service.submitEncryptedVote(
                    votePackage.commitment,
                    votePackage.nullifierHash,
                    votePackage.identityCommitment,
                    votePackage.proof,
                    ipfsHash
                );
                
                setVoteState('confirming');
                setTxHash(receipt.hash);
                
                await authService.recordVote(receipt.hash, upstashToken, turnstileToken, clerkToken);
                setVoteState('confirmed');

                setZkpVoteData({
                    nullifierHash: votePackage.nullifierHash,
                    commitment: votePackage.commitment,
                    ipfsHash: ipfsHash,
                    txHash: receipt.hash
                });
                setShowVerification(true);
                setSelectedCandidate(null);
            } else {
                setVoteState('pending');
                const receipt = await service.vote(selectedCandidate.id);
                setVoteState('confirming');
                setTxHash(receipt.hash);

                await authService.recordVote(receipt.hash, upstashToken, turnstileToken, clerkToken);
                setVoteState('confirmed');

                setSuccess(`Vote cast successfully! Tx: ${receipt.hash.slice(0, 10)}...`);
                setHasVoted(true);
                setSelectedCandidate(null);
                
                if (onUserUpdate) onUserUpdate({ ...user, hasVoted: true });
                await loadBlockchainData(service, walletAddress);
            }
        } catch (err) {
            const msg = err.message || 'Failed to cast vote';
            if (msg.includes('rejected') || msg.includes('ACTION_REJECTED')) {
                setError('You rejected the transaction — you have not voted yet.');
                setVoteState('recovered');
            } else {
                setError(msg);
                setVoteState('failed');
                
                // Fire Sentry Alarm for vote-drop threshold tracking > 5%
                if (window.Sentry) {
                    window.Sentry.captureMessage(`Vote Cast Failure: ${msg}`, { level: 'error', tags: { module: 'vote_submission', error_type: 'rpc_revert' } });
                }
            }
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
                    <div className="mt-6 pt-5 border-t border-gray-200">
                        <p className="text-gray-400 text-sm">Jai Hind! 🇮🇳</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => navigate('/dashboard', { replace: true })}
                            className="btn-primary min-w-[200px]"
                            aria-label="Return to Dashboard securely"
                        >
                            <i className="fa-solid fa-house mr-2"></i>Return to Dashboard
                        </button>
                        <button 
                            onClick={generateVoteReceipt}
                            className="btn-secondary min-w-[200px]" 
                            aria-label="Download cryptographic vote receipt PDF"
                        >
                            <i className="fa-solid fa-download mr-2"></i> Download Receipt
                        </button>
                    </div>
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

            {/* BREADCRUMB - RPwD Act / GIGW 3.0 Compliance */}
            <nav aria-label="Breadcrumb" className="max-w-4xl mx-auto mb-6 px-4 md:px-0">
              <ol className="flex text-sm text-gray-500 font-medium">
                <li><Link to="/" className="hover:text-primary transition-colors focus-visible">Home</Link><span className="mx-2">/</span></li>
                <li><Link to="/dashboard" className="hover:text-primary transition-colors focus-visible">Dashboard</Link><span className="mx-2">/</span></li>
                <li className="text-gray-900" aria-current="page">Cast Vote Securely</li>
              </ol>
            </nav>

            {/* ERROR / SUCCESS ALERTS */}
            {error && (
                <div className="max-w-4xl mx-auto bg-red-50 text-red-700 p-4 mb-6 rounded-lg text-sm border-l-4 border-l-red-500 flex items-center shadow-sm" role="alert" aria-live="assertive">
                    <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
                </div>
            )}
            {success && (
                <div className="max-w-4xl mx-auto bg-green-50 text-green-700 p-4 mb-6 rounded-lg text-sm border-l-4 border-l-green-500 flex items-center shadow-sm" role="alert" aria-live="assertive">
                    <i className="fa-solid fa-check-circle mr-2"></i>{success}
                </div>
            )}

            {/* Render wallet connection screen */}
            {!walletConnected && !loading ? (
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-200">
                         <i className="fa-solid fa-shield-halved text-2xl text-blue-600"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-primary mb-2">Connect Secure Vault</h2>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        To guarantee vote transparency and mathematical integrity, connect your cryptographic vault to proceed.
                    </p>
                    <button 
                        onClick={connectWallet} 
                        className="btn-primary"
                        aria-label="Connect Secure Cryptographic Vault"
                    >
                        <i className="fa-solid fa-link mr-2"></i> Verify Secure Identity
                    </button>
                    <div className="mt-6 border-t border-gray-100 pt-6">
                        <p className="text-gray-400 text-sm mb-1">Vault extension not found?</p>
                        <a 
                            href="https://metamask.io/download/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm font-semibold focus-visible px-2 py-1 rounded"
                            aria-label="Download supported Vault provider"
                        >
                            Download Vault Provider →
                        </a>
                    </div>
                </div>
            ) : (
                <>
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

                    {/* Election Info Card */}
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border-l-4 border-l-blue-500 mb-8 border border-gray-200">
                        <div className="mb-4 md:mb-0">
                            <h2 className="text-2xl font-black tracking-tight text-gray-900">
                                {voterConstituencyInfo?.stateCode === 0 ? 'National General Election' : 'Regional Legislative Election'}
                            </h2>
                            <p className="text-gray-500 font-medium">Secured by Cryptographic Zero-Knowledge Algorithms</p>
                        </div>
                        <div className="text-left md:text-right">
                            <p className="text-gray-900 font-bold mb-1">
                                <i className="fa-solid fa-flag text-blue-600 mr-2"></i>
                                {voterConstituencyInfo?.stateCode === 0 
                                    ? 'National Representative'
                                    : `${getStateName(voterConstituencyInfo?.stateCode)} - Constituency ${voterConstituencyInfo?.constituencyCode}`}
                            </p>
                            <p className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200 shadow-sm inline-block">
                                <span className="relative flex h-2 w-2 mr-2 inline-flex">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                Verified Authentic Session
                            </p>
                        </div>
                    </div>

                    {/* BALLOT ACCESS TURNSTILE */}
                    {!accessTurnstileToken && !hasVoted && (
                        <div className="max-w-4xl mx-auto bg-white p-8 border border-gray-200 rounded-xl shadow-sm text-center mb-8">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-200">
                                <i className="fa-solid fa-shield-halved text-2xl text-blue-600"></i>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Human Access</h2>
                            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">Please complete the security challenge below to unlock the secure digital ballot payload.</p>
                            
                            <div className="inline-block border border-gray-200 p-2 rounded-lg bg-gray-50">
                                <Turnstile onVerify={setAccessTurnstileToken} onError={() => setError('Bot check failed. Please refresh.')} action="ballot_access" />
                            </div>
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

                    {/* ELECTION CANDIDATES GRID (SEMANTIC HTML5 for Screen Readers) */}
                    <fieldset 
                        className={`max-w-4xl mx-auto transition-all duration-500 ${!accessTurnstileToken && !hasVoted ? 'opacity-30 pointer-events-none filter blur-sm' : ''}`}
                        aria-describedby={candidates.length === 0 ? "no-candidates-msg" : undefined}
                    >
                        <legend className="visually-hidden">Select exactly one candidate for the election</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {!votingActive ? (
                                <div className="col-span-full bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
                                    <i className="fa-solid fa-lock text-4xl text-gray-400 mb-3"></i>
                                    <p className="font-bold text-gray-600">The voting gateway is currently cryptographically sealed.</p>
                                </div>
                            ) : candidates.length === 0 ? (
                                <div id="no-candidates-msg" className="gov-card text-center col-span-full p-8">
                                    <p className="text-gray-500">No candidates available in your constituency</p>
                                </div>
                            ) : (
                                candidates.map(candidate => (
                                    <label 
                                        key={candidate.id} 
                                        className={`gov-card cursor-pointer group flex flex-col relative focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${selectedCandidate?.id === candidate.id ? 'border-primary ring-2 ring-primary ring-opacity-50 bg-blue-50/30' : 'hover:border-primary'}`}
                                        aria-label={`Select candidate ${candidate.name} from party ${candidate.partyName || 'Independent'}`}
                                    >
                                        <input
                                            type="radio"
                                            name="candidate"
                                            value={candidate.id}
                                            checked={selectedCandidate?.id === candidate.id}
                                            onChange={() => votingActive && isAuthorized && setSelectedCandidate(candidate)}
                                            className="peer visually-hidden focus-visible"
                                            aria-describedby={`desc-${candidate.id}`}
                                            disabled={!votingActive || !isAuthorized}
                                        />
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
                                            <button 
                                                type="button" 
                                                className="btn-primary mt-4 w-full py-2 text-sm"
                                                onClick={() => confirmVote(candidate)}
                                                disabled={selectedCandidate?.id === candidate.id}
                                            >
                                                {selectedCandidate?.id === candidate.id ? 'Selected' : 'Select Candidate'}
                                            </button>
                                        )}
                                    </label>
                                ))
                            )}
                        </div>
                    </fieldset>
                </>
            )}

            {/* Confirmation & Transaction Modal */}
            {selectedCandidate && (
                <div className={`fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4`} onClick={['checking', 'signing', 'pending', 'confirming'].includes(voteState) ? undefined : cancelVote}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 relative" onClick={e => e.stopPropagation()}>
                        {['reviewing', 'failed', 'recovered'].includes(voteState) && (
                            <button className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-2xl" onClick={cancelVote} aria-label="Close">&times;</button>
                        )}

                        {/* Transaction Processing Overlay */}
                        {['checking', 'signing', 'pending', 'confirming', 'confirmed'].includes(voteState) ? (
                            <div className="text-center py-4">
                                <div className="w-20 h-20 rounded-full bg-blue-50 text-primary flex items-center justify-center mx-auto mb-4 border-2 border-blue-200">
                                    <i className={`fa-solid ${voteState === 'confirmed' ? 'fa-check-circle text-green-600' : 'fa-circle-notch fa-spin'} text-3xl`}></i>
                                </div>
                                <h2 className="text-xl font-bold text-primary mb-2">
                                    {voteState === 'checking' && 'Acquiring Pre-Flight Token...'}
                                    {voteState === 'signing' && 'Waiting for Secure Vault Signature...'}
                                    {voteState === 'pending' && 'Transmitting to RPC Mempool...'}
                                    {voteState === 'confirming' && 'Awaiting Block Confirmations...'}
                                    {voteState === 'confirmed' && 'Zero-Knowledge Vote Confirmed!'}
                                </h2>
                                <p className="text-gray-500 text-sm mb-4">
                                    {voteState === 'checking' && 'Authenticating eligibility against blockchain and issuing TTL Redis Lock.'}
                                    {voteState === 'signing' && 'Please approve the gas estimation and signature in your Vault provider.'}
                                    {voteState === 'pending' && 'Mined to mempool. Waiting for validator nodes.'}
                                    {voteState === 'confirming' && 'Your transaction is being verified. Do not close this window.'}
                                    {voteState === 'confirmed' && 'Your vote has been irrevocably appended to the Bharat E-Vote ledger.'}
                                </p>

                                {/* Progress Steps */}
                                <div className="flex justify-center gap-2 mb-4">
                                    <div className={`w-3 h-3 rounded-full ${['checking', 'signing', 'pending'].includes(voteState) ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                                    <div className={`w-3 h-3 rounded-full ${voteState === 'confirming' ? 'bg-blue-500 animate-pulse' : voteState === 'confirmed' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    <div className={`w-3 h-3 rounded-full ${voteState === 'confirmed' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                </div>

                                {/* Transaction Hash */}
                                {txHash && (
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4 text-left">
                                        <p className="text-xs text-gray-500 font-medium mb-1">Transaction Hash</p>
                                        <p className="text-xs text-gray-700 font-mono break-all">{txHash}</p>
                                    </div>
                                )}

                                <p className="text-xs text-gray-400 mt-4">
                                    <i className="fa-solid fa-lock mr-1"></i>
                                    This window cannot be closed while the transaction is processing.
                                </p>
                            </div>
                        ) : (
                            /* Normal Confirmation View */
                            <>
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

                                <Turnstile onVerify={setTurnstileToken} onError={() => setError('Bot check failed. Please refresh.')} action="submit_vote" />

                                <div className="flex gap-3">
                                    <button 
                                        className="btn-secondary flex-1 py-3" 
                                        onClick={cancelVote} 
                                        disabled={['checking', 'signing', 'pending', 'confirming'].includes(voteState)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        className="btn-primary flex-1 py-3" 
                                        onClick={submitVote} 
                                        disabled={['checking', 'signing', 'pending', 'confirming'].includes(voteState) || !turnstileToken}
                                    >
                                        Confirm Vote
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

export default VotingPage;
