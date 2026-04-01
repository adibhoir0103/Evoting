import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/authService';

function Navbar({ user, onLogout, isAdmin }) {
    const [fontSize, setFontSize] = useState('normal');
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const [showLoginDropdown, setShowLoginDropdown] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const dropdownRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(''), 4000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    useEffect(() => {
        document.documentElement.classList.remove('font-small', 'font-normal', 'font-large', 'font-xlarge');
        document.documentElement.classList.add(`font-${fontSize}`);
    }, [fontSize]);

    // Dark mode persistence
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('darkMode', darkMode);
    }, [darkMode]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowLoginDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    const isLoggedIn = authService.isLoggedIn();
    const isAdminUser = isAdmin || localStorage.getItem('adminToken');

    const navLinkClass = (path) => `text-sm font-semibold hover:text-primary transition-colors ${location.pathname === path ? 'text-primary border-b-2 border-primary pb-1' : 'text-gray-600'}`;

    // Mobile Accessibility Focus Trap
    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.setAttribute('aria-hidden', mobileMenuOpen.toString());
            document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
        }
    }, [mobileMenuOpen]);

    return (
        <>
            {/* Accessibility Top Bar (Unified GIGW 3.0) */}
            <div className="bg-slate-900 border-b border-slate-800 text-[10px] md:text-xs font-semibold text-gray-200 py-2 z-50 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
                    {/* Left: Skip to Main content & Government Tag */}
                    <div className="flex items-center gap-3">
                        <span className="bg-accent-saffron text-white px-2 py-0.5 rounded font-bold text-[10px] tracking-wider hidden sm:inline-block">DEMO</span>
                        <a href="#main-content" className="hover:text-white transition-colors focus:ring-2 focus:ring-accent-saffron rounded px-1">Skip to Main Content</a>
                        <span className="text-gray-600 hidden sm:inline-block">|</span>
                        <div className="flex items-center gap-1.5 opacity-90">
                            <i className="fa-solid fa-flag text-[10px] text-accent-saffron"></i> 
                            <span className="font-bold">भारत सरकार</span> 
                            <span className="font-normal mx-0.5">/</span> 
                            <span>GOVERNMENT OF INDIA</span>
                        </div>
                    </div>
                    
                    {/* Right: Accessibility Controls & Language */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        {/* Language Toggler */}
                        <div className="flex items-center">
                            <i className="fa-solid fa-language text-accent-saffron mr-1.5 text-sm"></i>
                            <select 
                                className="bg-slate-800 border-none text-white text-[10px] md:text-xs font-semibold py-0.5 pl-1 pr-6 rounded focus:ring-1 focus:ring-accent-saffron cursor-pointer"
                                onChange={(e) => changeLanguage(e.target.value)}
                                value={i18n.language || 'en'}
                                aria-label="Select Language"
                            >
                                <option value="en">English</option>
                                <option value="hi">हिंदी (Hindi)</option>
                                <option value="mr">मराठी (Marathi)</option>
                            </select>
                        </div>
                        <span className="hidden lg:inline text-gray-400 font-medium">Screen Reader Access</span>
                        
                        {/* Font Resizer */}
                        <div className="flex items-center bg-slate-800 border border-slate-700 rounded overflow-hidden">
                            <button 
                                onClick={() => setFontSize('small')} 
                                className={`px-2 py-0.5 hover:bg-slate-700 hover:text-white transition-colors ${fontSize === 'small' ? 'bg-slate-700 text-white font-bold' : 'text-gray-400'}`}
                                aria-label="Decrease font size"
                                title="Smaller Text"
                            >A-</button>
                            <button 
                                onClick={() => setFontSize('normal')} 
                                className={`px-2 py-0.5 border-l border-r border-slate-700 hover:bg-slate-700 hover:text-white transition-colors ${fontSize === 'normal' ? 'bg-slate-700 text-white font-bold' : 'text-gray-400'}`}
                                aria-label="Normal font size"
                                title="Normal Text"
                            >A</button>
                            <button 
                                onClick={() => setFontSize('large')} 
                                className={`px-2 py-0.5 hover:bg-slate-700 hover:text-white transition-colors ${fontSize === 'large' ? 'bg-slate-700 text-white font-bold' : 'text-gray-400'}`}
                                aria-label="Increase font size"
                                title="Larger Text"
                            >A+</button>
                        </div>

                        {/* Theme Toggler (Dark/High Contrast) */}
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="flex items-center justify-center w-7 h-7 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors focus:ring-2 focus:ring-accent-saffron outline-none"
                            title={darkMode ? 'Switch to Standard Theme' : 'Switch to High Contrast Mode'}
                            aria-label={darkMode ? 'Switch to Standard Theme' : 'Switch to High Contrast Mode'}
                        >
                            <i className={`fa-solid ${darkMode ? 'fa-sun text-accent-saffron' : 'fa-circle-half-stroke text-gray-300'} text-xs`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Navbar */}
            <header className="bg-white border-b-4 border-primary shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20">
                        {/* Logo & Brand */}
                        <div className="flex items-center">
                            <Link to="/" className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                                <img
                                    src="/assets/emblem.svg"
                                    onError={(e) => { e.target.src='https://s2.googleusercontent.com/s2/favicons?domain=india.gov.in&sz=256'; }}
                                    alt="Emblem of India"
                                    className="h-12 w-auto mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert"
                                />
                                <div>
                                    <span className="block text-2xl font-bold text-primary leading-none tracking-tight">Bharat E-Vote</span>
                                    <span className="text-[11px] uppercase font-bold text-gray-500 tracking-wider">Election Commission of India</span>
                                </div>
                            </Link>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden flex items-center text-gray-600 hover:text-primary"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle mobile menu"
                            aria-expanded={mobileMenuOpen}
                            aria-controls="mobile-menu"
                        >
                            <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`}></i>
                        </button>

                        {/* Desktop Navigation */}
                        <nav aria-label="Desktop Navigation" className="hidden md:flex items-center space-x-6">
                            <Link to="/" className={navLinkClass('/')}>{t('nav.home')}</Link>
                            <Link to="/guidelines" className={navLinkClass('/guidelines')}>{t('nav.onboarding')}</Link>
                            <Link to="/results" className={navLinkClass('/results')}>
                                <i className="fa-solid fa-chart-column mr-1"></i>{t('nav.results')}
                            </Link>
                            
                            {/* Voter-specific links */}
                            {isLoggedIn && user && !isAdminUser && (
                                <>
                                    <Link to="/dashboard" className={navLinkClass('/dashboard')}>{t('nav.dashboard')}</Link>
                                    <Link to="/vote" className={navLinkClass('/vote')}>
                                        <i className="fa-solid fa-vote-yea mr-1"></i>{t('nav.voting')}
                                    </Link>
                                </>
                            )}

                            {/* Admin-specific links */}
                            {isAdminUser && (
                                <Link to="/admin-panel" className={`text-sm font-semibold hover:text-red-600 transition-colors flex items-center gap-1.5 ${location.pathname === '/admin-panel' ? 'text-red-600 border-b-2 border-red-500 pb-1' : 'text-gray-600'}`}>
                                    <i className="fa-solid fa-user-shield text-red-500"></i>{t('nav.admin')}
                                </Link>
                            )}

                            <form role="search" onSubmit={(e) => { e.preventDefault(); navigate('/search-roll'); }} className="flex items-center">
                                <button type="submit" aria-label="Submit Search" className="text-gray-500 hover:text-primary transition-colors px-2 relative group focus:outline-none focus:ring-2 focus:ring-primary rounded">
                                    <i className="fa-solid fa-magnifying-glass text-lg"></i>
                                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Search Roll</span>
                                </button>
                            </form>

                            <div className="h-6 w-px bg-gray-300 mx-2"></div>

                            {isLoggedIn && user ? (
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isAdminUser ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-primary'}`}>
                                            {user.fullname ? user.fullname.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <div className="hidden lg:block">
                                            <span className="text-sm font-medium text-gray-700 block leading-none">{user.fullname?.split(' ')[0]}</span>
                                            {isAdminUser && <span className="text-[10px] font-bold text-red-500 uppercase">Admin</span>}
                                        </div>
                                    </div>
                                    <button onClick={onLogout} className="btn-secondary py-1.5 px-4 text-sm">
                                        <i className="fa-solid fa-arrow-right-from-bracket mr-2"></i>{t('nav.logout')}
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
                        </nav>
                    </div>

                    {/* Mobile Menu */}
                    {mobileMenuOpen && (
                        <nav id="mobile-menu" aria-label="Mobile Navigation" className="md:hidden absolute top-full left-0 w-full bg-white shadow-xl border-t border-gray-200 py-4 px-4 space-y-2 z-50">
                            <Link to="/" className="block px-3 py-2 rounded text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-primary">{t('nav.home')}</Link>
                            <Link to="/guidelines" className="block px-3 py-2 rounded text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-primary">{t('nav.onboarding')}</Link>
                            <Link to="/results" className="block px-3 py-2 rounded text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-primary"><i className="fa-solid fa-chart-column mr-2"></i>{t('nav.results')}</Link>
                            
                            {isLoggedIn && user && !isAdminUser && (
                                <>
                                    <Link to="/dashboard" className="block px-3 py-2 rounded text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-primary">{t('nav.dashboard')}</Link>
                                    <Link to="/vote" className="block px-3 py-2 rounded text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-primary"><i className="fa-solid fa-vote-yea mr-2"></i>{t('nav.voting')}</Link>
                                </>
                            )}

                            {isAdminUser && (
                                <Link to="/admin-panel" className="block px-3 py-2 rounded text-sm font-semibold text-red-600 hover:bg-red-50"><i className="fa-solid fa-user-shield mr-2"></i>{t('nav.admin')}</Link>
                            )}

                            <div className="border-t border-gray-200 pt-3 mt-3">
                                {isLoggedIn && user ? (
                                    <button onClick={onLogout} className="w-full text-left px-3 py-2 rounded text-sm font-semibold text-red-600 hover:bg-red-50">
                                        <i className="fa-solid fa-arrow-right-from-bracket mr-2"></i>Logout
                                    </button>
                                ) : (
                                    <>
                                        <Link to="/login" className="block px-3 py-2 rounded text-sm font-semibold text-primary hover:bg-blue-50"><i className="fa-solid fa-user mr-2"></i>Voter Login</Link>
                                        <Link to="/admin-login" className="block px-3 py-2 rounded text-sm font-semibold text-red-600 hover:bg-red-50"><i className="fa-solid fa-user-shield mr-2"></i>Admin Login</Link>
                                    </>
                                )}
                            </div>
                        </nav>
                    )}
                </div>
            </header>

            {/* WCAG 3.2.2 Accessible Toast Notification */}
            {toastMessage && (
                <div role="status" aria-live="polite" className="fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-4 rounded shadow-2xl z-50 flex items-center gap-3 border-l-4 border-blue-500 animate-[bounce_0.3s_ease-in-out]">
                    <i className="fa-solid fa-circle-info text-blue-400"></i>
                    <p className="text-sm font-medium">{toastMessage}</p>
                </div>
            )}
        </>
    );
}

export default Navbar;
