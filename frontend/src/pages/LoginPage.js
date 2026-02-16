import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

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
    const [demoOTP, setDemoOTP] = useState(''); // For demo display

    // Traditional Login
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');

    // Common states
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');

    // OTP input refs
    const otpRefs = useRef([]);

    // Timer countdown
    useEffect(() => {
        if (otpTimer > 0) {
            const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [otpTimer]);

    // Format timer as MM:SS
    const formatTimer = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle OTP input
    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return; // Only numbers

        const newOtp = [...otp];
        newOtp[index] = value.slice(-1); // Only last digit
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    // Handle OTP backspace
    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    // Send OTP
    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const payload = {
                aadhaarNumber,
                method: otpMethod
            };

            // Add email or mobile based on method
            if (otpMethod === 'email') {
                payload.email = email;
            } else {
                payload.mobileNumber = mobileNumber;
            }

            const response = await fetch('http://localhost:5000/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send OTP');
            }

            setOtpSent(true);
            setOtpTimer(300); // 5 minutes
            setDemoOTP(data.demoOTP); // For demo
            setSuccess(data.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResendOTP = () => {
        setOtp(['', '', '', '', '', '']);
        setOtpSent(false);
        setDemoOTP('');
    };

    // Verify OTP and Login
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
            const response = await fetch('http://localhost:5000/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aadhaarNumber, otp: otpCode })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'OTP verification failed');
            }

            // Store token and user
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            onLogin(data.user);
            navigate('/');
        } catch (err) {
            setError(err.message);
            setOtp(['', '', '', '', '', '']); // Clear OTP on error
            otpRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    // Traditional Login
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
        <div className="auth-page">
            {/* Simplified Navbar for Auth Pages */}
            <nav className="govt-navbar">
                <div className="navbar-top">
                    <span style={{ background: '#FF9933', padding: '2px 8px', borderRadius: '3px', marginRight: '10px', fontSize: '0.75rem', fontWeight: '600' }}>DEMO</span>
                    <span>Bharat E-Vote | Blockchain Voting System</span>
                </div>
                <div className="navbar-main">
                    <Link to="/" className="navbar-brand">
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg"
                            alt="National Emblem of India"
                        />
                        <div className="brand-text">
                            <span className="title">Bharat E-Vote</span>
                            <span className="subtitle">Final Year Project</span>
                        </div>
                    </Link>
                    <Link to="/" className="btn btn-secondary">
                        <i className="fa-solid fa-arrow-left"></i> Back to Home
                    </Link>
                </div>
            </nav>

            <div className="auth-container">
                <div className="auth-card" style={{ maxWidth: '550px' }}>
                    <div className="auth-header">
                        <div style={{ fontSize: '3rem', color: '#000080', marginBottom: '1rem' }}>
                            <i className="fa-solid fa-user-shield"></i>
                        </div>
                        <h2>Sign in to your account</h2>
                        <p>Choose your preferred login method</p>
                    </div>

                    {/* Login Mode Selector - Inspired by RRB */}
                    <div style={{ marginBottom: '2rem' }}>
                        <button
                            onClick={() => { setLoginMode('aadhaar'); setError(''); setSuccess(''); }}
                            className="btn btn-block"
                            style={{
                                background: loginMode === 'aadhaar' ? '#FF9933' : '#fff',
                                color: loginMode === 'aadhaar' ? '#fff' : '#000080',
                                border: '2px solid #FF9933',
                                marginBottom: '0.75rem'
                            }}
                        >
                            <i className="fa-solid fa-fingerprint"></i> Login with Aadhaar
                        </button>
                        <button
                            onClick={() => { setLoginMode('credential'); setError(''); setSuccess(''); }}
                            className="btn btn-block"
                            style={{
                                background: loginMode === 'credential' ? '#000080' : '#fff',
                                color: loginMode === 'credential' ? '#fff' : '#000080',
                                border: '2px solid #000080'
                            }}
                        >
                            <i className="fa-solid fa-key"></i> Login with Account Credential
                        </button>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    {/* AADHAAR OTP LOGIN */}
                    {loginMode === 'aadhaar' && (
                        !otpSent ? (
                            <form onSubmit={handleSendOTP}>
                                <div className="form-group">
                                    <label htmlFor="aadhaar">
                                        <i className="fa-solid fa-id-card"></i> Aadhaar Number
                                    </label>
                                    <input
                                        type="text"
                                        id="aadhaar"
                                        value={aadhaarNumber}
                                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                                        placeholder="Enter 12-digit Aadhaar number"
                                        maxLength="12"
                                        required
                                    />
                                </div>

                                {/* OTP Method Selector */}
                                <div className="form-group">
                                    <label>
                                        <i className="fa-solid fa-paper-plane"></i> Send OTP via
                                    </label>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: 1, padding: '0.75rem', border: `2px solid ${otpMethod === 'email' ? '#000080' : '#dee2e6'}`, borderRadius: '6px', background: otpMethod === 'email' ? '#f0f7ff' : 'white' }}>
                                            <input
                                                type="radio"
                                                name="otpMethod"
                                                value="email"
                                                checked={otpMethod === 'email'}
                                                onChange={(e) => setOtpMethod(e.target.value)}
                                                style={{ marginRight: '0.5rem' }}
                                            />
                                            <i className="fa-solid fa-envelope" style={{ marginRight: '0.5rem', color: '#000080' }}></i>
                                            Email (Primary)
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: 1, padding: '0.75rem', border: `2px solid ${otpMethod === 'mobile' ? '#000080' : '#dee2e6'}`, borderRadius: '6px', background: otpMethod === 'mobile' ? '#f0f7ff' : 'white' }}>
                                            <input
                                                type="radio"
                                                name="otpMethod"
                                                value="mobile"
                                                checked={otpMethod === 'mobile'}
                                                onChange={(e) => setOtpMethod(e.target.value)}
                                                style={{ marginRight: '0.5rem' }}
                                            />
                                            <i className="fa-solid fa-mobile" style={{ marginRight: '0.5rem', color: '#000080' }}></i>
                                            Mobile (Backup)
                                        </label>
                                    </div>
                                </div>

                                {/* Email or Mobile input based on method */}
                                {otpMethod === 'email' ? (
                                    <div className="form-group">
                                        <label htmlFor="email">
                                            <i className="fa-solid fa-envelope"></i> Registered Email
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your registered email"
                                            required
                                        />
                                        <small style={{ color: '#777', fontSize: '0.8rem' }}>
                                            OTP will be sent to this email
                                        </small>
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label htmlFor="mobile">
                                            <i className="fa-solid fa-mobile"></i> Registered Mobile Number
                                        </label>
                                        <input
                                            type="text"
                                            id="mobile"
                                            value={mobileNumber}
                                            onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            placeholder="Enter 10-digit mobile number"
                                            maxLength="10"
                                            required
                                        />
                                        <small style={{ color: '#777', fontSize: '0.8rem' }}>
                                            OTP will be sent via SMS
                                        </small>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-block btn-lg"
                                    disabled={loading || aadhaarNumber.length !== 12 || (otpMethod === 'email' ? !email : mobileNumber.length !== 10)}
                                >
                                    {loading ? 'Sending OTP...' : `Generate OTP via ${otpMethod === 'email' ? 'Email' : 'SMS'}`}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleOTPLogin}>
                                <div className="form-group">
                                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>
                                            <i className="fa-solid fa-key"></i> Enter OTP
                                            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#777' }}>
                                                (sent via {otpMethod === 'email' ? 'Email' : 'SMS'})
                                            </span>
                                        </span>
                                        {otpTimer > 0 && (
                                            <span style={{ color: '#FF9933', fontSize: '0.9rem', fontWeight: '600' }}>
                                                <i className="fa-solid fa-clock"></i> {formatTimer(otpTimer)}
                                            </span>
                                        )}
                                    </label>

                                    {/* 6 OTP Boxes - RRB Style */}
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', margin: '1rem 0' }}>
                                        {otp.map((digit, index) => (
                                            <input
                                                key={index}
                                                ref={(el) => otpRefs.current[index] = el}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength="1"
                                                value={digit}
                                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                                style={{
                                                    width: '50px',
                                                    height: '50px',
                                                    textAlign: 'center',
                                                    fontSize: '1.5rem',
                                                    fontWeight: '700',
                                                    border: '2px solid #000080',
                                                    borderRadius: '8px',
                                                    outline: 'none'
                                                }}
                                                required
                                            />
                                        ))}
                                    </div>

                                    {/* Demo OTP Display */}
                                    {demoOTP && (
                                        <div style={{
                                            background: '#fff8e6',
                                            border: '1px solid #ffc107',
                                            padding: '0.75rem',
                                            borderRadius: '4px',
                                            marginTop: '1rem',
                                            fontSize: '0.9rem',
                                            color: '#856404',
                                            textAlign: 'center'
                                        }}>
                                            <i className="fa-solid fa-info-circle"></i> <strong>Demo OTP:</strong> {demoOTP}
                                            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
                                                Check backend console or {otpMethod === 'email' ? 'your email' : 'your phone'}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-block btn-lg"
                                    disabled={loading || otp.some(d => !d)}
                                >
                                    {loading ? 'Verifying...' : 'Login'}
                                </button>

                                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                                    {otpTimer > 0 ? (
                                        <p style={{ color: '#777', fontSize: '0.9rem' }}>
                                            Didn't receive OTP? Resend in {formatTimer(otpTimer)}
                                        </p>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleResendOTP}
                                            className="btn btn-secondary"
                                        >
                                            <i className="fa-solid fa-rotate"></i> Resend OTP
                                        </button>
                                    )}
                                </div>
                            </form>
                        )
                    )}

                    {/* TRADITIONAL LOGIN */}
                    {loginMode === 'credential' && (
                        <form onSubmit={handleTraditionalLogin}>
                            <div className="form-group">
                                <label htmlFor="identifier">
                                    <i className="fa-solid fa-user"></i> Email / Voter ID
                                </label>
                                <input
                                    type="text"
                                    id="identifier"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="Enter email or voter ID"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">
                                    <i className="fa-solid fa-lock"></i> Password
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-block btn-lg"
                                disabled={loading}
                            >
                                {loading ? 'Logging in...' : 'Login'}
                            </button>
                        </form>
                    )}

                    <div className="auth-footer">
                        <p>New voter? <Link to="/signup">Register here</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
