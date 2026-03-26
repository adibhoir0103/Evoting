import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function SearchRollPage() {
    const [activeTab, setActiveTab] = useState('epic');
    const [searchParams, setSearchParams] = useState({
        epicNo: '',
        state: '',
        name: '',
        relativeName: '',
        dob: '',
        gender: ''
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSearch = (e) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        // Simulate search API call
        setTimeout(() => {
            setLoading(false);
            // Mock result
            setResult({
                name: searchParams.name || "Rajesh Kumar",
                epicNo: activeTab === 'epic' ? searchParams.epicNo : "ABC1234567",
                partNo: "125",
                serialNo: "452",
                pollingStation: "Public School, Ward 12, New Delhi",
                assembly: "New Delhi Central",
                state: searchParams.state || "Delhi",
                lastUpdated: new Date().toLocaleDateString()
            });
        }, 1200);
    };

    return (
        <div className="min-h-screen bg-gov-bg font-sans py-8">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 border-b-4 border-[#0b2b54] rounded-t-lg shadow-sm mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-[#0b2b54] rounded-full flex items-center justify-center text-2xl shadow-inner border border-blue-100">
                            <i className="fa-solid fa-users-viewfinder"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Electoral Search / मतदाता खोज</h1>
                            <p className="text-sm text-gray-500">Search your name in the National Electoral Roll</p>
                        </div>
                    </div>
                    <Link to="/" className="mt-4 md:mt-0 text-sm font-semibold text-[#0b2b54] hover:text-[#d97014] transition-colors flex items-center gap-2 px-4 py-2 border border-gray-200 rounded">
                        <i className="fa-solid fa-arrow-left"></i> Home
                    </Link>
                </div>

                {/* Form Section */}
                <div className="bg-white rounded shadow-md border border-gray-200 overflow-hidden mb-8">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 bg-gray-50">
                        <button 
                            className={`flex-1 py-4 px-6 text-sm font-bold uppercase tracking-wider focus:outline-none transition-colors border-b-4 ${activeTab === 'epic' ? 'border-[#d97014] text-[#0b2b54] bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
                            onClick={() => { setActiveTab('epic'); setResult(null); }}
                        >
                            <i className="fa-solid fa-id-card mr-2"></i> Search by EPIC
                        </button>
                        <button 
                            className={`flex-1 py-4 px-6 text-sm font-bold uppercase tracking-wider focus:outline-none transition-colors border-b-4 ${activeTab === 'details' ? 'border-[#d97014] text-[#0b2b54] bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
                            onClick={() => { setActiveTab('details'); setResult(null); }}
                        >
                            <i className="fa-solid fa-user-pen mr-2"></i> Search by Details
                        </button>
                    </div>

                    {/* Form Body */}
                    <div className="p-6 md:p-8">
                        <form onSubmit={handleSearch}>
                            {activeTab === 'epic' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">EPIC Number <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#0b2b54] focus:border-[#0b2b54] uppercase transition-all"
                                            placeholder="Ex: ABC1234567"
                                            value={searchParams.epicNo}
                                            onChange={(e) => setSearchParams({ ...searchParams, epicNo: e.target.value })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">EPIC stands for Electors Photo Identity Card number.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">State <span className="text-red-500">*</span></label>
                                        <select
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#0b2b54] focus:border-[#0b2b54] transition-all bg-white"
                                            value={searchParams.state}
                                            onChange={(e) => setSearchParams({ ...searchParams, state: e.target.value })}
                                        >
                                            <option value="">-- Select State --</option>
                                            <option value="Delhi">NCT OF Delhi</option>
                                            <option value="Maharashtra">Maharashtra</option>
                                            <option value="Karnataka">Karnataka</option>
                                            <option value="Uttar Pradesh">Uttar Pradesh</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">State <span className="text-red-500">*</span></label>
                                        <select
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded focus:ring-2 focus:ring-[#0b2b54] focus:border-[#0b2b54]"
                                            value={searchParams.state}
                                            onChange={(e) => setSearchParams({ ...searchParams, state: e.target.value })}
                                        >
                                            <option value="">-- Select State --</option>
                                            <option value="Delhi">Delhi</option>
                                            <option value="Maharashtra">Maharashtra</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">First Name <span className="text-red-500">*</span></label>
                                        <input type="text" required className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#0b2b54]" placeholder="First Name" value={searchParams.name} onChange={(e) => setSearchParams({ ...searchParams, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Relative's Name</label>
                                        <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#0b2b54]" placeholder="Father/Husband Name" value={searchParams.relativeName} onChange={(e) => setSearchParams({ ...searchParams, relativeName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth</label>
                                        <input type="date" className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#0b2b54]" value={searchParams.dob} onChange={(e) => setSearchParams({ ...searchParams, dob: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex justify-center border-t border-gray-100 pt-8">
                                <button type="submit" disabled={loading} className="bg-[#0b2b54] hover:bg-blue-900 text-white font-bold py-3 px-12 rounded shadow-md transition-all flex items-center gap-3 w-full sm:w-auto text-lg disabled:opacity-70 disabled:cursor-not-allowed">
                                    {loading ? (
                                        <><i className="fa-solid fa-circle-notch fa-spin"></i> Processing...</>
                                    ) : (
                                        <><i className="fa-solid fa-magnifying-glass"></i> Search Record</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Results Section */}
                {result && (
                    <div className="bg-white rounded-lg shadow-lg border border-green-200 overflow-hidden mb-12 animate-fade-in">
                        <div className="bg-green-50 px-6 py-4 border-b border-green-200 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-green-800 font-bold text-lg">
                                <i className="fa-solid fa-circle-check text-2xl"></i> Match Found in Electoral Roll
                            </div>
                            <span className="text-xs text-gray-500">Last Updated: {result.lastUpdated}</span>
                        </div>
                        
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-6">
                                <div className="border-l-4 border-[#0b2b54] pl-4">
                                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Elector's Name</div>
                                    <div className="text-lg font-bold text-gray-900">{result.name}</div>
                                </div>
                                <div className="border-l-4 border-[#d97014] pl-4">
                                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">EPIC Number</div>
                                    <div className="text-lg font-bold text-gray-900 font-mono tracking-widest">{result.epicNo}</div>
                                </div>
                                <div className="border-l-4 border-gray-300 pl-4">
                                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">State</div>
                                    <div className="text-lg font-bold text-gray-900">{result.state}</div>
                                </div>
                                <div className="border-l-4 border-gray-300 pl-4">
                                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Assembly Constituency</div>
                                    <div className="text-lg font-bold text-gray-900">{result.assembly}</div>
                                </div>
                                <div className="border-l-4 border-gray-300 pl-4">
                                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Part No. & Serial No.</div>
                                    <div className="text-lg font-bold text-gray-900">Part: {result.partNo} <span className="text-gray-400 mx-2">|</span> Serial: {result.serialNo}</div>
                                </div>
                                <div className="col-span-1 md:col-span-2 lg:col-span-3 border-l-4 border-green-500 pl-4 bg-gray-50 py-3 mt-2">
                                    <div className="text-xs text-green-700 font-semibold uppercase tracking-wider mb-1">Assigned Polling Station</div>
                                    <div className="text-xl font-bold text-gray-900 flex items-start gap-2">
                                        <i className="fa-solid fa-location-dot mt-1 text-green-600"></i> {result.pollingStation}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
                                <button className="border border-[#0b2b54] text-[#0b2b54] hover:bg-[#0b2b54] hover:text-white font-bold py-2 px-6 rounded transition-colors flex items-center gap-2 text-sm focus:ring-2 focus:ring-[#0b2b54] focus:ring-offset-2">
                                    <i className="fa-solid fa-print"></i> Print Voter Information
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SearchRollPage;
