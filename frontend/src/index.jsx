import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { HelmetProvider } from 'react-helmet-async';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App';

// Import your publishable key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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
if (import.meta.env.VITE_SENTRY_DSN) {
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
}

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
                {PUBLISHABLE_KEY ? (
                    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
                        <App />
                    </ClerkProvider>
                ) : (
                    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                        <div className="sm:mx-auto sm:w-full sm:max-w-md">
                            <div className="bg-white py-8 px-4 shadow rounded-lg sm:px-10 text-center border-t-4 border-primary">
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">Clerk API Keys Required</h2>
                                <p className="text-gray-600 mb-6 font-medium">Authentication has been upgraded! Please add <code className="bg-gray-100 text-primary px-2 py-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code> to your <code className="bg-gray-100 px-2 py-1 rounded border border-gray-200">frontend/.env.local</code> file to proceed.</p>
                                <hr className="mb-6"/>
                                <p className="text-sm text-gray-500">You can obtain this from your <a href="https://dashboard.clerk.com" className="text-accent-saffron hover:underline" target="_blank" rel="noreferrer">Clerk Dashboard</a>.</p>
                            </div>
                        </div>
                    </div>
                )}
            </HelmetProvider>
        </Sentry.ErrorBoundary>
    </React.StrictMode>
);
