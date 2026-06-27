import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { indianStates } from '../utils/indianStates';
import { Turnstile } from '@marsidev/react-turnstile';
import { API_URL } from '../config/api';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

function SignupPage() {
    const [step, setStep] = useState(1); // 1: Identity, 2: Personal Details
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submittedName, setSubmittedName] = useState('');
    const [turnstileToken, setTurnstileToken] = useState('');

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
        address: ''
    });

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (error) setError('');
    };

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
            default:
                return null;
        }
    };

    const nextStep = () => {
        const err = validateStep(step);
        if (err) { setError(err); return; }
        setError('');
        setStep(s => s + 1);
    };

    const prevStep = () => { setError(''); setStep(s => s - 1); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (step === 1) {
            nextStep();
            return;
        }

        const err1 = validateStep(1);
        const err2 = validateStep(2);
        if (err1) { setStep(1); setError(err1); return; }
        if (err2) { setError(err2); return; }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_URL}/auth/register`, { credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullname: form.fullname.trim(),
                    email: form.email.trim().toLowerCase(),
                    voter_id: form.voter_id.trim().toUpperCase(),
                    aadhaar_number: form.aadhaar_number ? form.aadhaar_number.replace(/\s/g, '') : undefined,
                    father_name: form.father_name || undefined,
                    gender: form.gender || undefined,
                    dob: form.dob || undefined,
                    mobile_number: form.mobile_number || undefined,
                    state_code: form.state_code || undefined,
                    constituency_code: form.constituency_code || undefined,
                    address: form.address || undefined,
                    turnstileToken
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');

            setSubmittedName(form.fullname.trim());
            setSubmitted(true);
            toast.success('Application submitted successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Success / Confirmation Screen ───────────────────────────────────────
    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-gray-50 flex flex-col">
                <Helmet>
                    <title>Application Submitted | Bharat E-Vote Portal</title>
                    <meta name="description" content="Your voter registration application has been submitted for review." />
                </Helmet>
                <div className="h-1.5 bg-gradient-to-r from-accent-saffron via-white to-accent-green" />
                <div className="flex-grow flex items-center justify-center px-4 py-12">
                    <div className="w-full max-w-lg text-center">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 border-4 border-green-200 shadow-lg mb-6">
                            <i className="fa-solid fa-circle-check text-green-600 text-4xl" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Application Submitted!</h1>
                        <p className="text-gray-500 mb-8">Your voter registration is under review.</p>

                        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-left space-y-5">
                            <div className="flex items-start gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                                <i className="fa-solid fa-envelope-open-text text-green-600 text-2xl mt-1" />
                                <div>
                                    <p className="font-bold text-green-800">Watch your inbox</p>
                                    <p className="text-sm text-green-700 mt-1">
                                        Namaste, <strong>{submittedName}</strong>! Once an Election Officer reviews and approves your application, you will receive an email at <strong>{form.email}</strong> containing your <strong>Voter ID and a temporary password</strong>.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {[
                                    { icon: 'fa-user-check', color: 'text-blue-600', bg: 'bg-blue-50', title: 'Step 1 — Admin Review', desc: 'Your application details are being verified by an Election Officer.' },
                                    { icon: 'fa-envelope', color: 'text-orange-600', bg: 'bg-orange-50', title: 'Step 2 — Receive Credentials', desc: 'You\'ll get an email with your temporary login password.' },
                                    { icon: 'fa-key', color: 'text-purple-600', bg: 'bg-purple-50', title: 'Step 3 — Set Your Password', desc: 'On first login, you\'ll be prompted to create a permanent password.' },
                                    { icon: 'fa-vote-yea', color: 'text-green-600', bg: 'bg-green-50', title: 'Step 4 — Vote!', desc: 'Complete MFA verification and cast your vote securely.' }
                                ].map((s, i) => (
                                    <div key={i} className={`flex items-start gap-3 p-3 ${s.bg} rounded-lg`}>
                                        <i className={`fa-solid ${s.icon} ${s.color} mt-0.5`} />
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">{s.title}</p>
                                            <p className="text-xs text-gray-600 mt-0.5">{s.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                                <i className="fa-solid fa-clock mr-2" />
                                <strong>Processing Time:</strong> Applications are typically reviewed within 1-2 working days. If you haven't received an email within 3 days, please contact your local Election Officer or call ECI Helpline <strong>1950</strong>.
                            </div>
                        </div>

                        <div className="mt-6">
                            <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-primary border-2 border-primary hover:bg-primary hover:text-white transition">
                                <i className="fa-solid fa-right-to-bracket" /> Go to Login
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Registration Form ────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
            <Helmet>
                <title>Voter Registration | Bharat E-Vote Portal</title>
                <meta name="description" content="Apply for voter registration on the Bharat E-Vote Portal. Submit your details for admin approval." />
            </Helmet>
            <div className="h-1.5 bg-gradient-to-r from-accent-saffron via-white to-accent-green" />

            <div className="max-w-2xl mx-auto px-4 py-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                        <i className="fa-solid fa-user-plus text-primary text-2xl" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Voter Registration</h1>
                    <p className="text-gray-500 mt-2">Submit your application for admin approval</p>
                </div>

                {/* Info Banner */}
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <i className="fa-solid fa-info-circle text-blue-500 mt-0.5" />
                    <p className="text-sm text-blue-700">
                        <strong>How it works:</strong> Fill in your details and submit. An Election Officer will review your application. Once approved, you'll receive your login credentials via email.
                    </p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {[
                        { num: 1, label: 'Identity', icon: 'fa-id-card' },
                        { num: 2, label: 'Details', icon: 'fa-address-card' }
                    ].map((s, i) => (
                        <React.Fragment key={s.num}>
                            {i > 0 && <div className={`h-0.5 w-12 ${step >= s.num ? 'bg-primary' : 'bg-gray-200'} transition-colors`} />}
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                step === s.num ? 'bg-primary text-white shadow-lg shadow-primary/30' :
                                step > s.num ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                            }`}>
                                <i className={`fa-solid ${step > s.num ? 'fa-check' : s.icon} text-xs`} />
                                <span className="hidden sm:inline">{s.label}</span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3" role="alert">
                        <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5" />
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                )}

                {/* Form Card */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

                    {/* Step 1: Identity */}
                    {step === 1 && (
                        <div className="p-6 sm:p-8 space-y-5">
                            <div className="flex items-center gap-2 text-primary font-bold text-lg mb-2">
                                <i className="fa-solid fa-id-card" /> Identity Verification
                            </div>

                            <div>
                                <label htmlFor="signup-fullname" className="block text-sm font-semibold text-gray-700 mb-1">Full Name (as on EPIC) <span className="text-red-500">*</span></label>
                                <input id="signup-fullname" type="text" value={form.fullname}
                                    onChange={(e) => updateField('fullname', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                    placeholder="Enter your full name" autoFocus aria-required="true" />
                            </div>

                            <div>
                                <label htmlFor="signup-email" className="block text-sm font-semibold text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                                <input id="signup-email" type="email" value={form.email}
                                    onChange={(e) => updateField('email', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                    placeholder="voter@example.com" aria-required="true" />
                                <p className="text-xs text-gray-400 mt-1"><i className="fa-solid fa-info-circle mr-1" />Your login credentials will be sent to this email after approval</p>
                            </div>

                            <div>
                                <label htmlFor="signup-voterid" className="block text-sm font-semibold text-gray-700 mb-1">Voter ID (EPIC Number) <span className="text-red-500">*</span></label>
                                <input id="signup-voterid" type="text" value={form.voter_id}
                                    onChange={(e) => updateField('voter_id', e.target.value.toUpperCase())}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm font-mono tracking-wider"
                                    placeholder="ABC1234567" maxLength={10} aria-required="true" />
                                <p className="text-xs text-gray-400 mt-1">3 letters + 7 digits, as printed on your Voter ID card</p>
                            </div>

                            <div>
                                <label htmlFor="signup-aadhaar" className="block text-sm font-semibold text-gray-700 mb-1">Aadhaar Number</label>
                                <input id="signup-aadhaar" type="text" value={form.aadhaar_number}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                                        updateField('aadhaar_number', val);
                                    }}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm font-mono tracking-wider"
                                    placeholder="XXXX XXXX XXXX" maxLength={12} />
                                <p className="text-xs text-gray-400 mt-1"><i className="fa-solid fa-lock mr-1" />Hashed with HMAC-SHA256 before storage</p>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Personal Details */}
                    {step === 2 && (
                        <div className="p-6 sm:p-8 space-y-5">
                            <div className="flex items-center gap-2 text-primary font-bold text-lg mb-2">
                                <i className="fa-solid fa-address-card" /> Personal Details
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="signup-fathername" className="block text-sm font-semibold text-gray-700 mb-1">Father's Name</label>
                                    <input id="signup-fathername" type="text" value={form.father_name}
                                        onChange={(e) => updateField('father_name', e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        placeholder="Father's full name" />
                                </div>
                                <div>
                                    <label htmlFor="signup-gender" className="block text-sm font-semibold text-gray-700 mb-1">Gender</label>
                                    <select id="signup-gender" value={form.gender} onChange={(e) => updateField('gender', e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm bg-white">
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="signup-dob" className="block text-sm font-semibold text-gray-700 mb-1">Date of Birth</label>
                                    <input id="signup-dob" type="date" value={form.dob}
                                        onChange={(e) => updateField('dob', e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]} />
                                </div>
                                <div>
                                    <label htmlFor="signup-mobile" className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
                                    <input id="signup-mobile" type="tel" value={form.mobile_number}
                                        onChange={(e) => updateField('mobile_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        placeholder="10-digit mobile" maxLength={10} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="signup-state" className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                                    <select id="signup-state" value={form.state_code} onChange={(e) => updateField('state_code', e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm bg-white">
                                        <option value="">Select State</option>
                                        {indianStates.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="signup-constituency" className="block text-sm font-semibold text-gray-700 mb-1">Constituency Code</label>
                                    <input id="signup-constituency" type="number" value={form.constituency_code}
                                        onChange={(e) => updateField('constituency_code', e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm"
                                        placeholder="e.g., 1" min="0" />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="signup-address" className="block text-sm font-semibold text-gray-700 mb-1">Residential Address</label>
                                <textarea id="signup-address" value={form.address}
                                    onChange={(e) => updateField('address', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition text-sm resize-none"
                                    rows={2} placeholder="Full residential address" />
                            </div>

                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
                                <i className="fa-solid fa-gavel mr-1 text-gray-400" />
                                By submitting this application, you certify that all information provided is true and correct. Misrepresentation is a criminal offense under Section 171-F of the Indian Penal Code.
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="px-6 sm:px-8 py-5 bg-gray-50 border-t border-gray-100 flex flex-col gap-4">
                        {step === 2 && (
                            <div className="flex justify-center w-full">
                                <Turnstile siteKey={TURNSTILE_SITE_KEY} onSuccess={(token) => setTurnstileToken(token)} options={{ theme: 'light' }} />
                            </div>
                        )}
                        <div className="flex items-center justify-between w-full">
                            {step > 1 ? (
                                <button type="button" onClick={prevStep} className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition">
                                    <i className="fa-solid fa-arrow-left mr-2" />Back
                                </button>
                            ) : (
                                <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
                                    Already have an account? Login
                                </Link>
                            )}

                            {step < 2 ? (
                                <button type="button" onClick={nextStep} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition">
                                    Next <i className="fa-solid fa-arrow-right ml-2" />
                                </button>
                            ) : (
                                <button type="submit" disabled={loading} className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                    {loading ? (
                                        <><i className="fa-solid fa-spinner fa-spin" /> Submitting...</>
                                    ) : (
                                        <><i className="fa-solid fa-paper-plane" /> Submit Application</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </form>

                {/* Security badges */}
                <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><i className="fa-solid fa-lock text-green-500" />256-bit Encrypted</span>
                    <span className="flex items-center gap-1"><i className="fa-solid fa-shield-halved text-primary" />GIGW 3.0 Compliant</span>
                    <span className="flex items-center gap-1"><i className="fa-solid fa-user-shield text-blue-500" />ECI Verified Process</span>
                </div>
            </div>
        </div>
    );
}

export default SignupPage;
