import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { API_URL } from '../config/api';
import { useKeystrokeDynamics, KeystrokeIndicator } from '../components/KeystrokeDynamics';
import { authService } from '../services/authService';

function SetPasswordPage() {
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const { getKeystrokeProps, getKeystrokeData, resetKeystroke } = useKeystrokeDynamics();

    const passwordStrength = () => {
        const p = newPassword;
        if (!p) return { score: 0, label: '', color: '' };
        let score = 0;
        if (p.length >= 8) score++;
        if (p.length >= 12) score++;
        if (/[A-Z]/.test(p)) score++;
        if (/[a-z]/.test(p)) score++;
        if (/\d/.test(p)) score++;
        if (/[^A-Za-z0-9]/.test(p)) score++;
        if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500', text: 'text-red-500' };
        if (score <= 4) return { score, label: 'Medium', color: 'bg-yellow-500', text: 'text-yellow-600' };
        return { score, label: 'Strong', color: 'bg-green-500', text: 'text-green-600' };
    };

    const strength = passwordStrength();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!newPassword || !confirmPassword) {
            setError('Both fields are required');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
            setError('Password must contain uppercase, lowercase, and at least one number');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/set-new-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ newPassword, confirmPassword })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to set password');

            // Enroll keystroke biometrics for the new password
            const keystrokeData = getKeystrokeData();
            if (keystrokeData.keyCount >= 4) {
                try {
                    await fetch(`${API_URL}/auth/keystroke/enroll`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(keystrokeData)
                    });
                    toast('🔏 Keystroke biometrics sample captured', { duration: 2000 });
                } catch (e) {
                    // Non-blocking — enrollment will continue at next login
                }
            }

            // Clear user from localStorage — they must log in fresh
            authService.logout();

            toast.success('Password set! Please log in with your new password.', { duration: 5000 });
            
            // Hard reload to clear all React state and force user to login page
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 flex flex-col">
            <Helmet>
                <title>Set New Password | Bharat E-Vote Portal</title>
                <meta name="description" content="Set your permanent password for the Bharat E-Vote portal." />
            </Helmet>

            <div className="h-1.5 bg-gradient-to-r from-accent-saffron via-white to-accent-green" />

            <div className="flex-grow flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-5 shadow-lg shadow-primary/10 border-2 border-primary/20">
                            <i className="fa-solid fa-key text-primary text-3xl" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Set Your Password</h1>
                        <p className="text-gray-500 mt-2">Create a permanent password for your account</p>
                    </div>

                    {/* Notice Banner */}
                    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5" />
                        <p className="text-sm text-amber-800">
                            <strong>First Login Detected.</strong> Your account was created with a temporary password by the Election Officer. You must set a permanent password before proceeding.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3" role="alert">
                            <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5" />
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Form Card */}
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="p-6 sm:p-8 space-y-5">

                            {/* Requirements List */}
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1.5">
                                <p className="font-bold text-gray-700 mb-2"><i className="fa-solid fa-shield-halved mr-1 text-primary" /> Password Requirements</p>
                                {[
                                    { check: newPassword.length >= 8, label: 'At least 8 characters' },
                                    { check: /[A-Z]/.test(newPassword), label: 'At least one uppercase letter' },
                                    { check: /[a-z]/.test(newPassword), label: 'At least one lowercase letter' },
                                    { check: /\d/.test(newPassword), label: 'At least one number' },
                                ].map((r, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <i className={`fa-solid ${r.check ? 'fa-check-circle text-green-500' : 'fa-circle text-gray-300'} text-xs`} />
                                        <span className={r.check ? 'text-green-700 font-medium' : ''}>{r.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* New Password */}
                            <div>
                                <label htmlFor="set-new-password" className="block text-sm font-semibold text-gray-700 mb-1">
                                    New Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        id="set-new-password"
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                                        onFocus={() => { setPasswordFocused(true); resetKeystroke(); }}
                                        onBlur={() => setPasswordFocused(false)}
                                        {...getKeystrokeProps()}
                                        className="w-full pl-4 pr-11 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        placeholder="Type password (no paste)"
                                        aria-required="true"
                                        autoFocus
                                    />
                                    <button type="button" onClick={() => setShowNew(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        <i className={`fa-solid ${showNew ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                                    </button>
                                </div>
                                <KeystrokeIndicator isCapturing={passwordFocused} />
                                {newPassword && (
                                    <div className="mt-2">
                                        <div className="flex gap-1 mb-1">
                                            {[1,2,3,4,5,6].map(i => (
                                                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-gray-200'}`} />
                                            ))}
                                        </div>
                                        <p className={`text-xs font-semibold ${strength.text}`}>{strength.label}</p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label htmlFor="set-confirm-password" className="block text-sm font-semibold text-gray-700 mb-1">
                                    Confirm Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        id="set-confirm-password"
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                        onPaste={e => e.preventDefault()}
                                        className="w-full pl-4 pr-11 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        placeholder="Re-enter password (no paste)"
                                        autoComplete="off"
                                        data-lpignore="true"
                                        data-1p-ignore="true"
                                        aria-required="true"
                                    />
                                    <button type="button" onClick={() => setShowConfirm(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                                    </button>
                                </div>
                                {confirmPassword && (
                                    <p className={`text-xs mt-1 font-medium ${newPassword === confirmPassword ? 'text-green-600' : 'text-red-500'}`} role="status">
                                        <i className={`fa-solid ${newPassword === confirmPassword ? 'fa-check-circle' : 'fa-times-circle'} mr-1`} />
                                        {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="px-6 sm:px-8 py-5 bg-gray-50 border-t border-gray-100">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><i className="fa-solid fa-spinner fa-spin" /> Setting Password...</>
                                ) : (
                                    <><i className="fa-solid fa-lock" /> Set Permanent Password</>
                                )}
                            </button>
                            <p className="text-xs text-gray-400 text-center mt-3">
                                <i className="fa-solid fa-info-circle mr-1" />
                                After setting your password, you will be redirected to login and complete MFA verification.
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default SetPasswordPage;
