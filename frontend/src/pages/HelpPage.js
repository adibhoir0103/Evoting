import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function HelpPage() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('metamask');

    const faqData = [
        {
            id: 'metamask',
            title: 'MetaMask Connection Issues',
            icon: 'fa-wallet',
            content: [
                {
                    q: 'MetaMask is not connecting',
                    a: `1. Install MetaMask from metamask.io/download
2. Create or import a wallet
3. Add Hardhat Network:
   • Network Name: Hardhat Local
   • RPC URL: http://127.0.0.1:8545
   • Chain ID: 31337
   • Currency: ETH
4. Refresh the page and try again`
                },
                {
                    q: 'Transaction failed or pending',
                    a: `1. Check if Hardhat node is running (should be on port 8545)
2. Reset your MetaMask account: Settings → Advanced → Reset Account
3. Ensure you have enough ETH for gas fees
4. Try disconnecting and reconnecting your wallet`
                },
                {
                    q: 'Wrong network error',
                    a: `Switch to Hardhat Local network in MetaMask:
1. Click network dropdown in MetaMask
2. Select "Hardhat Local" (Chain ID 31337)
3. If not listed, add it manually using the RPC URL above`
                }
            ]
        },
        {
            id: 'voting',
            title: 'Voting Problems',
            icon: 'fa-vote-yea',
            content: [
                {
                    q: 'I see "Not Authorized to Vote"',
                    a: `Your wallet address needs to be authorized by the admin:
1. Contact the Election Officer with your wallet address
2. The admin must call authorizeVoter(yourAddress) on the contract
3. Once authorized, refresh the voting page`
                },
                {
                    q: 'Voting is showing as Inactive',
                    a: `Voting must be started by the admin:
1. The admin needs to click "Start Voting" in the admin panel
2. Voting hours are typically 7:00 AM - 6:00 PM
3. Wait for the announcement of voting commencement`
                },
                {
                    q: 'No candidates are showing',
                    a: `Candidates must be added by the admin before voting:
1. The admin adds candidates via the Admin Dashboard
2. Refresh the page after candidates are added
3. If issue persists, check if the smart contract is deployed`
                }
            ]
        },
        {
            id: 'login',
            title: 'Login & Registration Issues',
            icon: 'fa-user',
            content: [
                {
                    q: 'OTP not received on email',
                    a: `1. Check your spam/junk folder
2. Verify the email address is correct
3. For demo: Check the backend console for OTP
4. Wait 2-3 minutes and try "Resend OTP"
5. Contact support if issue persists`
                },
                {
                    q: 'Invalid credentials error',
                    a: `1. Verify your Email/Voter ID is correct
2. Check password (minimum 6 characters)
3. Use "Aadhaar OTP" login as alternative
4. Register a new account if you haven't already`
                },
                {
                    q: 'Aadhaar not found',
                    a: `Your Aadhaar must be registered in the system:
1. Register first via the Signup page
2. Enter the same 12-digit Aadhaar number
3. Ensure Aadhaar is linked to your voter ID`
                }
            ]
        },
        {
            id: 'technical',
            title: 'Technical Issues',
            icon: 'fa-cog',
            content: [
                {
                    q: 'Page not loading or showing errors',
                    a: `1. Clear browser cache and cookies
2. Try a different browser (Chrome recommended)
3. Disable browser extensions temporarily
4. Check if backend server is running on port 5000`
                },
                {
                    q: 'Blockchain data decode error',
                    a: `This usually means the smart contract needs redeployment:
1. Ensure Hardhat node is running: npx hardhat node
2. Deploy contract: npx hardhat run scripts/deploy.js --network localhost
3. Refresh the frontend application`
                }
            ]
        }
    ];

    return (
        <div className="help-page">
            <nav className="govt-navbar">
                <div className="navbar-top">
                    <span>भारत निर्वाचन आयोग | Election Commission of India</span>
                </div>
                <div className="navbar-main">
                    <div className="navbar-brand" onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="National Emblem" />
                        <div className="brand-text">
                            <span className="title">Bharat E-Vote</span>
                            <span className="subtitle">Help & Support</span>
                        </div>
                    </div>
                    <button onClick={() => navigate(-1)} className="btn btn-secondary">
                        <i className="fa-solid fa-arrow-left"></i> Go Back
                    </button>
                </div>
            </nav>

            <div className="help-container" style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1rem' }}>
                <div className="auth-card">
                    <h1 style={{ color: '#000080', marginBottom: '0.5rem' }}>
                        <i className="fa-solid fa-circle-question"></i> Help & Troubleshooting
                    </h1>
                    <p style={{ color: '#555', marginBottom: '2rem' }}>
                        Find solutions to common problems and get support
                    </p>

                    {/* Quick Fix Banner */}
                    <div style={{ background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '8px', padding: '1rem', marginBottom: '2rem' }}>
                        <h3 style={{ color: '#2e7d32', margin: '0 0 0.5rem 0' }}>
                            <i className="fa-solid fa-lightbulb"></i> Quick Fix - Try These First!
                        </h3>
                        <ol style={{ margin: 0, paddingLeft: '1.5rem', color: '#333' }}>
                            <li><strong>Refresh the page</strong> (Ctrl+F5 for hard refresh)</li>
                            <li><strong>Check MetaMask</strong> is on Hardhat network (Chain ID: 31337)</li>
                            <li><strong>Reset MetaMask:</strong> Settings → Advanced → Reset Account</li>
                            <li><strong>Verify servers running:</strong> Backend (port 5000), Frontend (port 3000), Hardhat (port 8545)</li>
                        </ol>
                    </div>

                    {/* FAQ Sections */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                        {faqData.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`btn ${activeSection === section.id ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: '1 1 auto', minWidth: '150px' }}
                            >
                                <i className={`fa-solid ${section.icon}`}></i> {section.title}
                            </button>
                        ))}
                    </div>

                    {/* Active Section Content */}
                    {faqData.filter(s => s.id === activeSection).map(section => (
                        <div key={section.id}>
                            <h2 style={{ color: '#000080', marginBottom: '1rem', borderBottom: '2px solid #FF9933', paddingBottom: '0.5rem' }}>
                                <i className={`fa-solid ${section.icon}`}></i> {section.title}
                            </h2>
                            {section.content.map((item, idx) => (
                                <div key={idx} style={{ marginBottom: '1.5rem', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #000080' }}>
                                    <h4 style={{ color: '#000080', marginBottom: '0.5rem' }}>
                                        <i className="fa-solid fa-question-circle"></i> {item.q}
                                    </h4>
                                    <pre style={{
                                        whiteSpace: 'pre-wrap',
                                        fontFamily: 'inherit',
                                        margin: 0,
                                        color: '#333',
                                        lineHeight: '1.6'
                                    }}>
                                        {item.a}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    ))}

                    {/* Contact Support */}
                    <div style={{ marginTop: '2rem', background: '#f0f7ff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #000080' }}>
                        <h3 style={{ color: '#000080', marginBottom: '1rem' }}>
                            <i className="fa-solid fa-headset"></i> Still Need Help?
                        </h3>
                        <p style={{ color: '#555', marginBottom: '1rem' }}>If the problem continues after trying the above solutions:</p>
                        <ul style={{ color: '#333', lineHeight: '2' }}>
                            <li><strong>Helpline:</strong> 1950 (Toll Free)</li>
                            <li><strong>Email:</strong> support@bharatevote.gov.in (Demo)</li>
                            <li><strong>Local ERO:</strong> Contact your nearest Electoral Registration Officer</li>
                            <li><strong>Technical Support:</strong> Check browser console (F12) for error details</li>
                        </ul>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <Link to="/guidelines" className="btn btn-secondary">
                            <i className="fa-solid fa-book"></i> Voter Guidelines
                        </Link>
                        <Link to="/vote" className="btn btn-primary">
                            <i className="fa-solid fa-vote-yea"></i> Go to Voting
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HelpPage;
