import React from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';

function LandingPage({ user }) {
    const navigate = useNavigate();

    const handleVoteNow = () => {
        if (user) {
            navigate('/vote');
        } else {
            navigate('/login');
        }
    };

    return (
        <>
            {/* Hero Section */}
            <section id="main-content" className="hero-section">
                <div className="hero-content">
                    <span className="hero-badge">
                        <i className="fa-solid fa-graduation-cap"></i> Final Year Project Demo
                    </span>

                    <h1>Blockchain-Based E-Voting System</h1>

                    <p>
                        A demonstration of secure electronic voting using blockchain technology.
                        This project showcases transparent, immutable, and verifiable voting.
                    </p>

                    {user?.hasVoted ? (
                        <div style={{
                            background: 'rgba(255,255,255,0.1)',
                            padding: '2rem',
                            borderRadius: '8px',
                            border: '2px solid #138808'
                        }}>
                            <i className="fa-solid fa-check-circle" style={{ fontSize: '3rem', color: '#138808', marginBottom: '1rem', display: 'block' }}></i>
                            <h2 style={{ marginBottom: '0.5rem' }}>Thank You, {user.fullname}!</h2>
                            <p style={{ margin: 0, opacity: 0.9 }}>You have successfully cast your vote. Jai Hind!</p>
                        </div>
                    ) : (
                        <>
                            <button onClick={handleVoteNow} className="hero-btn">
                                <i className="fa-solid fa-fingerprint"></i> Access Voting Terminal
                            </button>

                            <div className="hero-warning">
                                <i className="fa-solid fa-shield-halved"></i>
                                Authentication requires OTP & Biometric verification
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* Information Cards - NO LIVE RESULTS */}
            <section className="info-section">
                <div className="info-grid">
                    {/* Election Schedule Card */}
                    <div className="info-card">
                        <div className="info-card-icon">
                            <i className="fa-solid fa-calendar-days"></i>
                        </div>
                        <h3>Election Schedule</h3>
                        <p>Polling hours for General Election 2026</p>
                        <div className="schedule">
                            <div className="schedule-item">
                                <span className="label">Opens At</span>
                                <span className="time">7:00 AM</span>
                            </div>
                            <div className="schedule-item">
                                <span className="label">Closes At</span>
                                <span className="time">6:00 PM</span>
                            </div>
                        </div>
                    </div>

                    {/* Voter Turnout Card - NO Party-wise results */}
                    <div className="info-card">
                        <div className="info-card-icon">
                            <i className="fa-solid fa-chart-pie"></i>
                        </div>
                        <h3>Voter Turnout</h3>
                        <p>Current polling participation status</p>
                        <div className="turnout-bar">
                            <div className="turnout-fill" style={{ width: '45%' }}></div>
                        </div>
                        <div className="turnout-label">
                            <span>0%</span>
                            <span className="highlight" style={{ fontSize: '1.2rem' }}>45% Polling Completed</span>
                            <span>100%</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#777', marginTop: '0.5rem' }}>
                            * Results will be declared after polls close
                        </p>
                    </div>

                    {/* Helpdesk Card */}
                    <div className="info-card">
                        <div className="info-card-icon">
                            <i className="fa-solid fa-headset"></i>
                        </div>
                        <h3>Voter Helpdesk</h3>
                        <p>Need assistance? We're here to help 24/7</p>
                        <span className="helpdesk-number">1950</span>
                        <p className="helpdesk-note">Toll-Free | Available in 22 Languages</p>
                        <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#555' }}>
                            <p><i className="fa-solid fa-envelope"></i> complaints@eci.gov.in</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Guidelines Section */}
            <section style={{ padding: '3rem 5%', background: '#F5F7FA' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <h2 style={{ textAlign: 'center', color: '#000080', marginBottom: '2rem' }}>
                        Voting Guidelines
                    </h2>
                    <div className="info-grid">
                        <div className="info-card" style={{ borderTop: '4px solid #FF9933' }}>
                            <h3><i className="fa-solid fa-id-card" style={{ color: '#FF9933', marginRight: '0.5rem' }}></i> Step 1: Verify Identity</h3>
                            <p>Login using your Aadhaar number and complete OTP verification sent to your registered mobile.</p>
                        </div>
                        <div className="info-card" style={{ borderTop: '4px solid #FFFFFF' }}>
                            <h3><i className="fa-solid fa-wallet" style={{ color: '#000080', marginRight: '0.5rem' }}></i> Step 2: Connect Wallet</h3>
                            <p>Connect your MetaMask wallet for blockchain-based vote authentication and transparency.</p>
                        </div>
                        <div className="info-card" style={{ borderTop: '4px solid #138808' }}>
                            <h3><i className="fa-solid fa-check-to-slot" style={{ color: '#138808', marginRight: '0.5rem' }}></i> Step 3: Cast Vote</h3>
                            <p>Select your candidate and confirm. Your vote is encrypted and recorded on the blockchain.</p>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default LandingPage;
