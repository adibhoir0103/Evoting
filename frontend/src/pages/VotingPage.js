import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BlockchainService } from '../services/blockchainService';
import { authService } from '../services/authService';

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
            const [candidatesData, status, voted, authorized] = await Promise.all([
                service.getAllCandidates(),
                service.isVotingActive(),
                service.hasVoted(address),
                service.isAuthorized(address)
            ]);

            setCandidates(candidatesData);
            setVotingActive(status);
            setHasVoted(voted || user?.hasVoted);
            setIsAuthorized(authorized);
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
            const receipt = await service.vote(selectedCandidate.id);

            await authService.recordVote(selectedCandidate.id, receipt.hash);

            setSuccess('Vote cast successfully! Thank you for participating.');
            setHasVoted(true);
            setSelectedCandidate(null);

            if (onUserUpdate) {
                onUserUpdate({ ...user, hasVoted: true });
            }

            await loadBlockchainData(BlockchainService.getInstance(), walletAddress);
        } catch (err) {
            setError(err.message || 'Failed to cast vote');
        } finally {
            setTxLoading(false);
        }
    };

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
                        <p style={{ color: '#555' }}>No candidates available</p>
                    </div>
                ) : (
                    candidates.map(candidate => (
                        <div
                            key={candidate.id}
                            className={`candidate-card ${selectedCandidate?.id === candidate.id ? 'selected' : ''}`}
                            onClick={() => votingActive && isAuthorized && confirmVote(candidate)}
                            style={{ cursor: votingActive && isAuthorized ? 'pointer' : 'not-allowed', opacity: votingActive && isAuthorized ? 1 : 0.6 }}
                        >
                            <div className="candidate-avatar">
                                {candidate.id}
                            </div>
                            <h3>{candidate.name}</h3>
                            <p>Candidate #{candidate.id}</p>
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
                            <div className="candidate-avatar" style={{ margin: '0 auto 1rem' }}>
                                {selectedCandidate.id}
                            </div>
                            <h3 style={{ color: '#000080' }}>{selectedCandidate.name}</h3>
                            <p style={{ color: '#555' }}>Candidate #{selectedCandidate.id}</p>
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
