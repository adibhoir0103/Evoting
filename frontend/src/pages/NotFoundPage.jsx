import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

function NotFoundPage() {
    return (
        <div className="min-h-screen bg-[#f3f4f6] flex flex-col">
            <Helmet>
                <title>Page Not Found | Bharat E-Vote Portal</title>
                <meta name="description" content="The requested page could not be found on the Bharat E-Vote Portal." />
            </Helmet>

            <main id="main-content" className="flex-grow flex items-center justify-center px-4 py-16">
                <div className="max-w-lg w-full text-center">
                    {/* Ashoka Chakra inspired design */}
                    <div className="relative mx-auto w-40 h-40 mb-8">
                        <div className="absolute inset-0 rounded-full border-4 border-dashed border-primary/20 animate-[spin_20s_linear_infinite]"></div>
                        <div className="absolute inset-3 rounded-full border-2 border-primary/10"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-7xl font-black bg-gradient-to-b from-primary to-blue-900 bg-clip-text text-transparent select-none">
                                404
                            </span>
                        </div>
                    </div>

                    {/* Content */}
                    <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
                        Page Not Found
                    </h1>
                    <p className="text-gray-600 text-base mb-2 max-w-md mx-auto leading-relaxed">
                        The page you are looking for does not exist or has been moved. 
                        This may happen if the URL was mistyped or the resource was archived.
                    </p>
                    <p className="text-xs text-gray-400 mb-8 font-mono">
                        Error Code: HTTP 404 — Resource Not Located
                    </p>

                    {/* Navigation options */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
                        <Link 
                            to="/" 
                            className="btn-primary px-6 py-3 text-sm shadow-md"
                            aria-label="Return to home page"
                        >
                            <i className="fa-solid fa-house mr-2"></i>
                            Return to Home
                        </Link>
                        <Link 
                            to="/dashboard" 
                            className="btn-secondary px-6 py-3 text-sm"
                            aria-label="Go to voter dashboard"
                        >
                            <i className="fa-solid fa-gauge-high mr-2"></i>
                            Voter Dashboard
                        </Link>
                    </div>

                    {/* Helpful links */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-left">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                            <i className="fa-solid fa-compass mr-2 text-primary"></i>Quick Navigation
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            <Link to="/vote" className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors font-medium p-2 rounded-lg hover:bg-blue-50">
                                <i className="fa-solid fa-vote-yea text-accent-green w-5 text-center"></i>
                                Cast Your Vote
                            </Link>
                            <Link to="/results" className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors font-medium p-2 rounded-lg hover:bg-blue-50">
                                <i className="fa-solid fa-chart-column text-primary w-5 text-center"></i>
                                Election Results
                            </Link>
                            <Link to="/candidates" className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors font-medium p-2 rounded-lg hover:bg-blue-50">
                                <i className="fa-solid fa-address-card text-primary w-5 text-center"></i>
                                Know Candidates
                            </Link>
                            <Link to="/admin-login" className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors font-medium p-2 rounded-lg hover:bg-blue-50">
                                <i className="fa-solid fa-user-shield text-red-500 w-5 text-center"></i>
                                Admin Login
                            </Link>
                        </div>
                    </div>

                    {/* Helpdesk */}
                    <p className="text-xs text-gray-400 mt-8">
                        Need help? Call Voter Helpline <span className="font-bold text-gray-600">1950</span> or email <a href="mailto:complaints@eci.gov.in" className="text-primary hover:underline">complaints@eci.gov.in</a>
                    </p>
                </div>
            </main>
        </div>
    );
}

export default NotFoundPage;
