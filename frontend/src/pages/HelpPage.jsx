import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function HelpPage() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('vault');

    const faqData = [
        {
            id: 'vault',
            title: 'Secure Vault Connection Issues',
            icon: 'fa-shield-halved',
            content: [
                {
                    q: 'Secure Vault is not connecting',
                    a: `1. Ensure your vault browser extension is installed and updated
2. Open the vault UI and unlock it
3. Ensure it is connected to the authorized National Voting Network
4. Refresh the page and click "Verify Secure Identity" again`
                },
                {
                    q: 'Transaction failed or pending',
                    a: `1. Ensure your vault has successfully linked with the session
2. Reset your vault connection from the extension settings
3. Ensure the network can cover the automated verification cost
4. Try disconnecting and reconnecting your identity`
                },
                {
                    q: 'Wrong access network error',
                    a: `Switch to the official voting network within your vault:
1. Click the network dropdown in your external vault
2. Select the designated "National Voting Ledger"
3. If not listed, contact the Helpdesk for manual network entry details`
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
3. If issue persists, check if the cryptographic contract is deployed`
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
2. Check password (minimum 8 characters)
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
            id: 'guidelines',
            title: 'Voter Guidelines',
            icon: 'fa-book',
            content: [
                {
                    q: 'Before Voting',
                    a: `• Verify your name appears in the electoral roll
• Carry your EPIC (Voter ID Card) or any of the 12 alternative photo IDs approved by ECI
• For e-voting, your Aadhaar must be linked to your voter registration
• Ensure your Secure Vault extension is active and connected to the National Voting Network`
                },
                {
                    q: 'During Voting',
                    a: `• Each voter can cast only ONE vote — multiple voting is a punishable offense under IPC Section 171
• Your vote is encrypted on the secure cryptographic ledger — no one can see whom you voted for
• Review your choice carefully before confirming — once submitted, votes CANNOT be changed
• Wait for the Secure Vault to confirm the transaction — do not close the browser until success`
                },
                {
                    q: 'After Voting',
                    a: `• Your vote is recorded securely with a unique cryptographic transaction hash
• Results will be announced after polls close, as per ECI schedule
• You can verify your vote was recorded on the public cryptographic ledger explorer`
                },
                {
                    q: 'Model Code of Conduct',
                    a: `• Do not attempt to influence other voters
• Maintain decorum and silence in the voting area
• Report any irregularities to the Election Officer
• Respect the democratic process and accept results
• Any attempt to tamper with the voting process is a criminal offense under the Indian Penal Code`
                }
            ]
        }
    ];

    return (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="gov-card p-6 md:p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    <i className="fa-solid fa-circle-question text-primary mr-2"></i> Help, Guidelines & Troubleshooting
                </h1>
                <p className="text-gray-500 mb-6">
                    Find solutions to common problems, voter guidelines, and support
                </p>

                {/* Quick Fix Banner */}
                <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-8">
                    <h3 className="text-green-800 font-bold mb-2">
                        <i className="fa-solid fa-lightbulb mr-1"></i> Quick Fix — Try These First!
                    </h3>
                    <ol className="text-gray-700 pl-5 space-y-1 list-decimal text-sm">
                        <li><strong>Refresh the page</strong> (Ctrl+F5 for hard refresh)</li>
                        <li><strong>Check your Secure Vault</strong> to ensure it points to the correct network</li>
                        <li><strong>Restart your browser session</strong> to clear cache</li>
                        <li><strong>Verify administrative connectivity</strong> with the backend system</li>
                    </ol>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Sidebar */}
                    <div className="md:w-64 shrink-0 flex flex-col gap-2">
                        {faqData.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`text-left px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors ${activeSection === section.id ? 'bg-primary text-white shadow' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                            >
                                <i className={`fa-solid ${section.icon} w-6 inline-block`}></i> {section.title}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {faqData.filter(s => s.id === activeSection).map(section => (
                            <div key={section.id}>
                                <h2 className="text-xl font-bold text-primary mb-4 border-b-2 border-accent-saffron pb-2">
                                    <i className={`fa-solid ${section.icon} mr-2`}></i> {section.title}
                                </h2>
                                {section.content.map((item, idx) => (
                                    <div key={idx} className="mb-4 bg-gray-50 p-4 rounded-lg border-l-4 border-primary">
                                        <h4 className="text-primary font-bold text-sm mb-2">
                                            <i className="fa-solid fa-question-circle mr-1"></i> {item.q}
                                        </h4>
                                        <pre className="whitespace-pre-wrap font-sans m-0 text-gray-700 text-sm leading-relaxed">
                                            {item.a}
                                        </pre>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contact Support */}
                <div className="mt-8 bg-blue-50 p-5 rounded-lg border border-primary">
                    <h3 className="text-primary font-bold mb-3">
                        <i className="fa-solid fa-headset mr-2"></i> Still Need Help?
                    </h3>
                    <p className="text-gray-500 text-sm mb-3">If the problem continues after trying the above solutions:</p>
                    <ul className="text-gray-700 text-sm space-y-2">
                        <li><strong>Helpline:</strong> 1950 (Toll Free)</li>
                        <li><strong>Email:</strong> support@bharat-evote.me</li>
                        <li><strong>Local ERO:</strong> Contact your nearest Electoral Registration Officer</li>
                        <li><strong>Technical Support:</strong> Check browser console (F12) for error details</li>
                    </ul>
                </div>

                <div className="mt-6 flex gap-3 justify-center flex-wrap">
                    <Link to="/vote" className="btn-primary px-6 py-2.5">
                        <i className="fa-solid fa-vote-yea mr-2"></i> Go to Voting
                    </Link>
                    <Link to="/results" className="btn-secondary px-6 py-2.5">
                        <i className="fa-solid fa-chart-column mr-2"></i> View Results
                    </Link>
                </div>
            </div>
        </section>
    );
}

export default HelpPage;
