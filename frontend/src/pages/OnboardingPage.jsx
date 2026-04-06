import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { indianStates } from '../utils/indianStates';
import { authService } from '../services/authService';

const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_URL = rawUrl.startsWith('http') ? (rawUrl.endsWith('/api/v1') ? rawUrl : rawUrl.replace(/\/$/, '') + '/api/v1') : 'https://' + rawUrl.replace(/\/$/, '') + (rawUrl.endsWith('/api/v1') ? '' : '/api/v1');

export default function OnboardingPage({ clerkUser, onComplete }) {
    const { getToken } = useAuth();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        fullname: clerkUser?.fullName || '',
        voterId: '',
        aadhaarNumber: '',
        mobileNumber: '',
        stateCode: '',
        constituencyCode: ''
    });

    const handleChange = (e) => {
        const { id, value } = e.target;
        if (id === 'fullname' && !/^[A-Za-z\s]*$/.test(value)) return;

        if (id === 'voterId') {
            const upperVal = value.toUpperCase();
            if (upperVal.length > 10) return;
            if (upperVal.length <= 3 && !/^[A-Z]*$/.test(upperVal)) return;
            if (upperVal.length > 3) {
                if (!/^[A-Z]{3}/.test(upperVal)) return;
                if (!/^\d*$/.test(upperVal.slice(3))) return;
            }
            setFormData({ ...formData, [id]: upperVal });
            return;
        }
        setFormData({ ...formData, [id]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!/^[A-Za-z\s]+$/.test(formData.fullname)) {
            return setError('Full Name must contain only alphabets');
        }
        if (!/^[A-Z]{3}[0-9]{7}$/.test(formData.voterId)) {
            return setError('EPIC ID must start with 3 alphabets followed by 7 numbers (e.g., ABC1234567)');
        }
        if (!/^\d{10}$/.test(formData.mobileNumber)) {
            return setError('Mobile Number must be exactly 10 digits.');
        }

        setLoading(true);

        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/auth/register-clerk`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    fullname: formData.fullname,
                    voterId: formData.voterId,
                    aadhaarNumber: formData.aadhaarNumber,
                    mobileNumber: formData.mobileNumber,
                    stateCode: parseInt(formData.stateCode) || 0,
                    constituencyCode: parseInt(formData.constituencyCode) || 0,
                    email: clerkUser?.primaryEmailAddress?.emailAddress
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to sync Voter Profile');

            toast.success('Onboarding Complete! Redirecting...', { duration: 3000 });
            
            // Sync the user back via authService
            const dbUser = await authService.getCurrentUser(token);
            if(onComplete && dbUser) onComplete(dbUser);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gov-bg flex flex-col font-sans">
            <main className="flex-grow p-4 py-8 md:py-12">
                <div className="gov-card max-w-2xl w-full mx-auto p-8 shadow-xl">
                    <div className="text-center mb-8 border-b border-gray-100 pb-6">
                        <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-blue-50 text-primary mb-4 border border-blue-100 shadow-inner">
                            <i className="fa-solid fa-address-card text-2xl"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Complete E-Voter Profile</h2>
                        <p className="text-gray-500 mt-2">Almost there! We need a few more standard KYC details.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
                                <div className="flex">
                                    <div className="flex-shrink-0"><i className="fa-solid fa-circle-exclamation text-red-500"></i></div>
                                    <div className="ml-3"><p className="text-sm text-red-700">{error}</p></div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4 md:col-span-2">
                                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2 mb-4">Official Identity</h3>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="fullname" className="block text-sm font-semibold text-gray-700">Full Name (as per EPIC)</label>
                                <input type="text" id="fullname" className="input-field" value={formData.fullname} onChange={handleChange} required />
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="voterId" className="block text-sm font-semibold text-gray-700">EPIC Number</label>
                                <input type="text" id="voterId" className="input-field uppercase tracking-wider font-mono text-sm" value={formData.voterId} onChange={handleChange} placeholder="AAA1234567" required />
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="aadhaarNumber" className="block text-sm font-semibold text-gray-700">Aadhaar Number</label>
                                <input type="text" id="aadhaarNumber" className="input-field tracking-widest font-mono text-sm" value={formData.aadhaarNumber} onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="XXXX XXXX XXXX" maxLength="12" required />
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="mobileNumber" className="block text-sm font-semibold text-gray-700">Mobile Number</label>
                                <div className="flex relative">
                                    <span className="inline-flex flex-shrink-0 items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500">+91</span>
                                    <input type="text" id="mobileNumber" className="input-field rounded-l-none" value={formData.mobileNumber} onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })} maxLength="10" required />
                                </div>
                            </div>

                            <div className="space-y-4 md:col-span-2 mt-2">
                                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2 mb-4">Jurisdiction</h3>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="stateCode" className="block text-sm font-semibold text-gray-700">State / Union Territory</label>
                                <select id="stateCode" className="input-field" value={formData.stateCode} onChange={handleChange} required>
                                    <option value="" disabled>Select your State</option>
                                    {indianStates.map((state) => (
                                        <option key={state.code} value={state.id}>{state.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="constituencyCode" className="block text-sm font-semibold text-gray-700">Constituency Number</label>
                                <input type="text" id="constituencyCode" className="input-field" value={formData.constituencyCode} onChange={(e) => setFormData({ ...formData, constituencyCode: e.target.value.replace(/\D/g, '') })} placeholder="E.g., 14" required />
                            </div>
                        </div>

                        <div className="pt-6">
                            <button type="submit" disabled={loading} className="btn-primary w-full shadow-lg hover:shadow-xl py-3 text-lg">
                                {loading ? (<span><i className="fa-solid fa-spinner fa-spin mr-2"></i> Syncing Profile...</span>) : (<span><i className="fa-solid fa-check-shield mr-2"></i> Finalize Enrollment</span>)}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
