import React from 'react';
import { Link } from 'react-router-dom';

function VoterGuidelines() {
    const sections = [
        {
            icon: 'fa-clipboard-check',
            title: 'Before Voting',
            items: [
                { label: 'Verify Your Registration', text: 'Ensure your name appears in the electoral roll. Check at nvsp.in or your local Electoral Registration Officer.' },
                { label: 'Valid ID Required', text: 'Carry your EPIC (Voter ID Card) or any of the 12 alternative photo IDs approved by ECI.' },
                { label: 'Aadhaar Linking', text: 'For e-voting, your Aadhaar must be linked to your voter registration.' },
                { label: 'Polling Hours', text: 'Voting is open from 7:00 AM to 6:00 PM on the designated polling day.' },
                { label: 'Wallet Setup', text: 'Install MetaMask browser extension and connect to the Hardhat Local network.' }
            ]
        },
        {
            icon: 'fa-vote-yea',
            title: 'During Voting',
            items: [
                { label: 'One Person, One Vote', text: 'Each voter can cast only ONE vote. Multiple voting is a punishable offense under IPC Section 171.' },
                { label: 'Secret Ballot', text: 'Your vote is encrypted on the blockchain. No one can see whom you voted for.' },
                { label: 'Confirm Before Submit', text: 'Review your choice carefully before confirming. Once submitted, votes CANNOT be changed.' },
                { label: 'Transaction Confirmation', text: 'Wait for MetaMask to confirm the transaction. Do not close the browser until you see the success message.' },
                { label: 'No Photography', text: 'Taking photos or videos inside the voting area is prohibited.' }
            ]
        },
        {
            icon: 'fa-flag-checkered',
            title: 'After Voting',
            items: [
                { label: 'Vote Receipt', text: 'Your vote is recorded on the blockchain with a unique transaction hash.' },
                { label: 'Results Declaration', text: 'Results will be announced after polls close, as per ECI schedule.' },
                { label: 'Verification', text: 'You can verify your vote was recorded on the blockchain explorer.' }
            ]
        }
    ];

    return (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="gov-card p-6 md:p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-1 border-b-[3px] border-accent-saffron pb-3">
                    <i className="fa-solid fa-book text-primary mr-2"></i> Voter Guidelines
                </h1>
                <p className="text-gray-500 mb-8 mt-3">
                    As per Election Commission of India norms for secure and transparent voting
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {sections.map((section, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 p-5">
                            <h2 className="text-lg font-bold text-primary mb-4">
                                <i className={`fa-solid ${section.icon} mr-2`}></i> {section.title}
                            </h2>
                            <ul className="space-y-3 text-sm text-gray-700 leading-relaxed">
                                {section.items.map((item, i) => (
                                    <li key={i}>
                                        <strong className="text-gray-900">{item.label}:</strong> {item.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Model Code of Conduct */}
                <div className="mt-8 bg-blue-50 p-5 rounded-lg border border-primary">
                    <h2 className="text-lg font-bold text-primary mb-3">
                        <i className="fa-solid fa-scale-balanced mr-2"></i> Model Code of Conduct
                    </h2>
                    <ul className="text-gray-700 text-sm space-y-2 leading-relaxed">
                        <li>• Do not attempt to influence other voters</li>
                        <li>• Maintain decorum and silence in the voting area</li>
                        <li>• Report any irregularities to the Election Officer</li>
                        <li>• Respect the democratic process and accept results</li>
                    </ul>
                </div>

                {/* Important Notice */}
                <div className="mt-6 bg-yellow-50 border border-yellow-300 p-4 rounded-lg text-sm text-yellow-800">
                    <strong><i className="fa-solid fa-triangle-exclamation mr-1"></i> Important:</strong> Any attempt to tamper with the voting process, cast multiple votes, or impersonate another voter is a criminal offense punishable under the Indian Penal Code.
                </div>

                <div className="mt-6 text-center">
                    <Link to="/vote" className="btn-primary px-8 py-3 text-lg">
                        <i className="fa-solid fa-arrow-right mr-2"></i> Proceed to Vote
                    </Link>
                </div>
            </div>
        </section>
    );
}

export default VoterGuidelines;
