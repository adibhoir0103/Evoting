import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useKeystrokeDynamics, KeystrokeIndicator } from '../components/KeystrokeDynamics';
import { isValidEmail, isValidVoterId } from '../utils/validators';

import { API_URL } from '../config/api';

function LoginPage({ onLogin }) {
    const navigate = useNavigate();
    const { getKeystrokeProps, getKeystrokeData, resetKeystroke } = useKeystrokeDynamics();

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [keystrokeResult, setKeystrokeResult] = useState(null);

    // MFA State
    const [mfaStep, setMfaStep] = useState(false);
    const [preAuthToken, setPreAuthToken] = useState('');
    const [maskedEmail, setMaskedEmail] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState('');
    const [otpCountdown, setOtpCountdown] = useState(300); // 5 minutes
    const [resendCooldown, setResendCooldown] = useState(0);
    const [pendingUser, setPendingUser] = useState(null);
    const [demoOtp, setDemoOtp] = useState('');

    // Forgot Password State
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: OTP+newPass
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotResetToken, setForgotResetToken] = useState('');
    const [forgotOtp, setForgotOtp] = useState('');
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState('');
    const [forgotSuccess, setForgotSuccess] = useState('');
    const [forgotDemoOtp, setForgotDemoOtp] = useState('');

    const otpRefs = useRef([]);

    // OTP Countdown Timer
    useEffect(() => {
        if (!mfaStep || otpCountdown <= 0) return;
        const interval = setInterval(() => {
            setOtpCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [mfaStep, otpCountdown]);

    // Resend Cooldown Timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const interval = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) { clearInterval(interval); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [resendCooldown]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Step 1: Submit password
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!identifier.trim() || !password) {
            setError('Email/Voter ID and password are required');
            return;
        }

        // Frontend validation — instant feedback before network call
        const id = identifier.trim();
        const isEmail = id.includes('@');
        if (isEmail && !isValidEmail(id)) {
            setError('Please enter a valid email address (e.g., voter@example.com)');
            return;
        }
        if (!isEmail && !isValidVoterId(id)) {
            setError('Voter ID must be 3 letters followed by 7 digits (e.g., ABC1234567)');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setError('');
        setKeystrokeResult(null);

        try {
            const keystrokeData = getKeystrokeData();

            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: identifier.trim(), password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // MFA flow: password verified, now need OTP
            if (data.mfaRequired) {
                setPreAuthToken(data.preAuthToken);
                setMaskedEmail(data.email);
                setPendingUser(data.user);
                setMfaStep(true);
                setOtpCountdown(300);
                setOtpDigits(['', '', '', '', '', '']);
                setDemoOtp(data.otpDemo || '');

                // Keystroke verification (non-blocking, during MFA wait)
                if (keystrokeData.keyCount >= 4) {
                    try {
                        const ksRes = await fetch(`${API_URL}/auth/keystroke/verify`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: data.user.email,
                                holdTimes: keystrokeData.holdTimes,
                                flightTimes: keystrokeData.flightTimes,
                                meanSpeed: keystrokeData.meanSpeed
                            })
                        });
                        const ksData = await ksRes.json();
                        setKeystrokeResult(ksData);

                        if (ksData.enrolled && !ksData.verified) {
                            toast('⚠️ Keystroke pattern differs from your profile. Logged for security.', {
                                duration: 5000, icon: '🔒',
                                style: { background: '#fef3c7', color: '#92400e', fontWeight: 600 }
                            });
                        }
                    } catch (ksErr) {
                        console.warn('Keystroke verification skipped:', ksErr.message);
                    }
                }

                toast.success('OTP sent to your email!', { icon: '📧' });
                // Focus first OTP input
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            }
        } catch (err) {
            setError(err.message);
            resetKeystroke();
        } finally {
            setLoading(false);
        }
    };

    // Handle OTP digit input
    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return; // Only digits

        const newDigits = [...otpDigits];
        newDigits[index] = value.slice(-1); // Single digit
        setOtpDigits(newDigits);
        setOtpError('');

        // Auto-focus next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (newDigits.every(d => d !== '') && newDigits.join('').length === 6) {
            setTimeout(() => verifyOtp(newDigits.join('')), 150);
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').trim().slice(0, 6);
        if (/^\d{6}$/.test(pasteData)) {
            const digits = pasteData.split('');
            setOtpDigits(digits);
            otpRefs.current[5]?.focus();
            setTimeout(() => verifyOtp(pasteData), 150);
        }
    };

    // Step 2: Verify OTP
    const verifyOtp = async (otpCode) => {
        const otp = otpCode || otpDigits.join('');
        if (otp.length !== 6) {
            setOtpError('Please enter all 6 digits');
            return;
        }

        setOtpLoading(true);
        setOtpError('');

        try {
            const res = await fetch(`${API_URL}/auth/mfa/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preAuthToken, otp })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'OTP verification failed');
            }

            // MFA complete — store final JWT and proceed
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Enroll keystroke if needed
            const keystrokeData = getKeystrokeData();
            if (keystrokeData.keyCount >= 4) {
                try {
                    const ksRes = await fetch(`${API_URL}/auth/keystroke/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: data.user.email, holdTimes: keystrokeData.holdTimes, flightTimes: keystrokeData.flightTimes, meanSpeed: keystrokeData.meanSpeed })
                    });
                    const ksData = await ksRes.json();
                    if (!ksData.enrolled) {
                        await fetch(`${API_URL}/auth/keystroke/enroll`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
                            body: JSON.stringify(keystrokeData)
                        }).catch(() => {});
                    }
                } catch (e) {}
            }

            if (onLogin) onLogin(data.user, data.token);
            toast.success(`Welcome back, ${data.user.fullname || 'Voter'}! MFA verified ✓`, { icon: '🛡️' });
            navigate('/dashboard');

        } catch (err) {
            setOtpError(err.message);
            setOtpDigits(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        } finally {
            setOtpLoading(false);
        }
    };

    // Resend OTP
    const resendOtp = async () => {
        if (resendCooldown > 0) return;

        try {
            const res = await fetch(`${API_URL}/auth/mfa/resend-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preAuthToken })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to resend OTP');
            }

            setOtpCountdown(300);
            setResendCooldown(30);
            setOtpDigits(['', '', '', '', '', '']);
            setDemoOtp(data.otpDemo || '');
            toast.success('New OTP sent!', { icon: '📧' });
            otpRefs.current[0]?.focus();
        } catch (err) {
            setOtpError(err.message);
        }
    };

    // Back to password step
    const backToPassword = () => {
        setMfaStep(false);
        setPreAuthToken('');
        setOtpDigits(['', '', '', '', '', '']);
        setOtpError('');
        setDemoOtp('');
        setPassword('');
        resetKeystroke();
    };

    // ===== FORGOT PASSWORD HANDLERS =====
    const handleForgotSubmitEmail = async (e) => {
        e.preventDefault();
        if (!forgotEmail.trim()) { setForgotError('Email is required'); return; }
        setForgotLoading(true);
        setForgotError('');
        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setForgotResetToken(data.resetToken || '');
            setForgotDemoOtp(data.otpDemo || '');
            setForgotStep(2);
            toast.success('OTP sent to your email!', { icon: '📧' });
        } catch (err) {
            setForgotError(err.message);
        } finally {
            setForgotLoading(false);
        }
    };

    const handleForgotResetPassword = async (e) => {
        e.preventDefault();
        if (!forgotOtp.trim()) { setForgotError('OTP is required'); return; }
        if (forgotNewPassword.length < 8) { setForgotError('Password must be at least 8 characters'); return; }
        if (forgotNewPassword !== forgotConfirmPassword) { setForgotError('Passwords do not match'); return; }
        setForgotLoading(true);
        setForgotError('');
        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resetToken: forgotResetToken, otp: forgotOtp.trim(), newPassword: forgotNewPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Reset failed');
            setForgotSuccess(data.message);
            toast.success('Password reset! You can now login.', { icon: '✅' });
            setTimeout(() => {
                setForgotMode(false);
                setForgotStep(1);
                setForgotEmail('');
                setForgotOtp('');
                setForgotNewPassword('');
                setForgotConfirmPassword('');
                setForgotSuccess('');
                setForgotDemoOtp('');
            }, 2000);
        } catch (err) {
            setForgotError(err.message);
        } finally {
            setForgotLoading(false);
        }
    };

    // ======= MFA OTP VERIFICATION SCREEN =======
    if (mfaStep) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 flex flex-col">
                <Helmet>
                    <title>Verify OTP | Bharat E-Vote Portal</title>
                    <meta name="description" content="Enter the one-time password sent to your registered email to complete multi-factor authentication." />
                </Helmet>

                <div className="h-1.5 bg-gradient-to-r from-accent-saffron via-white to-accent-green"></div>

                <div className="flex-grow flex items-center justify-center px-4 py-12">
                    <div className="w-full max-w-md">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-50 mb-5 shadow-lg shadow-green-100 border-2 border-green-200">
                                <i className="fa-solid fa-shield-halved text-green-600 text-3xl"></i>
                            </div>
                            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Multi-Factor Authentication</h1>
                            <p className="text-gray-500 mt-2">Enter the 6-digit OTP sent to <strong className="text-primary">{maskedEmail}</strong></p>
                        </div>

                        {/* MFA Badge */}
                        <div className="flex justify-center gap-3 mb-6">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                                <i className="fa-solid fa-check-circle"></i> Password Verified
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                                <i className="fa-solid fa-envelope"></i> OTP Pending
                            </span>
                            {keystrokeResult?.enrolled && (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                                    keystrokeResult.verified ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                    <i className="fa-solid fa-fingerprint"></i> {keystrokeResult.verified ? 'Biometric ✓' : 'Anomaly'}
                                </span>
                            )}
                        </div>

                        {/* Error */}
                        {otpError && (
                            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-shake">
                                <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
                                <p className="text-sm text-red-700 font-medium">{otpError}</p>
                            </div>
                        )}

                        {/* OTP Card */}
                        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                            <div className="p-6 sm:p-8">
                                {/* Timer */}
                                <div className="text-center mb-6">
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${
                                        otpCountdown > 60 ? 'bg-green-50 text-green-700 border-green-200' :
                                        otpCountdown > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                        <i className="fa-solid fa-clock"></i>
                                        {otpCountdown > 0 ? `Expires in ${formatTime(otpCountdown)}` : 'OTP Expired'}
                                    </div>
                                </div>

                                {/* Demo OTP hint */}
                                {demoOtp && (
                                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-sm text-amber-800">
                                        <i className="fa-solid fa-flask mr-1"></i>
                                        <strong>Demo Mode OTP:</strong> <span className="font-mono text-lg font-bold tracking-widest">{demoOtp}</span>
                                    </div>
                                )}

                                {/* 6-Digit OTP Input */}
                                <div className="flex justify-center gap-3 mb-6" onPaste={handleOtpPaste}>
                                    {otpDigits.map((digit, i) => (
                                        <input
                                            key={i}
                                            ref={el => otpRefs.current[i] = el}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(i, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                            className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none transition-all duration-200 ${
                                                digit ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 text-gray-900'
                                            } focus:border-primary focus:ring-2 focus:ring-primary/20 focus:scale-105`}
                                            disabled={otpCountdown === 0 || otpLoading}
                                            autoComplete="one-time-code"
                                        />
                                    ))}
                                </div>

                                {/* Verify Button */}
                                <button
                                    onClick={() => verifyOtp()}
                                    disabled={otpLoading || otpDigits.some(d => !d) || otpCountdown === 0}
                                    className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {otpLoading ? (
                                        <><i className="fa-solid fa-spinner fa-spin"></i> Verifying OTP...</>
                                    ) : (
                                        <><i className="fa-solid fa-shield-halved"></i> Verify & Complete Login</>
                                    )}
                                </button>

                                {/* Resend */}
                                <div className="mt-4 text-center">
                                    <p className="text-sm text-gray-500">Didn't receive the code?</p>
                                    <button
                                        onClick={resendOtp}
                                        disabled={resendCooldown > 0}
                                        className="mt-1 text-sm font-bold text-primary hover:underline disabled:text-gray-400 disabled:no-underline"
                                    >
                                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                                    </button>
                                </div>
                            </div>

                            {/* Back */}
                            <div className="px-6 sm:px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
                                <button onClick={backToPassword} className="text-sm text-gray-500 hover:text-primary font-semibold">
                                    <i className="fa-solid fa-arrow-left mr-1"></i> Back to Password
                                </button>
                            </div>
                        </div>

                        {/* Security info */}
                        <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><i className="fa-solid fa-lock text-green-500"></i>Password ✓</span>
                            <span className="flex items-center gap-1"><i className="fa-solid fa-envelope text-blue-500"></i>Email OTP</span>
                            <span className="flex items-center gap-1"><i className="fa-solid fa-fingerprint text-purple-500"></i>Keystroke Bio</span>
                            <span className="flex items-center gap-1"><i className="fa-solid fa-shield-halved text-primary"></i>3-Factor MFA</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ======= PASSWORD LOGIN SCREEN (Step 1) =======
    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 flex flex-col">
            <Helmet>
                <title>Login | Bharat E-Vote Portal</title>
                <meta name="description" content="Login to the Bharat E-Vote Portal with your Voter ID or email. Secured with multi-factor authentication and keystroke biometric verification." />
            </Helmet>

            {/* Top tricolour band */}
            <div className="h-1.5 bg-gradient-to-r from-accent-saffron via-white to-accent-green"></div>

            <div className="flex-grow flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-5 shadow-lg shadow-primary/10">
                            <i className="fa-solid fa-landmark text-primary text-3xl"></i>
                        </div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Voter Login</h1>
                        <p className="text-gray-500 mt-2">Bharat E-Vote — Secure Electoral Portal</p>
                    </div>

                    {/* MFA Info */}
                    <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3">
                        <i className="fa-solid fa-shield-halved text-blue-500 mt-0.5"></i>
                        <p className="text-xs text-blue-700 font-medium">
                            <strong>3-Factor Authentication:</strong> Password → Email OTP → Keystroke Biometrics.
                            An OTP will be sent to your registered email after password verification.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-shake">
                            <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Form Card */}
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="p-6 sm:p-8 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Email or Voter ID</label>
                                <div className="relative">
                                    <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        placeholder="voter@example.com or ABC1234567"
                                        autoFocus
                                        autoComplete="username"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
                                <div className="relative">
                                    <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                        onFocus={() => { setPasswordFocused(true); resetKeystroke(); }}
                                        onBlur={() => setPasswordFocused(false)}
                                        {...getKeystrokeProps()}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                    />
                                </div>
                                <KeystrokeIndicator isCapturing={passwordFocused} />
                                <div className="text-right mt-1">
                                    <button type="button" onClick={() => { setForgotMode(true); setForgotError(''); setForgotSuccess(''); setForgotStep(1); }} className="text-xs text-primary hover:underline font-semibold">
                                        <i className="fa-solid fa-key mr-1"></i>Forgot Password?
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><i className="fa-solid fa-spinner fa-spin"></i> Verifying Password...</>
                                ) : (
                                    <><i className="fa-solid fa-right-to-bracket"></i> Continue with MFA</>
                                )}
                            </button>
                        </div>

                        <div className="px-6 sm:px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
                            <p className="text-sm text-gray-500">
                                Don't have an account?{' '}
                                <Link to="/signup" className="text-primary font-bold hover:underline">Register Now</Link>
                            </p>
                        </div>
                    </form>

                    {/* ===== FORGOT PASSWORD MODAL ===== */}
                    {forgotMode && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setForgotMode(false)}>
                            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                                <div className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 text-white">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <i className="fa-solid fa-key"></i> Reset Password
                                    </h2>
                                    <p className="text-blue-100 text-sm mt-1">
                                        {forgotStep === 1 ? 'Enter your registered email to receive an OTP' : 'Enter OTP and set your new password'}
                                    </p>
                                </div>

                                <div className="p-6 space-y-4">
                                    {forgotError && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                                            <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
                                            <p className="text-sm text-red-700 font-medium">{forgotError}</p>
                                        </div>
                                    )}
                                    {forgotSuccess && (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                                            <i className="fa-solid fa-check-circle text-green-500 mt-0.5"></i>
                                            <p className="text-sm text-green-700 font-medium">{forgotSuccess}</p>
                                        </div>
                                    )}

                                    {forgotStep === 1 ? (
                                        <form onSubmit={handleForgotSubmitEmail} className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
                                                <div className="relative">
                                                    <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                                                    <input
                                                        type="email"
                                                        value={forgotEmail}
                                                        onChange={e => { setForgotEmail(e.target.value); setForgotError(''); }}
                                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                                        placeholder="voter@example.com"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <button type="submit" disabled={forgotLoading} className="w-full py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
                                                {forgotLoading ? <><i className="fa-solid fa-spinner fa-spin"></i> Sending OTP...</> : <><i className="fa-solid fa-paper-plane"></i> Send Reset OTP</>}
                                            </button>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleForgotResetPassword} className="space-y-4">
                                            {forgotDemoOtp && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-sm text-amber-800">
                                                    <i className="fa-solid fa-flask mr-1"></i>
                                                    <strong>Demo OTP:</strong> <span className="font-mono text-lg font-bold tracking-widest">{forgotDemoOtp}</span>
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">OTP Code</label>
                                                <input
                                                    type="text"
                                                    value={forgotOtp}
                                                    onChange={e => { setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setForgotError(''); }}
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm text-center font-mono text-2xl tracking-[0.5em]"
                                                    placeholder="000000"
                                                    maxLength={6}
                                                    autoFocus
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                                                <input
                                                    type="password"
                                                    value={forgotNewPassword}
                                                    onChange={e => { setForgotNewPassword(e.target.value); setForgotError(''); }}
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                                    placeholder="Min 8 characters"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                                                <input
                                                    type="password"
                                                    value={forgotConfirmPassword}
                                                    onChange={e => { setForgotConfirmPassword(e.target.value); setForgotError(''); }}
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                                    placeholder="Re-enter password"
                                                />
                                            </div>
                                            <button type="submit" disabled={forgotLoading} className="w-full py-3 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
                                                {forgotLoading ? <><i className="fa-solid fa-spinner fa-spin"></i> Resetting...</> : <><i className="fa-solid fa-check"></i> Reset Password</>}
                                            </button>
                                        </form>
                                    )}
                                </div>

                                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
                                    <button onClick={() => setForgotMode(false)} className="text-sm text-gray-500 hover:text-gray-700 font-semibold">
                                        <i className="fa-solid fa-arrow-left mr-1"></i> Back to Login
                                    </button>
                                    {forgotStep === 2 && (
                                        <button onClick={() => setForgotStep(1)} className="text-sm text-primary hover:underline font-semibold">
                                            Resend OTP
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Security badges */}
                    <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><i className="fa-solid fa-lock text-green-500"></i>TLS Encrypted</span>
                        <span className="flex items-center gap-1"><i className="fa-solid fa-envelope text-blue-500"></i>Email OTP</span>
                        <span className="flex items-center gap-1"><i className="fa-solid fa-fingerprint text-purple-500"></i>Keystroke Bio</span>
                        <span className="flex items-center gap-1"><i className="fa-solid fa-shield-halved text-primary"></i>Rate Limited</span>
                    </div>

                    {/* Admin link */}
                    <div className="mt-6 text-center">
                        <Link to="/admin-login" className="text-xs text-gray-400 hover:text-red-500 transition font-semibold">
                            <i className="fa-solid fa-user-shield mr-1"></i>Election Officer Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
