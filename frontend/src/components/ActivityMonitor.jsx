import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate, useLocation } from 'react-router-dom';

const TIMEOUT_MINUTES = 15;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;
const WARNING_MS = 60 * 1000; // Show warning 1 minute before timeout

function ActivityMonitor({ children }) {
    const { isLoaded, isSignedIn, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showWarning, setShowWarning] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const timeoutRef = useRef(null);
    const warningRef = useRef(null);
    const countdownRef = useRef(null);

    const isPublicRoute = ['/', '/login', '/signup', '/guidelines', '/help'].includes(location.pathname);

    const resetTimers = () => {
        if (!isSignedIn || isPublicRoute) return;

        setShowWarning(false);
        setCountdown(60);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);

        // Set Warning Timer (14 minutes)
        warningRef.current = setTimeout(() => {
            setShowWarning(true);
            
            // Start countdown interval
            countdownRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

        }, TIMEOUT_MS - WARNING_MS);

        // Set Final Eviction Timer (15 minutes)
        timeoutRef.current = setTimeout(() => {
            handleForceSignOut();
        }, TIMEOUT_MS);
    };

    const handleForceSignOut = async () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        
        setShowWarning(false);
        
        // Wipe local storage caching state
        localStorage.removeItem('turnstile_token');
        localStorage.removeItem('has_voted_cache');
        
        await signOut();
        navigate('/login?reason=timeout');
    };

    useEffect(() => {
        if (!isLoaded) return;

        // Only monitor activity on secure routes
        if (isSignedIn && !isPublicRoute) {
            resetTimers();

            const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
            
            // Throttle the event listeners to avoid severe React rerenders on every mouse move
            let throttled = false;
            const handleActivity = () => {
                if (!throttled && !showWarning) {
                    resetTimers();
                    throttled = true;
                    setTimeout(() => throttled = false, 1000); // Only reset timer max once per second
                }
            };

            events.forEach(event => document.addEventListener(event, handleActivity));

            return () => {
                events.forEach(event => document.removeEventListener(event, handleActivity));
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                if (warningRef.current) clearTimeout(warningRef.current);
                if (countdownRef.current) clearInterval(countdownRef.current);
            };
        } else {
            // Cleanup if they log out naturally
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (warningRef.current) clearTimeout(warningRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            setShowWarning(false);
        }
    }, [isLoaded, isSignedIn, isPublicRoute, showWarning]); // Re-attach when public route changes

    return (
        <>
            {children}

            {/* OWASP Session Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center border-t-4 border-yellow-500" role="alert" aria-live="assertive">
                        <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-200">
                            <i className="fa-solid fa-clock text-2xl text-yellow-600 animate-pulse"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Expiring Soon</h2>
                        <p className="text-gray-600 mb-6">
                            For your security, your authenticated vault session will automatically close due to inactivity in:
                        </p>
                        <div className="text-4xl font-black text-red-600 tracking-wider mb-8">
                            {countdown}s
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button 
                                onClick={handleForceSignOut}
                                className="px-6 py-2.5 rounded-lg font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                            >
                                Logout Now
                            </button>
                            <button 
                                onClick={resetTimers}
                                className="px-6 py-2.5 rounded-lg font-bold bg-primary text-white hover:bg-blue-700 shadow-md transition-colors"
                            >
                                <i className="fa-solid fa-shield-check mr-2"></i> Keep Session Active
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ActivityMonitor;
