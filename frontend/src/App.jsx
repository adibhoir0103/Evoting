import React, { useState, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

// Styles
// Using global Tailwind CSS in index.css

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AdminDashboard from './components/AdminDashboard';
import ActivityMonitor from './components/ActivityMonitor';

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
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import OnboardingPage from './pages/OnboardingPage';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';

// Services
import { authService } from './services/authService';
import { BlockchainService } from './services/blockchainService';

import { useUser, useAuth } from '@clerk/clerk-react';

function App() {
    const { isLoaded, isSignedIn, user: clerkUser } = useUser();
    const { getToken } = useAuth();

    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [fetchFailed, setFetchFailed] = useState(false);

    useEffect(() => {
        const syncUserWithDB = async () => {
            if (!isLoaded) return;

            if (isSignedIn) {
                try {
                    setFetchFailed(false);
                    // Pull the active high-security Clerk Session JWT
                    const sessionToken = await getToken();
                    // Inject into local storage for the legacy authService headers to use safely
                    localStorage.setItem('token', sessionToken);
                    
                    const dbUser = await authService.getCurrentUser();
                    if (dbUser) {
                        setUser(dbUser);
                        if (dbUser.walletAddress) {
                            await checkAdminStatus(dbUser.walletAddress);
                        }
                    }
                } catch (err) {
                    console.error('Failed to sync DB user with Clerk Session:', err);
                    setFetchFailed(true);
                }
            } else {
                // If Clerk signs out, purge the local state immediately
                setUser(null);
                setIsAdmin(false);
                authService.logout();
            }
            setLoading(false);
        };

        syncUserWithDB();
        // eslint-disable-next-line
    }, [isLoaded, isSignedIn]);

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', (chainId) => {
                const expectedChainId = '0x539'; // Hardhat = 1337
                if (chainId !== expectedChainId) {
                    toast.error('Wrong network! Please switch to Hardhat Localhost (Chain ID: 1337)');
                }
                window.location.reload();
            });
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
        // Track user in Sentry for error attribution
        Sentry.setUser({ id: userData.id, email: userData.email, username: userData.voterId });
        // Identify user in PostHog for analytics
        posthog.identify(userData.voterId, { email: userData.email, name: userData.fullname });
        posthog.capture('user_logged_in', { method: 'credential' });
    };

    const handleLogout = () => {
        authService.logout();
        setUser(null);
        setIsAdmin(false);
        Sentry.setUser(null); // Clear user from Sentry on logout
        posthog.capture('user_logged_out');
        posthog.reset(); // Clear PostHog identity on logout
    };

    const handleUserUpdate = (updatedUser) => {
        setUser(updatedUser);
        if (updatedUser?.walletAddress) {
            checkAdminStatus(updatedUser.walletAddress);
        }
    };

    // Retry handler for when backend is waking up
    const retryFetch = () => {
        setLoading(true);
        setFetchFailed(false);
        // Re-trigger the sync effect
        window.location.reload();
    };

    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
                <p style={{ color: '#555', marginTop: '1rem', fontSize: '1.1rem' }}>Connecting to Bharat E-Vote Portal...</p>
                <p style={{ color: '#999', marginTop: '0.5rem', fontSize: '0.85rem' }}>This may take up to 60 seconds on first load</p>
            </div>
        );
    }

    // If the backend is unreachable, show a retry screen instead of wrongly redirecting to onboarding
    if (isSignedIn && !user && fetchFailed) {
        return (
            <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                <h2 style={{ color: '#333', marginBottom: '0.5rem', fontSize: '1.5rem' }}>Server is Starting Up</h2>
                <p style={{ color: '#666', maxWidth: '400px', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                    The backend server is waking up from sleep mode. This typically takes 30-60 seconds on the first visit.
                </p>
                <button onClick={retryFetch} style={{ padding: '12px 32px', fontSize: '1rem', backgroundColor: '#162a5c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    🔄 Retry Connection
                </button>
            </div>
        );
    }

    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ActivityMonitor>
                <Toaster position="bottom-right" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff' } }} />
                <div className="flex flex-col min-h-screen bg-watermark">
                    <Navbar user={user} onLogout={() => { signOut(); authService.logout(); }} isAdmin={isAdmin} />
                    <main id="main-content" className="flex-grow focus:outline-none" tabIndex="-1">
                    <Routes>
                        {/* Landing Page - Redirect if logged in */}
                        <Route
                            path="/"
                            element={
                                isAdmin ? <Navigate to="/admin" replace /> :
                                (isSignedIn && user) ? <Navigate to="/dashboard" replace /> :
                                (isSignedIn && !user && !fetchFailed) ? <Navigate to="/onboarding" replace /> :
                                <LandingPage user={user} />
                            }
                        />

                        {/* Login Page */}
                        <Route
                            path="/login"
                            element={
                                (isSignedIn && user) ? <Navigate to="/dashboard" replace /> :
                                (isSignedIn && !user && !fetchFailed) ? <Navigate to="/onboarding" replace /> :
                                <LoginPage />
                            }
                        />

                        {/* Signup Page */}
                        <Route
                            path="/signup"
                            element={
                                (isSignedIn && user) ? <Navigate to="/dashboard" replace /> :
                                (isSignedIn && !user && !fetchFailed) ? <Navigate to="/onboarding" replace /> :
                                <SignupPage />
                            }
                        />

                        {/* SSO Callback */}
                        <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />
                        
                        {/* Onboarding Bridge */}
                        <Route 
                            path="/onboarding" 
                            element={
                                !isSignedIn ? <Navigate to="/login" replace /> :
                                user ? <Navigate to="/dashboard" replace /> :
                                <OnboardingPage clerkUser={clerkUser} onComplete={(dbUser) => setUser(dbUser)} />
                            } 
                        />

                        {/* Forgot Password */}
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                        {/* Voter Dashboard */}
                        <Route
                            path="/dashboard"
                            element={
                                (isSignedIn && user) ? (
                                    <DashboardPage user={user} onUserUpdate={handleUserUpdate} />
                                ) : (
                                    <Navigate to="/login" replace />
                                )
                            }
                        />

                        <Route
                            path="/vote"
                            element={
                                (isSignedIn && user) ? (
                                    <VotingPage
                                        user={user}
                                        onUserUpdate={handleUserUpdate}
                                    />
                                ) : (
                                    <Navigate to="/login" replace />
                                )
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
                                        <AdminDashboard />
                                    </div>
                                ) : (
                                    <Navigate to="/" replace />
                                )
                            }
                        />

                        {/* Admin Login Page */}
                        <Route path="/admin-login" element={<AdminLoginPage onAdminLogin={(adminAddress) => { setIsAdmin(true); checkAdminStatus(adminAddress); }} />} />

                        {/* Admin Data Panel — Protected */}
                        <Route path="/admin-panel" element={
                            isAdmin ? <AdminPanel /> : <Navigate to="/" replace />
                        } />

                        {/* Fallback — 404 */}
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </main>
                <Footer />
            </div>
            </ActivityMonitor>
        </Router>
    );
}

export default App;
