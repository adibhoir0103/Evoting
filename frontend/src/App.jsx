import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Styles
// Using global Tailwind CSS in index.css

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AdminDashboard from './components/AdminDashboard';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import VotingPage from './pages/VotingPage';
import VoterGuidelines from './pages/VoterGuidelines';
import HelpPage from './pages/HelpPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminPanel from './pages/AdminPanel';
import DashboardPage from './pages/DashboardPage';
import CandidatesPage from './pages/CandidatesPage';
import SearchRollPage from './pages/SearchRollPage';
import ResultsPage from './pages/ResultsPage';

// Services
import { authService } from './services/authService';
import { BlockchainService } from './services/blockchainService';

function App() {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            if (authService.isLoggedIn()) {
                const storedUser = authService.getStoredUser();
                if (storedUser) {
                    setUser(storedUser);

                    if (storedUser.walletAddress) {
                        await checkAdminStatus(storedUser.walletAddress);
                    }
                }
            }
            setLoading(false);
        };

        checkAuth();

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', () => window.location.reload());
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, []);

    const handleAccountsChanged = async (accounts) => {
        if (accounts.length === 0) {
            if (user) {
                setUser({ ...user, walletAddress: null });
            }
            setIsAdmin(false);
        } else {
            const newAddress = accounts[0];
            if (user) {
                await authService.linkWallet(newAddress);
                setUser({ ...user, walletAddress: newAddress });
            }
            await checkAdminStatus(newAddress);
        }
    };

    const checkAdminStatus = async (address) => {
        try {
            const service = BlockchainService.getInstance();
            if (service.contract) {
                const admin = await service.contract.admin();
                setIsAdmin(admin.toLowerCase() === address.toLowerCase());
            }
        } catch (err) {
            console.error('Error checking admin status:', err);
        }
    };

    const handleLogin = (userData) => {
        setUser(userData);
    };

    const handleLogout = () => {
        authService.logout();
        setUser(null);
        setIsAdmin(false);
    };

    // Session timeout: auto-logout after 30 minutes of inactivity
    useEffect(() => {
        if (!user) return;
        let idleTimer;
        const IDLE_LIMIT = 30 * 60 * 1000; // 30 minutes
        const resetTimer = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                alert('Session expired due to inactivity. Please log in again.');
                handleLogout();
                window.location.href = '/login';
            }, IDLE_LIMIT);
        };
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        events.forEach(e => window.addEventListener(e, resetTimer));
        resetTimer();
        return () => {
            clearTimeout(idleTimer);
            events.forEach(e => window.removeEventListener(e, resetTimer));
        };
        // eslint-disable-next-line
    }, [user]);

    const handleUserUpdate = (updatedUser) => {
        setUser(updatedUser);
        if (updatedUser?.walletAddress) {
            checkAdminStatus(updatedUser.walletAddress);
        }
    };

    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
                <p style={{ color: '#555', marginTop: '1rem' }}>Loading Bharat E-Vote Portal...</p>
            </div>
        );
    }

    return (
        <Router>
            <div className="flex flex-col min-h-screen">
                <Navbar user={user} onLogout={handleLogout} isAdmin={isAdmin} />
                <main id="main-content" className="flex-grow focus:outline-none" tabIndex="-1">
                    <Routes>
                        {/* Landing Page - Redirect if logged in */}
                        <Route
                            path="/"
                            element={
                                isAdmin ? (
                                    <Navigate to="/admin" replace />
                                ) : user ? (
                                    <Navigate to="/dashboard" replace />
                                ) : (
                                    <LandingPage user={user} />
                                )
                            }
                        />

                        {/* Login Page */}
                        <Route
                            path="/login"
                            element={
                                user ? (
                                    <Navigate to="/dashboard" replace />
                                ) : (
                                    <LoginPage onLogin={handleLogin} />
                                )
                            }
                        />

                        {/* Signup Page */}
                        <Route
                            path="/signup"
                            element={
                                user ? (
                                    <Navigate to="/dashboard" replace />
                                ) : (
                                    <SignupPage />
                                )
                            }
                        />

                        {/* Voter Dashboard */}
                        <Route
                            path="/dashboard"
                            element={
                                user ? (
                                    <DashboardPage user={user} onUserUpdate={handleUserUpdate} />
                                ) : (
                                    <Navigate to="/login" replace />
                                )
                            }
                        />

                        {/* Voting Page */}
                        <Route
                            path="/vote"
                            element={
                                <VotingPage
                                    user={user}
                                    onUserUpdate={handleUserUpdate}
                                />
                            }
                        />

                        {/* Voter Guidelines */}
                        <Route path="/guidelines" element={<VoterGuidelines />} />

                        {/* Help Page */}
                        <Route path="/help" element={<HelpPage />} />
                        <Route path="/candidates" element={<CandidatesPage />} />
                        <Route path="/search-roll" element={<SearchRollPage />} />

                        {/* Election Results — Public */}
                        <Route path="/results" element={<ResultsPage />} />

                        {/* Admin Dashboard */}
                        <Route
                            path="/admin"
                            element={
                                isAdmin ? (
                                    <div style={{ padding: '2rem 5%', background: '#F5F7FA', minHeight: '100vh' }}>
                                        <AdminDashboard
                                            account={user?.walletAddress}
                                            onError={(err) => console.error(err)}
                                        />
                                    </div>
                                ) : (
                                    <Navigate to="/" replace />
                                )
                            }
                        />

                        {/* Admin Login Page */}
                        <Route path="/admin-login" element={<AdminLoginPage />} />

                        {/* Admin Data Panel — Protected */}
                        <Route path="/admin-panel" element={
                            localStorage.getItem('adminToken') ? <AdminPanel /> : <Navigate to="/admin-login" replace />
                        } />

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </Router>
    );
}

export default App;
