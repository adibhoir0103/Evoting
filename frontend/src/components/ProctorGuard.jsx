import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../styles/proctor-guard.css';

/**
 * ProctorGuard — Secure Voting Window
 * 
 * Cognizant/HackerEarth-style proctored lockdown overlay for secure voting.
 * Features:
 * - Fullscreen API mode
 * - 60-second countdown timer (pauses during blockchain TX processing)
 * - Tab-switch/focus-loss detection with violation counter
 * - Keyboard shortcut suppression (Ctrl+C/V/T/W, Alt+Tab, F12, PrintScreen)
 * - Right-click & copy/paste disabled
 * - Auto-close on timer expiry
 * - Success summary screen on vote completion
 */

const TOTAL_TIME = 60; // seconds
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 22; // r=22 for the SVG ring

function ProctorGuard({ 
    active, 
    candidates, 
    selectedCandidate, 
    onSelectCandidate, 
    onConfirmVote, 
    onCancel, 
    voteState, 
    txHash, 
    user, 
    voterConstituencyInfo,
    error: externalError 
}) {
    const navigate = useNavigate();
    const [timeRemaining, setTimeRemaining] = useState(TOTAL_TIME);
    const [violations, setViolations] = useState(0);
    const [showViolationFlash, setShowViolationFlash] = useState(false);
    const [violationMsg, setViolationMsg] = useState('');
    const [isTimerPaused, setIsTimerPaused] = useState(false);
    const containerRef = useRef(null);
    const timerRef = useRef(null);
    const violationTimeoutRef = useRef(null);

    // States where the vote is being processed (timer should pause)
    const processingStates = ['checking', 'signing', 'pending', 'confirming'];
    const isProcessing = processingStates.includes(voteState);
    const isConfirmed = voteState === 'confirmed';
    const isFailed = voteState === 'failed';
    const isRecovered = voteState === 'recovered';

    // ====== FULLSCREEN ======
    useEffect(() => {
        if (!active) return;

        const requestFullscreen = async () => {
            try {
                const el = document.documentElement;
                if (el.requestFullscreen) await el.requestFullscreen();
                else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
                else if (el.msRequestFullscreen) await el.msRequestFullscreen();
            } catch (e) {
                console.warn('Fullscreen not supported or blocked:', e);
            }
        };

        requestFullscreen();

        return () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        };
    }, [active]);

    // ====== TIMER ======
    useEffect(() => {
        if (!active || isConfirmed) return;

        // Pause timer during blockchain processing
        if (isProcessing) {
            setIsTimerPaused(true);
            return;
        }
        setIsTimerPaused(false);

        timerRef.current = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [active, isProcessing, isConfirmed]);

    // ====== TIMEOUT HANDLER ======
    useEffect(() => {
        if (timeRemaining === 0 && !isConfirmed && !isProcessing) {
            toast.error('Voting session expired. Returning to dashboard.', { duration: 4000 });
            // Exit fullscreen
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
            setTimeout(() => {
                onCancel();
                navigate('/dashboard', { replace: true });
            }, 1500);
        }
    }, [timeRemaining, isConfirmed, isProcessing, navigate, onCancel]);

    // ====== VIOLATION TRIGGER ======
    const triggerViolation = useCallback((message) => {
        setViolations(prev => prev + 1);
        setViolationMsg(message);
        setShowViolationFlash(true);

        if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current);
        violationTimeoutRef.current = setTimeout(() => {
            setShowViolationFlash(false);
            setViolationMsg('');
        }, 2500);
    }, []);

    // ====== KEYBOARD LOCKDOWN ======
    useEffect(() => {
        if (!active) return;

        const handleKeyDown = (e) => {
            // Suppress dangerous shortcuts
            const blockedCombos = [
                e.ctrlKey && e.key === 'c',
                e.ctrlKey && e.key === 'v',
                e.ctrlKey && e.key === 'x',
                e.ctrlKey && e.key === 't',
                e.ctrlKey && e.key === 'w',
                e.ctrlKey && e.key === 'n',
                e.ctrlKey && e.shiftKey && e.key === 'I',
                e.ctrlKey && e.shiftKey && e.key === 'J',
                e.ctrlKey && e.shiftKey && e.key === 'C',
                e.ctrlKey && e.key === 'u',
                e.key === 'F12',
                e.key === 'PrintScreen',
                e.altKey && e.key === 'Tab',
                e.altKey && e.key === 'F4',
                e.metaKey, // Windows key / Cmd
            ];

            if (blockedCombos.some(Boolean)) {
                e.preventDefault();
                e.stopPropagation();
                triggerViolation('Keyboard shortcut blocked');
                return false;
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [active, triggerViolation]);

    // ====== RIGHT-CLICK / COPY / PASTE LOCKDOWN ======
    useEffect(() => {
        if (!active) return;

        const prevent = (e) => {
            e.preventDefault();
            triggerViolation('Action blocked in secure mode');
        };

        document.addEventListener('contextmenu', prevent, true);
        document.addEventListener('copy', prevent, true);
        document.addEventListener('cut', prevent, true);
        document.addEventListener('paste', prevent, true);

        return () => {
            document.removeEventListener('contextmenu', prevent, true);
            document.removeEventListener('copy', prevent, true);
            document.removeEventListener('cut', prevent, true);
            document.removeEventListener('paste', prevent, true);
        };
    }, [active, triggerViolation]);

    // ====== FOCUS LOSS / TAB SWITCH DETECTION ======
    useEffect(() => {
        if (!active) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                triggerViolation('Tab switch detected!');
            }
        };

        const handleBlur = () => {
            triggerViolation('Window lost focus');
        };

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && active && !isConfirmed && timeRemaining > 0) {
                triggerViolation('Fullscreen exited!');
                // Re-request fullscreen
                setTimeout(async () => {
                    try {
                        await document.documentElement.requestFullscreen();
                    } catch (e) { /* user may block */ }
                }, 500);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [active, triggerViolation, isConfirmed, timeRemaining]);

    // ====== BODY SCROLL LOCK ======
    useEffect(() => {
        if (active) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [active]);

    if (!active) return null;

    // Timer calculations
    const progress = timeRemaining / TOTAL_TIME;
    const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - progress);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const timerClass = timeRemaining <= 10 ? 'critical' : timeRemaining <= 20 ? 'warning' : '';

    // ====== SUCCESS SCREEN ======
    if (isConfirmed) {
        return (
            <div className="proctor-overlay" ref={containerRef}>
                {/* Top Bar */}
                <div className="proctor-topbar">
                    <div className="proctor-topbar-left">
                        <div className="proctor-shield-icon">
                            <i className="fa-solid fa-check"></i>
                        </div>
                        <div>
                            <div className="proctor-title">Vote Recorded</div>
                            <div className="proctor-subtitle">Blockchain Confirmed</div>
                        </div>
                    </div>
                </div>

                {/* Success Content */}
                <div className="proctor-content">
                    <div className="proctor-inner">
                        <div className="proctor-processing">
                            <div className="proctor-processing-icon success">
                                <i className="fa-solid fa-check-circle"></i>
                            </div>
                            <h2>Successfully Voted!</h2>
                            <p>Your vote has been irrevocably recorded on the blockchain. Thank you for participating in democracy.</p>

                            {/* Vote Summary */}
                            <div className="proctor-summary">
                                <div className="proctor-summary-row">
                                    <span className="proctor-summary-label">Voter</span>
                                    <span className="proctor-summary-value">{user?.fullname || 'N/A'}</span>
                                </div>
                                <div className="proctor-summary-row">
                                    <span className="proctor-summary-label">Voter ID</span>
                                    <span className="proctor-summary-value">{user?.voterId || 'N/A'}</span>
                                </div>
                                <div className="proctor-summary-row">
                                    <span className="proctor-summary-label">Election</span>
                                    <span className="proctor-summary-value">General Election 2026</span>
                                </div>
                                <div className="proctor-summary-row">
                                    <span className="proctor-summary-label">Timestamp</span>
                                    <span className="proctor-summary-value">{new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                                </div>
                                <div className="proctor-summary-row">
                                    <span className="proctor-summary-label">Verification</span>
                                    <span className="proctor-summary-value" style={{ color: '#4ade80' }}>
                                        <i className="fa-solid fa-shield-halved" style={{ marginRight: '4px' }}></i>
                                        Blockchain Immutable
                                    </span>
                                </div>
                            </div>

                            {/* TX Hash */}
                            {txHash && (
                                <div className="proctor-tx-box">
                                    <div className="proctor-tx-label">Transaction Hash</div>
                                    <div className="proctor-tx-hash">{txHash}</div>
                                </div>
                            )}

                            <div className="proctor-actions" style={{ marginTop: '28px' }}>
                                <button 
                                    className="proctor-btn proctor-btn-primary"
                                    onClick={() => {
                                        if (document.fullscreenElement) {
                                            document.exitFullscreen().catch(() => {});
                                        }
                                        onCancel(); // This triggers the parent's hasVoted flow
                                        navigate('/dashboard', { replace: true });
                                    }}
                                >
                                    <i className="fa-solid fa-house"></i>
                                    Return to Dashboard
                                </button>
                            </div>

                            <p style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
                                <i className="fa-solid fa-flag" style={{ marginRight: '4px', color: '#f59e0b' }}></i>
                                Jai Hind! 🇮🇳
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="proctor-bottombar">
                    <div className="proctor-footer-item">
                        <i className="fa-solid fa-lock"></i> End-to-End Encrypted
                    </div>
                    <div className="proctor-footer-item">
                        <i className="fa-solid fa-link"></i> Blockchain Verified
                    </div>
                    <div className="proctor-footer-item">
                        <i className="fa-solid fa-shield-halved"></i> Zero-Knowledge Proof
                    </div>
                </div>
            </div>
        );
    }

    // ====== PROCESSING SCREEN ======
    if (isProcessing) {
        const stepLabels = {
            checking: { title: 'Acquiring Pre‑Flight Token...', desc: 'Authenticating eligibility and issuing Redis TTL lock.' },
            signing: { title: 'Awaiting Vault Signature...', desc: 'Please approve the transaction in your MetaMask wallet.' },
            pending: { title: 'Transmitting to Blockchain...', desc: 'Transaction submitted. Waiting for validator confirmations.' },
            confirming: { title: 'Confirming Block...', desc: 'Your vote is being finalized. Do not close this window.' },
        };

        const currentStep = stepLabels[voteState] || { title: 'Processing...', desc: '' };
        const stepIndex = processingStates.indexOf(voteState);

        return (
            <div className="proctor-overlay" ref={containerRef}>
                {/* Top Bar */}
                <div className="proctor-topbar">
                    <div className="proctor-topbar-left">
                        <div className="proctor-shield-icon">
                            <i className="fa-solid fa-shield-halved"></i>
                        </div>
                        <div>
                            <div className="proctor-title">Secure Voting Window</div>
                            <div className="proctor-subtitle">Transaction Processing</div>
                        </div>
                    </div>
                    <div className="proctor-topbar-right">
                        <div className="proctor-timer-container">
                            <div className={`proctor-timer-ring ${isTimerPaused ? 'proctor-timer-paused' : ''}`}>
                                <svg viewBox="0 0 48 48">
                                    <circle className="ring-bg" cx="24" cy="24" r="22" />
                                    <circle className="ring-progress warning" cx="24" cy="24" r="22"
                                        strokeDasharray={CIRCLE_CIRCUMFERENCE}
                                        strokeDashoffset={dashOffset}
                                    />
                                </svg>
                                <div className="proctor-timer-text">⏸</div>
                            </div>
                            <div className="proctor-paused-label">Paused</div>
                        </div>
                    </div>
                </div>

                {/* Processing Content */}
                <div className="proctor-content">
                    <div className="proctor-inner">
                        <div className="proctor-processing">
                            <div className="proctor-processing-icon loading">
                                <i className="fa-solid fa-circle-notch fa-spin"></i>
                            </div>
                            <h2>{currentStep.title}</h2>
                            <p>{currentStep.desc}</p>

                            {/* Step dots */}
                            <div className="proctor-steps">
                                {processingStates.map((s, i) => (
                                    <div key={s} className={`proctor-step-dot ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}`} />
                                ))}
                            </div>

                            {txHash && (
                                <div className="proctor-tx-box">
                                    <div className="proctor-tx-label">Transaction Hash</div>
                                    <div className="proctor-tx-hash">{txHash}</div>
                                </div>
                            )}

                            <p style={{ marginTop: '20px', fontSize: '12px', color: '#64748b' }}>
                                <i className="fa-solid fa-lock" style={{ marginRight: '4px' }}></i>
                                Timer paused during blockchain processing. Do not close this window.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="proctor-bottombar">
                    <div className="proctor-footer-item">
                        <i className="fa-solid fa-lock"></i> End-to-End Encrypted
                    </div>
                    <div className="proctor-footer-item">
                        <i className="fa-solid fa-link"></i> Blockchain Verified
                    </div>
                </div>
            </div>
        );
    }

    // ====== MAIN BALLOT SCREEN ======
    return (
        <div className="proctor-overlay" ref={containerRef}>
            {/* Violation Flash */}
            {showViolationFlash && (
                <div className="proctor-violation-flash">
                    <div className="proctor-violation-banner">
                        <h3><i className="fa-solid fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>VIOLATION DETECTED</h3>
                        <p>{violationMsg}</p>
                    </div>
                </div>
            )}

            {/* Top Security Bar */}
            <div className="proctor-topbar">
                <div className="proctor-topbar-left">
                    <div className="proctor-shield-icon">
                        <i className="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                        <div className="proctor-title">Secure Voting Window</div>
                        <div className="proctor-subtitle">Proctored Session — General Election 2026</div>
                    </div>
                </div>

                <div className="proctor-topbar-right">
                    <div className="proctor-live-dot">LIVE</div>

                    <div className={`proctor-violations ${violations === 0 ? 'clean' : ''}`}>
                        <i className={`fa-solid ${violations === 0 ? 'fa-check-circle' : 'fa-triangle-exclamation'}`}></i>
                        {violations === 0 ? 'Clean' : `${violations} Violation${violations > 1 ? 's' : ''}`}
                    </div>

                    {/* Timer */}
                    <div className="proctor-timer-container">
                        <div className="proctor-timer-ring">
                            <svg viewBox="0 0 48 48">
                                <circle className="ring-bg" cx="24" cy="24" r="22" />
                                <circle className={`ring-progress ${timerClass}`} cx="24" cy="24" r="22"
                                    strokeDasharray={CIRCLE_CIRCUMFERENCE}
                                    strokeDashoffset={dashOffset}
                                />
                            </svg>
                            <div className="proctor-timer-text">{timeDisplay}</div>
                        </div>
                        <div className="proctor-timer-label">Remaining</div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="proctor-content">
                <div className="proctor-inner">
                    <div className="proctor-card">
                        <div className="proctor-card-header">
                            <h2>
                                <i className="fa-solid fa-box-ballot" style={{ marginRight: '8px', color: '#3b82f6' }}></i>
                                Select Your Candidate
                            </h2>
                            <p>Choose exactly one candidate. This action is final and irreversible.</p>
                        </div>

                        {/* Error display */}
                        {(externalError || isFailed || isRecovered) && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '10px',
                                padding: '12px 16px',
                                marginBottom: '20px',
                                color: '#f87171',
                                fontSize: '13px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <i className="fa-solid fa-circle-exclamation"></i>
                                {externalError || (isRecovered ? 'Transaction rejected — you may try again.' : 'Vote submission failed. Please try again.')}
                            </div>
                        )}

                        {/* Candidates Grid */}
                        <div className="proctor-candidates-grid">
                            {candidates.map(candidate => (
                                <div
                                    key={candidate.id}
                                    className={`proctor-candidate-card ${selectedCandidate?.id === candidate.id ? 'selected' : ''}`}
                                    onClick={() => onSelectCandidate(candidate)}
                                    role="radio"
                                    aria-checked={selectedCandidate?.id === candidate.id}
                                    aria-label={`Select ${candidate.name} from ${candidate.partyName || 'Independent'}`}
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectCandidate(candidate); } }}
                                >
                                    <div className="proctor-candidate-avatar">
                                        {candidate.partySymbol || <i className="fa-solid fa-user-tie"></i>}
                                    </div>
                                    <div className="proctor-candidate-name">{candidate.name}</div>
                                    <div className="proctor-candidate-party">{candidate.partyName || 'Independent'}</div>
                                    <div className="proctor-candidate-meta">Candidate #{candidate.id}</div>
                                </div>
                            ))}
                        </div>

                        {/* Warning */}
                        <div style={{
                            background: 'rgba(245,158,11,0.08)',
                            border: '1px solid rgba(245,158,11,0.2)',
                            borderRadius: '10px',
                            padding: '12px 16px',
                            marginBottom: '20px',
                            color: '#fbbf24',
                            fontSize: '12px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <i className="fa-solid fa-exclamation-triangle"></i>
                            Once submitted, your vote <strong style={{ color: '#f59e0b' }}>cannot be changed</strong>. This action is final and recorded on the blockchain.
                        </div>

                        {/* Actions */}
                        <div className="proctor-actions">
                            <button
                                className="proctor-btn proctor-btn-secondary"
                                onClick={() => {
                                    if (document.fullscreenElement) {
                                        document.exitFullscreen().catch(() => {});
                                    }
                                    onCancel();
                                }}
                            >
                                <i className="fa-solid fa-xmark"></i>
                                Exit Secure Window
                            </button>
                            <button
                                className="proctor-btn proctor-btn-primary"
                                onClick={() => onConfirmVote(selectedCandidate)}
                                disabled={!selectedCandidate || timeRemaining === 0}
                            >
                                <i className="fa-solid fa-check-to-slot"></i>
                                Confirm & Cast Vote
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Security Bar */}
            <div className="proctor-bottombar">
                <div className="proctor-footer-item">
                    <i className="fa-solid fa-lock"></i> End-to-End Encrypted
                </div>
                <div className="proctor-footer-item">
                    <i className="fa-solid fa-video-slash"></i> No Screen Recording
                </div>
                <div className="proctor-footer-item">
                    <i className="fa-solid fa-shield-halved"></i> Proctor Active
                </div>
                <div className="proctor-footer-item">
                    <i className="fa-solid fa-link"></i> Blockchain Verified
                </div>
            </div>
        </div>
    );
}

export default ProctorGuard;
