import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';

function AdminLoginPage({ onAdminLogin }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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
        <section className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-gray-50">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="gov-card p-8">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border-2 border-red-200">
                            <i className="fa-solid fa-user-shield text-2xl"></i>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Admin Login</h1>
                        <p className="text-gray-500 text-sm mt-1">Election Commission Officer Access Only</p>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded text-sm mb-4">
                            <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                    </form>

                    {/* Security Notice */}
                    <div className="mt-5 bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm text-yellow-800">
                        <i className="fa-solid fa-shield-halved mr-2"></i>
                        <strong>Authorized Personnel Only</strong>
                        <br />
                        <span className="text-xs">Contact System Administrator for credentials. All login attempts are logged and monitored.</span>
                    </div>

                    {/* Voter Login Link */}
                    <div className="mt-5 text-center pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-500">
                            Are you a voter? <Link to="/dashboard" className="text-primary font-semibold hover:underline">Voter Dashboard →</Link>
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default AdminLoginPage;
