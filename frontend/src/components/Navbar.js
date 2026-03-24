import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';

function Navbar({ user, onLogout }) {
    const [fontSize, setFontSize] = useState('normal');
    const [showLoginDropdown, setShowLoginDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const location = useLocation();

    useEffect(() => {
        document.documentElement.classList.remove('font-small', 'font-normal', 'font-large', 'font-xlarge');
        document.documentElement.classList.add(`font-${fontSize}`);
    }, [fontSize]);

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
        <React.Fragment>
            {/* Accessibility Top Bar */}
            <div className="bg-gray-100 py-1 px-4 sm:px-6 lg:px-8 text-xs font-medium text-gray-600 border-b border-gray-200">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="flex items-center gap-3">
                        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:text-primary focus:p-2 focus:z-50">Skip to main content</a>
                        <span className="bg-accent-saffron text-white px-2 py-0.5 rounded font-bold text-[10px]">DEMO</span>
                        <span>भारत सरकार | Government of India</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="hidden sm:inline">Screen Reader Access</span>
                        <div className="flex bg-white rounded border border-gray-300 overflow-hidden">
                            <button className={`px-2 py-0.5 hover:bg-gray-100 ${fontSize === 'small' ? 'bg-gray-200 font-bold' : ''}`} onClick={() => setFontSize('small')} title="Decrease font size">A-</button>
                            <button className={`px-2 py-0.5 border-l border-r border-gray-300 hover:bg-gray-100 ${fontSize === 'normal' ? 'bg-gray-200 font-bold' : ''}`} onClick={() => setFontSize('normal')} title="Normal font size">A</button>
                            <button className={`px-2 py-0.5 hover:bg-gray-100 ${fontSize === 'large' ? 'bg-gray-200 font-bold' : ''}`} onClick={() => setFontSize('large')} title="Increase font size">A+</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Navbar */}
            <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20">
                        {/* Logo & Brand */}
                        <div className="flex items-center">
                            <Link to="/" className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                                <img
                                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/220px-Emblem_of_India.svg.png"
                                    alt="Emblem of India"
                                    className="h-12 w-auto"
                                />
                                <div>
                                    <span className="block text-2xl font-bold text-primary leading-none">Bharat E-Vote</span>
                                    <span className="text-[11px] uppercase font-bold text-gray-500 tracking-wider">Election Commission of India</span>
                                </div>
                            </Link>
                        </div>

                        {/* Navigation Links & Actions */}
                        <div className="hidden md:flex items-center space-x-6">
                            <Link to="/" className={`text-sm font-semibold hover:text-primary transition-colors ${location.pathname === '/' ? 'text-primary border-b-2 border-primary pb-1' : 'text-gray-600'}`}>Home</Link>
                            <Link to="/guidelines" className={`text-sm font-semibold hover:text-primary transition-colors ${location.pathname === '/guidelines' ? 'text-primary border-b-2 border-primary pb-1' : 'text-gray-600'}`}>Guidelines</Link>
                            
                            {isLoggedIn && user && (
                                <Link to="/dashboard" className={`text-sm font-semibold hover:text-primary transition-colors ${location.pathname === '/dashboard' ? 'text-primary border-b-2 border-primary pb-1' : 'text-gray-600'}`}>Dashboard</Link>
                            )}

                            <div className="h-6 w-px bg-gray-300 mx-2"></div>

                            {isLoggedIn && user ? (
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold">
                                            {user.fullname ? user.fullname.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 hidden lg:block">Welcome, {user.fullname?.split(' ')[0]}</span>
                                    </div>
                                    <button onClick={onLogout} className="btn-secondary py-1.5 px-4 text-sm">
                                        <i className="fa-solid fa-arrow-right-from-bracket mr-2"></i>Logout
                                    </button>
                                </div>
                            ) : (
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setShowLoginDropdown(!showLoginDropdown)}
                                        className="btn-primary py-2 px-5 text-sm"
                                    >
                                        <i className="fa-solid fa-right-to-bracket mr-2"></i> Sign In <i className="fa-solid fa-caret-down ml-2"></i>
                                    </button>
                                    
                                    {showLoginDropdown && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50">
                                            <Link
                                                to="/login"
                                                className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary font-medium border-b border-gray-100 transition-colors"
                                                onClick={() => setShowLoginDropdown(false)}
                                            >
                                                <i className="fa-solid fa-user text-primary w-5"></i> Voter Login
                                            </Link>
                                            <Link
                                                to="/admin-login"
                                                className="block px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 font-medium transition-colors"
                                                onClick={() => setShowLoginDropdown(false)}
                                            >
                                                <i className="fa-solid fa-user-shield text-red-500 w-5"></i> Admin Login
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
        </React.Fragment>
    );
}

export default Navbar;
