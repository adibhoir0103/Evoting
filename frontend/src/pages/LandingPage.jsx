import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';

function LandingPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="flex flex-col min-h-screen bg-transparent font-sans">
            <Helmet>
                <title>Home | Bharat E-Vote Portal</title>
                <meta name="description" content="Official National Portal for the Secure Digital Electoral Process. Cast your vote securely using Blockchain technology." />
                <link rel="canonical" href="https://evote.gov.in/" />
            </Helmet>
            <main id="main-content" className="flex-grow">
                {/* 1. Hero Section */}
                <section className="relative overflow-hidden border-b border-gray-200 bg-white/80 dark:bg-[#070e20]/80 backdrop-blur-md">
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary-50 to-transparent opacity-50 z-0 pointer-events-none"></div>
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-accent-saffron via-white to-accent-green z-10"></div>
                    
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 relative z-10 flex flex-col lg:flex-row items-center gap-12">
                        <div className="w-full lg:w-3/5 space-y-8">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-sm font-semibold">
                                <i className="fa-solid fa-shield-halved text-primary"></i>
                                Blockchain-Secured E-Voting Platform
                            </div>
                            
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight drop-shadow-md">
                                {t('hero.title')}
                            </h2>
                            
                            <p className="text-lg text-gray-800 font-medium max-w-2xl leading-relaxed drop-shadow-sm">
                                {t('hero.subtitle')}
                            </p>
                            
                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <button 
                                    onClick={() => navigate('/login')} 
                                    className="btn-primary text-lg px-8 py-4 shadow-lg shadow-primary/20 flex items-center justify-center gap-3"
                                    aria-label="Login to Cast Your Vote"
                                >
                                    <i className="fa-solid fa-right-to-bracket text-xl"></i>
                                    Login to Vote
                                </button>
                                <button 
                                    onClick={() => navigate('/signup')} 
                                    className="btn-secondary text-lg px-8 py-4 flex items-center justify-center gap-3 bg-white/90 dark:bg-[#0f1a36]/90 shadow-lg backdrop-blur-lg border border-gray-200 dark:border-transparent dark:text-gray-100"
                                    aria-label="Register as a Voter"
                                >
                                    <i className="fa-solid fa-user-plus text-primary text-xl"></i>
                                    New Voter? Register
                                </button>
                            </div>
                        </div>
                        
                        <div className="w-full lg:w-2/5 flex justify-center lg:justify-end">
                            <div className="bg-white/90 dark:bg-[#0f1a36]/85 backdrop-blur-xl border border-white/50 dark:border-white/10 p-6 rounded-2xl shadow-xl w-full max-w-md">
                                <h3 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-100 pb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-lock text-accent-green text-base"></i>
                                    How Voting Works
                                </h3>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-saffron/10 text-accent-saffron flex items-center justify-center font-bold">1</div>
                                        <div>
                                            <p className="font-semibold text-gray-900">Connect Wallet</p>
                                            <p className="text-sm text-gray-500">Link your MetaMask or Web3 wallet</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary flex items-center justify-center font-bold">2</div>
                                        <div>
                                            <p className="font-semibold text-gray-900">Select Candidate</p>
                                            <p className="text-sm text-gray-500">Choose in a secure proctored window</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-green/10 text-accent-green flex items-center justify-center font-bold">3</div>
                                        <div>
                                            <p className="font-semibold text-gray-900">Vote on Blockchain</p>
                                            <p className="text-sm text-gray-500">Immutable, transparent, tamper-proof</p>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. What's New */}
                <div className="bg-primary text-white py-3 border-b border-gray-700 shadow-xl relative z-10" role="region" aria-label="Latest Announcements">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="bg-accent-saffron text-white font-bold px-3 py-1 rounded text-xs tracking-wider flex items-center gap-2 shrink-0">
                            <i className="fa-solid fa-bullhorn" aria-hidden="true"></i> WHAT'S NEW
                        </div>
                        <ul className="flex flex-col sm:flex-row gap-x-6 gap-y-2 text-sm font-medium list-none">
                            <li className="flex items-center gap-2">
                                <span className="bg-accent-saffron/20 text-accent-saffron px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0">New</span>
                                <span>Election Commission announces schedule for Phase 4 Digital Voting.</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="bg-white/10 text-gray-300 border border-gray-500 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0">Update</span>
                                <span>Final Electoral Roll 2026 published. Check your name using the EPIC number.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* 3. Citizen Services Grid */}
                <section className="py-16 bg-transparent">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-primary drop-shadow-sm">Citizen Services</h2>
                            <div className="w-16 h-1 bg-accent-saffron mx-auto mt-4 mb-4 shadow"></div>
                            <p className="text-lg text-gray-800 font-medium">Access essential election services rapidly through the National Portal.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Link to="/vote" aria-label="Cast Your Vote" className="bg-white/85 dark:bg-[#0f1a36]/80 backdrop-blur-lg border border-white/40 dark:border-white/10 p-6 border-t-4 border-accent-green rounded shadow-xl hover:-translate-y-1 block focus:outline-none focus:ring-2 focus:ring-accent-saffron transition-all duration-300">
                                <i className="fa-solid fa-vote-yea text-3xl text-accent-green mb-4"></i>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Cast Your Vote</h3>
                                <p className="text-sm text-gray-600">Enter the secure voting booth and cast your ballot on the blockchain.</p>
                            </Link>

                            <Link to="/search-roll" aria-label="Search Name in Electoral Roll" className="bg-white/85 dark:bg-[#0f1a36]/80 backdrop-blur-lg border border-white/40 dark:border-white/10 p-6 border-t-4 border-primary rounded shadow-xl hover:-translate-y-1 block focus:outline-none focus:ring-2 focus:ring-accent-saffron transition-all duration-300">
                                <i className="fa-solid fa-magnifying-glass-chart text-3xl text-primary mb-4"></i>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Search in Electoral Roll</h3>
                                <p className="text-sm text-gray-600">Verify your name and polling station details in the current digital registry.</p>
                            </Link>

                            <Link to="/candidates" aria-label="Know Your Candidates" className="bg-white/85 dark:bg-[#0f1a36]/80 backdrop-blur-lg border border-white/40 dark:border-white/10 p-6 border-t-4 border-primary rounded shadow-xl hover:-translate-y-1 block focus:outline-none focus:ring-2 focus:ring-accent-saffron transition-all duration-300">
                                <i className="fa-solid fa-address-card text-3xl text-primary mb-4"></i>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Know Your Candidates</h3>
                                <p className="text-sm text-gray-600">Review affidavits, criminal records, and asset declarations of contesting candidates.</p>
                            </Link>

                            <Link to="/results" aria-label="Live Election Results" className="bg-white/85 dark:bg-[#0f1a36]/80 backdrop-blur-lg border border-white/40 dark:border-white/10 p-6 border-t-4 border-primary rounded shadow-xl hover:-translate-y-1 block focus:outline-none focus:ring-2 focus:ring-accent-saffron transition-all duration-300">
                                <i className="fa-solid fa-chart-pie text-3xl text-primary mb-4"></i>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Live Election Results</h3>
                                <p className="text-sm text-gray-600">Track real-time digital ballot counting across all national and state constituencies.</p>
                            </Link>

                            <Link to="/guidelines" aria-label="Download Voter Guidelines" className="bg-white/85 dark:bg-[#0f1a36]/80 backdrop-blur-lg border border-white/40 dark:border-white/10 p-6 border-t-4 border-primary rounded shadow-xl hover:-translate-y-1 block focus:outline-none focus:ring-2 focus:ring-accent-saffron transition-all duration-300">
                                <i className="fa-solid fa-book-open text-3xl text-primary mb-4"></i>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Voter Guidelines</h3>
                                <p className="text-sm text-gray-600">Read the official manual on how to securely cast your vote via the E-Voting system.</p>
                            </Link>

                            <div className="bg-blue-50/90 dark:bg-[#1a2c5b]/70 backdrop-blur-lg border border-white/40 dark:border-white/10 p-6 border-t-4 border-primary rounded shadow-inner flex flex-col justify-center items-center text-center">
                                <i className="fa-solid fa-mobile-screen-button text-3xl text-primary mb-2"></i>
                                <h3 className="text-xl font-bold text-primary">Voter Helpline App</h3>
                                <p className="text-xs text-blue-800 mt-2 mb-4 font-semibold">Download the official app for immediate mobile assistance.</p>
                                <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full justify-center">
                                    <button className="bg-gray-900 border border-gray-700 text-white px-3 py-1.5 rounded-md flex items-center gap-2 text-xs hover:bg-black transition-colors shadow w-full sm:w-auto overflow-hidden">
                                        <i className="fa-brands fa-google-play text-lg text-white"></i>
                                        <div className="text-left leading-none">
                                            <span className="text-[8px] uppercase tracking-wider block text-gray-300">Get it on</span>
                                            <span className="font-bold">Google Play</span>
                                        </div>
                                    </button>
                                    <button className="bg-gray-900 border border-gray-700 text-white px-3 py-1.5 rounded-md flex items-center gap-2 text-xs hover:bg-black transition-colors shadow w-full sm:w-auto overflow-hidden">
                                        <i className="fa-brands fa-apple text-xl text-white"></i>
                                        <div className="text-left leading-none">
                                            <span className="text-[8px] uppercase tracking-wider block text-gray-300">Download on the</span>
                                            <span className="font-bold">App Store</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. National Statistics */}
                <section className="bg-white py-12 border-y border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-gray-200">
                            <div className="px-4">
                                <p className="text-4xl font-black text-primary mb-2">96.8</p>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Crore Voters</p>
                            </div>
                            <div className="px-4">
                                <p className="text-4xl font-black text-primary mb-2">10.5</p>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Lakh Polling Stations</p>
                            </div>
                            <div className="px-4">
                                <p className="text-4xl font-black text-primary mb-2">2.4</p>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Lakh Nodes Active</p>
                            </div>
                            <div className="px-4">
                                <p className="text-4xl font-black text-accent-saffron mb-2">100%</p>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Cryptographically Auditable</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. Info Bar */}
                <section className="bg-primary text-white py-12 border-t-4 border-accent-saffron">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/20">
                            <div className="px-4 py-2">
                                <i className="fa-solid fa-headset text-3xl mb-4 text-gray-300"></i>
                                <h4 className="text-lg font-bold mb-2 text-white">Voter Helpline</h4>
                                <p className="text-3xl font-black text-white tracking-wider">1950</p>
                                <p className="text-sm text-gray-300 mt-2">Toll-Free, 22 Languages</p>
                            </div>
                            <div className="px-4 pt-8 md:pt-2 pb-2">
                                <i className="fa-solid fa-envelope-open-text text-3xl mb-4 text-gray-300"></i>
                                <h4 className="text-lg font-bold mb-2 text-white">Email Support</h4>
                                <a href="mailto:complaints@eci.gov.in" className="text-xl font-bold text-white hover:text-accent-saffron transition-colors">complaints@eci.gov.in</a>
                                <p className="text-sm text-gray-300 mt-2">24/7 Response Time</p>
                            </div>
                            <div className="px-4 pt-8 md:pt-2 pb-2">
                                <i className="fa-solid fa-building-flag text-3xl mb-4 text-gray-300"></i>
                                <h4 className="text-lg font-bold mb-2 text-white">Registered Office</h4>
                                <p className="text-sm text-white font-medium">Nirvachan Sadan</p>
                                <p className="text-sm text-gray-300 mt-1">Ashoka Road, New Delhi 110001</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default LandingPage;
