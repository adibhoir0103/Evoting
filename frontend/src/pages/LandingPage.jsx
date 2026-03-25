import React from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';

function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col min-h-screen bg-gov-bg font-sans">
            <main id="main-content" className="flex-grow">
                {/* Hero Section */}
                <section className="bg-white relative overflow-hidden border-b border-gray-200">
                    {/* Background accents */}
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary-50 to-transparent opacity-50 z-0 pointer-events-none"></div>
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-accent-saffron via-white to-accent-green z-10"></div>
                    
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 relative z-10 flex flex-col lg:flex-row items-center gap-12">
                        <div className="w-full lg:w-3/5 space-y-8">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-800 text-sm font-semibold">
                                <i className="fa-solid fa-shield-halved text-primary"></i>
                                GIGW 3.0 & WCAG 2.1 AA Compliant
                            </div>
                            
                            <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
                                Secure, Transparent, and <br/>
                                <span className="text-primary block mt-2">Verifiable E-Voting</span>
                            </h2>
                            
                            <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
                                Empowering every Indian citizen with blockchain-backed digital voting. 
                                Exercise your democratic right securely from anywhere using Aadhaar biometric authentication.
                            </p>
                            
                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <button 
                                    onClick={() => navigate('/login')} 
                                    className="btn-primary text-lg px-8 py-4 shadow-lg shadow-primary/20 flex items-center justify-center gap-3"
                                    aria-label="Login as Voter"
                                >
                                    <i className="fa-solid fa-right-to-bracket text-xl"></i>
                                    Login to Vote
                                </button>
                                <button 
                                    onClick={() => navigate('/signup')} 
                                    className="btn-secondary text-lg px-8 py-4 flex items-center justify-center gap-3"
                                    aria-label="Register New Voter"
                                >
                                    <i className="fa-solid fa-user-plus text-primary text-xl"></i>
                                    New Voter Registration
                                </button>
                            </div>
                        </div>
                        
                        <div className="w-full lg:w-2/5 flex justify-center lg:justify-end">
                            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full relative">
                                <div className="absolute -top-4 -right-4 bg-accent-green text-white p-3 rounded-full shadow-lg">
                                    <i className="fa-solid fa-lock text-xl"></i>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-100 pb-4">Digital Electoral Process</h3>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-saffron/10 text-accent-saffron flex items-center justify-center font-bold">1</div>
                                        <div>
                                            <p className="font-semibold text-gray-900">Aadhaar Verification</p>
                                            <p className="text-sm text-gray-500">Identity verification via UIDAI</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary flex items-center justify-center font-bold">2</div>
                                        <div>
                                            <p className="font-semibold text-gray-900">Wallet Authorization</p>
                                            <p className="text-sm text-gray-500">Secure blockchain session creation</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-green/10 text-accent-green flex items-center justify-center font-bold">3</div>
                                        <div>
                                            <p className="font-semibold text-gray-900">Cast Ballot</p>
                                            <p className="text-sm text-gray-500">Immutable vote recording</p>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-16 bg-gov-bg">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-gray-900">Why Bharat E-Vote?</h2>
                            <p className="mt-4 text-lg text-gray-600">Built on advanced blockchain technology for absolute integrity.</p>
                        </div>
                        
                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="gov-card flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-primary flex items-center justify-center mb-6 shadow-sm border border-blue-100">
                                    <i className="fa-solid fa-link text-2xl"></i>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Immutable Ledger</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    Every vote is permanently recorded on a decentralized blockchain. It cannot be altered, deleted, or tampered with by anyone.
                                </p>
                            </div>
                            
                            <div className="gov-card flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-orange-50 text-accent-saffron flex items-center justify-center mb-6 shadow-sm border border-orange-100">
                                    <i className="fa-solid fa-user-shield text-2xl"></i>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Voter Privacy</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    Advanced cryptography ensures your identity is securely detached from your vote, maintaining absolute ballot secrecy.
                                </p>
                            </div>
                            
                            <div className="gov-card flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-2xl bg-green-50 text-accent-green flex items-center justify-center mb-6 shadow-sm border border-green-100">
                                    <i className="fa-solid fa-file-contract text-2xl"></i>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Mathematical Proof</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    Receive a unique cryptographic hash receipt to independently verify that your vote was included in the final tally.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
                
                {/* Info Bar */}
                <section className="bg-primary text-white py-12 border-t-4 border-accent-saffron">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-primary-800">
                            <div className="px-4 py-2">
                                <i className="fa-solid fa-headset text-3xl mb-4 text-primary-300"></i>
                                <h4 className="text-lg font-bold mb-2">Voter Helpline</h4>
                                <p className="text-2xl font-black text-white">1950</p>
                                <p className="text-sm text-primary-200 mt-2">Toll-Free, 22 Languages</p>
                            </div>
                            <div className="px-4 pt-8 md:pt-2 pb-2">
                                <i className="fa-solid fa-envelope-open-text text-3xl mb-4 text-primary-300"></i>
                                <h4 className="text-lg font-bold mb-2">Email Support</h4>
                                <p className="text-lg font-bold text-white">complaints@eci.gov.in</p>
                                <p className="text-sm text-primary-200 mt-2">24/7 Response Time</p>
                            </div>
                            <div className="px-4 pt-8 md:pt-2 pb-2">
                                <i className="fa-solid fa-building-flag text-3xl mb-4 text-primary-300"></i>
                                <h4 className="text-lg font-bold mb-2">Registered Office</h4>
                                <p className="text-sm text-white font-medium">Nirvachan Sadan</p>
                                <p className="text-sm text-primary-200 mt-1">Ashoka Road, New Delhi 110001</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}

export default LandingPage;
