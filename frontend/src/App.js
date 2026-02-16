import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Styles
import './styles/BharatStyles.css';

// Components
import Navbar from './components/Navbar';
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
            <Routes>
                {/* Landing Page */}
                <Route
                    path="/"
                    element={
                        <>
                            <Navbar user={user} onLogout={handleLogout} />
                            <LandingPage user={user} />
                        </>
                    }
                />

                {/* Login Page */}
                <Route
                    path="/login"
                    element={
                        user ? (
                            <Navigate to="/" replace />
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
                            <Navigate to="/" replace />
                        ) : (
                            <SignupPage />
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

                {/* Admin Dashboard */}
                <Route
                    path="/admin"
                    element={
                        isAdmin ? (
                            <>
                                <Navbar user={user} onLogout={handleLogout} />
                                <div style={{ padding: '2rem 5%', background: '#F5F7FA', minHeight: '100vh' }}>
                                    <AdminDashboard
                                        account={user?.walletAddress}
                                        onError={(err) => console.error(err)}
                                    />
                                </div>
                            </>
                        ) : (
                            <Navigate to="/" replace />
                        )
                    }
                />

                {/* Admin Login Page */}
                <Route path="/admin-login" element={<AdminLoginPage />} />

                {/* Admin Data Panel */}
                <Route path="/admin-panel" element={<AdminPanel />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
