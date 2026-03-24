import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

function VoterGuidelines() {
    const navigate = useNavigate();

    return (
        <div className="guidelines-page">
            <nav className="govt-navbar">
                <div className="navbar-top">
                    <span>भारत निर्वाचन आयोग | Election Commission of India</span>
                </div>
                <div className="navbar-main">
                    <div className="navbar-brand" onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="National Emblem" />
                        <div className="brand-text">
                            <span className="title">Bharat E-Vote</span>
                            <span className="subtitle">Voter Guidelines</span>
                        </div>
                    </div>
                    <button onClick={() => navigate(-1)} className="btn btn-secondary">
                        <i className="fa-solid fa-arrow-left"></i> Go Back
                    </button>
                </div>
            </nav>

            <div className="guidelines-container" style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem' }}>
                <div className="content-card">
                    <h1 style={{ color: '#000080', marginBottom: '1.5rem', borderBottom: '3px solid #FF9933', paddingBottom: '0.5rem' }}>
                        <i className="fa-solid fa-book"></i> Voter Guidelines
                    </h1>
                    <p style={{ color: '#555', marginBottom: '2rem' }}>
                        As per Election Commission of India norms for secure and transparent voting
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                        {/* Before Voting */}
                        <div className="guideline-section">
                            <h2 style={{ color: '#000080', marginBottom: '1rem' }}>
                                <i className="fa-solid fa-clipboard-check"></i> Before Voting
                            </h2>
                            <ul style={{ lineHeight: '1.8', color: '#333' }}>
                                <li><strong>Verify Your Registration:</strong> Ensure your name appears in the electoral roll. Check at nvsp.in or your local Electoral Registration Officer.</li>
                                <li><strong>Valid ID Required:</strong> Carry your EPIC (Voter ID Card) or any of the 12 alternative photo IDs approved by ECI.</li>
                                <li><strong>Aadhaar Linking:</strong> For e-voting, your Aadhaar must be linked to your voter registration.</li>
                                <li><strong>Polling Hours:</strong> Voting is open from <strong>7:00 AM to 6:00 PM</strong> on the designated polling day.</li>
                                <li><strong>Wallet Setup:</strong> Install MetaMask browser extension and connect to the Hardhat Local network.</li>
                            </ul>
                        </div>

                        {/* During Voting */}
                        <div className="guideline-section">
                            <h2 style={{ color: '#000080', marginBottom: '1rem' }}>
                                <i className="fa-solid fa-vote-yea"></i> During Voting
                            </h2>
                            <ul style={{ lineHeight: '1.8', color: '#333' }}>
                                <li><strong>One Person, One Vote:</strong> Each voter can cast only ONE vote. Multiple voting is a punishable offense under IPC Section 171.</li>
                                <li><strong>Secret Ballot:</strong> Your vote is encrypted on the blockchain. No one can see whom you voted for.</li>
                                <li><strong>Confirm Before Submit:</strong> Review your choice carefully before confirming. Once submitted, votes CANNOT be changed.</li>
                                <li><strong>Transaction Confirmation:</strong> Wait for MetaMask to confirm the transaction. Do not close the browser until you see the success message.</li>
                                <li><strong>No Photography:</strong> Taking photos or videos inside the voting area is prohibited.</li>
                            </ul>
                        </div>

                        {/* After Voting */}
                        <div className="guideline-section">
                            <h2 style={{ color: '#000080', marginBottom: '1rem' }}>
                                <i className="fa-solid fa-flag-checkered"></i> After Voting
                            </h2>
                            <ul style={{ lineHeight: '1.8', color: '#333' }}>
                                <li><strong>Vote Receipt:</strong> Your vote is recorded on the blockchain with a unique transaction hash.</li>
                                <li><strong>Results Declaration:</strong> Results will be announced after polls close, as per ECI schedule.</li>
                                <li><strong>Verification:</strong> You can verify your vote was recorded on the blockchain explorer.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Code of Conduct */}
                    <div className="guideline-section" style={{ background: '#f0f7ff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #000080' }}>
                        <h2 style={{ color: '#000080', marginBottom: '1rem' }}>
                            <i className="fa-solid fa-scale-balanced"></i> Model Code of Conduct
                        </h2>
                        <ul style={{ lineHeight: '2', color: '#333' }}>
                            <li>Do not attempt to influence other voters</li>
                            <li>Maintain decorum and silence in the voting area</li>
                            <li>Report any irregularities to the Election Officer</li>
                            <li>Respect the democratic process and accept results</li>
                        </ul>
                    </div>

                    {/* Important Notice */}
                    <div style={{ marginTop: '2rem', background: '#fff3cd', border: '1px solid #ffc107', padding: '1rem', borderRadius: '4px' }}>
                        <strong><i className="fa-solid fa-triangle-exclamation"></i> Important:</strong> Any attempt to tamper with the voting process, cast multiple votes, or impersonate another voter is a criminal offense punishable under the Indian Penal Code.
                    </div>

                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <Link to="/vote" className="btn btn-primary btn-lg">
                            <i className="fa-solid fa-arrow-right"></i> Proceed to Vote
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VoterGuidelines;
