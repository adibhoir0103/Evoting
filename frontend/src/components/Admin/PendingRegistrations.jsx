import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { API_URL } from '../../config/api';

function PendingRegistrations() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState('PENDING'); // PENDING, APPROVED, REJECTED

    const fetchRegistrations = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/admin/voter-registrations?status=${filterStatus}`, { credentials: 'include',
                headers: {  }
            });
            if (!res.ok) throw new Error('Failed to fetch registrations');
            const data = await res.json();
            setRegistrations(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegistrations();
    }, [filterStatus]);

    const handleApprove = async (id, name) => {
        if (!window.confirm(`Are you sure you want to approve ${name}? This will generate credentials and send an email.`)) return;
        
        try {
            const res = await fetch(`${API_URL}/admin/voter-registrations/${id}/approve`, { credentials: 'include',
                method: 'POST',
                headers: {  }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Approval failed');
            
            toast.success(data.message);
            fetchRegistrations(); // refresh
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleReject = async (id, name) => {
        const reason = window.prompt(`Reason for rejecting ${name}:`);
        if (reason === null) return; // cancelled
        
        try {
            const res = await fetch(`${API_URL}/admin/voter-registrations/${id}/reject`, { credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json',  },
                body: JSON.stringify({ reason })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Rejection failed');
            
            toast.success(data.message);
            fetchRegistrations(); // refresh
        } catch (err) {
            toast.error(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold text-gray-900">Voter Registration Applications</h3>
                
                <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {['PENDING', 'APPROVED', 'REJECTED'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 text-sm font-semibold transition ${
                                filterStatus === status 
                                ? 'bg-primary text-white' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation"></i> {error}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Applicant</th>
                                <th className="px-6 py-4 font-semibold">Voter ID (EPIC)</th>
                                <th className="px-6 py-4 font-semibold">Applied On</th>
                                <th className="px-6 py-4 font-semibold">Location</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 text-primary"></i>
                                        <p>Loading applications...</p>
                                    </td>
                                </tr>
                            ) : registrations.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <i className="fa-solid fa-inbox text-gray-300 text-2xl"></i>
                                        </div>
                                        <p className="font-medium text-gray-600">No {filterStatus.toLowerCase()} applications found.</p>
                                    </td>
                                </tr>
                            ) : (
                                registrations.map(reg => (
                                    <tr key={reg.id} className="hover:bg-gray-50/50 transition">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{reg.fullname}</div>
                                            <div className="text-xs text-gray-500">{reg.email}</div>
                                            {reg.mobile_number && <div className="text-xs text-gray-500">{reg.mobile_number}</div>}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-primary font-medium">
                                            {reg.voter_id}
                                            {reg.aadhaar_number && (
                                                <span className="block text-xs text-green-600 mt-1" title="Aadhaar provided">
                                                    <i className="fa-solid fa-check-circle mr-1"></i>Aadhaar ✓
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs whitespace-nowrap">
                                            {new Date(reg.created_at).toLocaleDateString()}
                                            <br/>
                                            <span className="text-gray-400">{new Date(reg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            State: {reg.state_code || 'N/A'}<br/>
                                            Const: {reg.constituency_code || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {filterStatus === 'PENDING' ? (
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleReject(reg.id, reg.fullname)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition"
                                                    >
                                                        Reject
                                                    </button>
                                                    <button 
                                                        onClick={() => handleApprove(reg.id, reg.fullname)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-700 shadow-sm transition"
                                                    >
                                                        <i className="fa-solid fa-check mr-1"></i> Approve
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                    filterStatus === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {filterStatus}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default PendingRegistrations;
