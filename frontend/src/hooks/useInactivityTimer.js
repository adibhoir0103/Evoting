import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * useInactivityTimer — Auto-logout after configurable idle period.
 * 
 * Industry-standard session timeout for government/banking apps.
 * Tracks mouse, keyboard, scroll, and touch events as "activity".
 * Shows a warning modal 60 seconds before logout.
 * 
 * @param {Function} onLogout - Called when the user should be logged out
 * @param {number} timeoutMs - Total idle time before logout (default: 10 minutes)
 * @param {number} warningMs - Time before logout to show warning (default: 60 seconds)
 * @returns {{ showWarning, remainingSeconds, stayLoggedIn }}
 */
const useInactivityTimer = (onLogout, timeoutMs = 10 * 60 * 1000, warningMs = 60 * 1000) => {
    const [showWarning, setShowWarning] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    
    const logoutTimerRef = useRef(null);
    const warningTimerRef = useRef(null);
    const countdownRef = useRef(null);
    const onLogoutRef = useRef(onLogout);

    // Keep the callback ref fresh without causing re-renders
    useEffect(() => {
        onLogoutRef.current = onLogout;
    }, [onLogout]);

    const clearAllTimers = useCallback(() => {
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setShowWarning(false);
        setRemainingSeconds(0);
    }, []);

    const resetTimer = useCallback(() => {
        clearAllTimers();

        // Set warning timer (fires warningMs before logout)
        warningTimerRef.current = setTimeout(() => {
            setShowWarning(true);
            setRemainingSeconds(Math.ceil(warningMs / 1000));

            // Start countdown for the warning modal
            let seconds = Math.ceil(warningMs / 1000);
            countdownRef.current = setInterval(() => {
                seconds--;
                setRemainingSeconds(seconds);
                if (seconds <= 0) {
                    clearInterval(countdownRef.current);
                }
            }, 1000);
        }, timeoutMs - warningMs);

        // Set logout timer (fires after full timeout)
        logoutTimerRef.current = setTimeout(() => {
            clearAllTimers();
            onLogoutRef.current();
        }, timeoutMs);
    }, [timeoutMs, warningMs, clearAllTimers]);

    // "Stay Logged In" — resets everything
    const stayLoggedIn = useCallback(() => {
        resetTimer();
    }, [resetTimer]);

    useEffect(() => {
        // Activity events that reset the timer
        const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'mousemove', 'click'];

        const handleActivity = () => {
            // Only reset if warning is NOT showing (don't let background activity dismiss warning)
            if (!showWarning) {
                resetTimer();
            }
        };

        events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
        
        // Start the timer
        resetTimer();

        return () => {
            clearAllTimers();
            events.forEach(event => window.removeEventListener(event, handleActivity));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { showWarning, remainingSeconds, stayLoggedIn };
};

export default useInactivityTimer;
