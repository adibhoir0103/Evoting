import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { BlockchainService } from '../../services/blockchainService';

const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_URL = rawUrl.startsWith('http') ? (rawUrl.endsWith('/api/v1') ? rawUrl : rawUrl.replace(/\/$/, '') + '/api/v1') : 'https://' + rawUrl.replace(/\/$/, '') + (rawUrl.endsWith('/api/v1') ? '' : '/api/v1');

const VoterRolls = () => {
    const [voters, setVoters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [formData, setFormData] = useState({ email: '', fullname: '', voter_id: '', status: 'WHITELIST' });
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [blockchainAddress, setBlockchainAddress] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    const getToken = () => localStorage.getItem('adminToken');

    const fetchVoters = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/approved-voters`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setVoters(data);
            }
        } catch (e) {
            console.error('Failed to fetch voters');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchVoters(); }, []);

    const handleAddVoter = async (e) => {
        e.preventDefault();
        if (!formData.email) return;
        setMessage('');

        try {
            const res = await fetch(`${API_URL}/admin/approved-voters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(`✅ ${formData.email} added as ${formData.status}`);
                setFormData({ email: '', fullname: '', voter_id: '', status: 'WHITELIST' });
                fetchVoters();
            } else {
                setMessage(`❌ ${data.error}`);
            }
        } catch (err) {
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                setMessage('❌ Cannot reach backend server. Make sure it is running on the correct port.');
            } else {
                setMessage('❌ Failed to add voter: ' + (err.message || 'Network error'));
            }
        }
    };

    const handleToggle = async (id, currentStatus) => {
        const newStatus = currentStatus === 'WHITELIST' ? 'BLACKLIST' : 'WHITELIST';
        try {
            const res = await fetch(`${API_URL}/admin/approved-voters/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) fetchVoters();
        } catch (e) {
            console.error('Toggle failed');
        }
    };

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`${API_URL}/admin/approved-voters/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                toast.success('Voter removed from approved list');
                fetchVoters();
            } else {
                toast.error('Failed to remove voter');
            }
        } catch (e) {
            toast.error('Network error removing voter');
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handleBulkUpload = async (e) => {
        e.preventDefault();
        if (!file) return;
        setUploading(true);
        setMessage('');

        const fd = new FormData();
        fd.append('file', file);

        try {
            const res = await fetch(`${API_URL}/admin/approved-voters/bulk`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: fd
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(`✅ Bulk upload: ${data.successCount} added, ${data.errorCount} skipped`);
                setFile(null);
                fetchVoters();
            } else {
                setMessage(`❌ ${data.error}`);
            }
        } catch (err) {
            setMessage('❌ Bulk upload failed');
        } finally {
            setUploading(false);
        }
    };

    const filteredVoters = voters.filter(v =>
        v.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.fullname || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const whitelistCount = voters.filter(v => v.status === 'WHITELIST').length;
    const blacklistCount = voters.filter(v => v.status === 'BLACKLIST').length;

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Approved</p>
                    <p className="text-3xl font-black text-gray-900 mt-1">{voters.length}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-green-200">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider">Whitelisted</p>
                    <p className="text-3xl font-black text-green-700 mt-1">{whitelistCount}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-red-200">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Blacklisted</p>
                    <p className="text-3xl font-black text-red-700 mt-1">{blacklistCount}</p>
                </div>
            </div>

            {/* Direct Blockchain Authorization */}
            <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-indigo-200">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                    <i className="fa-brands fa-ethereum text-indigo-600 mr-2"></i>Direct Smart Contract Authorization
                </h3>
                <p className="text-xs text-gray-500 mb-4">You must explicitly authorize public wallet addresses on the blockchain for testing.</p>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!blockchainAddress.trim()) return;
                    setAuthLoading(true);
                    try {
                        const service = BlockchainService.getInstance();
                        const id = toast.loading('Waiting for MetaMask signature...');
                        await service.authorizeVoter(blockchainAddress);
                        toast.success('Address authorized on the Blockchain!', { id });
                        setBlockchainAddress('');
                    } catch (err) {
                        toast.error(err.message || 'Failed to authorize transaction');
                    } finally {
                        setAuthLoading(false);
                    }
                }} className="flex items-center gap-3">
                    <input type="text" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono" 
                        value={blockchainAddress} onChange={(e) => setBlockchainAddress(e.target.value)} required placeholder="0x... (Public Wallet Address)" />
                    <button type="submit" disabled={authLoading || !blockchainAddress} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50">
                        {authLoading ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Authorizing...</> : <><i className="fa-solid fa-link mr-2"></i> Authorize Wallet</>}
                    </button>
                </form>
            </div>

            {/* Manual Entry Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                    <i className="fa-solid fa-user-plus text-blue-600 mr-2"></i>Add Voter Manually
                </h3>
                <form onSubmit={handleAddVoter} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                        <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                            value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required placeholder="voter@email.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
                        <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                            value={formData.fullname} onChange={(e) => setFormData({...formData, fullname: e.target.value})} placeholder="John Doe" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Voter ID</label>
                        <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                            value={formData.voter_id} onChange={(e) => setFormData({...formData, voter_id: e.target.value})} placeholder="ABC1234567" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                            value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                            <option value="WHITELIST">✅ Whitelist</option>
                            <option value="BLACKLIST">🚫 Blacklist</option>
                        </select>
                    </div>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm">
                        <i className="fa-solid fa-plus mr-1"></i> Add
                    </button>
                </form>
            </div>

            {/* CSV Bulk Upload */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                    <i className="fa-solid fa-file-csv text-green-600 mr-2"></i>Bulk Import (CSV)
                </h3>
                <p className="text-xs text-gray-500 mb-3">CSV columns: <code className="bg-gray-100 px-1 rounded">email</code> (required), <code className="bg-gray-100 px-1 rounded">fullname</code>, <code className="bg-gray-100 px-1 rounded">voter_id</code>, <code className="bg-gray-100 px-1 rounded">status</code></p>
                <form onSubmit={handleBulkUpload} className="flex items-center gap-3">
                    <input type="file" accept=".csv" onChange={(e) => { setFile(e.target.files[0]); setMessage(''); }}
                        className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                    <button type="submit" disabled={uploading || !file} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition shadow-sm disabled:opacity-50">
                        {uploading ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i> Uploading...</> : <><i className="fa-solid fa-upload mr-1"></i> Import CSV</>}
                    </button>
                </form>
            </div>

            {/* Status Messages */}
            {message && (
                <div className={`p-4 rounded-lg text-sm font-medium ${message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message}
                </div>
            )}

            {/* Voter Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">
                        <i className="fa-solid fa-list-check text-purple-600 mr-2"></i>Approved Voter Registry
                    </h3>
                    <div className="relative">
                        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                        <input type="text" placeholder="Search voters..." className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500" 
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center"><i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i></div>
                ) : filteredVoters.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <i className="fa-solid fa-user-slash text-3xl mb-2"></i>
                        <p>No approved voters yet. Add voters manually or upload a CSV.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 text-left">Email</th>
                                    <th className="px-4 py-3 text-left">Name</th>
                                    <th className="px-4 py-3 text-left">Voter ID</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredVoters.map(v => (
                                    <tr key={v.id} className="hover:bg-gray-50 transition">
                                        <td className="px-4 py-3 font-medium text-gray-900">{v.email}</td>
                                        <td className="px-4 py-3 text-gray-600">{v.fullname || '—'}</td>
                                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{v.voter_id || '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                v.status === 'WHITELIST' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {v.status === 'WHITELIST' ? '✅ Whitelist' : '🚫 Blacklist'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center space-x-2">
                                            <button onClick={() => handleToggle(v.id, v.status)} 
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                                                    v.status === 'WHITELIST' 
                                                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                                                }`}>
                                                {v.status === 'WHITELIST' ? 'Blacklist' : 'Whitelist'}
                                            </button>
                                            {deleteConfirmId === v.id ? (
                                                <>
                                                    <span className="text-xs text-red-600 font-medium">Sure?</span>
                                                    <button onClick={() => handleDelete(v.id)} className="px-2 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition">Yes</button>
                                                    <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition">No</button>
                                                </>
                                            ) : (
                                                <button onClick={() => setDeleteConfirmId(v.id)} className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-50 text-gray-600 hover:bg-gray-100 transition">
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoterRolls;
