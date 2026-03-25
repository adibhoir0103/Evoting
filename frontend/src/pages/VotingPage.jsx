import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BlockchainService } from '../services/blockchainService';
import { authService } from '../services/authService';
import { zkpClientService } from '../services/zkpService';
import ZKPVerificationPanel from '../components/ZKPVerificationPanel';

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

    const indianStates = [
        { code: 1, name: 'Andhra Pradesh' }, { code: 2, name: 'Arunachal Pradesh' },
        { code: 3, name: 'Assam' }, { code: 4, name: 'Bihar' },
        { code: 5, name: 'Chhattisgarh' }, { code: 6, name: 'Goa' },
        { code: 7, name: 'Gujarat' }, { code: 8, name: 'Haryana' },
        { code: 9, name: 'Himachal Pradesh' }, { code: 10, name: 'Jharkhand' },
        { code: 11, name: 'Karnataka' }, { code: 12, name: 'Kerala' },
        { code: 13, name: 'Madhya Pradesh' }, { code: 14, name: 'Maharashtra' },
        { code: 15, name: 'Manipur' }, { code: 16, name: 'Meghalaya' },
        { code: 17, name: 'Mizoram' }, { code: 18, name: 'Nagaland' },
        { code: 19, name: 'Odisha' }, { code: 20, name: 'Punjab' },
        { code: 21, name: 'Rajasthan' }, { code: 22, name: 'Sikkim' },
        { code: 23, name: 'Tamil Nadu' }, { code: 24, name: 'Telangana' },
        { code: 25, name: 'Tripura' }, { code: 26, name: 'Uttar Pradesh' },
        { code: 27, name: 'Uttarakhand' }, { code: 28, name: 'West Bengal' },
        { code: 29, name: 'Delhi (NCT)' }, { code: 30, name: 'Jammu & Kashmir' },
        { code: 31, name: 'Ladakh' }, { code: 32, name: 'Puducherry' },
        { code: 33, name: 'Chandigarh' }, { code: 34, name: 'Andaman & Nicobar' },
        { code: 35, name: 'Dadra & Nagar Haveli' }, { code: 36, name: 'Lakshadweep' }
    ];
    const getStateName = (code) => (indianStates.find(s => s.code === Number(code)) || {}).name || '';

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

            // Fetch candidates and filter based on constituency rules
            // If vInfo.stateCode is 0, they can see all candidates marked 0 for state
            // If candidate stateCode is 0, it applies to all states
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

            // Check if ZKP mode is enabled
            let isZKP = false;
            try {
                isZKP = await service.isZKPEnabled();
            } catch (e) {
                // ZKP check failed, proceed with legacy
            }

            if (isZKP && voterSecret) {
                // ===== ZKP VOTING FLOW =====
                // Step 1: Generate vote package locally (privacy preserved)
                const votePackage = await zkpClientService.generateVotePackage(
                    selectedCandidate.id,
                    voterSecret,
                    candidates.length,
                    'bharat-evote-2026'
                );

                // Step 2: Pin vote metadata to IPFS
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

                // Step 3: Submit encrypted vote to blockchain
                const receipt = await service.submitEncryptedVote(
                    votePackage.commitment,
                    votePackage.nullifierHash,
                    votePackage.identityCommitment,
                    votePackage.proof,
                    ipfsHash
                );

                // Step 4: Record in backend database
                await authService.recordVote(selectedCandidate.id, receipt.hash);

                // Step 5: Show COMPULSORY verification panel
                setZkpVoteData({
                    nullifierHash: votePackage.nullifierHash,
                    commitment: votePackage.commitment,
                    ipfsHash: ipfsHash,
                    txHash: receipt.hash
                });
                setShowVerification(true);
                setSelectedCandidate(null);
            } else {
                // ===== LEGACY VOTING FLOW =====
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
            <div className="voting-container">
                <nav className="govt-navbar">
                    <div className="navbar-top">
                        <span>भारत निर्वाचन आयोग | Election Commission of India</span>
                    </div>
                    <div className="navbar-main">
                        <Link to="/" className="navbar-brand">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="National Emblem" />
                            <div className="brand-text">
                                <span className="title">Election Commission of India</span>
                                <span className="subtitle">ZKP Vote Verification</span>
                            </div>
                        </Link>
                    </div>
                </nav>

                <div style={{ padding: '2rem 1rem' }}>
                    <ZKPVerificationPanel
                        nullifierHash={zkpVoteData.nullifierHash}
                        commitment={zkpVoteData.commitment}
                        ipfsHash={zkpVoteData.ipfsHash}
                        blockchainService={BlockchainService.getInstance()}
                        onVerificationComplete={handleVerificationComplete}
                    />
                </div>
            </div>
        );
    }

    // Render wallet connection screen
    if (!walletConnected && !loading) {
        return (
            <div className="voting-container">
                <nav className="govt-navbar">
                    <div className="navbar-top">
                        <span>भारत निर्वाचन आयोग | Election Commission of India</span>
                    </div>
                    <div className="navbar-main">
                        <Link to="/" className="navbar-brand">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="National Emblem" />
                            <div className="brand-text">
                                <span className="title">Election Commission of India</span>
                                <span className="subtitle">Bharat E-Vote Portal</span>
                            </div>
                        </Link>
                        <Link to="/" className="btn btn-secondary">
                            <i className="fa-solid fa-arrow-left"></i> Back to Home
                        </Link>
                    </div>
                </nav>

                <div className="auth-container">
                    <div className="auth-card" style={{ textAlign: 'center', maxWidth: '500px' }}>
                        <div style={{ fontSize: '4rem', color: '#000080', marginBottom: '1rem' }}>
                            <i className="fa-solid fa-wallet"></i>
                        </div>
                        <h2 style={{ color: '#000080' }}>Connect Blockchain Wallet</h2>
                        <p style={{ color: '#555', marginBottom: '1.5rem' }}>
                            To ensure vote transparency and immutability, connect your MetaMask wallet.
                        </p>
                        {error && <div className="error-message">{error}</div>}
                        <button onClick={connectWallet} className="btn btn-primary btn-lg btn-block">
                            <i className="fa-solid fa-link"></i> Connect MetaMask
                        </button>
                        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #dee2e6' }}>
                            <p style={{ color: '#777', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Don't have MetaMask?</p>
                            <a
                                href="https://metamask.io/download/"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#000080' }}
                            >
                                Download MetaMask →
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="voting-container">
                <nav className="govt-navbar">
                    <div className="navbar-top">
                        <span>भारत निर्वाचन आयोग | Election Commission of India</span>
                    </div>
                    <div className="navbar-main">
                        <Link to="/" className="navbar-brand">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="National Emblem" />
                            <div className="brand-text">
                                <span className="title">Election Commission of India</span>
                            </div>
                        </Link>
                    </div>
                </nav>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p style={{ color: '#555' }}>Loading voting terminal...</p>
                </div>
            </div>
        );
    }

    // Thank you screen
    if (hasVoted) {
        return (
            <div className="voting-container">
                <nav className="govt-navbar">
                    <div className="navbar-top">
                        <span>भारत निर्वाचन आयोग | Election Commission of India</span>
                    </div>
                    <div className="navbar-main">
                        <Link to="/" className="navbar-brand">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="National Emblem" />
                            <div className="brand-text">
                                <span className="title">Election Commission of India</span>
                                <span className="subtitle">Bharat E-Vote Portal</span>
                            </div>
                        </Link>
                        <Link to="/" className="btn btn-secondary">
                            <i className="fa-solid fa-home"></i> Return to Home
                        </Link>
                    </div>
                </nav>

                <div className="auth-container">
                    <div className="auth-card" style={{ textAlign: 'center', maxWidth: '600px' }}>
                        <div className="thank-you-icon">
                            <i className="fa-solid fa-check-circle"></i>
                        </div>
                        <h2 style={{ color: '#000080', marginBottom: '1rem' }}>Thank You, {user?.fullname}!</h2>
                        <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Your vote has been successfully recorded.</p>
                        <div style={{
                            background: '#f0fff4',
                            border: '1px solid #138808',
                            padding: '1rem',
                            borderRadius: '4px',
                            marginBottom: '1.5rem'
                        }}>
                            <p style={{ color: '#138808', margin: 0 }}>
                                <i className="fa-solid fa-shield-halved"></i> Your vote is encrypted and stored on the blockchain. It cannot be altered or deleted.
                            </p>
                        </div>
                        <p style={{ color: '#555' }}>
                            Results will be declared after polls close at 6:00 PM as per Election Commission guidelines.
                        </p>
                        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #dee2e6' }}>
                            <p style={{ color: '#777', fontSize: '0.9rem' }}>Jai Hind! 🇮🇳</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Main voting interface
    return (
        <div className="voting-container">
            <nav className="govt-navbar">
                <div className="navbar-top">
                    <span>भारत निर्वाचन आयोग | Election Commission of India</span>
                    <span>Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                </div>
                <div className="navbar-main">
                    <Link to="/" className="navbar-brand">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="National Emblem" />
                        <div className="brand-text">
                            <span className="title">Election Commission of India</span>
                            <span className="subtitle">Bharat E-Vote Portal</span>
                        </div>
                    </Link>
                </div>
            </nav>

            <div className="voting-header">
                <h1>General Election 2026 - Voting Terminal</h1>
                <p>Select your candidate and confirm your choice</p>
            </div>

            {/* Status Bar */}
            <div className="status-bar">
                <div className={`status-item ${votingActive ? 'success' : 'error'}`}>
                    <i className={`fa-solid ${votingActive ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                    Voting: {votingActive ? 'Active' : 'Inactive'}
                </div>
                <div className={`status-item ${isAuthorized ? 'success' : 'warning'}`}>
                    <i className={`fa-solid ${isAuthorized ? 'fa-check' : 'fa-exclamation-triangle'}`}></i>
                    Status: {isAuthorized ? 'Authorized' : 'Not Authorized'}
                </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div style={{ maxWidth: '800px', margin: '1rem auto', padding: '0 1rem' }}>
                    <div className="error-message">{error}</div>
                </div>
            )}
            {success && (
                <div style={{ maxWidth: '800px', margin: '1rem auto', padding: '0 1rem' }}>
                    <div className="success-message">{success}</div>
                </div>
            )}

            {/* Warnings */}
            {!isAuthorized && (
                <div style={{ maxWidth: '800px', margin: '1rem auto', padding: '0 1rem' }}>
                    <div className="error-message">
                        <i className="fa-solid fa-exclamation-triangle"></i> You are not authorized to vote. Please contact your local Election Officer.
                    </div>
                </div>
            )}

            {!votingActive && isAuthorized && (
                <div style={{ maxWidth: '800px', margin: '1rem auto', padding: '0 1rem' }}>
                    <div style={{ background: '#fff8e6', border: '1px solid #ffc107', padding: '1rem', borderRadius: '4px', color: '#856404' }}>
                        <i className="fa-solid fa-clock"></i> Voting is not currently active. Polling hours: 7:00 AM - 6:00 PM.
                    </div>
                </div>
            )}

            {/* Candidates Grid */}
            <div className="candidates-grid">
                {candidates.length === 0 ? (
                    <div className="auth-card" style={{ textAlign: 'center', gridColumn: '1 / -1' }}>
                        <p style={{ color: '#555' }}>No candidates available in your constituency</p>
                    </div>
                ) : (
                    candidates.map(candidate => (
                        <div
                            key={candidate.id}
                            className={`candidate-card ${selectedCandidate?.id === candidate.id ? 'selected' : ''}`}
                            onClick={() => votingActive && isAuthorized && confirmVote(candidate)}
                            style={{ cursor: votingActive && isAuthorized ? 'pointer' : 'not-allowed', opacity: votingActive && isAuthorized ? 1 : 0.6 }}
                        >
                            <div className="candidate-avatar" style={{ fontSize: '1.5rem', background: '#eef2f5', color: '#000080' }}>
                                {candidate.partySymbol || <i className="fa-solid fa-user-tie"></i>}
                            </div>
                            <h3>{candidate.name}</h3>
                            <p style={{ fontWeight: 'bold', color: '#138808', marginBottom: '0.2rem' }}>
                                {candidate.partyName || 'Independent'}
                            </p>
                            <p style={{ fontSize: '0.8rem', color: '#777' }}>
                                Candidate #{candidate.id}
                                {candidate.stateCode ? ` | ${getStateName(candidate.stateCode)}` : ' | National'}
                            </p>
                            {votingActive && isAuthorized && (
                                <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
                                    Select Candidate
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Confirmation Modal */}
            {selectedCandidate && (
                <div className="modal-overlay" onClick={cancelVote}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-modal" onClick={cancelVote}>&times;</button>
                        <h2 style={{ color: '#000080', marginBottom: '1rem' }}>Confirm Your Vote</h2>
                        <p style={{ color: '#555', marginBottom: '1.5rem' }}>You are about to vote for:</p>

                        <div style={{
                            background: '#F5F7FA',
                            border: '2px solid #000080',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            textAlign: 'center',
                            marginBottom: '1.5rem'
                        }}>
                            <div className="candidate-avatar" style={{ margin: '0 auto 1rem', fontSize: '2rem', background: '#eef2f5', color: '#000080' }}>
                                {selectedCandidate.partySymbol || <i className="fa-solid fa-user-tie"></i>}
                            </div>
                            <h3 style={{ color: '#000080', marginBottom: '0.2rem' }}>{selectedCandidate.name}</h3>
                            <p style={{ fontWeight: 'bold', color: '#138808', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                                {selectedCandidate.partyName || 'Independent'}
                            </p>
                            <p style={{ color: '#555', fontSize: '0.9rem' }}>
                                Candidate #{selectedCandidate.id}
                                {selectedCandidate.stateCode ? ` | ${getStateName(selectedCandidate.stateCode)} Constituency: ${selectedCandidate.constituencyCode}` : ' | National List'}
                            </p>
                        </div>

                        <div style={{
                            background: '#fff8e6',
                            border: '1px solid #ffc107',
                            borderRadius: '4px',
                            padding: '1rem',
                            marginBottom: '1.5rem',
                            fontSize: '0.9rem',
                            color: '#856404'
                        }}>
                            <i className="fa-solid fa-exclamation-triangle"></i> Once submitted, your vote <strong>cannot be changed</strong>. This action is final.
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={cancelVote} disabled={txLoading}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={submitVote} disabled={txLoading}>
                                {txLoading ? 'Processing...' : 'Confirm Vote'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default VotingPage;
