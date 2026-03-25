import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

function SignupPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        fullname: '',
        voterId: '',
        email: '',
        aadhaarNumber: '',
        mobileNumber: '',
        stateCode: '',
        constituencyCode: '',
        password: '',
        confirmPassword: ''
    });

    const indianStates = [
        { code: 1, name: 'Andhra Pradesh' }, { code: 2, name: 'Arunachal Pradesh' },
        { code: 3, name: 'Assam' }, { code: 4, name: 'Bihar' },
        { code: 5, name: 'Chhattisgarh' }, { code: 6, name: 'Goa' },
        { code: 7, name: 'Gujarat' }, { code: 8, name: 'Haryana' },
        { code: 9, name: 'Himachal Pradesh' }, { code: 10, name: 'Jharkhand' },
        { code: 11, name: 'Karnataka' }, { code: 12, name: 'Kerala' },
        { code: 13, name: 'Madhya Pradesh' }, { code: 14, name: 'Maharashtra' },
        { code: 15, name: 'Manipur' }, { code: 16, name: 'Meghalaya' },
        { code: 17, name: 'Mizoram' }, { code: 18, name: 'Nagaland' },
        { code: 19, name: 'Odisha' }, { code: 20, name: 'Punjab' },
        { code: 21, name: 'Rajasthan' }, { code: 22, name: 'Sikkim' },
        { code: 23, name: 'Tamil Nadu' }, { code: 24, name: 'Telangana' },
        { code: 25, name: 'Tripura' }, { code: 26, name: 'Uttar Pradesh' },
        { code: 27, name: 'Uttarakhand' }, { code: 28, name: 'West Bengal' },
        { code: 29, name: 'Delhi (NCT)' }, { code: 30, name: 'Jammu & Kashmir' },
        { code: 31, name: 'Ladakh' }, { code: 32, name: 'Puducherry' },
        { code: 33, name: 'Chandigarh' }, { code: 34, name: 'Andaman & Nicobar' },
        { code: 35, name: 'Dadra & Nagar Haveli' }, { code: 36, name: 'Lakshadweep' }
    ];
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '#ccc' });

    const handleChange = (e) => {
        const { id, value } = e.target;

        // Strict Name Input
        if (id === 'fullname' && !/^[A-Za-z\s]*$/.test(value)) return;

        // Strict EPIC Input
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

        if (id === 'password') checkStrength(value);
    };

    const checkStrength = (pass) => {
        let score = 0;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[a-z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        let label = 'Too Short';
        let color = '#ccc';

        if (pass.length >= 8) {
            if (score <= 2) { label = 'Weak'; color = '#ef4444'; }
            else if (score <= 4) { label = 'Medium'; color = '#f97316'; }
            else { label = 'Strong'; color = '#10b981'; }
        }

        setPasswordStrength({ score, label, color });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!/^[A-Za-z\s]+$/.test(formData.fullname)) {
            setError('Full Name must contain only alphabets');
            return;
        }

        if (!/^[A-Z]{3}[0-9]{7}$/.test(formData.voterId)) {
            setError('EPIC ID must start with 3 alphabets followed by 7 numbers (e.g., ABC1234567)');
            return;
        }

        if (!/^\d{10}$/.test(formData.mobileNumber)) {
            setError('Mobile Number must be exactly 10 digits.');
            return;
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }
        if (!/[A-Z]/.test(formData.password)) {
            setError('Password must contain at least one uppercase letter');
            return;
        }
        if (!/[a-z]/.test(formData.password)) {
            setError('Password must contain at least one lowercase letter');
            return;
        }
        if (!/[0-9]/.test(formData.password)) {
            setError('Password must contain at least one number');
            return;
        }
        if (!/[^A-Za-z0-9]/.test(formData.password)) {
            setError('Password must contain at least one symbol');
            return;
        }

        setLoading(true);

        try {
            await authService.register(
                formData.fullname,
                formData.voterId,
                formData.email,
                formData.password,
                formData.aadhaarNumber,
                formData.mobileNumber,
                parseInt(formData.stateCode) || 0,
                parseInt(formData.constituencyCode) || 0
            );
            alert('Registration Successful! Redirecting to Login...');
            navigate('/login');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gov-bg flex flex-col font-sans">
            {/* Simple Govt Navbar */}
            <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
                <div className="bg-gray-100 py-1 px-4 sm:px-6 lg:px-8 text-xs font-medium text-gray-600 flex justify-between items-center border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <span className="bg-accent-saffron text-white px-2 py-0.5 rounded font-bold text-[10px]">DEMO</span>
                        <span>भारत सरकार | Government of India</span>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-3">
                        <img 
                            src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/220px-Emblem_of_India.svg.png" 
                            alt="Emblem of India" 
                            className="h-10 w-auto"
                        />
                        <div>
                            <span className="block text-xl font-bold text-primary leading-none">Bharat E-Vote</span>
                            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Citizen Registration</span>
                        </div>
                    </Link>
                    <Link to="/" className="btn-secondary text-sm py-1.5 px-4">
                        <i className="fa-solid fa-arrow-left mr-2"></i> Back
                    </Link>
                </div>
            </header>

            <main className="flex-grow p-4 py-8 md:py-12">
                <div className="gov-card max-w-2xl w-full mx-auto p-8 shadow-xl">
                    <div className="text-center mb-8 border-b border-gray-100 pb-6">
                        <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-blue-50 text-primary mb-4 border border-blue-100 shadow-inner">
                            <i className="fa-solid fa-user-plus text-2xl"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Voter Enrollment</h2>
                        <p className="text-gray-500 mt-2">Register your secure Aadhaar-linked voting account</p>
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
                            {/* Personal Details Section */}
                            <div className="space-y-4 md:col-span-2">
                                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2 mb-4">Personal Identity Details</h3>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="fullname" className="block text-sm font-semibold text-gray-700">
                                    <i className="fa-solid fa-user text-gray-400 mr-2"></i>Full Name (as per EPIC)
                                </label>
                                <input
                                    type="text"
                                    id="fullname"
                                    className="input-field"
                                    value={formData.fullname}
                                    onChange={handleChange}
                                    placeholder="Enter your full name"
                                    required
                                />
                                <p className="text-xs text-gray-500 ml-1">Alphabets only</p>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="voterId" className="block text-sm font-semibold text-gray-700">
                                    <i className="fa-solid fa-id-card text-gray-400 mr-2"></i>EPIC Number (Voter ID)
                                </label>
                                <input
                                    type="text"
                                    id="voterId"
                                    className="input-field uppercase tracking-wider font-mono text-sm"
                                    value={formData.voterId}
                                    onChange={handleChange}
                                    placeholder="AAA1234567"
                                    required
                                />
                                <p className="text-xs text-gray-500 ml-1">Format: 3 Letters + 7 Numbers</p>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="aadhaarNumber" className="block text-sm font-semibold text-gray-700">
                                    <i className="fa-solid fa-fingerprint text-gray-400 mr-2"></i>Aadhaar Number
                                </label>
                                <input
                                    type="text"
                                    id="aadhaarNumber"
                                    className="input-field tracking-widest font-mono text-sm placeholder-gray-300"
                                    value={formData.aadhaarNumber}
                                    onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                                    placeholder="XXXX XXXX XXXX"
                                    maxLength="12"
                                    required
                                />
                                <p className="text-xs text-gray-500 ml-1">Required for 2FA secure login</p>
                            </div>

                            {/* Contact Details Section */}
                            <div className="space-y-4 md:col-span-2 mt-2">
                                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2 mb-4">Contact Information</h3>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                                    <i className="fa-solid fa-envelope text-gray-400 mr-2"></i>Email Address
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    className="input-field"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="voter@example.com"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="mobileNumber" className="block text-sm font-semibold text-gray-700">
                                    <i className="fa-solid fa-mobile-screen text-gray-400 mr-2"></i>Mobile Number
                                </label>
                                <div className="flex relative">
                                    <span className="inline-flex flex-shrink-0 items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 font-medium">+91</span>
                                    <input
                                        type="text"
                                        id="mobileNumber"
                                        className="input-field rounded-l-none"
                                        value={formData.mobileNumber}
                                        onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        placeholder="Enter 10-digit number"
                                        maxLength="10"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Location Section */}
                            <div className="space-y-4 md:col-span-2 mt-2">
                                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2 mb-4">Electoral Details</h3>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="stateCode" className="block text-sm font-semibold text-gray-700">
                                    <i className="fa-solid fa-map-location-dot text-gray-400 mr-2"></i>State / Union Territory
                                </label>
                                <div className="relative">
                                    <select
                                        id="stateCode"
                                        className="input-field appearance-none bg-white pr-10"
                                        value={formData.stateCode}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="" disabled>Select your State/UT</option>
                                        {indianStates.map(s => (
                                            <option key={s.code} value={s.code}>{s.name}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                        <i className="fa-solid fa-chevron-down text-sm"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="constituencyCode" className="block text-sm font-semibold text-gray-700">
                                    <i className="fa-solid fa-landmark-dome text-gray-400 mr-2"></i>Constituency Number
                                </label>
                                <input
                                    type="number"
                                    id="constituencyCode"
                                    className="input-field"
                                    value={formData.constituencyCode}
                                    onChange={(e) => setFormData({ ...formData, constituencyCode: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                                    placeholder="e.g., 1"
                                    min="1"
                                    max="255"
                                    required
                                />
                                <p className="text-xs text-gray-500 ml-1">Parliamentary constituency no.</p>
                            </div>

                            {/* Security Section */}
                            <div className="space-y-4 md:col-span-2 mt-2">
                                <h3 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2 mb-4">Account Security</h3>
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                                    <i className="fa-solid fa-lock text-gray-400 mr-2"></i>Create Password
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    className="input-field"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Min 8 chars, 1 Upper, 1 Sym"
                                    required
                                />
                                {formData.password && (
                                    <div className="mt-2">
                                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full transition-all duration-300"
                                                style={{ 
                                                    width: `${(passwordStrength.score / 5) * 100}%`,
                                                    backgroundColor: passwordStrength.color 
                                                }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-[10px] mt-1 font-medium">
                                            <span className="text-gray-500">Strength:</span>
                                            <span style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">
                                    <i className="fa-solid fa-lock text-gray-400 mr-2"></i>Confirm Password
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    className="input-field"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Re-enter password"
                                    required
                                />
                            </div>
                        </div>

                        {/* Declaration */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8 flex gap-3">
                            <div className="mt-0.5">
                                <input 
                                    type="checkbox" 
                                    id="declaration" 
                                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2 cursor-pointer" 
                                    required 
                                />
                            </div>
                            <label htmlFor="declaration" className="text-sm text-gray-700 cursor-pointer">
                                <span className="font-semibold text-gray-900 block mb-1">Declaration of Authenticity</span>
                                I hereby declare that I am an Indian citizen above 18 years of age. All information provided is true to the best of my knowledge. I understand that providing false information for electoral registration is punishable under Section 31 of the Representation of the People Act, 1950.
                            </label>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary w-full py-4 text-lg mt-6 shadow-md"
                            disabled={loading}
                        >
                            {loading ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : <i className="fa-solid fa-user-check mr-2"></i>}
                            {loading ? 'Processing Registration...' : 'Complete Registration'}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                        <p className="text-gray-600">
                            Already registered?{' '}
                            <Link to="/login" className="text-primary font-bold hover:underline focus:outline-none">
                                Sign In instead
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default SignupPage;
