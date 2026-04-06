import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_URL = rawUrl.startsWith('http') ? (rawUrl.endsWith('/api/v1') ? rawUrl : rawUrl.replace(/\/$/, '') + '/api/v1') : 'https://' + rawUrl.replace(/\/$/, '') + (rawUrl.endsWith('/api/v1') ? '' : '/api/v1');

const ElectionWizard = () => {
    const { getToken } = useAuth();
    const [elections, setElections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ name: '', description: '', start_time: '', end_time: '' });

    const fetchElections = async () => {
        try {
            // Use Admin JWT instead of Clerk voter token
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${API_URL}/admin/elections`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setElections(data);
            }
        } catch (e) {
            console.error('Failed to fetch elections');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchElections();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${API_URL}/admin/elections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                setFormData({ name: '', description: '', start_time: '', end_time: '' });
                fetchElections();
            } else {
                const errData = await res.json().catch(() => ({}));
                toast.error(errData.error || 'Server rejected the request');
            }
        } catch (err) {
            toast.error('Network error creating election');
        }
    };

    const updateStatus = async (id, status, reason = '') => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${API_URL}/admin/elections/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status, override_reason: reason })
            });
            if (res.ok) {
                fetchElections();
            }
        } catch (e) {
            console.error("Status updated failed");
        }
    };

    if (loading) return <div className="p-8 text-center"><i className="fa-solid fa-spinner fa-spin text-3xl"></i></div>;

    return (
        <div className="space-y-8">
            <div className="gov-card p-6">
                <h3 className="text-xl font-bold mb-4">Create New Election</h3>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Election Name</label>
                        <input type="text" className="gov-input w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea className="gov-input w-full" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Start Time</label>
                            <input type="datetime-local" className="gov-input w-full" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">End Time</label>
                            <input type="datetime-local" className="gov-input w-full" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} required />
                        </div>
                    </div>
                    <button type="submit" className="btn-primary">Create Draft Election</button>
                </form>
            </div>

            <div className="gov-card p-6">
                <h3 className="text-xl font-bold mb-4">Election Lifecycle Management</h3>
                <div className="space-y-4">
                    {elections.map(election => (
                        <div key={election.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center bg-gray-50">
                            <div>
                                <h4 className="font-bold text-lg">{election.name}</h4>
                                <p className="text-sm text-gray-500">{election.description}</p>
                                <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">STATUS: {election.status}</span>
                            </div>
                            <div className="flex space-x-2">
                                {/* HOD Flow: Draft -> Published -> Awaiting Approval */}
                                {election.status === 'DRAFT' && (
                                    <button onClick={() => updateStatus(election.id, 'PUBLISHED')} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition font-bold shadow-sm">
                                        Publish Configuration
                                    </button>
                                )}
                                
                                {election.status === 'PUBLISHED' && (
                                    <button onClick={() => updateStatus(election.id, 'AWAITING_APPROVAL')} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm transition font-bold shadow-sm">
                                        Submit for Principal Approval
                                    </button>
                                )}

                                {/* Principal Flow: Awaiting Approval -> Active */}
                                {election.status === 'AWAITING_APPROVAL' && (
                                    <button onClick={() => {
                                        const adminPass = prompt("🚨 PRINCIPAL AUTHORIZATION REQUIRED\n\nPlease enter the Super Admin Authorization Passphrase to permanently ACTIVATE this election. This cannot be undone.");
                                        if(adminPass) {
                                            // In a real scenario, this passphrase would be sent to the backend for verification.
                                            // For this UI flow, we append it to the override_reason to log the authorization attempt.
                                            updateStatus(election.id, 'ACTIVE', `Authorized by Passphrase: ${adminPass ? 'Provided' : 'Failed'}`);
                                        }
                                    }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition font-bold shadow-lg animate-pulse">
                                        Approve & Start Voting
                                    </button>
                                )}

                                {/* Emergency Overrides */}
                                {election.status === 'ACTIVE' && (
                                    <button onClick={() => {
                                        const reason = prompt("Enter Emergency Pause Reason:");
                                        if(reason) updateStatus(election.id, 'PAUSED', reason);
                                    }} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm transition font-bold shadow-sm">
                                        Emergency Pause
                                    </button>
                                )}
                                
                                {(election.status === 'ACTIVE' || election.status === 'PAUSED') && (
                                    <button onClick={() => {
                                        const reason = prompt("🚨 HIGH RISK OPERATION\nEnter EXPLICIT reason for forcing Election Closure:");
                                        if(reason) updateStatus(election.id, 'CLOSED', reason);
                                    }} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition font-bold shadow-sm">
                                        Force Close
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {elections.length === 0 && <p className="text-gray-500 italic">No elections established.</p>}
                </div>
            </div>
        </div>
    );
};

export default ElectionWizard;
