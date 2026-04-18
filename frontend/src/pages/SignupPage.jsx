import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useKeystrokeDynamics, KeystrokeIndicator } from '../components/KeystrokeDynamics';
import { indianStates } from '../utils/indianStates';

import { API_URL } from '../config/api';

function SignupPage() {
    const navigate = useNavigate();
    const { getKeystrokeProps, getKeystrokeData, resetKeystroke } = useKeystrokeDynamics();

    const [step, setStep] = useState(1); // 1: Identity, 2: Details, 3: Security
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [passwordFocused, setPasswordFocused] = useState(false);

    // Form fields
    const [form, setForm] = useState({
        fullname: '',
        email: '',
        voter_id: '',
        aadhaar_number: '',
        father_name: '',
        gender: '',
        dob: '',
        mobile_number: '',
        state_code: '',
        constituency_code: '',
        address: '',
        password: '',
        confirmPassword: ''
    });

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (error) setError('');
    };

    // Validation per step
    const validateStep = (stepNum) => {
        switch (stepNum) {
            case 1:
                if (!form.fullname.trim()) return 'Full name is required';
                if (!form.email.trim()) return 'Email address is required';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Invalid email format';
                if (!form.voter_id.trim()) return 'Voter ID (EPIC) is required';
                if (!/^[A-Za-z]{3}\d{7}$/.test(form.voter_id.trim())) return 'Voter ID must be 3 letters followed by 7 digits (e.g., ABC1234567)';
                return null;
            case 2:
                if (form.aadhaar_number && !/^\d{12}$/.test(form.aadhaar_number.replace(/\s/g, ''))) return 'Aadhaar must be exactly 12 digits';
                if (form.mobile_number && !/^\d{10}$/.test(form.mobile_number.replace(/\s/g, ''))) return 'Mobile number must be 10 digits';
                return null;
            case 3:
                if (!form.password) return 'Password is required';
                if (form.password.length < 8) return 'Password must be at least 8 characters';
                if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) return 'Password must contain uppercase, lowercase, and number';
                if (form.password !== form.confirmPassword) return 'Passwords do not match';
                return null;
            default:
                return null;
        }
    };

    const nextStep = () => {
        const err = validateStep(step);
        if (err) {
            setError(err);
            return;
        }
        setError('');
        setStep(s => s + 1);
    };

    const prevStep = () => {
        setError('');
        setStep(s => s - 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const err = validateStep(3);
        if (err) { setError(err); return; }

        setLoading(true);
        setError('');

        try {
            // Get keystroke data from password typing
            const keystrokeData = getKeystrokeData();

            // Register
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullname: form.fullname.trim(),
                    email: form.email.trim().toLowerCase(),
                    password: form.password,
                    voter_id: form.voter_id.trim().toUpperCase(),
                    aadhaar_number: form.aadhaar_number ? form.aadhaar_number.replace(/\s/g, '') : undefined,
                    father_name: form.father_name || undefined,
                    gender: form.gender || undefined,
                    dob: form.dob || undefined,
                    mobile_number: form.mobile_number || undefined,
                    state_code: form.state_code || undefined,
                    constituency_code: form.constituency_code || undefined,
                    address: form.address || undefined
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Store JWT and user
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Enroll keystroke profile if we have data
            if (keystrokeData.keyCount >= 6) {
                try {
                    await fetch(`${API_URL}/auth/keystroke/enroll`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${data.token}`
                        },
                        body: JSON.stringify(keystrokeData)
                    });
                } catch (ksErr) {
                    console.warn('Keystroke enrollment skipped:', ksErr.message);
                }
            }

            toast.success('🎉 Registration successful! Welcome to Bharat E-Vote.');
            navigate('/dashboard');

        } catch (err) {
            setError(err.message);
            if (err.message.includes('whitelisted')) {
                toast.error('You need to be approved by an Election Officer first.', { duration: 6000 });
            }
        } finally {
            setLoading(false);
        }
    };

    const passwordStrength = () => {
        const p = form.password;
        if (!p) return { score: 0, label: '', color: '' };
        let score = 0;
        if (p.length >= 8) score++;
        if (p.length >= 12) score++;
        if (/[A-Z]/.test(p)) score++;
        if (/[a-z]/.test(p)) score++;
        if (/\d/.test(p)) score++;
        if (/[^A-Za-z0-9]/.test(p)) score++;

        if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
        if (score <= 4) return { score, label: 'Medium', color: 'bg-yellow-500' };
        return { score, label: 'Strong', color: 'bg-green-500' };
    };

    const strength = passwordStrength();

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
            <Helmet>
                <title>Register | Bharat E-Vote Portal</title>
                <meta name="description" content="Register as a voter on the Bharat E-Vote Portal. Create your account with Aadhaar verification and keystroke biometrics." />
            </Helmet>

            {/* Top tricolour band */}
            <div className="h-1.5 bg-gradient-to-r from-accent-saffron via-white to-accent-green"></div>

            <div className="max-w-2xl mx-auto px-4 py-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                        <i className="fa-solid fa-user-plus text-primary text-2xl"></i>
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Voter Registration</h1>
                    <p className="text-gray-500 mt-2">Create your secure Bharat E-Vote account</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {[
                        { num: 1, label: 'Identity', icon: 'fa-id-card' },
                        { num: 2, label: 'Details', icon: 'fa-address-card' },
                        { num: 3, label: 'Security', icon: 'fa-shield-halved' }
                    ].map((s, i) => (
                        <React.Fragment key={s.num}>
                            {i > 0 && <div className={`h-0.5 w-8 ${step >= s.num ? 'bg-primary' : 'bg-gray-200'} transition-colors`} />}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold transition-all ${
                                step === s.num ? 'bg-primary text-white shadow-lg shadow-primary/30' :
                                step > s.num ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                            }`}>
                                <i className={`fa-solid ${step > s.num ? 'fa-check' : s.icon} text-xs`}></i>
                                <span className="hidden sm:inline">{s.label}</span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-shake">
                        <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                )}

                {/* Form Card */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

                    {/* Step 1: Identity */}
                    {step === 1 && (
                        <div className="p-6 sm:p-8 space-y-5">
                            <div className="flex items-center gap-2 text-primary font-bold text-lg mb-2">
                                <i className="fa-solid fa-id-card"></i> Identity Verification
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name (as on EPIC) <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={form.fullname}
                                    onChange={(e) => updateField('fullname', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                    placeholder="Enter your full name"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => updateField('email', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                    placeholder="voter@example.com"
                                />
                                <p className="text-xs text-gray-400 mt-1"><i className="fa-solid fa-info-circle mr-1"></i>Must match your admin-approved email</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Voter ID (EPIC Number) <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={form.voter_id}
                                    onChange={(e) => updateField('voter_id', e.target.value.toUpperCase())}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm font-mono tracking-wider"
                                    placeholder="ABC1234567"
                                    maxLength={10}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Aadhaar Number</label>
                                <input
                                    type="text"
                                    value={form.aadhaar_number}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                                        updateField('aadhaar_number', val);
                                    }}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm font-mono tracking-wider"
                                    placeholder="XXXX XXXX XXXX"
                                    maxLength={12}
                                />
                                <p className="text-xs text-gray-400 mt-1"><i className="fa-solid fa-lock mr-1"></i>256-bit AES encrypted storage</p>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Personal Details */}
                    {step === 2 && (
                        <div className="p-6 sm:p-8 space-y-5">
                            <div className="flex items-center gap-2 text-primary font-bold text-lg mb-2">
                                <i className="fa-solid fa-address-card"></i> Personal Details
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Father's Name</label>
                                    <input
                                        type="text"
                                        value={form.father_name}
                                        onChange={(e) => updateField('father_name', e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        placeholder="Father's full name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Gender</label>
                                    <select
                                        value={form.gender}
                                        onChange={(e) => updateField('gender', e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm bg-white"
                                    >
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Date of Birth</label>
                                    <input
                                        type="date"
                                        value={form.dob}
                                        onChange={(e) => updateField('dob', e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
                                    <input
                                        type="tel"
                                        value={form.mobile_number}
                                        onChange={(e) => updateField('mobile_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        placeholder="10-digit mobile"
                                        maxLength={10}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                                    <select
                                        value={form.state_code}
                                        onChange={(e) => updateField('state_code', e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm bg-white"
                                    >
                                        <option value="">Select State</option>
                                        {indianStates.map(s => (
                                            <option key={s.code} value={s.code}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Constituency Code</label>
                                    <input
                                        type="number"
                                        value={form.constituency_code}
                                        onChange={(e) => updateField('constituency_code', e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        placeholder="e.g., 1"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                                <textarea
                                    value={form.address}
                                    onChange={(e) => updateField('address', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm resize-none"
                                    rows={2}
                                    placeholder="Full residential address"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Security (Password + Keystroke) */}
                    {step === 3 && (
                        <div className="p-6 sm:p-8 space-y-5">
                            <div className="flex items-center gap-2 text-primary font-bold text-lg mb-2">
                                <i className="fa-solid fa-shield-halved"></i> Security Setup
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                                <i className="fa-solid fa-fingerprint mr-2 text-blue-600"></i>
                                <strong>Keystroke Biometrics Active</strong> — Your typing pattern is being captured as you type your password. This creates a unique biometric profile for secure login verification.
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Create Password <span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => updateField('password', e.target.value)}
                                    onFocus={() => { setPasswordFocused(true); resetKeystroke(); }}
                                    onBlur={() => setPasswordFocused(false)}
                                    {...getKeystrokeProps()}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                    placeholder="Min 8 chars, mixed case + number"
                                    autoComplete="new-password"
                                />
                                {/* Password strength bar */}
                                {form.password && (
                                    <div className="mt-2">
                                        <div className="flex gap-1 mb-1">
                                            {[1,2,3,4,5,6].map(i => (
                                                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-gray-200'}`} />
                                            ))}
                                        </div>
                                        <p className={`text-xs font-semibold ${strength.score <= 2 ? 'text-red-500' : strength.score <= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
                                            {strength.label}
                                        </p>
                                    </div>
                                )}
                                <KeystrokeIndicator isCapturing={passwordFocused} />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    value={form.confirmPassword}
                                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                    placeholder="Re-enter password"
                                    autoComplete="new-password"
                                />
                                {form.confirmPassword && form.password !== form.confirmPassword && (
                                    <p className="text-xs text-red-500 mt-1 font-medium"><i className="fa-solid fa-times-circle mr-1"></i>Passwords do not match</p>
                                )}
                                {form.confirmPassword && form.password === form.confirmPassword && (
                                    <p className="text-xs text-green-600 mt-1 font-medium"><i className="fa-solid fa-check-circle mr-1"></i>Passwords match</p>
                                )}
                            </div>

                            {/* Terms */}
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
                                <i className="fa-solid fa-gavel mr-1 text-gray-400"></i>
                                By registering, you certify that the information provided is true and correct. Misrepresentation of identity is a criminal offense under Section 171-F of the Indian Penal Code.
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="px-6 sm:px-8 py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        {step > 1 ? (
                            <button type="button" onClick={prevStep} className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition">
                                <i className="fa-solid fa-arrow-left mr-2"></i>Back
                            </button>
                        ) : (
                            <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
                                Already have an account? Login
                            </Link>
                        )}

                        {step < 3 ? (
                            <button type="button" onClick={nextStep} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition">
                                Next <i className="fa-solid fa-arrow-right ml-2"></i>
                            </button>
                        ) : (
                            <button type="submit" disabled={loading} className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                {loading ? (
                                    <><i className="fa-solid fa-spinner fa-spin"></i> Registering...</>
                                ) : (
                                    <><i className="fa-solid fa-user-check"></i> Complete Registration</>
                                )}
                            </button>
                        )}
                    </div>
                </form>

                {/* Security badges */}
                <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><i className="fa-solid fa-lock text-green-500"></i>256-bit Encryption</span>
                    <span className="flex items-center gap-1"><i className="fa-solid fa-fingerprint text-blue-500"></i>Keystroke Biometrics</span>
                    <span className="flex items-center gap-1"><i className="fa-solid fa-shield-halved text-primary"></i>GIGW 3.0 Compliant</span>
                </div>
            </div>
        </div>
    );
}

export default SignupPage;
