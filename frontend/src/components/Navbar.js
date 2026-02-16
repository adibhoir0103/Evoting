import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';

function Navbar({ user, onLogout }) {
    const [fontSize, setFontSize] = useState('normal');
    const [showLoginDropdown, setShowLoginDropdown] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        // Remove all font classes first
        document.body.classList.remove('font-small', 'font-normal', 'font-large', 'font-xlarge');
        document.body.classList.add(`font-${fontSize}`);
    }, [fontSize]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowLoginDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isLoggedIn = authService.isLoggedIn();

    return (
        <nav className="govt-navbar">
            {/* Top Bar - Accessibility Controls */}
            <div className="navbar-top">
                <div>
                    <a href="#main-content" className="skip-link">Skip to main content</a>
                    <span style={{
                        background: '#FF9933',
                        padding: '2px 8px',
                        borderRadius: '3px',
                        marginRight: '10px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                    }}>DEMO PROJECT</span>
                    <span>Bharat E-Vote | Blockchain Voting System (Final Year Project)</span>
                </div>
                <div className="accessibility-controls">
                    <span>Screen Reader Access</span>
                    <button
                        className={`font-btn ${fontSize === 'small' ? 'active' : ''}`}
                        onClick={() => setFontSize('small')}
                        title="Decrease font size"
                    >
                        A-
                    </button>
                    <button
                        className={`font-btn ${fontSize === 'normal' ? 'active' : ''}`}
                        onClick={() => setFontSize('normal')}
                        title="Normal font size"
                    >
                        A
                    </button>
                    <button
                        className={`font-btn ${fontSize === 'large' ? 'active' : ''}`}
                        onClick={() => setFontSize('large')}
                        title="Increase font size"
                    >
                        A+
                    </button>
                </div>
            </div>

            {/* Main Navbar */}
            <div className="navbar-main">
                <Link to="/" className="navbar-brand">
                    {/* Ashoka Stambh / Lion Capital */}
                    <img
                        src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg"
                        alt="National Emblem of India"
                    />
                    <div className="brand-text">
                        <span className="title">Bharat E-Vote</span>
                        <span className="subtitle">Blockchain Voting System | Final Year Project</span>
                    </div>
                </Link>

                <div className="navbar-actions">
                    <Link to="/" className="nav-link">Home</Link>
                    <Link to="/guidelines" className="nav-link">Voter Guidelines</Link>
                    <Link to="/help" className="nav-link">Help</Link>

                    {isLoggedIn && user ? (
                        <>
                            <span style={{ color: '#555' }}>
                                Welcome, {user.fullname}
                            </span>
                            <button className="btn btn-secondary" onClick={onLogout}>
                                Logout
                            </button>
                        </>
                    ) : (
                        <div className="login-dropdown" ref={dropdownRef} style={{ position: 'relative' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowLoginDropdown(!showLoginDropdown)}
                            >
                                <i className="fa-solid fa-right-to-bracket"></i> Login <i className="fa-solid fa-caret-down"></i>
                            </button>
                            {showLoginDropdown && (
                                <div
                                    className="dropdown-menu"
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '0.5rem',
                                        background: 'white',
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        minWidth: '180px',
                                        zIndex: 1000
                                    }}
                                >
                                    <Link
                                        to="/login"
                                        className="dropdown-item"
                                        onClick={() => setShowLoginDropdown(false)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem 1rem',
                                            color: '#000080',
                                            textDecoration: 'none',
                                            borderBottom: '1px solid #eee'
                                        }}
                                    >
                                        <i className="fa-solid fa-user"></i> Voter Login
                                    </Link>
                                    <Link
                                        to="/admin-login"
                                        className="dropdown-item"
                                        onClick={() => setShowLoginDropdown(false)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem 1rem',
                                            color: '#dc3545',
                                            textDecoration: 'none'
                                        }}
                                    >
                                        <i className="fa-solid fa-user-shield"></i> Admin Login
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default Navbar;

