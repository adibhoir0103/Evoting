import React, { useState } from 'react';
import { useSignUp } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Turnstile from '../components/Turnstile';

export default function SignupPage() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [checkingOtp, setCheckingOtp] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState(null);

    const handleSignupWithPassword = async (e) => {
        e.preventDefault();
        if (!isLoaded) return;
        setLoading(true);

        try {
            await signUp.create({
                emailAddress: email,
                password,
            });

            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setCheckingOtp(true);
            toast.success("Verification token deployed to your address.");
            
        } catch (err) {
            toast.error(err.errors?.[0]?.message || 'Node registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!isLoaded) return;
        setLoading(true);

        try {
            const attempt = await signUp.attemptEmailAddressVerification({ code: otpCode });
            if (attempt.status === 'complete') {
                await setActive({ session: attempt.createdSessionId });
                toast.success("Cryptographic Identity formed successfully!");
                navigate('/onboarding');
            } else {
                toast.error("Handshake failed. Token invalid.");
            }
        } catch (err) {
            toast.error(err.errors?.[0]?.message || 'Invalid topological code');
        } finally {
            setLoading(false);
        }
    };

    const handleSocialAuth = async (strategy) => {
        if (!isLoaded) return;
        try {
            await signUp.authenticateWithRedirect({
                strategy,
                redirectUrl: '/sso-callback',
                redirectUrlComplete: '/onboarding',
            });
        } catch (err) {
            toast.error('OAuth configuration protocol missing.');
        }
    };

    if (checkingOtp) {
        return (
            <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden bg-gray-50 dark:bg-[#070e20] transition-colors duration-500">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-400/20 dark:bg-teal-600/30 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>
                
                <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 transition-all duration-500">
                    <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-10 shadow-2xl rounded-3xl">
                        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-white/20">
                            <i className="fa-solid fa-envelope-open-text text-3xl text-teal-600 dark:text-teal-400"></i>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white text-center mb-2 tracking-tight">Verify Deployment</h2>
                        <p className="text-sm text-gray-500 dark:text-teal-200/60 text-center mb-8">Enter the 6-digit cryptographic token sent to {email}</p>
                        
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <input 
                                type="text" 
                                className="w-full px-4 py-4 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-center text-2xl tracking-[0.75em] font-mono text-gray-900 dark:text-white transition-all shadow-inner" 
                                value={otpCode} 
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                required 
                                placeholder="●●●●●●"
                            />
                            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white py-4 rounded-xl font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all">
                                {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Finalize Registration'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 relative overflow-hidden bg-gray-50 dark:bg-[#070e20] transition-colors duration-500 font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-teal-500/20 dark:bg-teal-600/20 rounded-full blur-[150px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 dark:bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none"></div>

            {/* Invisible Turnstile Bot Protection */}
            <Turnstile onVerify={setTurnstileToken} action="signup" />

            <div className="w-full max-w-md relative z-10 transition-all duration-500 mt-4">
                
                {/* Main Glassmorphic Card */}
                <div className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-8 shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl relative overflow-hidden">
                    
                    {/* Header */}
                    <div className="text-center mb-8 relative z-20">
                        <div className="inline-flex justify-center items-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 dark:from-white/5 dark:to-white/10 text-teal-600 dark:text-teal-400 mb-5 border border-teal-500/30 dark:border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] backdrop-blur-md">
                            <i className="fa-solid fa-user-plus text-3xl"></i>
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Node Identity</h2>
                        <p className="text-sm text-gray-500 dark:text-teal-200/60 mt-2 font-medium tracking-wide">Register your gateway presence</p>
                    </div>

                    {/* Dynamic Forms */}
                    <div className="relative z-20">
                        <form onSubmit={handleSignupWithPassword} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Transmission Address</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-teal-500 transition-colors">
                                        <i className="fa-regular fa-envelope"></i>
                                    </div>
                                    <input 
                                        type="email" 
                                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-medium placeholder-gray-400" 
                                        placeholder="Email Address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Cryptographic Key</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-teal-500 transition-colors">
                                        <i className="fa-solid fa-lock text-sm"></i>
                                    </div>
                                    <input 
                                        type="password" 
                                        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-medium placeholder-gray-400 tracking-widest" 
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white py-3.5 rounded-xl font-bold tracking-wide shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all">
                                Construct Identity Node
                            </button>
                        </form>
                    </div>

                    {/* Divider */}
                    <div className="relative flex items-center py-6 z-20 mt-4">
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
                        <button onClick={() => handleSocialAuth('oauth_linkedin')} className="w-12 h-12 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-[#0A66C2] dark:text-teal-400 flex items-center justify-center transition-all hover:scale-110 shadow-sm">
                            <i className="fa-brands fa-linkedin-in text-lg"></i>
                        </button>
                    </div>

                </div>

                {/* Footer Switcher */}
                <div className="mt-8 text-center relative z-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <p className="text-gray-600 dark:text-gray-400 font-medium">
                        Node Already Verified? <Link to="/login" className="text-teal-600 dark:text-teal-400 font-extrabold hover:text-teal-800 dark:hover:text-teal-300 transition-colors">Log In Securely</Link>
                    </p>
                </div>

            </div>
        </div>
    );
}
