import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

function AdminLoginPage({ onAdminLogin }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Admin login failed');
            }

            localStorage.setItem('adminToken', data.token);
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

    return (
        <div className="auth-page">

            <div className="auth-container">
                <div className="auth-card" style={{ maxWidth: '450px' }}>
                    <div className="auth-header">
                        <div style={{ fontSize: '3rem', color: '#dc3545', marginBottom: '1rem' }}>
                            <i className="fa-solid fa-user-shield"></i>
                        </div>
                        <h2>Admin Login</h2>
                        <p>Election Commission Officer Access Only</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="email">
                                <i className="fa-solid fa-envelope"></i> Admin Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@evote.com"
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
                                placeholder="Enter admin password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-block btn-lg"
                            disabled={loading}
                            style={{ background: '#dc3545', color: 'white', border: 'none' }}
                        >
                            {loading ? 'Authenticating...' : 'Login as Admin'}
                        </button>
                    </form>

                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fff3cd', borderRadius: '4px', fontSize: '0.85rem' }}>
                        <strong><i className="fa-solid fa-info-circle"></i> Authorized Personnel Only</strong>
                        <br />Contact System Administrator for credentials.
                    </div>

                    <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
                        <p>Are you a voter? <Link to="/login">Voter Login</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminLoginPage;
