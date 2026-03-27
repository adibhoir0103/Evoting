import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App';

// Initialize PostHog Analytics & Session Replay
if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        enable_recording_console_log: true,
    });
}

// Initialize Sentry — must be before ReactDOM.createRoot()
Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
    ],
    environment: import.meta.env.MODE, // 'development' or 'production'
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <Sentry.ErrorBoundary
            fallback={({ error }) => (
                <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                    <h1 style={{ color: '#DC2626' }}>Something went wrong</h1>
                    <p style={{ color: '#555' }}>An unexpected error occurred. Our team has been notified.</p>
                    <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#000080', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                        Reload Page
                    </button>
                </div>
            )}
        >
            <HelmetProvider>
                <App />
            </HelmetProvider>
        </Sentry.ErrorBoundary>
    </React.StrictMode>
);
