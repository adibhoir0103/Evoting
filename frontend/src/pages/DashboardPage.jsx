import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

function DashboardPage({ user, onUserUpdate }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [voteReceipt, setVoteReceipt] = useState(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        loadDashboardData();

        // Countdown Timer Logic — TODO: Fetch target date from backend API
        const targetDate = new Date('2026-05-15T08:00:00');
        const timer = setInterval(() => {
            const now = new Date();
            const difference = targetDate - now;

            if (difference > 0) {
                setTimeLeft({
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60)
                });
            }
        }, 1000);
        return () => clearInterval(timer);
        // eslint-disable-next-line
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            setError('');

            const userData = await authService.getCurrentUser();
            if (!userData) {
                navigate('/login');
                return;
            }
            setProfile(userData);
            if (onUserUpdate) onUserUpdate(userData);

            const voted = await authService.checkVoteStatus();
            setHasVoted(voted);

            if (voted) {
                try {
                    const token = authService.getToken();
                    const res = await fetch(`${API_URL}/vote/receipt`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setVoteReceipt(data.vote);
                    }
                } catch (err) {
                    // Ignore non-critical fetch errors for receipts
                }
            }
        } catch (err) {
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // State for editing entire EPIC card
    const [isEditingCard, setIsEditingCard] = useState(false);
    const [cardFormData, setCardFormData] = useState({
        fatherName: '',
        gender: '',
        dob: '',
        address: ''
    });

    useEffect(() => {
        if (profile) {
            setCardFormData({
                fatherName: profile.fatherName || profile.father_name || '',
                gender: profile.gender || '',
                dob: profile.dob || '',
                address: profile.address || ''
            });
        }
    }, [profile, isEditingCard]);

    const handleSaveCard = async () => {
        try {
            await authService.updateProfile(cardFormData);
            setProfile(prev => ({ ...prev, ...cardFormData }));
            setIsEditingCard(false);
        } catch (err) {
            toast.error('Failed to update card: ' + err.message);
        }
    };

    const formatAddress = (addr) => {
        if (!addr) return 'Not connected';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const d = new Date(dateString);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    };

    const announcements = [
        { id: 1, text: "Ensure you have a stable internet connection before starting the voting process." },
        { id: 2, text: "Keep your mobile phone handy for Aadhaar OTP verification." },
        { id: 3, text: "Do not share your OTP or screen with anyone to maintain vote secrecy." },
        { id: 4, text: "Voting window closes at 6:00 PM. Cast your vote before the deadline." }
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <i className="fa-solid fa-circle-notch fa-spin text-primary text-4xl mb-4"></i>
                <p className="text-gray-600 font-medium">Loading your voter dashboard...</p>
            </div>
        );
    }

    const isWalletConnected = !!(profile?.walletAddress || profile?.wallet_address);
    const currentStep = hasVoted ? 4 : (isWalletConnected ? 3 : 2);

    return (
        <main id="main-content" className="min-h-screen bg-[#f3f4f6] pb-12">
            {/* Header Banner */}
            <div className="bg-primary text-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white text-primary flex items-center justify-center text-3xl font-bold shadow-inner">
                            {profile?.fullname ? profile.fullname.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Voter Dashboard</h1>
                            <p className="text-blue-100 mt-1">Welcome back, {profile?.fullname || 'Citizen'}</p>
                        </div>
                    </div>
                    
                    {/* Countdown Banner inside Header */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 flex items-center gap-6">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-accent-saffron">General Election 2026</h2>
                            <span className="text-xs text-blue-100">Live Polling Closes In:</span>
                        </div>
                        <div className="flex gap-3">
                            {[ 
                                { label: 'Days', val: timeLeft.days },
                                { label: 'Hours', val: timeLeft.hours },
                                { label: 'Mins', val: timeLeft.minutes },
                                { label: 'Secs', val: timeLeft.seconds }
                            ].map((unit, idx) => (
                                <div key={idx} className="flex flex-col items-center">
                                    <div className="bg-white text-primary font-bold text-xl w-10 h-10 flex flex-col justify-center items-center rounded shadow-sm">
                                        {unit.val}
                                    </div>
                                    <span className="text-[10px] uppercase font-semibold mt-1 opacity-80">{unit.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6 shadow-sm">
                        <div className="flex">
                            <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
                            <p className="ml-3 text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT COLUMN: Identity (8 Cols) */}
                    <div className="lg:col-span-7 space-y-6">
                        
                        {/* Digital EPIC Card */}
                        <div className="gov-card p-0 overflow-hidden shadow-lg border-t-4 border-t-primary">
                            <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex justify-between items-start">
                                <div className="flex gap-4">
                                    <img src="https://s2.googleusercontent.com/s2/favicons?domain=india.gov.in&sz=256" alt="Emblem" className="h-16 w-auto mix-blend-multiply opacity-90" />
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 leading-tight">भारत निर्वाचन आयोग</h3>
                                        <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Election Commission of India</h3>
                                        <p className="text-[10px] font-medium text-gray-500 mt-1 uppercase">मतदाता फोटो पहचान पत्र / Elector Photo Identity Card</p>
                                    </div>
                                </div>
                                <div>
                                    {!isEditingCard ? (
                                        <button onClick={() => setIsEditingCard(true)} className="text-gray-400 hover:text-primary transition-colors p-2 bg-white rounded-full shadow-sm hover:shadow" title="Edit Card">
                                            <i className="fa-solid fa-pen-to-square"></i>
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button onClick={handleSaveCard} className="text-green-600 bg-green-50 hover:bg-green-100 p-2 rounded-full shadow-sm" title="Save">
                                                <i className="fa-solid fa-check"></i>
                                            </button>
                                            <button onClick={() => setIsEditingCard(false)} className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-full shadow-sm" title="Cancel">
                                                <i className="fa-solid fa-xmark"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="p-6 flex flex-col md:flex-row gap-6 relative">
                                {/* Watermark */}
                                <div className="absolute inset-0 flex flex-col justify-center items-center opacity-[0.03] pointer-events-none">
                                    <img src="/assets/emblem.svg"
                                        onError={(e) => { e.target.src='https://s2.googleusercontent.com/s2/favicons?domain=india.gov.in&sz=256'; }}
                                        alt="" className="h-64 object-contain" />
                                </div>

                                <div className="flex-shrink-0 flex flex-col items-center">
                                    <div className="w-28 h-32 bg-gray-200 border-2 border-gray-300 rounded overflow-hidden flex items-center justify-center text-gray-400">
                                        <i className="fa-solid fa-user text-5xl"></i>
                                    </div>
                                    <div className="mt-4 text-center">
                                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">EPIC Number</div>
                                        <div className="text-lg font-mono font-bold text-gray-900 uppercase">{profile?.voter_id || profile?.voterId || '—'}</div>
                                    </div>
                                </div>

                                <div className="flex-grow space-y-4">
                                    <div>
                                        <span className="block text-xs font-bold text-gray-500 uppercase">Name (English & Local)</span>
                                        <span className="block text-base font-bold text-gray-900">{profile?.fullname || '—'}</span>
                                    </div>
                                    
                                    <div>
                                        <span className="block text-xs font-bold text-gray-500 uppercase">Father's Name</span>
                                        {isEditingCard ? (
                                            <input type="text" className="input-field py-1 px-2 text-sm mt-1 border-primary bg-blue-50" value={cardFormData.fatherName} onChange={(e) => setCardFormData({ ...cardFormData, fatherName: e.target.value })} />
                                        ) : (
                                            <span className="block text-sm font-medium text-gray-800">{profile?.fatherName || profile?.father_name || '—'}</span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="block text-xs font-bold text-gray-500 uppercase">Gender</span>
                                            {isEditingCard ? (
                                                <select className="input-field py-1 px-2 text-sm mt-1 border-primary bg-blue-50" value={cardFormData.gender} onChange={(e) => setCardFormData({ ...cardFormData, gender: e.target.value })}>
                                                    <option>Male</option><option>Female</option><option>Other</option>
                                                </select>
                                            ) : (
                                                <span className="block text-sm font-medium text-gray-800">{profile?.gender || '—'}</span>
                                            )}
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-gray-500 uppercase">Date of Birth</span>
                                            {isEditingCard ? (
                                                <input type="date" className="input-field py-1 px-2 text-sm mt-1 border-primary bg-blue-50" value={cardFormData.dob} onChange={(e) => setCardFormData({ ...cardFormData, dob: e.target.value })} />
                                            ) : (
                                                <span className="block text-sm font-medium text-gray-800">{profile?.dob ? formatDate(profile.dob) : '—'}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="block text-xs font-bold text-gray-500 uppercase">Address</span>
                                        {isEditingCard ? (
                                            <textarea className="input-field text-sm mt-1 border-primary bg-blue-50 resize-none h-16 w-full" value={cardFormData.address} onChange={(e) => setCardFormData({ ...cardFormData, address: e.target.value })} />
                                        ) : (
                                            <span className="block text-sm font-medium text-gray-800 leading-relaxed max-w-sm">{profile?.address || '—'}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Blockchain Wallet Link Card */}
                        <div className="gov-card flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-inner border ${isWalletConnected ? 'bg-green-100 text-green-600 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                                    <i className={`fa-solid ${isWalletConnected ? 'fa-link' : 'fa-link-slash'}`}></i>
                                </div>
                                <div>
                                    <h3 className="text-gray-900 font-bold shrink-0">Web3 Digital Wallet</h3>
                                    {isWalletConnected ? (
                                        <p className="text-sm text-gray-600 font-mono mt-0.5"><i className="fa-brands fa-ethereum text-[#627eea] mr-1"></i> {formatAddress(profile?.walletAddress || profile?.wallet_address)}</p>
                                    ) : (
                                        <p className="text-sm text-red-500 font-medium mt-0.5"><i className="fa-solid fa-circle-xmark mr-1"></i> Not Connected</p>
                                    )}
                                </div>
                            </div>
                            
                            {!isWalletConnected ? (
                                <Link to="/vote" className="btn-outline px-4 py-2 text-sm">Connect Wallet</Link>
                            ) : (
                                <span className="status-badge bg-green-100 text-green-800 border border-green-200"><i className="fa-solid fa-check mr-1.5"></i> Ready</span>
                            )}
                        </div>
                        
                        {/* Guidelines box */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 shadow-sm">
                            <h4 className="text-yellow-800 font-bold mb-3 flex items-center text-sm uppercase tracking-wide">
                                <i className="fa-solid fa-bullhorn mr-2 text-lg"></i> Important Guidelines
                            </h4>
                            <ul className="space-y-2">
                                {announcements.map(ann => (
                                    <li key={ann.id} className="flex items-start">
                                        <i className="fa-solid fa-caret-right text-yellow-500 mt-1 mr-2 text-sm"></i>
                                        <span className="text-sm text-gray-700">{ann.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Actions (5 Cols) */}
                    <div className="lg:col-span-5 space-y-6">
                        
                        {/* Interactive Voting Status */}
                        <div className="gov-card bg-white border-none relative overflow-hidden ring-1 ring-gray-200 shadow-md">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <i className="fa-solid fa-check-to-slot text-9xl"></i>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center border-b pb-4">
                                <i className="fa-solid fa-list-check text-primary mr-2"></i> Your Voting Journey
                            </h3>
                            
                            <div className="relative">
                                {/* Connecting line */}
                                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200 -z-10"></div>
                                
                                <ul className="space-y-6">
                                    <li className="flex items-start">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${currentStep >= 2 ? 'bg-primary text-white shadow-md' : 'bg-gray-200 text-gray-500'}`}>
                                            <i className="fa-solid fa-user"></i>
                                        </div>
                                        <div className="ml-4">
                                            <h4 className={`font-bold ${currentStep >= 2 ? 'text-gray-900' : 'text-gray-500'}`}>Citizen Authentication</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">Securely logged in via Aadhaar/OTP.</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${currentStep >= 3 ? 'bg-primary text-white shadow-md' : (currentStep === 2 ? 'bg-white border-2 border-primary text-primary' : 'bg-gray-200 text-gray-500')}`}>
                                            <i className="fa-solid fa-wallet"></i>
                                        </div>
                                        <div className="ml-4">
                                            <h4 className={`font-bold ${currentStep >= 3 ? 'text-gray-900' : (currentStep === 2 ? 'text-primary' : 'text-gray-500')}`}>Link Secure Wallet</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">{isWalletConnected ? 'MetaMask successfully linked.' : 'Requires a Web3 wallet extension.'}</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${currentStep >= 4 ? 'bg-green-500 text-white shadow-md' : (currentStep === 3 ? 'bg-white border-2 border-primary text-primary' : 'bg-gray-200 text-gray-500')}`}>
                                            <i className="fa-solid fa-vote-yea"></i>
                                        </div>
                                        <div className="ml-4">
                                            <h4 className={`font-bold ${currentStep >= 4 ? 'text-green-600' : (currentStep === 3 ? 'text-primary' : 'text-gray-500')}`}>{hasVoted ? 'Vote Recorded' : 'Cast Your Vote'}</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">{hasVoted ? 'Your vote is secured on the blockchain.' : 'Enter the secure booth to vote.'}</p>
                                            
                                            {/* Primary Action Button */}
                                            {currentStep === 3 && !hasVoted && (
                                                <Link to="/vote" className="mt-3 inline-flex items-center justify-center bg-primary hover:bg-primary-800 text-white px-5 py-2 rounded shadow transition-colors text-sm font-bold w-full">
                                                    Enter Voting Booth <i className="fa-solid fa-arrow-right ml-2 text-xs"></i>
                                                </Link>
                                            )}
                                            {hasVoted && (
                                                <div className="mt-2 text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded border border-green-200 inline-block">
                                                    <i className="fa-solid fa-check-circle mr-1"></i> Successfully Voted
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Recent Activity/Receipt */}
                        {hasVoted && voteReceipt && (
                            <div className="gov-card border-l-4 border-l-green-500">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Blockchain Receipt</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-500 font-bold uppercase">Status</span>
                                        <span className="status-badge bg-green-100 text-green-800 border-green-200"><i className="fa-solid fa-shield-halved mr-1"></i> VERIFIED</span>
                                    </div>
                                    <div className="bg-gray-50 rounded p-3 border border-gray-200">
                                        <span className="block text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Transaction Hash</span>
                                        <span className="font-mono text-xs text-gray-900 break-all">{voteReceipt.tx_hash}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                                        <a href={`https://etherscan.io/tx/${voteReceipt.tx_hash}`} target="_blank" rel="noreferrer" className="text-xs text-primary font-bold hover:underline flex items-center">
                                            Verify on Explorer <i className="fa-solid fa-arrow-up-right-from-square ml-1"></i>
                                        </a>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const doc = new jsPDF();
                                                    const pageW = doc.internal.pageSize.getWidth();

                                                    // Header band
                                                    doc.setFillColor(0, 0, 128);
                                                    doc.rect(0, 0, pageW, 35, 'F');
                                                    doc.setTextColor(255, 255, 255);
                                                    doc.setFontSize(18);
                                                    doc.setFont('helvetica', 'bold');
                                                    doc.text('Election Commission of India', pageW / 2, 15, { align: 'center' });
                                                    doc.setFontSize(11);
                                                    doc.text('Bharat E-Vote — Digital Vote Receipt', pageW / 2, 25, { align: 'center' });

                                                    // Saffron bar
                                                    doc.setFillColor(255, 153, 51);
                                                    doc.rect(0, 35, pageW, 3, 'F');

                                                    // Body
                                                    doc.setTextColor(51, 51, 51);
                                                    doc.setFontSize(12);
                                                    let y = 50;

                                                    doc.setFont('helvetica', 'bold');
                                                    doc.text('VOTER DETAILS', 20, y);
                                                    doc.setDrawColor(200, 200, 200);
                                                    doc.line(20, y + 2, pageW - 20, y + 2);
                                                    y += 12;

                                                    doc.setFont('helvetica', 'normal');
                                                    doc.setFontSize(10);
                                                    const details = [
                                                        ['Name', profile?.fullname || '—'],
                                                        ['Voter ID (EPIC)', profile?.voter_id || profile?.voterId || '—'],
                                                        ['Date', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })],
                                                        ['Time', new Date().toLocaleTimeString('en-IN')]
                                                    ];
                                                    details.forEach(([label, val]) => {
                                                        doc.setFont('helvetica', 'bold');
                                                        doc.text(label + ':', 20, y);
                                                        doc.setFont('helvetica', 'normal');
                                                        doc.text(val, 70, y);
                                                        y += 8;
                                                    });

                                                    y += 5;
                                                    doc.setFont('helvetica', 'bold');
                                                    doc.setFontSize(12);
                                                    doc.text('BLOCKCHAIN VERIFICATION', 20, y);
                                                    doc.line(20, y + 2, pageW - 20, y + 2);
                                                    y += 12;

                                                    doc.setFontSize(9);
                                                    doc.setFont('helvetica', 'bold');
                                                    doc.text('Transaction Hash:', 20, y);
                                                    y += 6;
                                                    doc.setFont('courier', 'normal');
                                                    doc.setFontSize(8);
                                                    doc.text(voteReceipt.tx_hash, 20, y, { maxWidth: pageW - 40 });
                                                    y += 12;

                                                    doc.setFont('helvetica', 'normal');
                                                    doc.setFontSize(9);
                                                    doc.setTextColor(0, 0, 128);
                                                    doc.text('Verify: https://etherscan.io/tx/' + voteReceipt.tx_hash.slice(0, 20) + '...', 20, y);
                                                    y += 15;

                                                    // QR Code
                                                    const qrDataUrl = await QRCode.toDataURL(voteReceipt.tx_hash, { width: 150, margin: 1 });
                                                    doc.addImage(qrDataUrl, 'PNG', pageW / 2 - 25, y, 50, 50);
                                                    y += 55;
                                                    doc.setTextColor(100, 100, 100);
                                                    doc.setFontSize(8);
                                                    doc.text('Scan QR to verify on blockchain', pageW / 2, y, { align: 'center' });

                                                    // Footer
                                                    doc.setFillColor(19, 136, 8);
                                                    doc.rect(0, 280, pageW, 17, 'F');
                                                    doc.setTextColor(255, 255, 255);
                                                    doc.setFontSize(8);
                                                    doc.text('This receipt is for your records only. It does not reveal your vote.', pageW / 2, 288, { align: 'center' });
                                                    doc.text('Jai Hind!', pageW / 2, 293, { align: 'center' });

                                                    doc.save('BharatEVote_Receipt.pdf');
                                                } catch (err) {
                                                    toast.error('Failed to generate PDF: ' + err.message);
                                                }
                                            }}
                                            className="inline-flex items-center text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded border border-green-200 transition-colors"
                                            aria-label="Download vote receipt as PDF"
                                        >
                                            <i className="fa-solid fa-file-pdf mr-1.5"></i>Download PDF Receipt
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quick Services Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <Link to="/candidates" className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all group">
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <i className="fa-solid fa-users-viewfinder text-xl"></i>
                                </div>
                                <h4 className="font-bold text-gray-900 text-sm">Candidates</h4>
                                <p className="text-xs text-gray-500 mt-1">Know your leaders</p>
                            </Link>

                            <Link to="/search-roll" className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all group">
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <i className="fa-solid fa-magnifying-glass text-xl"></i>
                                </div>
                                <h4 className="font-bold text-gray-900 text-sm">Search Roll</h4>
                                <p className="text-xs text-gray-500 mt-1">Find your details</p>
                            </Link>
                        </div>

                        {/* Election Schedule Timeline */}
                        <div className="gov-card mt-6 border-t-4 border-[#138808]">
                            <h3 className="text-lg font-bold text-[#0b2b54] mb-4 flex items-center border-b pb-2">
                                <i className="fa-solid fa-calendar-days text-[#d97014] mr-2"></i> Election Schedule (Phase 4)
                            </h3>
                            <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-2 mt-4">
                                <div className="relative pl-6">
                                    <div className="absolute w-3 h-3 bg-green-500 rounded-full -left-[7px] top-1.5 ring-4 ring-green-100"></div>
                                    <div className="text-xs font-bold text-gray-500 uppercase">10 April 2026</div>
                                    <div className="text-sm font-bold text-gray-900">Gazette Notification Issued</div>
                                </div>
                                <div className="relative pl-6">
                                    <div className="absolute w-3 h-3 bg-green-500 rounded-full -left-[7px] top-1.5 ring-4 ring-green-100"></div>
                                    <div className="text-xs font-bold text-gray-500 uppercase">18 April 2026</div>
                                    <div className="text-sm font-bold text-gray-900">Last Date for Formal Nominations</div>
                                </div>
                                <div className="relative pl-6">
                                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 ring-4 ring-blue-100 animate-pulse"></div>
                                    <div className="text-xs font-bold text-blue-600 uppercase">Current Status</div>
                                    <div className="text-sm font-bold text-[#0b2b54]">Scrutiny of Affidavits Active</div>
                                </div>
                                <div className="relative pl-6">
                                    <div className="absolute w-3 h-3 bg-gray-300 rounded-full -left-[7px] top-1.5"></div>
                                    <div className="text-xs font-bold text-gray-400 uppercase">15 May 2026</div>
                                    <div className="text-sm font-bold text-gray-400">Date of Poll (Live E-Voting active)</div>
                                </div>
                                <div className="relative pl-6">
                                    <div className="absolute w-3 h-3 bg-gray-300 rounded-full -left-[7px] top-1.5"></div>
                                    <div className="text-xs font-bold text-gray-400 uppercase">04 June 2026</div>
                                    <div className="text-sm font-bold text-gray-400">Date of Counting & National Results</div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </main>
    );
}

export default DashboardPage;
