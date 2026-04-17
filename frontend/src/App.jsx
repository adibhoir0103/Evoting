import React, { useState, useEffect, Suspense, lazy } from 'react';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

// Components (always loaded — part of shell)
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages — lazy loaded for code splitting (reduces initial bundle ~60%)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const VotingPage = lazy(() => import('./pages/VotingPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const TechnologyPage = lazy(() => import('./pages/TechnologyPage'));
const VerifyVotePage = lazy(() => import('./pages/VerifyVotePage'));

// Services
import { authService } from './services/authService';
import { BlockchainService } from './services/blockchainService';

// Hooks
import useInactivityTimer from './hooks/useInactivityTimer';

/** Skeleton loading fallback — shown while lazy chunks load */
function PageSkeleton() {
    return (
        <div className="min-h-[60vh] max-w-5xl mx-auto px-4 py-12 animate-pulse">
            {/* Hero skeleton */}
            <div className="h-8 bg-gray-200 rounded-lg w-2/3 mb-4"></div>
            <div className="h-4 bg-gray-100 rounded w-1/2 mb-8"></div>
            {/* Card skeletons */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                        <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-100 rounded w-full"></div>
                        <div className="h-3 bg-gray-100 rounded w-5/6"></div>
                    </div>
                ))}
            </div>
            {/* Table skeleton */}
            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-4">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function App() {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    // Network status detection
    useEffect(() => {
        const goOffline = () => { setIsOffline(true); toast.error('You are offline. Some features may not work.', { id: 'offline', duration: Infinity }); };
        const goOnline = () => { setIsOffline(false); toast.dismiss('offline'); toast.success('Connection restored!', { duration: 3000 }); };
        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            try {
                // Check for existing JWT token
                if (authService.isLoggedIn()) {
                    const storedUser = authService.getStoredUser();
                    if (storedUser) {
                        setUser(storedUser);
                    }
                    // Verify token with backend
                    const freshUser = await authService.getCurrentUser();
                    if (freshUser) {
                        setUser(freshUser);
                    }
                }
                setIsAdmin(!!localStorage.getItem('adminToken'));
            } catch (err) {
                console.error('Auth init error:', err);
            } finally {
                setLoading(false);
            }
        };
        initAuth();
    }, []);

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', (chainId) => {
                // Accept both localhost (0x539 / 1337) and Sepolia (0xaa36a7 / 11155111)
                const acceptedChains = ['0xaa36a7', '0x539'];
                if (!acceptedChains.includes(chainId)) {
                    toast.error('Wrong network! Please switch to Sepolia Testnet or Localhost 8545');
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

    const handleLogin = (userData, token) => {
        setUser(userData);
        if (userData.walletAddress) {
            checkAdminStatus(userData.walletAddress);
        }
    };

    const handleLogout = () => {
        authService.logout();
        setUser(null);
        setIsAdmin(false);
        Sentry.setUser(null);
        posthog.reset();
    };

    const handleUserUpdate = (updatedUser) => {
        setUser(updatedUser);
        if (updatedUser?.walletAddress) {
            checkAdminStatus(updatedUser.walletAddress);
        }
    };

    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
                <p style={{ color: '#555', marginTop: '1rem', fontSize: '1.1rem' }}>Connecting to Bharat E-Vote Portal...</p>
            </div>
        );
    }

    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Toaster position="bottom-right" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff' } }} />
            <AppLayout
                user={user}
                isAdmin={isAdmin}
                setIsAdmin={setIsAdmin}
                handleLogin={handleLogin}
                handleLogout={handleLogout}
                handleUserUpdate={handleUserUpdate}
                checkAdminStatus={checkAdminStatus}
                isOffline={isOffline}
            />
        </Router>
    );
}

