import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { BlockchainService } from '../../services/blockchainService';

const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_URL = rawUrl.startsWith('http') ? (rawUrl.endsWith('/api/v1') ? rawUrl : rawUrl.replace(/\/$/, '') + '/api/v1') : 'https://' + rawUrl.replace(/\/$/, '') + (rawUrl.endsWith('/api/v1') ? '' : '/api/v1');

/** Inline confirmation modal — replaces unsafe prompt() calls */
function ConfirmModal({ open, title, description, inputLabel, inputPlaceholder, requireInput, dangerLevel, confirmText, onConfirm, onCancel }) {
    const [inputValue, setInputValue] = useState('');

    useEffect(() => { if (open) setInputValue(''); }, [open]);

    if (!open) return null;

    const borderColor = dangerLevel === 'critical' ? 'border-red-500' : dangerLevel === 'warning' ? 'border-amber-500' : 'border-blue-500';
    const btnColor = dangerLevel === 'critical' ? 'bg-red-600 hover:bg-red-700' : dangerLevel === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700';
    const iconColor = dangerLevel === 'critical' ? 'text-red-500' : dangerLevel === 'warning' ? 'text-amber-500' : 'text-blue-500';
    const icon = dangerLevel === 'critical' ? 'fa-triangle-exclamation' : dangerLevel === 'warning' ? 'fa-shield-halved' : 'fa-circle-question';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel}></div>
            <div className={`relative bg-white rounded-xl shadow-2xl max-w-md w-full border-t-4 ${borderColor} animate-[fadeIn_0.2s_ease-out]`}>
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full ${iconColor} bg-opacity-10 flex items-center justify-center shrink-0 mt-0.5`} style={{ backgroundColor: 'currentColor', opacity: 0.1 }}>
                            <i className={`fa-solid ${icon} text-lg ${iconColor}`} style={{ opacity: 1 }}></i>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{description}</p>
                        </div>
                    </div>

                    {(requireInput || inputLabel) && (
                        <div className="mt-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{inputLabel || 'Reason'}</label>
                            <input
                                type="text"
                                className="input-field w-full"
                                placeholder={inputPlaceholder || 'Enter reason...'}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                autoFocus
                            />
                        </div>
                    )}
                </div>
                <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3 bg-gray-50/50 rounded-b-xl">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(inputValue)}
                        disabled={requireInput && !inputValue.trim()}
                        className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${btnColor}`}
                    >
                        {confirmText || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const ElectionWizard = () => {
    const [elections, setElections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ name: '', description: '', start_time: '', end_time: '' });
    const [scCandidateData, setScCandidateData] = useState('');
    const [scPartyName, setScPartyName] = useState('');
    const [scPartySymbol, setScPartySymbol] = useState('');
    const [scStateCode, setScStateCode] = useState('0');
    const [scConstituencyCode, setScConstituencyCode] = useState('0');
    const [scCandidateLoading, setScCandidateLoading] = useState(false);

    // Modal state — replaces prompt()
    const [modal, setModal] = useState({ open: false, type: null, electionId: null });

    const fetchElections = async () => {
        try {
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
                toast.success('Election draft created successfully!');
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
                toast.success(`Election status updated to ${status}`);
                fetchElections();
            } else {
                const errData = await res.json().catch(() => ({}));
                toast.error(errData.error || 'Server rejected the status update');
            }
        } catch (e) {
            toast.error("Network error updating status");
        }
    };

    const handleModalConfirm = async (inputValue) => {
        const { type, electionId } = modal;
        setModal({ open: false, type: null, electionId: null });

        if (type === 'activate') {
            try {
                const id = toast.loading('Waiting for MetaMask signature to Start Election...');
                await BlockchainService.getInstance().startVoting();
                toast.success('Election cryptographically ACTIVATED!', { id });
                updateStatus(electionId, 'ACTIVE', `Authorized by Passphrase: Provided`);
            } catch (err) {
                toast.error(`Blockchain error: ${err.message || 'Transaction failed'}`);
            }
        } else if (type === 'pause') {
            updateStatus(electionId, 'PAUSED', inputValue);
        } else if (type === 'close') {
            try {
                const id = toast.loading('Waiting for MetaMask signature to Close Election...');
                await BlockchainService.getInstance().endVoting();
                toast.success('Election cryptographically CLOSED!', { id });
                updateStatus(electionId, 'CLOSED', inputValue);
            } catch (err) {
                toast.error(`Blockchain error: ${err.message || 'Transaction failed'}`);
            }
        }
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) return <div className="p-8 text-center"><i className="fa-solid fa-spinner fa-spin text-3xl"></i></div>;

    return (
        <div className="space-y-8">
            {/* Confirmation Modal */}
            {modal.type === 'activate' && (
                <ConfirmModal
                    open={modal.open}
                    title="Principal Authorization Required"
                    description="You are about to permanently ACTIVATE this election on the blockchain. This action requires a MetaMask transaction signature and cannot be undone."
                    inputLabel="Super Admin Authorization Passphrase"
                    inputPlaceholder="Enter passphrase to confirm..."
                    requireInput={true}
                    dangerLevel="warning"
                    confirmText="Approve & Start Voting"
                    onConfirm={handleModalConfirm}
                    onCancel={() => setModal({ open: false, type: null, electionId: null })}
                />
            )}
            {modal.type === 'pause' && (
                <ConfirmModal
                    open={modal.open}
                    title="Emergency Pause"
                    description="This will immediately pause the active election. All voting will be suspended until the election is reactivated."
                    inputLabel="Emergency Pause Reason (required for audit)"
                    inputPlaceholder="E.g., Security incident detected..."
                    requireInput={true}
                    dangerLevel="warning"
                    confirmText="Pause Election"
                    onConfirm={handleModalConfirm}
                    onCancel={() => setModal({ open: false, type: null, electionId: null })}
                />
            )}
            {modal.type === 'close' && (
                <ConfirmModal
                    open={modal.open}
                    title="Force Close Election"
                    description="This is a HIGH RISK irreversible operation. The election will be permanently closed on the blockchain. No further votes can be accepted."
                    inputLabel="Explicit reason for forcing closure (required for audit)"
                    inputPlaceholder="E.g., Scheduled end of polling period..."
                    requireInput={true}
                    dangerLevel="critical"
                    confirmText="Force Close Election"
                    onConfirm={handleModalConfirm}
                    onCancel={() => setModal({ open: false, type: null, electionId: null })}
                />
            )}

            <div className="gov-card p-6">
                <h3 className="text-xl font-bold mb-4">Create New Election</h3>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Election Name</label>
                        <input type="text" className="input-field w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea className="input-field w-full" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Start Time</label>
                            <input type="datetime-local" className="input-field w-full" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">End Time</label>
                            <input type="datetime-local" className="input-field w-full" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} required />
                        </div>
                    </div>
                    <button type="submit" className="btn-primary">Create Draft Election</button>
                </form>
            </div>

            <div className="gov-card p-6">
                <h3 className="text-xl font-bold mb-4">Election Lifecycle Management</h3>
                <div className="space-y-4">
                    {elections.map(election => (
                        <div key={election.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-sm transition">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-lg text-gray-900">{election.name}</h4>
                                    <p className="text-sm text-gray-500 mt-0.5">{election.description}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">STATUS: {election.status}</span>
                                        {election._count && (
                                            <>
                                                <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                                                    <i className="fa-solid fa-users mr-1"></i>{election._count.candidates || 0} candidates
                                                </span>
                                                <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                                                    <i className="fa-solid fa-check mr-1"></i>{election._count.votes || 0} votes
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    {(election.start_time || election.end_time) && (
                                        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                                            {election.start_time && (
                                                <span><i className="fa-solid fa-play mr-1 text-green-500"></i>Start: {formatDateTime(election.start_time)}</span>
                                            )}
                                            {election.end_time && (
                                                <span><i className="fa-solid fa-stop mr-1 text-red-500"></i>End: {formatDateTime(election.end_time)}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2 shrink-0">
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

                                    {/* Principal Flow: Awaiting Approval -> Active (uses modal instead of prompt) */}
                                    {election.status === 'AWAITING_APPROVAL' && (
                                        <button onClick={() => setModal({ open: true, type: 'activate', electionId: election.id })} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition font-bold shadow-lg animate-pulse">
                                            Approve & Start Voting
                                        </button>
                                    )}

                                    {/* Emergency Overrides (use modals instead of prompt) */}
                                    {election.status === 'ACTIVE' && (
                                        <button onClick={() => setModal({ open: true, type: 'pause', electionId: election.id })} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm transition font-bold shadow-sm">
                                            Emergency Pause
                                        </button>
                                    )}
                                    
                                    {(election.status === 'ACTIVE' || election.status === 'PAUSED') && (
                                        <button onClick={() => setModal({ open: true, type: 'close', electionId: election.id })} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition font-bold shadow-sm">
                                            Force Close
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {elections.length === 0 && <p className="text-gray-500 italic">No elections established.</p>}
                </div>
            </div>

            {/* Smart Contract Operations */}
            <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-purple-200">
                <h3 className="text-xl font-bold mb-2">
                    <i className="fa-brands fa-ethereum text-purple-600 mr-2"></i>Smart Contract: Add Candidates
                </h3>
                <p className="text-xs text-gray-500 mb-4">Candidates must be explicitly added to the Ethereum Smart Contract before the election is Activated.</p>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!scCandidateData.trim()) return;
                    setScCandidateLoading(true);
                    try {
                        const id = toast.loading('Waiting for MetaMask signature to append candidate...');
                        await BlockchainService.getInstance().addCandidate(
                            scCandidateData,
                            scPartyName,
                            scPartySymbol,
                            parseInt(scStateCode) || 0,
                            parseInt(scConstituencyCode) || 0
                        );
                        toast.success('Candidate mathematically secured on Blockchain!', { id });
                        setScCandidateData('');
                        setScPartyName('');
                        setScPartySymbol('');
                        setScStateCode('0');
                        setScConstituencyCode('0');
                    } catch (err) {
                        toast.error(err.message || 'Transaction failed');
                    } finally {
                        setScCandidateLoading(false);
                    }
                }} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Candidate Name *</label>
                            <input type="text" className="w-full px-4 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                                value={scCandidateData} onChange={(e) => setScCandidateData(e.target.value)} required placeholder="Sardar Patel" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Party Name</label>
                            <input type="text" className="w-full px-4 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                                value={scPartyName} onChange={(e) => setScPartyName(e.target.value)} placeholder="Iron Party" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Party Symbol</label>
                            <input type="text" className="w-full px-4 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                                value={scPartySymbol} onChange={(e) => setScPartySymbol(e.target.value)} placeholder="🔨 or HAMMER" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">State Code</label>
                                <input type="number" min="0" className="w-full px-4 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                                    value={scStateCode} onChange={(e) => setScStateCode(e.target.value)} placeholder="0 = National" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Constituency</label>
                                <input type="number" min="0" className="w-full px-4 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                                    value={scConstituencyCode} onChange={(e) => setScConstituencyCode(e.target.value)} placeholder="0 = All" />
                            </div>
                        </div>
                    </div>
                    <button type="submit" disabled={scCandidateLoading || !scCandidateData} className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition shadow-sm disabled:opacity-50">
                        {scCandidateLoading ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Processing...</> : <><i className="fa-solid fa-plus mr-2"></i> Stamp Candidate on Blockchain</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ElectionWizard;
