import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function CandidatesPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAffidavit, setSelectedAffidavit] = useState(null);

    const candidates = [
        { 
            id: 1, name: "Rajesh Kumar", party: "Janta Party", symbol: "fa-star", color: "#FF9933",
            affidavit: { edu: "M.A. Political Science", cases: 0, assets: "₹ 2.4 Crores", liabilities: "₹ 12 Lakhs", age: 45 }
        },
        { 
            id: 2, name: "Suresh Patil", party: "Progressive Alliance", symbol: "fa-leaf", color: "#28a745",
            affidavit: { edu: "B.Tech", cases: 1, assets: "₹ 5.1 Crores", liabilities: "₹ 45 Lakhs", age: 52 }
        },
        { 
            id: 3, name: "Amitabh Singh", party: "Tech Forward", symbol: "fa-laptop", color: "#007bff",
            affidavit: { edu: "Ph.D. Economics", cases: 0, assets: "₹ 1.2 Crores", liabilities: "Nil", age: 38 }
        },
        { 
            id: 4, name: "Lakshmi Devi", party: "United Front", symbol: "fa-hand-holding-heart", color: "#dc3545",
            affidavit: { edu: "LLB", cases: 2, assets: "₹ 14 Crores", liabilities: "₹ 2.1 Crores", age: 49 }
        },
        { 
            id: 5, name: "Abdul Wahab", party: "Peace Party", symbol: "fa-dove", color: "#6f42c1",
            affidavit: { edu: "B.A. History", cases: 0, assets: "₹ 85 Lakhs", liabilities: "₹ 5 Lakhs", age: 61 }
        },
        { 
            id: 10, name: "NOTA", party: "None of the Above", symbol: "fa-ban", color: "#343a40",
            affidavit: null
        }
    ];

    const filteredCandidates = candidates.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.party.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gov-bg font-sans py-8 relative">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 border-b-4 border-accent-saffron rounded-t-lg shadow-sm mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-50 text-accent-saffron rounded-full flex items-center justify-center text-2xl shadow-inner border border-orange-100">
                            <i className="fa-solid fa-address-card"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-primary">Know Your Candidates / उम्मीदवार विवरण</h1>
                            <p className="text-sm text-gray-500">View official affidavits, criminal records, and asset declarations.</p>
                        </div>
                    </div>
                    <Link to="/" className="mt-4 md:mt-0 text-sm font-semibold text-primary hover:text-accent-saffron transition-colors flex items-center gap-2 px-4 py-2 border border-gray-200 rounded">
                        <i className="fa-solid fa-arrow-left"></i> Home
                    </Link>
                </div>

                {/* Toolbar */}
                <div className="bg-white p-4 rounded shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-96">
                        <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            placeholder="Search by candidate or party name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-sm"
                        />
                    </div>
                    <div className="text-sm font-bold text-gray-600 bg-gray-100 px-4 py-2 rounded-full border border-gray-200">
                        {filteredCandidates.length} Contesting Candidates Found
                    </div>
                </div>

                {/* Data Grid */}
                <div className="bg-white rounded shadow-md border border-gray-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-primary text-white text-xs uppercase tracking-wider">
                                <th className="p-4 w-16 text-center">S.No</th>
                                <th className="p-4">Candidate Profile</th>
                                <th className="p-4 hidden md:table-cell">Party Affiliation</th>
                                <th className="p-4 w-24 text-center">Symbol</th>
                                <th className="p-4 w-40 text-center">Legal Affidavit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredCandidates.map((candidate, idx) => (
                                <tr key={candidate.id} className="hover:bg-blue-50 transition-colors">
                                    <td className="p-4 text-center font-bold text-gray-700 text-lg border-r border-gray-100 bg-gray-50">
                                        {candidate.id}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900 text-lg uppercase tracking-wide">{candidate.name}</div>
                                        <div className="text-xs text-gray-500 md:hidden mt-1 font-semibold">{candidate.party}</div>
                                    </td>
                                    <td className="p-4 hidden md:table-cell text-sm font-semibold text-gray-700">
                                        {candidate.party}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="w-12 h-12 rounded flex items-center justify-center mx-auto border border-gray-200 bg-white shadow-sm" style={{ color: candidate.color }}>
                                            <i className={`fa-solid ${candidate.symbol} text-2xl`}></i>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {candidate.affidavit ? (
                                            <button 
                                                onClick={() => setSelectedAffidavit(candidate)}
                                                className="text-xs font-bold px-3 py-1.5 bg-white border border-primary text-primary rounded hover:bg-primary hover:text-white transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-primary"
                                                aria-label={`View affidavit for ${candidate.name}`}
                                            >
                                                <i className="fa-solid fa-file-pdf mr-1"></i> View Form 26
                                            </button>
                                        ) : (
                                            <span className="text-xs font-bold text-gray-400 italic">Not Applicable</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredCandidates.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500 font-medium">
                                        <i className="fa-solid fa-folder-open text-3xl mb-3 text-gray-300 block"></i>
                                        No candidates found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Affidavit Modal */}
                {selectedAffidavit && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-t-8 border-primary">
                            
                            <div className="flex justify-between items-start p-6 border-b border-gray-200 bg-gray-50">
                                <div>
                                    <div className="text-xs font-bold text-accent-saffron uppercase tracking-widest mb-1">Form 26 Affidavit Summary</div>
                                    <h2 className="text-2xl font-black text-gray-900 uppercase">{selectedAffidavit.name}</h2>
                                    <p className="text-sm font-semibold text-gray-600 mt-1">{selectedAffidavit.party}</p>
                                </div>
                                <button 
                                    onClick={() => setSelectedAffidavit(null)}
                                    className="text-gray-400 hover:text-red-500 focus:outline-none transition-colors"
                                    aria-label="Close modal"
                                >
                                    <i className="fa-solid fa-xmark text-2xl"></i>
                                </button>
                            </div>

                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="bg-gray-50 p-4 border border-gray-200 rounded">
                                        <div className="flex items-center gap-3 mb-2">
                                            <i className="fa-solid fa-graduation-cap text-gray-400"></i>
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Education</span>
                                        </div>
                                        <div className="text-lg font-bold text-gray-900">{selectedAffidavit.affidavit.edu}</div>
                                    </div>
                                    <div className="bg-gray-50 p-4 border border-gray-200 rounded">
                                        <div className="flex items-center gap-3 mb-2">
                                            <i className="fa-solid fa-calendar text-gray-400"></i>
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Age</span>
                                        </div>
                                        <div className="text-lg font-bold text-gray-900">{selectedAffidavit.affidavit.age} Years</div>
                                    </div>
                                </div>

                                <h3 className="text-sm font-bold border-b border-gray-200 pb-2 mb-4 text-primary uppercase tracking-wider"><i className="fa-solid fa-scale-balanced mr-2"></i>Legal & Financial Declarations</h3>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-4 border rounded shadow-sm bg-white">
                                        <div className="font-semibold text-gray-700">Pending Criminal Cases</div>
                                        <div className={`font-black text-xl px-3 py-1 rounded ${selectedAffidavit.affidavit.cases > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {selectedAffidavit.affidavit.cases}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center p-4 border border-blue-100 rounded shadow-sm bg-blue-50">
                                        <div className="font-semibold text-blue-900">Total Assets Declared</div>
                                        <div className="font-black text-xl text-blue-800">
                                            {selectedAffidavit.affidavit.assets}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center p-4 border border-orange-100 rounded shadow-sm bg-orange-50">
                                        <div className="font-semibold text-orange-900">Total Liabilities</div>
                                        <div className="font-black text-xl text-orange-800">
                                            {selectedAffidavit.affidavit.liabilities}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                                    <p className="text-xs text-gray-500 mb-4 max-w-lg mx-auto">This information is parsed from the official Form 26 submitted to the returning officer by the candidate. Misrepresentation is punishable under RPA 1951.</p>
                                    <button className="bg-gray-800 hover:bg-black text-white px-6 py-2 rounded text-sm font-bold transition-colors shadow focus:ring-2 focus:ring-offset-1 focus:ring-black">
                                        <i className="fa-solid fa-download mr-2"></i> Download Full PDF Affidavit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CandidatesPage;
