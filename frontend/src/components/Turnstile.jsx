import { useEffect, useRef, useCallback } from 'react';

/**
 * Invisible Cloudflare Turnstile component
 * Renders an invisible CAPTCHA widget that silently verifies the user is human.
 * 
 * @param {Object} props
 * @param {function} props.onVerify - Callback with the verification token
 * @param {function} props.onError - Callback on error (optional)
 * @param {string} props.action - Action label for analytics (optional)
 */
function Turnstile({ onVerify, onError, action = 'login' }) {
    const containerRef = useRef(null);
    const widgetIdRef = useRef(null);

    const handleVerify = useCallback((token) => {
        if (onVerify) onVerify(token);
    }, [onVerify]);

    useEffect(() => {
        const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
        if (!siteKey || !window.turnstile) {
            // Turnstile not configured — skip silently
            if (onVerify) onVerify('turnstile-not-configured');
            return;
        }

        // Render the invisible widget
        if (containerRef.current && !widgetIdRef.current) {
            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                callback: handleVerify,
                'error-callback': onError || (() => {}),
                size: 'invisible',
                action: action,
            });
        }

        return () => {
            if (widgetIdRef.current) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch (e) {
                    // Ignore cleanup errors
                }
                widgetIdRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleVerify, onError, action]);

    return <div ref={containerRef} style={{ display: 'none' }} />;
}

export default Turnstile;
