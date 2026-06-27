import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';
import { Turnstile } from '@marsidev/react-turnstile';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'; // test key by default

function AdminLoginPage({ onAdminLogin }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState('');

    // MFA state
    const [mfaRequired, setMfaRequired] = useState(false);
    const [preAuthToken, setPreAuthToken] = useState('');
    const [maskedEmail, setMaskedEmail] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/admin/login`, { credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, turnstileToken })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Admin login failed');
            }

            if (data.mfaRequired) {
                // Step 1 complete — show OTP form
                setMfaRequired(true);
                setPreAuthToken(data.preAuthToken);
                setMaskedEmail(data.email || '');
            } else if (data.token) {
                // Direct login (legacy fallback)
                localStorage.setItem('admin', JSON.stringify(data.admin));
                if (onAdminLogin) onAdminLogin(data.admin);
                navigate('/admin-panel');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyMfa = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/admin/verify-mfa`, { credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preAuthToken, otp })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'MFA verification failed');
            }

            localStorage.setItem('admin', JSON.stringify(data.admin));

            if (onAdminLogin) {
                onAdminLogin(data.admin);
            }
            navigate('/admin-panel');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBackToLogin = () => {
        setMfaRequired(false);
        setPreAuthToken('');
        setOtp('');
        setError('');
    };

    return (
        <section className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-gray-50">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="gov-card p-8">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border-2 border-red-200">
                            <i className={`fa-solid ${mfaRequired ? 'fa-shield-halved' : 'fa-user-shield'} text-2xl`}></i>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {mfaRequired ? 'Verify Identity' : 'Admin Login'}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {mfaRequired
                                ? `OTP sent to ${maskedEmail}`
                                : 'Election Commission Officer Access Only'}
                        </p>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded text-sm mb-4" role="alert" aria-live="assertive">
                            <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
                        </div>
                    )}

                    {/* Login Form (Step 1) */}
                    {!mfaRequired && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label htmlFor="admin-email" className="block text-sm font-semibold text-gray-700 mb-1">
                                    <i className="fa-solid fa-envelope mr-2 text-gray-400"></i>Admin Email
                                </label>
                                <input
                                    type="email"
                                    id="admin-email"
                                    className="input-field"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@evote.gov.in"
                                    required
                                    autoComplete="email"
                                    aria-required="true"
                                />
                            </div>

                            <div>
                                <label htmlFor="admin-password" className="block text-sm font-semibold text-gray-700 mb-1">
                                    <i className="fa-solid fa-lock mr-2 text-gray-400"></i>Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="admin-password"
                                        className="input-field pr-10"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter admin password"
                                        required
                                        autoComplete="current-password"
                                        aria-required="true"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 rounded-lg font-bold text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: loading ? '#b91c1c' : '#dc2626' }}
                                disabled={loading}
                            >
                                {loading ? (
                                    <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Authenticating...</>
                                ) : (
                                    <><i className="fa-solid fa-right-to-bracket mr-2"></i>Login as Admin</>
                                )}
                            </button>
                            <div className="flex justify-center mt-4">
                                <Turnstile
                                    siteKey={TURNSTILE_SITE_KEY}
                                    onSuccess={(token) => setTurnstileToken(token)}
                                    options={{ theme: 'light' }}
                                />
                            </div>
                        </form>
                    )}

                    {/* MFA OTP Form (Step 2) */}
                    {mfaRequired && (
                        <form onSubmit={handleVerifyMfa} className="space-y-4">
                            <div>
                                <label htmlFor="admin-otp" className="block text-sm font-semibold text-gray-700 mb-1">
                                    <i className="fa-solid fa-key mr-2 text-gray-400"></i>One-Time Password
                                </label>
                                <input
                                    type="text"
                                    id="admin-otp"
                                    className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    required
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    autoFocus
                                    aria-required="true"
                                />
                                <p className="text-xs text-gray-500 mt-1">Enter the 6-digit code sent to your admin email</p>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 rounded-lg font-bold text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: loading ? '#b91c1c' : '#dc2626' }}
                                disabled={loading || otp.length !== 6}
                            >
                                {loading ? (
                                    <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Verifying...</>
                                ) : (
                                    <><i className="fa-solid fa-shield-check mr-2"></i>Verify & Login</>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleBackToLogin}
                                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <i className="fa-solid fa-arrow-left mr-1"></i> Back to Login
                            </button>
                        </form>
                    )}

                    {/* Security Notice */}
                    <div className="mt-5 bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm text-yellow-800">
                        <i className="fa-solid fa-shield-halved mr-2"></i>
                        <strong>Authorized Personnel Only</strong>
                        <br />
                        <span className="text-xs">
                            {mfaRequired
                                ? 'OTP expires in 5 minutes. Do not share this code.'
                                : 'Contact System Administrator for credentials. All login attempts are logged and monitored.'}
                        </span>
                    </div>

                    {/* Voter Login Link */}
                    {!mfaRequired && (
                        <div className="mt-5 text-center pt-4 border-t border-gray-200">
                            <p className="text-sm text-gray-500">
                                Are you a voter? <Link to="/dashboard" className="text-primary font-semibold hover:underline">Voter Dashboard →</Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default AdminLoginPage;
