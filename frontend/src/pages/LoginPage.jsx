import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const navigate = useNavigate();

    const [loginMethod, setLoginMethod] = useState('otp'); // 'otp' or 'password'
    
    const [otpEmail, setOtpEmail] = useState('');
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [otpCode, setOtpCode] = useState('');

    const [pwEmail, setPwEmail] = useState('');
    const [password, setPassword] = useState('');

    const [loading, setLoading] = useState(false);

    const handleSendOTP = async (e) => {
        e.preventDefault();
        if (!isLoaded) return;
        if (!otpEmail) return toast.error('Please enter E-mail/Mobile');

        setLoading(true);
        try {
            await signIn.create({
                identifier: otpEmail,
                strategy: 'email_code',
            });
            setIsVerifyingOtp(true);
            toast.success('Secure OTP sent successfully!');
        } catch (err) {
            toast.error(err.errors?.[0]?.message || 'Error executing OTP algorithm');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        if (!isLoaded) return;

        setLoading(true);
        try {
            const attempt = await signIn.attemptFirstFactor({
                strategy: 'email_code',
                code: otpCode,
            });

            if (attempt.status === 'complete') {
                await setActive({ session: attempt.createdSessionId });
                navigate('/dashboard');
            } else {
                toast.error('Cryptographic verification failed.');
            }
        } catch (err) {
            toast.error(err.errors?.[0]?.message || 'Invalid or Expired OTP Token');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordLogin = async (e) => {
        e.preventDefault();
        if (!isLoaded) return;

        setLoading(true);
        try {
            const attempt = await signIn.create({
                identifier: pwEmail,
                strategy: 'password',
                password,
            });

            if (attempt.status === 'complete') {
                await setActive({ session: attempt.createdSessionId });
                navigate('/dashboard');
            } else {
                toast.error('Elevated MFA intercept required.');
            }
        } catch (err) {
            if (err.errors?.[0]?.code === "form_password_incorrect") {
                toast.error("Cryptographic hash mismatch (Invalid password).");
            } else {
                toast.error(err.errors?.[0]?.message || 'Invalid Credentials');
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasskeyLogin = async () => {
        if (!isLoaded) return;
        try {
            const attempt = await signIn.authenticateWithWebAuthn();
            if (attempt.status === 'complete') {
                await setActive({ session: attempt.createdSessionId });
                toast.success('Biometric Handshake Successful!');
                navigate('/dashboard');
            }
        } catch (err) {
            console.error(err);
            toast.error("Local hardware passkey interface cancelled.");
        }
    };

    const handleSocialAuth = async (strategy) => {
        if (!isLoaded) return;
        try {
            await signIn.authenticateWithRedirect({
                strategy,
                redirectUrl: '/sso-callback',
                redirectUrlComplete: '/onboarding',
            });
        } catch (err) {
            toast.error('Identity provider handshake initializing...');
        }
    };

    if (isVerifyingOtp) {
        return (
            <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden bg-gray-50 dark:bg-[#070e20] transition-colors duration-500">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/30 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-400/20 dark:bg-orange-500/20 rounded-full blur-[120px] pointer-events-none"></div>
                
                <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 transition-all duration-500">
                    <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-10 shadow-2xl rounded-3xl">
                        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-white/20">
                            <i className="fa-solid fa-shield-halved text-3xl text-blue-600 dark:text-blue-400"></i>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white text-center mb-2 tracking-tight">Security Verification</h2>
                        <p className="text-sm text-gray-500 dark:text-blue-200/60 text-center mb-8">Enter the 6-digit cryptographic token sent to your device.</p>
                        
                        <form onSubmit={handleVerifyOTP} className="space-y-6">
                            <input 
                                type="text" 
                                className="w-full px-4 py-4 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-center text-2xl tracking-[0.75em] font-mono text-gray-900 dark:text-white transition-all shadow-inner" 
                                value={otpCode} 
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                required 
                                placeholder="●●●●●●"
                            />
                            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all">
                                {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Authenticate Token'}
                            </button>
                        </form>
                        
                        <div className="mt-8 text-center text-sm">
                            <button onClick={() => setIsVerifyingOtp(false)} className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                                <i className="fa-solid fa-arrow-left mr-2"></i>Return to Matrix
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 relative overflow-hidden bg-gray-50 dark:bg-[#070e20] transition-colors duration-500 font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 dark:bg-blue-600/20 rounded-full blur-[150px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-orange-500/20 dark:bg-orange-600/10 rounded-full blur-[150px] pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10 transition-all duration-500">
                
                {/* Main Glassmorphic Card */}
                <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-8 shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl relative overflow-hidden">
                    
                    {/* Header */}
                    <div className="text-center mb-8 relative z-20">
                        <div className="inline-flex justify-center items-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-white/5 dark:to-white/10 text-blue-600 dark:text-blue-400 mb-5 border border-blue-500/30 dark:border-white/10 shadow-[0_0_20px_rgba(59,130,246,0.15)] backdrop-blur-md">
                            <i className="fa-solid fa-fingerprint text-3xl"></i>
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Bharat E-Vote</h2>
                        <p className="text-sm text-gray-500 dark:text-blue-200/60 mt-2 font-medium tracking-wide">Decentralized Identity Gateway</p>
                    </div>

                    {/* Toggle Switch */}
                    <div className="flex bg-gray-200/50 dark:bg-black/30 p-1.5 rounded-2xl mb-8 relative z-20 shadow-inner border border-gray-300/50 dark:border-white/5">
                        <button 
                            onClick={() => setLoginMethod('otp')} 
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 ${loginMethod === 'otp' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-white shadow-md border border-gray-200 dark:border-white/10' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                        >
                            <i className="fa-solid fa-bolt mr-2"></i>Quick OTP
                        </button>
                        <button 
                            onClick={() => setLoginMethod('password')} 
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 ${loginMethod === 'password' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-white shadow-md border border-gray-200 dark:border-white/10' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                        >
                            <i className="fa-solid fa-key mr-2"></i>Password
                        </button>
                    </div>

                    {/* Dynamic Forms */}
                    <div className="relative z-20">
                        {loginMethod === 'otp' ? (
                            <form onSubmit={handleSendOTP} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Digital Identifier</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <i className="fa-regular fa-envelope"></i>
                                        </div>
                                        <input 
                                            type="text" 
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium placeholder-gray-400" 
                                            placeholder="Email or Mobile"
                                            value={otpEmail}
                                            onChange={(e) => setOtpEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3.5 rounded-xl font-bold tracking-wide shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all">
                                    Request OTP Link
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handlePasswordLogin} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Digital Identifier</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <i className="fa-regular fa-user"></i>
                                        </div>
                                        <input 
                                            type="text" 
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium placeholder-gray-400" 
                                            placeholder="Email or Username"
                                            value={pwEmail}
                                            onChange={(e) => setPwEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Access Token</label>
                                        <Link to="/forgot-password" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors">Recover</Link>
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <i className="fa-solid fa-asterisk text-xs"></i>
                                        </div>
                                        <input 
                                            type="password" 
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium placeholder-gray-400 tracking-widest" 
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3.5 rounded-xl font-bold tracking-wide shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all">
                                    Initialize Handshake
                                </button>
                            </form>
                        )}
                        
                        {/* Native WebAuthn Passkeys Component */}
                        <div className="mt-5">
                            <button onClick={handlePasskeyLogin} disabled={loading} className="w-full relative overflow-hidden group bg-gray-900 dark:bg-white text-white dark:text-black py-3.5 rounded-xl font-bold tracking-wide shadow-lg transition-all hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/40 dark:to-teal-500/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    <i className="fa-solid fa-fingerprint text-emerald-400 dark:text-emerald-600 text-lg"></i>
                                    Authenticate via Hardware Passkey
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="relative flex items-center py-6 z-20">
                        <div className="flex-grow border-t border-gray-300 dark:border-white/10"></div>
                        <span className="flex-shrink-0 mx-4 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Federated Access</span>
                        <div className="flex-grow border-t border-gray-300 dark:border-white/10"></div>
                    </div>

                    {/* Social Buttons Stack */}
                    <div className="grid grid-cols-2 gap-3 relative z-20">
                        <button onClick={() => handleSocialAuth('oauth_google')} className="flex items-center justify-center gap-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold transition-all shadow-sm">
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 pointer-events-none" alt="Google" />
                            <span>Google</span>
                        </button>
                        <button onClick={() => handleSocialAuth('oauth_github')} className="flex items-center justify-center gap-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold transition-all shadow-sm">
                            <i className="fa-brands fa-github text-xl text-gray-900 dark:text-white"></i>
                            <span>GitHub</span>
                        </button>
                    </div>

                    {/* Secondary Socials */}
                    <div className="mt-4 flex justify-center gap-4 relative z-20">
                        <button onClick={() => handleSocialAuth('oauth_twitter')} className="w-12 h-12 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-all hover:scale-110 shadow-sm">
                            <i className="fa-brands fa-x-twitter text-lg"></i>
                        </button>
                        <button onClick={() => handleSocialAuth('oauth_linkedin')} className="w-12 h-12 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-[#0A66C2] dark:text-blue-400 flex items-center justify-center transition-all hover:scale-110 shadow-sm">
                            <i className="fa-brands fa-linkedin-in text-lg"></i>
                        </button>
                    </div>

                </div>

                {/* Footer Switcher */}
                <div className="mt-8 text-center relative z-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <p className="text-gray-600 dark:text-gray-400 font-medium">
                        Unregistered Node? <Link to="/signup" className="text-blue-600 dark:text-blue-400 font-extrabold hover:text-blue-800 dark:hover:text-blue-300 transition-colors">Establish Identity</Link>
                    </p>
                </div>

            </div>
        </div>
    );
}
