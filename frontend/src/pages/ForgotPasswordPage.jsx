import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_URL = rawUrl.startsWith('http') ? (rawUrl.endsWith('/api/v1') ? rawUrl : rawUrl.replace(/\/$/, '') + '/api/v1') : 'https://' + rawUrl.replace(/\/$/, '') + (rawUrl.endsWith('/api/v1') ? '' : '/api/v1');

function ForgotPasswordPage() {
    const [step, setStep] = useState('request'); // 'request' | 'verify' | 'reset' | 'done'
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpTimer, setOtpTimer] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const otpRefs = useRef([]);

    useEffect(() => {
        if (otpTimer > 0) {
            const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [otpTimer]);

    const formatTimer = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Step 1: Send password reset OTP
    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, purpose: 'password-reset', turnstileToken: 'turnstile-not-configured' })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send OTP');
            }

            setSuccess('A 6-digit OTP has been sent to your registered email.');
            if (data.otp) {
                setSuccess(`Demo OTP: ${data.otp} (shown only in development mode)`);
            }
            setOtpTimer(300); // 5 minutes
            setStep('verify');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // OTP input handler
    const handleOtpChange = (index, value) => {
        if (value.length > 1) value = value.slice(-1);
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        const otpCode = otp.join('');

        if (otpCode.length !== 6) {
            setError('Please enter all 6 digits');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp: otpCode, purpose: 'password-reset', turnstileToken: 'turnstile-not-configured' })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Invalid OTP');
            }

            setSuccess('OTP verified! Set your new password.');
            setStep('reset');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Reset Password
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp: otp.join(''), newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to reset password');
            }

            setStep('done');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-gray-50">
            <div className="w-full max-w-md">
                <div className="gov-card p-8">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-blue-50 text-primary flex items-center justify-center mx-auto mb-4 border-2 border-blue-200">
                            <i className={`fa-solid ${step === 'done' ? 'fa-check-circle text-green-600' : 'fa-key'} text-2xl`}></i>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {step === 'request' && 'Forgot Password'}
                            {step === 'verify' && 'Verify OTP'}
                            {step === 'reset' && 'Set New Password'}
                            {step === 'done' && 'Password Changed!'}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {step === 'request' && 'Enter your registered email to receive a reset OTP'}
                            {step === 'verify' && `Enter the 6-digit code sent to ${email}`}
                            {step === 'reset' && 'Create a strong new password'}
                            {step === 'done' && 'Your password has been successfully updated'}
                        </p>
                    </div>

                    {/* Error / Success */}
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded text-sm mb-4">
                            <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
                        </div>
                    )}
                    {success && step !== 'done' && (
                        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-3 rounded text-sm mb-4">
                            <i className="fa-solid fa-check-circle mr-2"></i>{success}
                        </div>
                    )}

                    {/* Step 1: Request OTP */}
                    {step === 'request' && (
                        <form onSubmit={handleSendOTP} className="space-y-4">
                            <div>
                                <label htmlFor="reset-email" className="block text-sm font-semibold text-gray-700 mb-1">
                                    <i className="fa-solid fa-envelope mr-2 text-gray-400"></i>Registered Email
                                </label>
                                <input
                                    type="email"
                                    id="reset-email"
                                    className="input-field"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="voter@example.com"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                                {loading ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Sending...</> : <><i className="fa-solid fa-paper-plane mr-2"></i>Send OTP</>}
                            </button>
                        </form>
                    )}

                    {/* Step 2: Verify OTP */}
                    {step === 'verify' && (
                        <form onSubmit={handleVerifyOTP} className="space-y-4">
                            <div className="flex justify-center gap-2">
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => otpRefs.current[i] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
                                        value={digit}
                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        aria-label={`OTP digit ${i + 1}`}
                                    />
                                ))}
                            </div>

                            {otpTimer > 0 && (
                                <p className="text-center text-sm text-gray-500">
                                    <i className="fa-solid fa-clock mr-1"></i> OTP expires in {formatTimer(otpTimer)}
                                </p>
                            )}

                            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                                {loading ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Verifying...</> : <><i className="fa-solid fa-shield-check mr-2"></i>Verify OTP</>}
                            </button>

                            {otpTimer === 0 && (
                                <button type="button" onClick={() => { setOtp(['', '', '', '', '', '']); setStep('request'); }} className="w-full text-sm text-primary font-semibold hover:underline">
                                    Resend OTP
                                </button>
                            )}
                        </form>
                    )}

                    {/* Step 3: Reset Password */}
                    {step === 'reset' && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <label htmlFor="new-password" className="block text-sm font-semibold text-gray-700 mb-1">
                                    <i className="fa-solid fa-lock mr-2 text-gray-400"></i>New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="new-password"
                                        className="input-field pr-10"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Minimum 8 characters"
                                        required
                                        minLength={8}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-700 mb-1">
                                    <i className="fa-solid fa-lock mr-2 text-gray-400"></i>Confirm Password
                                </label>
                                <input
                                    type="password"
                                    id="confirm-password"
                                    className="input-field"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter your new password"
                                    required
                                />
                            </div>

                            {/* Password Strength */}
                            {newPassword && (
                                <div className="text-xs text-gray-500 space-y-1">
                                    <p className={newPassword.length >= 8 ? 'text-green-600' : 'text-red-500'}>
                                        <i className={`fa-solid ${newPassword.length >= 8 ? 'fa-check' : 'fa-times'} mr-1`}></i> At least 8 characters
                                    </p>
                                    <p className={/[A-Z]/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}>
                                        <i className={`fa-solid ${/[A-Z]/.test(newPassword) ? 'fa-check' : 'fa-times'} mr-1`}></i> One uppercase letter
                                    </p>
                                    <p className={/\d/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}>
                                        <i className={`fa-solid ${/\d/.test(newPassword) ? 'fa-check' : 'fa-times'} mr-1`}></i> One number
                                    </p>
                                </div>
                            )}

                            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                                {loading ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Updating...</> : <><i className="fa-solid fa-check mr-2"></i>Reset Password</>}
                            </button>
                        </form>
                    )}

                    {/* Step 4: Done */}
                    {step === 'done' && (
                        <div className="text-center">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                                <p className="text-green-700 text-sm font-medium">
                                    <i className="fa-solid fa-shield-halved mr-2"></i>
                                    Your password has been securely updated. You may now log in with your new credentials.
                                </p>
                            </div>
                            <Link to="/login" className="btn-primary w-full py-3 inline-flex">
                                <i className="fa-solid fa-right-to-bracket mr-2"></i>Go to Login
                            </Link>
                        </div>
                    )}

                    {/* Footer Links */}
                    {step !== 'done' && (
                        <div className="mt-5 text-center pt-4 border-t border-gray-200">
                            <p className="text-sm text-gray-500">
                                Remember your password? <Link to="/login" className="text-primary font-semibold hover:underline">Back to Login</Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default ForgotPasswordPage;
