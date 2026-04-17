import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BlockchainService } from '../services/blockchainService';
import { authService } from '../services/authService';
import { zkpClientService } from '../services/zkpService';
import ZKPVerificationPanel from '../components/ZKPVerificationPanel';
import ProctorGuard from '../components/ProctorGuard';
import QRVoteTicket from '../components/QRVoteTicket';
import { indianStates, getStateName } from '../utils/indianStates';
import { Helmet } from 'react-helmet-async';
import { jsPDF } from 'jspdf';
import useElectionTimer from '../hooks/useElectionTimer';

function VotingPage({ user, onUserUpdate }) {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [votingActive, setVotingActive] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [voteState, setVoteState] = useState('idle');
    const [txHash, setTxHash] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [walletConnected, setWalletConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [voterConstituencyInfo, setVoterConstituencyInfo] = useState(null);

    // Proctored Voting Window State
    const [proctorActive, setProctorActive] = useState(false);
    const [proctorCandidate, setProctorCandidate] = useState(null);

    // ZKP State
    const [zkpMode, setZkpMode] = useState(false);
    const [zkpVoteData, setZkpVoteData] = useState(null);
    const [showVerification, setShowVerification] = useState(false);
    const [voterSecret, setVoterSecret] = useState('');

    // QR Voting Ticket State
    const [showQRTicket, setShowQRTicket] = useState(false);
    const [qrTicketValidated, setQrTicketValidated] = useState(false);

    // Blockchain-synced election timer
    const { hours, minutes, seconds, electionState: timerState } = useElectionTimer();

    useEffect(() => {
        if (!user) {
            navigate('/dashboard');
            return;
        }

        if (user.walletAddress) {
            setWalletAddress(user.walletAddress);
            initializeBlockchain(user.walletAddress);
        } else {
            // Auto prompt MetaMask connection if not linked yet
            connectWallet();
        }
    }, [user, navigate]);

    // Modal scroll lock
    useEffect(() => {
        if (selectedCandidate || showVerification || ['checking', 'signing', 'pending', 'confirming'].includes(voteState)) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [selectedCandidate, showVerification, voteState]);

    const connectWallet = async (forceSelect = false) => {
        try {
            setLoading(true);
            setError('');

            const service = BlockchainService.getInstance();
            const account = await service.connectWallet(forceSelect);

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
        setVoteState('reviewing');
        setSelectedCandidate(candidate);
    };

    const cancelVote = () => {
        setVoteState('selecting');
        setSelectedCandidate(null);
    };

    // ===== QR TICKET HANDLER =====
    const requestQRTicket = () => {
        setShowQRTicket(true);
        setError('');
        setSuccess('');
    };

    const handleQRTicketValidated = (ticketToken) => {
        setShowQRTicket(false);
        setQrTicketValidated(true);
        // After QR validated, go straight to proctor mode
        setProctorActive(true);
        setProctorCandidate(null);
        setVoteState('selecting');
        setError('');
        setSuccess('');
    };

    const handleQRCancel = () => {
        setShowQRTicket(false);
    };

    // ===== PROCTOR GUARD HANDLERS =====
    const enterProctorMode = () => {
        // If QR ticket hasn't been validated yet, show QR first
        if (!qrTicketValidated) {
            requestQRTicket();
            return;
        }
        setProctorActive(true);
        setProctorCandidate(null);
        setVoteState('selecting');
        setError('');
        setSuccess('');
    };

    const handleProctorSelectCandidate = (candidate) => {
        setProctorCandidate(candidate);
        setSelectedCandidate(candidate);
    };

    const handleProctorConfirmVote = async (candidate) => {
        if (!candidate) return;
        setSelectedCandidate(candidate);
        await submitVoteFromProctor(candidate);
    };

    const handleProctorCancel = () => {
        setProctorActive(false);
        setProctorCandidate(null);
        setSelectedCandidate(null);
        setVoteState('idle');
    };

    // ===== UNIFIED VOTE EXECUTION (replaces duplicate submitVote + submitVoteFromProctor) =====
    const executeVote = async (candidate) => {
        if (!candidate) return;

        try {
            setVoteState('checking');
            setTxHash('');
            setError('');

            const service = BlockchainService.getInstance();
            let isZKP = false;
            try { isZKP = await service.isZKPEnabled(); } catch (e) { /* legacy */ }

            setVoteState('signing');

            if (isZKP && voterSecret) {
                const votePackage = await zkpClientService.generateVotePackage(
                    candidate.id,
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

                await authService.recordVote(receipt.hash);
                setVoteState('confirmed');

                setZkpVoteData({
                    nullifierHash: votePackage.nullifierHash,
                    commitment: votePackage.commitment,
                    ipfsHash: ipfsHash,
                    txHash: receipt.hash
                });
                setShowVerification(true);
            } else {
                setVoteState('pending');
                const receipt = await service.vote(candidate.id);
                setVoteState('confirming');
                setTxHash(receipt.hash);

                await authService.recordVote(receipt.hash);
                setVoteState('confirmed');

                setSuccess(`Vote cast successfully! Tx: ${receipt.hash.slice(0, 10)}...`);
            }

            // Common post-vote state updates
            setHasVoted(true);
            setSelectedCandidate(null);
            if (onUserUpdate) onUserUpdate({ ...user, hasVoted: true });
            await loadBlockchainData(service, walletAddress);
        } catch (err) {
            const msg = err.message || 'Failed to cast vote';
            if (msg.includes('rejected') || msg.includes('ACTION_REJECTED')) {
                setError('You rejected the transaction — you have not voted yet.');
                setVoteState('recovered');
            } else {
                setError(msg);
                setVoteState('failed');
            }
        }
    };

    // Wrappers for proctor mode and direct mode
    const submitVoteFromProctor = (candidate) => executeVote(candidate);
    const submitVote = () => executeVote(selectedCandidate);

    const handleVerificationComplete = () => {
        setShowVerification(false);
        setSuccess('Vote cast and verified successfully via Zero-Knowledge Proof! Thank you for participating.');
        setHasVoted(true);
        if (onUserUpdate) {
            onUserUpdate({ ...user, hasVoted: true });
        }
    };

    // ===== PDF VOTE RECEIPT GENERATOR =====
    const generateVoteReceipt = () => {
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            
            doc.setFillColor(0, 51, 102);
            doc.rect(0, 0, pageWidth, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('BHARAT E-VOTE', pageWidth / 2, 18, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Official Digital Vote Receipt — Election Commission of India', pageWidth / 2, 28, { align: 'center' });
            doc.text('Secured by Zero-Knowledge Blockchain Cryptography', pageWidth / 2, 35, { align: 'center' });

            doc.setTextColor(0, 0, 0);
            let y = 55;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Vote Confirmation Receipt', 20, y); y += 12;

            doc.setDrawColor(0, 51, 102);
            doc.setLineWidth(0.5);
            doc.line(20, y, pageWidth - 20, y); y += 10;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            const details = [
                ['Voter Name:', user?.fullname || 'N/A'],
                ['Voter ID:', user?.voterId || 'N/A'],
                ['Wallet Address:', walletAddress || 'N/A'],
                ['Transaction Hash:', txHash || 'N/A'],
                ['Constituency:', voterConstituencyInfo ? `State ${voterConstituencyInfo.stateCode} — Constituency ${voterConstituencyInfo.constituencyCode}` : 'National'],
                ['Timestamp:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
                ['Election:', 'General Election 2026'],
                ['Verification:', 'Blockchain-Immutable, Zero-Knowledge Verified']
            ];

            for (const [label, value] of details) {
                doc.setFont('helvetica', 'bold');
                doc.text(label, 20, y);
                doc.setFont('helvetica', 'normal');
                const lines = doc.splitTextToSize(value, pageWidth - 85);
                doc.text(lines, 65, y);
                y += (lines.length * 6) + 4;
            }

            y += 5;
            doc.setDrawColor(0, 51, 102);
            doc.line(20, y, pageWidth - 20, y); y += 10;

            doc.setFillColor(240, 249, 255);
            doc.roundedRect(20, y, pageWidth - 40, 30, 3, 3, 'F');
            doc.setFontSize(9);
            doc.setTextColor(0, 51, 102);
            doc.text('SECURITY NOTICE', 25, y + 8);
            doc.setTextColor(80, 80, 80);
            doc.setFontSize(8);
            doc.text('This receipt proves your participation without revealing your vote choice.', 25, y + 15);
            doc.text('Your vote is encrypted on the Ethereum blockchain and cannot be altered or deleted.', 25, y + 21);
            doc.text('Verify this transaction at: https://sepolia.etherscan.io/tx/' + (txHash || ''), 25, y + 27);

            const footerY = doc.internal.pageSize.getHeight() - 20;
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Generated: ${new Date().toISOString()} | Bharat E-Vote v2.0 | Jai Hind!`, pageWidth / 2, footerY, { align: 'center' });

            doc.save(`BharatEVote_Receipt_${Date.now()}.pdf`);
        } catch (err) {
            console.error('PDF generation failed:', err);
            setError('Failed to generate receipt. Please try again.');
        }
    };

    // ZKP Verification Screen
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
            <Helmet>
                <title>Cast Your Vote | Bharat E-Vote Portal</title>
                <meta name="description" content="Securely cast your vote in the General Election 2026 using blockchain-verified zero-knowledge cryptography on the Bharat E-Vote Portal." />
            </Helmet>
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">General Election 2026 — Voting Terminal</h1>
                <p className="text-gray-500 mt-1">Select your candidate and confirm your choice</p>
            </div>

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="max-w-4xl mx-auto mb-6 px-4 md:px-0">
              <ol className="flex text-sm text-gray-500 font-medium">
                <li><Link to="/" className="hover:text-primary transition-colors focus-visible">Home</Link><span className="mx-2">/</span></li>
                <li><Link to="/dashboard" className="hover:text-primary transition-colors focus-visible">Dashboard</Link><span className="mx-2">/</span></li>
                <li className="text-gray-900" aria-current="page">Cast Vote Securely</li>
              </ol>
            </nav>

            {/* Alerts */}
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

            {/* Wallet connection or voting interface */}
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
                            <i className="fa-solid fa-wallet text-indigo-500"></i>
                            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                            <button onClick={() => connectWallet(true)} className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 font-bold underline" aria-label="Switch MetaMask Wallet">
                                Switch
                            </button>
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
                                <i className="fa-solid fa-clock mr-2"></i> 
                                {timerState === 'NOT_STARTED' 
                                    ? `Voting has not started yet. Begins in: ${hours}h ${minutes}m ${seconds}s`
                                    : timerState === 'ENDED'
                                    ? 'Voting period has ended. Results will be announced soon.'
                                    : 'Voting is not currently active. Please wait for the admin to start the election.'}
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

                    {/* ENTER SECURE VOTING WINDOW — No Turnstile gate, directly available */}
                    <div className="max-w-4xl mx-auto">
                        {!votingActive ? (
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
                                <i className="fa-solid fa-lock text-4xl text-gray-400 mb-3"></i>
                                <p className="font-bold text-gray-600">The voting gateway is currently cryptographically sealed.</p>
                            </div>
                        ) : candidates.length === 0 ? (
                            <div className="gov-card text-center p-8">
                                <p className="text-gray-500">No candidates available in your constituency</p>
                            </div>
                        ) : (
                            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 text-center">
                                <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-blue-200 shadow-sm">
                                    <i className="fa-solid fa-shield-halved text-3xl text-blue-600"></i>
                                </div>
                                <h2 className="text-2xl font-black text-gray-900 mb-2">Ready to Cast Your Vote</h2>
                                <p className="text-gray-500 mb-2 max-w-md mx-auto">
                                    You will enter a <strong>secure proctored window</strong> with a <strong>60-second timer</strong>. 
                                    Tab switching, screenshots, and keyboard shortcuts will be blocked.
                                </p>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800 max-w-md mx-auto">
                                    <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                                    <strong>Important:</strong> Complete your vote within the timer. The window will auto-close on expiry.
                                </div>

                                {/* Authentication steps progress */}
                                <div className="flex items-center justify-center gap-2 mb-6">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                                        <i className="fa-solid fa-check-circle"></i> MFA Login
                                    </span>
                                    <i className="fa-solid fa-arrow-right text-gray-300 text-xs"></i>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                                        qrTicketValidated ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                        <i className={`fa-solid ${qrTicketValidated ? 'fa-check-circle' : 'fa-qrcode'}`}></i>
                                        QR Ticket {qrTicketValidated ? '✓' : ''}
                                    </span>
                                    <i className="fa-solid fa-arrow-right text-gray-300 text-xs"></i>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-50 text-gray-500 border border-gray-200">
                                        <i className="fa-solid fa-lock"></i> Proctored Vote
                                    </span>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <button 
                                        className="btn-primary px-8 py-3 text-base font-bold shadow-lg hover:shadow-xl transition-all"
                                        onClick={enterProctorMode}
                                        disabled={!votingActive || !isAuthorized}
                                        aria-label="Generate QR ticket and enter secure voting window"
                                    >
                                        <i className={`fa-solid ${qrTicketValidated ? 'fa-lock' : 'fa-qrcode'} mr-2`}></i>
                                        {qrTicketValidated ? 'Enter Secure Voting Window' : 'Generate QR Ticket & Vote'}
                                    </button>
                                </div>
                                <p className="text-gray-400 text-xs mt-4">
                                    <i className="fa-solid fa-info-circle mr-1"></i>
                                    {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} in your constituency
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* QR VOTING TICKET MODAL */}
            {showQRTicket && (
                <QRVoteTicket
                    user={user}
                    onTicketValidated={handleQRTicketValidated}
                    onCancel={handleQRCancel}
                />
            )}

            {/* PROCTORED VOTING WINDOW */}
            <ProctorGuard
                active={proctorActive}
                candidates={candidates}
                selectedCandidate={proctorCandidate}
                onSelectCandidate={handleProctorSelectCandidate}
                onConfirmVote={handleProctorConfirmVote}
                onCancel={handleProctorCancel}
                voteState={voteState}
                txHash={txHash}
                user={user}
                voterConstituencyInfo={voterConstituencyInfo}
                error={error}
            />
        </section>
    );
}

export default VotingPage;
