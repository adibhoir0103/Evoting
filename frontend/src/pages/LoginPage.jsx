import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

function LoginPage({ onLogin }) {
    const navigate = useNavigate();

    // Login mode: 'aadhaar' or 'credential'
    const [loginMode, setLoginMode] = useState('aadhaar');

    // OTP delivery method: 'email' or 'mobile'
    const [otpMethod, setOtpMethod] = useState('email');

    // Aadhaar OTP Login
    const [aadhaarNumber, setAadhaarNumber] = useState('');
    const [email, setEmail] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [otpSent, setOtpSent] = useState(false);
    const [otpTimer, setOtpTimer] = useState(0);
    const [demoOTP, setDemoOTP] = useState('');

    // Traditional Login
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');

    // Common states
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

    // OTP input refs
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

    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
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

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const payload = { aadhaarNumber, method: otpMethod };
            if (otpMethod === 'email') payload.email = email;
            else payload.mobileNumber = mobileNumber;

            const response = await fetch(`${API_URL}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to send OTP');

            setOtpSent(true);
            setOtpTimer(300);
            setDemoOTP(data.demoOTP);
            setSuccess(data.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = () => {
        setOtp(['', '', '', '', '', '']);
        setOtpSent(false);
        setDemoOTP('');
    };

    const handleOTPLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const otpCode = otp.join('');
        if (otpCode.length !== 6) {
            setError('Please enter complete 6-digit OTP');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aadhaarNumber, otp: otpCode })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'OTP verification failed');

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            onLogin(data.user);
            navigate('/');
        } catch (err) {
            setError(err.message);
            setOtp(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleTraditionalLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authService.login(identifier, password);
            onLogin(response.user);
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gov-bg flex flex-col font-sans">

            <main className="flex-grow p-4 py-8 md:py-12">
                <div className="gov-card max-w-lg w-full mx-auto p-8 shadow-xl">
                    <div className="text-center mb-8">
                        <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-blue-50 text-primary mb-4 border border-blue-100 shadow-inner">
                            <i className="fa-solid fa-user-shield text-2xl"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Sign in to your account</h2>
                        <p className="text-gray-500 mt-2">Choose your preferred secure login method</p>
                    </div>

                    {/* Mode Selector */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-8">
                        <button
                            onClick={() => { setLoginMode('aadhaar'); setError(''); setSuccess(''); }}
                            className={`flex-1 py-3 px-4 rounded-lg font-semibold border-2 transition-colors flex items-center justify-center gap-2 ${
                                loginMode === 'aadhaar' 
                                ? 'bg-accent-saffron border-accent-saffron text-white shadow-md' 
                                : 'bg-white border-gray-200 text-gray-600 hover:border-accent-saffron/50 hover:bg-orange-50'
                            }`}
                        >
                            <i className="fa-solid fa-fingerprint"></i> Aadhaar Login
                        </button>
                        <button
                            onClick={() => { setLoginMode('credential'); setError(''); setSuccess(''); }}
                            className={`flex-1 py-3 px-4 rounded-lg font-semibold border-2 transition-colors flex items-center justify-center gap-2 ${
                                loginMode === 'credential' 
                                ? 'bg-primary border-primary text-white shadow-md' 
                                : 'bg-white border-gray-200 text-gray-600 hover:border-primary/50 hover:bg-blue-50'
                            }`}
                        >
                            <i className="fa-solid fa-key"></i> Passcode Login
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r">
                            <div className="flex">
                                <div className="flex-shrink-0"><i className="fa-solid fa-circle-exclamation text-red-500"></i></div>
                                <div className="ml-3"><p className="text-sm text-red-700">{error}</p></div>
                            </div>
                        </div>
                    )}
                    
                    {success && (
                        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-r">
                            <div className="flex">
                                <div className="flex-shrink-0"><i className="fa-solid fa-circle-check text-green-500"></i></div>
                                <div className="ml-3"><p className="text-sm text-green-700">{success}</p></div>
                            </div>
                        </div>
                    )}

                    {/* AADHAAR LOGIN */}
                    {loginMode === 'aadhaar' && (
                        !otpSent ? (
                            <form onSubmit={handleSendOTP} className="space-y-5">
                                <div>
                                    <label htmlFor="aadhaar" className="block text-sm font-semibold text-gray-700 mb-1">
                                        <i className="fa-solid fa-id-card text-gray-400 mr-2"></i>Aadhaar Number
                                    </label>
                                    <input
                                        type="text"
                                        id="aadhaar"
                                        className="input-field text-center tracking-widest text-lg font-mono placeholder-gray-300"
                                        value={aadhaarNumber}
                                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                                        placeholder="XXXX XXXX XXXX"
                                        maxLength="12"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        <i className="fa-solid fa-paper-plane text-gray-400 mr-2"></i>Send OTP via
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${otpMethod === 'email' ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                            <input
                                                type="radio"
                                                name="otpMethod"
                                                value="email"
                                                className="sr-only"
                                                checked={otpMethod === 'email'}
                                                onChange={(e) => setOtpMethod(e.target.value)}
                                            />
                                            <i className="fa-solid fa-envelope w-6 text-center shadow-none"></i>
                                            <span className="font-medium text-sm">Email</span>
                                        </label>
                                        <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${otpMethod === 'mobile' ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                            <input
                                                type="radio"
                                                name="otpMethod"
                                                value="mobile"
                                                className="sr-only"
                                                checked={otpMethod === 'mobile'}
                                                onChange={(e) => setOtpMethod(e.target.value)}
                                            />
                                            <i className="fa-solid fa-mobile-screen w-6 text-center shadow-none"></i>
                                            <span className="font-medium text-sm">Mobile SMS</span>
                                        </label>
                                    </div>
                                </div>

                                {otpMethod === 'email' ? (
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
                                            <i className="fa-solid fa-at text-gray-400 mr-2"></i>Registered Email
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            className="input-field"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your registered email"
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor="mobile" className="block text-sm font-semibold text-gray-700 mb-1">
                                            <i className="fa-solid fa-phone text-gray-400 mr-2"></i>Registered Mobile
                                        </label>
                                        <div className="flex relative">
                                            <span className="inline-flex flex-shrink-0 items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 font-medium">+91</span>
                                            <input
                                                type="text"
                                                id="mobile"
                                                className="input-field rounded-l-none"
                                                value={mobileNumber}
                                                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                placeholder="Enter 10-digit number"
                                                maxLength="10"
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn-primary w-full py-3.5 text-lg mt-2 flex items-center justify-center gap-2"
                                    disabled={loading || aadhaarNumber.length !== 12 || (otpMethod === 'email' ? !email : mobileNumber.length !== 10)}
                                >
                                    {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-shield-check"></i>}
                                    {loading ? 'Sending Request...' : 'Generate Secure OTP'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleOTPLogin} className="space-y-6">
                                <div>
                                    <div className="flex justify-between items-end mb-4">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            Enter 6-digit OTP
                                            <span className="block text-xs text-gray-500 font-normal mt-0.5">Sent via {otpMethod === 'email' ? 'Email' : 'SMS'}</span>
                                        </label>
                                        {otpTimer > 0 && (
                                            <span className="text-accent-saffron font-mono font-bold text-lg bg-orange-50 px-2 rounded border border-orange-100">
                                                {formatTimer(otpTimer)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex justify-between gap-2 max-w-sm mx-auto">
                                        {otp.map((digit, index) => (
                                            <input
                                                key={index}
                                                ref={(el) => otpRefs.current[index] = el}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength="1"
                                                className="w-12 h-14 text-center text-2xl font-bold text-primary border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-colors shadow-sm"
                                                value={digit}
                                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                                required
                                            />
                                        ))}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn-primary w-full py-3.5 text-lg flex items-center justify-center gap-2"
                                    disabled={loading || otp.some(d => !d)}
                                >
                                    {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-unlock-keyhole"></i>}
                                    {loading ? 'Verifying Identity...' : 'Secure Login'}
                                </button>

                                <div className="text-center pt-2">
                                    {otpTimer > 0 ? (
                                        <p className="text-sm text-gray-500">
                                            Didn't receive OTP? Resend in <span className="font-semibold text-gray-700">{formatTimer(otpTimer)}</span>
                                        </p>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleResendOTP}
                                            className="text-primary hover:text-primary-800 font-semibold text-sm underline focus:outline-none"
                                        >
                                            <i className="fa-solid fa-rotate-right mr-1"></i> Resend OTP Request
                                        </button>
                                    )}
                                </div>
                            </form>
                        )
                    )}

                    {/* TRADITIONAL LOGIN */}
                    {loginMode === 'credential' && (
                        <form onSubmit={handleTraditionalLogin} className="space-y-5">
                            <div>
                                <label htmlFor="identifier" className="block text-sm font-semibold text-gray-700 mb-1">
                                    <i className="fa-solid fa-user text-gray-400 mr-2"></i>Email Address / EPIC Number
                                </label>
                                <input
                                    type="text"
                                    id="identifier"
                                    className="input-field"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="Enter your registered email or Voter ID"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                                    <i className="fa-solid fa-lock text-gray-400 mr-2"></i>Account Password
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    className="input-field"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn-primary w-full py-3.5 text-lg mt-4 flex items-center justify-center gap-2"
                                disabled={loading || !identifier || !password}
                            >
                                {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-right-to-bracket"></i>}
                                {loading ? 'Authenticating...' : 'Sign In'}
                            </button>
                        </form>
                    )}

                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                        <p className="text-gray-600">
                            Don't have a voting account?{' '}
                            <Link to="/signup" className="text-accent-saffron font-bold hover:underline focus:outline-none">
                                Register as a New Voter
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default LoginPage;
