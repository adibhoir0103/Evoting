import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

function SignupPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        fullname: '',
        voterId: '',
        email: '',
        aadhaarNumber: '',
        mobileNumber: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (formData.voterId.length < 10) {
            setError('Please enter a valid EPIC/Voter ID number');
            return;
        }

        setLoading(true);

        try {
            await authService.register(
                formData.fullname,
                formData.voterId,
                formData.email,
                formData.password,
                formData.aadhaarNumber,
                formData.mobileNumber
            );
            alert('Registration Successful! Redirecting to Login...');
            navigate('/login');
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
                <div className="auth-card">
                    <div className="auth-header">
                        <div style={{ fontSize: '3rem', color: '#000080', marginBottom: '1rem' }}>
                            <i className="fa-solid fa-user-plus"></i>
                        </div>
                        <h2>Voter Registration</h2>
                        <p>Create your secure voting account</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="fullname">
                                <i className="fa-solid fa-user"></i> Full Name (as per EPIC)
                            </label>
                            <input
                                type="text"
                                id="fullname"
                                value={formData.fullname}
                                onChange={handleChange}
                                placeholder="Enter your full name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="voterId">
                                <i className="fa-solid fa-id-card"></i> EPIC Number (Voter ID)
                            </label>
                            <input
                                type="text"
                                id="voterId"
                                value={formData.voterId}
                                onChange={handleChange}
                                placeholder="e.g., ABC1234567"
                                required
                            />
                            <small style={{ color: '#777', fontSize: '0.8rem' }}>
                                Your 10-character alphanumeric Voter ID
                            </small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">
                                <i className="fa-solid fa-envelope"></i> Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="voter@example.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="aadhaarNumber">
                                <i className="fa-solid fa-fingerprint"></i> Aadhaar Number
                            </label>
                            <input
                                type="text"
                                id="aadhaarNumber"
                                value={formData.aadhaarNumber}
                                onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                                placeholder="Enter 12-digit Aadhaar number"
                                maxLength="12"
                                required
                            />
                            <small style={{ color: '#777', fontSize: '0.8rem' }}>
                                Required for Aadhaar OTP login
                            </small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="mobileNumber">
                                <i className="fa-solid fa-mobile"></i> Mobile Number
                            </label>
                            <input
                                type="text"
                                id="mobileNumber"
                                value={formData.mobileNumber}
                                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                placeholder="Enter 10-digit mobile number"
                                maxLength="10"
                                required
                            />
                            <small style={{ color: '#777', fontSize: '0.8rem' }}>
                                OTP will be sent to this number
                            </small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">
                                <i className="fa-solid fa-lock"></i> Create Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Minimum 6 characters"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">
                                <i className="fa-solid fa-lock"></i> Confirm Password
                            </label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Re-enter password"
                                required
                            />
                        </div>

                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            background: '#f0f7ff',
                            border: '1px solid #000080',
                            borderRadius: '4px',
                            fontSize: '0.85rem'
                        }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                                <input type="checkbox" required style={{ marginTop: '4px' }} />
                                <span>
                                    I hereby declare that I am an eligible voter and the information provided is accurate.
                                    I understand that providing false information is punishable under IPC Section 171D.
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block btn-lg"
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : 'Register as Voter'}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>Already registered? <Link to="/login">Login here</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SignupPage;
