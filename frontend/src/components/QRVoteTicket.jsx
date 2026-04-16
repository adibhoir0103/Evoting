import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');

/**
 * QR Voting Ticket Component
 * 
 * Displays a time-limited QR code that serves as a cryptographic voting pass.
 * Separates authentication from the voting act — a key coercion resistance feature.
 * 
 * Flow: User requests ticket → Backend issues JWT → QR displayed → Auto-validated → Proceed to vote
 */
function QRVoteTicket({ user, onTicketValidated, onCancel }) {
    const [state, setState] = useState('idle'); // idle, generating, displaying, validating, validated, expired, error
    const [ticketToken, setTicketToken] = useState('');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [countdown, setCountdown] = useState(300);
    const [error, setError] = useState('');
    const [voterName, setVoterName] = useState('');
    const canvasRef = useRef(null);

    const getToken = () => localStorage.getItem('token') || '';

    // Generate ticket on mount
    useEffect(() => {
        generateTicket();
    }, []);

    // Countdown timer
    useEffect(() => {
        if (state !== 'displaying' || countdown <= 0) return;
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    setState('expired');
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [state, countdown]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const generateTicket = async () => {
        setState('generating');
        setError('');

        try {
            const res = await fetch(`${API_URL}/auth/generate-qr-ticket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate ticket');
            }

            setTicketToken(data.ticketToken);
            setVoterName(data.voterName || user?.fullname || 'Voter');
            setCountdown(data.validitySeconds || 300);

            // Generate QR code image
            const qrUrl = await QRCode.toDataURL(data.ticketToken, {
                width: 280,
                margin: 2,
                color: {
                    dark: '#000080',
                    light: '#ffffff'
                },
                errorCorrectionLevel: 'H'
            });

            setQrDataUrl(qrUrl);
            setState('displaying');

        } catch (err) {
            setError(err.message);
            setState('error');
        }
    };

    const validateAndProceed = async () => {
        setState('validating');

        try {
            const res = await fetch(`${API_URL}/auth/validate-qr-ticket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ ticketToken })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.expired) {
                    setState('expired');
                    return;
                }
                throw new Error(data.error || 'Ticket validation failed');
            }

            setState('validated');

            // Brief success animation then proceed
            setTimeout(() => {
                if (onTicketValidated) onTicketValidated(ticketToken);
            }, 1500);

        } catch (err) {
            setError(err.message);
            setState('error');
        }
    };

    // Progress ring calculation
    const progressPercent = (countdown / 300) * 100;
    const circumference = 2 * Math.PI * 54;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden animate-fadeIn">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary to-blue-800 text-white p-5 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold mb-2">
                        <i className="fa-solid fa-qrcode"></i> CRYPTOGRAPHIC VOTING PASS
                    </div>
                    <h2 className="text-xl font-extrabold">QR Voting Ticket</h2>
                    <p className="text-blue-100 text-sm mt-1">
                        {state === 'displaying' ? 'Scan or validate to enter the voting booth' : 
                         state === 'validated' ? 'Access granted!' :
                         state === 'expired' ? 'Ticket expired' : 'Processing...'}
                    </p>
                </div>

                <div className="p-6">
                    {/* Generating */}
                    {state === 'generating' && (
                        <div className="text-center py-12">
                            <i className="fa-solid fa-circle-notch fa-spin text-primary text-4xl mb-4"></i>
                            <p className="text-gray-600 font-medium">Generating secure voting ticket...</p>
                            <p className="text-gray-400 text-sm mt-1">Creating time-limited cryptographic pass</p>
                        </div>
                    )}

                    {/* QR Display */}
                    {state === 'displaying' && (
                        <div className="text-center">
                            {/* Voter Info */}
                            <div className="flex items-center justify-center gap-3 mb-4 bg-gray-50 rounded-lg p-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <i className="fa-solid fa-user text-primary"></i>
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-sm text-gray-900">{voterName}</p>
                                    <p className="text-xs text-gray-500">Voter ID: {user?.voterId || 'N/A'}</p>
                                </div>
                            </div>

                            {/* QR Code with Progress Ring */}
                            <div className="relative inline-block mb-4">
                                <svg className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)]" viewBox="0 0 120 120">
                                    <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                                    <circle cx="60" cy="60" r="54" fill="none"
                                        stroke={countdown > 60 ? '#22c55e' : countdown > 30 ? '#f59e0b' : '#ef4444'}
                                        strokeWidth="4" strokeLinecap="round"
                                        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                                        className="transition-all duration-1000" style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                                    />
                                </svg>
                                {qrDataUrl && (
                                    <img src={qrDataUrl} alt="QR Voting Ticket" className="w-56 h-56 rounded-xl border-2 border-gray-200 shadow-md" />
                                )}
                            </div>

                            {/* Timer */}
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border mb-4 ${
                                countdown > 60 ? 'bg-green-50 text-green-700 border-green-200' :
                                countdown > 30 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-red-50 text-red-700 border-red-200 animate-pulse'
                            }`}>
                                <i className="fa-solid fa-clock"></i>
                                Valid for {formatTime(countdown)}
                            </div>

                            {/* Info */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-xs text-blue-700">
                                <i className="fa-solid fa-info-circle mr-1"></i>
                                This QR code is a <strong>one-time cryptographic pass</strong> signed with your identity.
                                It separates your authentication from the voting act for <strong>coercion resistance</strong>.
                            </div>

                            {/* Validate Button */}
                            <button
                                onClick={validateAndProceed}
                                className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 transition flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-check-circle"></i>
                                Validate Ticket & Enter Voting Booth
                            </button>
                        </div>
                    )}

                    {/* Validating */}
                    {state === 'validating' && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 border-2 border-blue-200">
                                <i className="fa-solid fa-spinner fa-spin text-primary text-2xl"></i>
                            </div>
                            <p className="text-gray-700 font-bold">Validating cryptographic ticket...</p>
                            <p className="text-gray-400 text-sm mt-1">Checking JWT signature, expiry, and database record</p>
                        </div>
                    )}

                    {/* Validated */}
                    {state === 'validated' && (
                        <div className="text-center py-8">
                            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 border-2 border-green-200 animate-bounce">
                                <i className="fa-solid fa-check text-green-600 text-3xl"></i>
                            </div>
                            <h3 className="text-xl font-extrabold text-green-700 mb-2">Ticket Validated!</h3>
                            <p className="text-gray-500">Entering secure voting booth...</p>
                            <div className="mt-4 flex justify-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" style={{ animationDelay: '0.2s' }}></span>
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" style={{ animationDelay: '0.4s' }}></span>
                            </div>
                        </div>
                    )}

                    {/* Expired */}
                    {state === 'expired' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 border-2 border-red-200">
                                <i className="fa-solid fa-clock text-red-500 text-2xl"></i>
                            </div>
                            <h3 className="text-xl font-bold text-red-700 mb-2">Ticket Expired</h3>
                            <p className="text-gray-500 mb-4">Your voting ticket has expired. Please generate a new one.</p>
                            <button onClick={generateTicket}
                                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-md transition"
                            >
                                <i className="fa-solid fa-rotate-right mr-2"></i>Generate New Ticket
                            </button>
                        </div>
                    )}

                    {/* Error */}
                    {state === 'error' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                                <i className="fa-solid fa-exclamation-triangle text-red-500 text-2xl"></i>
                            </div>
                            <p className="text-red-700 font-medium mb-4">{error}</p>
                            <button onClick={generateTicket}
                                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-md transition"
                            >
                                <i className="fa-solid fa-rotate-right mr-2"></i>Try Again
                            </button>
                        </div>
                    )}
                </div>

                {/* Cancel */}
                {(state === 'displaying' || state === 'expired' || state === 'error') && (
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
                        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-red-500 font-semibold transition">
                            <i className="fa-solid fa-arrow-left mr-1"></i> Cancel & Return to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default QRVoteTicket;