/** Inner layout — can use useLocation since it's inside Router */
function AppLayout({ user, isAdmin, setIsAdmin, handleLogin, handleLogout, handleUserUpdate, checkAdminStatus, isOffline }) {
    const location = useLocation();
    const isAdminPanel = location.pathname === '/admin-panel';
    const isAuthPage = ['/login', '/signup'].includes(location.pathname);

    // Inactivity auto-logout (10 min idle = security standard for govt apps)
    const isAuthenticated = !!(user || localStorage.getItem('adminToken'));
    const { showWarning, remainingSeconds, stayLoggedIn } = useInactivityTimer(
        handleLogout,
        isAuthenticated ? 10 * 60 * 1000 : Infinity // Only active when logged in
    );

    return (
        <div className="flex flex-col min-h-screen bg-watermark">
            {/* Session Timeout Warning Modal */}
            {showWarning && isAuthenticated && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]" role="alertdialog" aria-modal="true" aria-label="Session timeout warning">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-fade-in">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <i className="fa-solid fa-clock text-white text-3xl"></i>
                            </div>
                            <h2 className="text-xl font-bold text-white">Session Expiring</h2>
                            <p className="text-red-100 text-sm mt-1">Due to inactivity, your session will end soon</p>
                        </div>
                        {/* Body */}
                        <div className="p-6 text-center">
                            <div className="w-24 h-24 rounded-full border-4 border-red-500 flex items-center justify-center mx-auto mb-4">
                                <span className="text-4xl font-bold text-red-600">{remainingSeconds}</span>
                            </div>
                            <p className="text-gray-600 text-sm mb-6">seconds remaining before automatic logout</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={stayLoggedIn}
                                    className="flex-1 bg-primary hover:bg-primary-800 text-white py-3 px-6 rounded-lg font-bold transition-colors shadow-md"
                                    autoFocus
                                >
                                    <i className="fa-solid fa-rotate-right mr-2"></i> Stay Logged In
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium transition-colors border border-gray-300"
                                >
                                    <i className="fa-solid fa-right-from-bracket mr-2"></i> Logout Now
                                </button>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500 text-center">
                                <i className="fa-solid fa-shield-halved mr-1"></i>
                                Session timeout is a security feature mandated by GIGW 3.0 compliance standards.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {/* Offline Banner */}
            {isOffline && (
                <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 z-50" role="alert" aria-live="assertive">
                    <i className="fa-solid fa-wifi-slash"></i>
                    <span>You are currently offline. Blockchain transactions and authentication require an internet connection.</span>
                </div>
            )}
            {!isAdminPanel && !isAuthPage && <Navbar user={user} onLogout={handleLogout} isAdmin={isAdmin} />}
            <main id="main-content" className="flex-grow focus:outline-none" tabIndex="-1">
                <Suspense fallback={<PageSkeleton />}>
                <Routes>
                    {/* Landing page — always show at root */}
                    <Route path="/" element={<LandingPage />} />

                    {/* Auth Pages */}
                    <Route path="/login" element={
                        user ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={handleLogin} />
                    } />
                    <Route path="/signup" element={
                        user ? <Navigate to="/dashboard" replace /> : <SignupPage />
                    } />

                    {/* Voter Dashboard — requires login */}
                    <Route path="/dashboard" element={
                        user ? <DashboardPage user={user} onUserUpdate={handleUserUpdate} /> : <Navigate to="/login" replace />
                    } />

                    {/* Voting Page — requires login */}
                    <Route path="/vote" element={
                        user ? <VotingPage user={user} onUserUpdate={handleUserUpdate} /> : <Navigate to="/login" replace />
                    } />

                    {/* Public Pages */}
                    <Route path="/guidelines" element={<Navigate to="/help" replace />} />
                    <Route path="/help" element={<HelpPage />} />
                    <Route path="/candidates" element={<Navigate to="/vote" replace />} />
                    <Route path="/search-roll" element={<Navigate to="/help" replace />} />
                    <Route path="/results" element={<ResultsPage />} />
                    <Route path="/technology" element={<TechnologyPage />} />
                    <Route path="/verify" element={<VerifyVotePage />} />

                    {/* Admin */}
                    <Route path="/admin-login" element={<AdminLoginPage onAdminLogin={(adminAddress) => { setIsAdmin(true); checkAdminStatus(adminAddress); }} />} />
                    <Route path="/admin-panel" element={
                        (isAdmin || localStorage.getItem('adminToken')) ? <AdminPanel onAdminLogout={() => { setIsAdmin(false); localStorage.removeItem('adminToken'); localStorage.removeItem('admin'); }} /> : <Navigate to="/admin-login" replace />
                    } />

                    {/* 404 */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
                </Suspense>
            </main>
            {!isAdminPanel && !isAuthPage && <Footer />}
        </div>
    );
}

export default App;
