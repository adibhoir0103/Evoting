import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ElectionWizard from '../components/Admin/ElectionWizard';
import VoterRolls from '../components/Admin/VoterRolls';
import AuditLogs from '../components/Admin/AuditLogs';
import { BlockchainService } from '../services/blockchainService';

function AdminPanel({ onAdminLogout }) {
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [statsError, setStatsError] = useState('');
    const [adminWallet, setAdminWallet] = useState(null);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const adminData = JSON.parse(localStorage.getItem('admin') || '{}');
    const adminEmail = adminData.email || 'admin@evote.gov';

    const fetchStats = async () => {
        try {
            setStatsError('');
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            } else {
                setStatsError('Failed to load dashboard statistics. Server returned an error.');
            }
        } catch (err) {
            console.error(err);
            setStatsError('Cannot reach backend server. Please ensure it is running.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            navigate('/admin-login');
            return;
        }
        fetchStats();

        // Check if MetaMask is already connected
        if (window.ethereum) {
            BlockchainService.getInstance().getCurrentAccount()
                .then(acc => setAdminWallet(acc))
                .catch(() => {});
        }
    }, [navigate]);

    const connectWallet = async (force = false) => {
        try {
            const acc = await BlockchainService.getInstance().connectWallet(force);
            setAdminWallet(acc);
        } catch (e) {
            console.error("Wallet connection cancelled or failed", e);
        }
    };

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '—';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    const getActionIcon = (action) => {
        if (!action) return 'fa-circle-info';
        const a = action.toUpperCase();
        if (a.includes('LOGIN')) return 'fa-right-to-bracket';
        if (a.includes('CREATE')) return 'fa-plus-circle';
        if (a.includes('UPDATE') || a.includes('TOGGLE')) return 'fa-pen';
        if (a.includes('DELETE') || a.includes('DROP')) return 'fa-trash';
        if (a.includes('UPLOAD') || a.includes('BULK')) return 'fa-upload';
        if (a.includes('ACTIVE') || a.includes('APPROVE')) return 'fa-check-circle';
        if (a.includes('PAUSE')) return 'fa-pause-circle';
        if (a.includes('CLOSE')) return 'fa-stop-circle';
        if (a.includes('DENIED')) return 'fa-ban';
        if (a.includes('ADD')) return 'fa-user-plus';
        return 'fa-circle-info';
    };

    const getActionColor = (action) => {
        if (!action) return 'text-blue-500 bg-blue-50';
        const a = action.toUpperCase();
        if (a.includes('DELETE') || a.includes('DROP') || a.includes('DENIED') || a.includes('CLOSE')) return 'text-red-500 bg-red-50';
        if (a.includes('CREATE') || a.includes('ADD') || a.includes('ACTIVE') || a.includes('APPROVE')) return 'text-green-500 bg-green-50';
        if (a.includes('PAUSE') || a.includes('TOGGLE')) return 'text-amber-500 bg-amber-50';
        return 'text-blue-500 bg-blue-50';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <i className="fa-solid fa-spinner fa-spin text-primary text-5xl"></i>
            </div>
        );
    }

    const sidebarTabs = [
        { key: 'overview', icon: 'fa-chart-pie', label: 'System Dashboard' },
        { key: 'elections', icon: 'fa-check-to-slot', label: 'Election Engine' },
        { key: 'voters', icon: 'fa-file-csv', label: 'Voter Whitelists' },
        { key: 'audit', icon: 'fa-timeline', label: 'Security Audits' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Mobile Top Bar */}
            <div className="md:hidden bg-slate-900 text-white flex items-center justify-between px-4 py-3 sticky top-0 z-30">
                <h2 className="text-lg font-extrabold tracking-tight">BharatE-Vote <span className="text-blue-400">Admin</span></h2>
                <button
                    onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                    className="text-white p-2 rounded-lg hover:bg-slate-800 transition"
                    aria-label="Toggle sidebar"
                >
                    <i className={`fa-solid ${mobileSidebarOpen ? 'fa-xmark' : 'fa-bars'} text-xl`}></i>
                </button>
            </div>

            {/* Sidebar Navigation */}
            <div className={`${mobileSidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col md:min-h-screen shadow-xl z-20`}>
                <div className="p-6 hidden md:block">
                    <h2 className="text-xl font-extrabold tracking-tight">BharatE-Vote <span className="text-blue-400">Admin</span></h2>
                </div>
                
                <nav className="flex-1 mt-2 md:mt-4 px-4 space-y-1">
                    {sidebarTabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setMobileSidebarOpen(false); }}
                            className={`w-full text-left px-4 py-3 rounded-lg flex items-center mb-2 transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                        >
                            <i className={`fa-solid ${tab.icon} w-6`}></i> {tab.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-700 bg-slate-900">
                    <div className="flex items-center space-x-3 p-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs uppercase">
                            A
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">Administrator</p>
                            <p className="text-xs text-slate-400 truncate">{adminEmail}</p>
                        </div>
                    </div>
                    <button onClick={() => { if (onAdminLogout) onAdminLogout(); navigate('/admin-login'); }} className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">
                        <i className="fa-solid fa-power-off"></i>
                        <span className="font-bold text-sm">Sign Out Node</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden md:max-h-screen">
                <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 md:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm z-0">
                    <div>
                        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight">
                            {activeTab === 'overview' && 'Constituency Operations Center'}
                            {activeTab === 'elections' && 'Dynamic Election Controller'}
                            {activeTab === 'voters' && 'Electoral Roll Management'}
                            {activeTab === 'audit' && 'Immutable Event Trails'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">GIGW 3.0 Compliant High-Security SaaS Panel</p>
                    </div>
                    <div className="flex items-center space-x-4 flex-wrap gap-2">
                        {adminWallet ? (
                             <div className="text-sm font-bold text-indigo-700 bg-indigo-50 flex items-center px-4 py-2 rounded-full border border-indigo-200 shadow-sm" aria-label="Connected MetaMask Wallet">
                                 <i className="fa-brands fa-ethereum mr-2"></i>
                                 {adminWallet.slice(0,6)}...{adminWallet.slice(-4)}
                                 <button onClick={() => connectWallet(true)} className="ml-3 text-xs underline hover:text-indigo-900 border-l border-indigo-300 pl-3">Switch Wallet</button>
                             </div>
                        ) : (
                             <button onClick={() => connectWallet(false)} className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center px-4 py-2 rounded-full shadow-sm transition">
                                 <i className="fa-solid fa-link mr-2"></i> Link MetaMask
                             </button>
                        )}
                        <div className="hidden md:flex text-sm font-bold text-gray-600 bg-gray-100 items-center px-4 py-2 rounded-full border border-gray-200 shadow-sm">
                            <span className="relative flex h-3 w-3 mr-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            API LINKED
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 p-4 md:p-8">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Error State */}
                            {statsError && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm flex items-center justify-between">
                                    <div className="flex items-center">
                                        <i className="fa-solid fa-triangle-exclamation text-red-500 mr-3 text-lg"></i>
                                        <div>
                                            <p className="text-sm font-bold text-red-800">Dashboard Data Unavailable</p>
                                            <p className="text-xs text-red-600 mt-0.5">{statsError}</p>
                                        </div>
                                    </div>
                                    <button onClick={fetchStats} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-sm">
                                        <i className="fa-solid fa-rotate-right mr-1"></i> Retry
                                    </button>
                                </div>
                            )}

                            {/* Row 1: Core Voting Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Eligible Voters</h3>
                                        <div className="bg-blue-100 p-2 rounded-lg"><i className="fa-solid fa-users text-blue-600"></i></div>
                                    </div>
                                    <p className="text-3xl md:text-4xl font-black text-gray-900">{stats?.totalUsers ?? 0}</p>
                                    <p className="text-xs text-gray-400 mt-1">Registered on platform</p>
                                </div>
                                <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Cast Ballots</h3>
                                        <div className="bg-green-100 p-2 rounded-lg"><i className="fa-solid fa-check-to-slot text-green-600"></i></div>
                                    </div>
                                    <p className="text-3xl md:text-4xl font-black text-gray-900">{stats?.votedUsers ?? 0}</p>
                                    <p className="text-xs text-gray-400 mt-1">Votes successfully cast</p>
                                </div>
                                <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Turnout Index</h3>
                                        <div className="bg-purple-100 p-2 rounded-lg"><i className="fa-solid fa-chart-line text-purple-600"></i></div>
                                    </div>
                                    <p className="text-3xl md:text-4xl font-black text-gray-900">{stats?.votingPercentage ?? 0}%</p>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                        <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(stats?.votingPercentage ?? 0, 100)}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: System Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                                <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Blockchain Validations</h3>
                                        <div className="bg-amber-100 p-2 rounded-lg"><i className="fa-brands fa-ethereum text-amber-600"></i></div>
                                    </div>
                                    <p className="text-3xl md:text-4xl font-black text-gray-900">{stats?.totalVotes ?? 0}</p>
                                    <p className="text-xs text-gray-400 mt-1">On-chain transactions</p>
                                </div>
                                <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-green-200 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-green-600 text-xs font-bold uppercase tracking-wider">Active Elections</h3>
                                        <div className="bg-green-100 p-2 rounded-lg"><i className="fa-solid fa-bolt text-green-600"></i></div>
                                    </div>
                                    <p className="text-3xl md:text-4xl font-black text-green-700">{stats?.activeElections ?? 0}</p>
                                    <p className="text-xs text-gray-400 mt-1">Currently accepting votes</p>
                                </div>
                                <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-amber-200 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-amber-600 text-xs font-bold uppercase tracking-wider">Pending Approvals</h3>
                                        <div className="bg-amber-100 p-2 rounded-lg"><i className="fa-solid fa-clock text-amber-600"></i></div>
                                    </div>
                                    <p className="text-3xl md:text-4xl font-black text-amber-700">{stats?.pendingApprovals ?? 0}</p>
                                    <p className="text-xs text-gray-400 mt-1">Awaiting Principal sign-off</p>
                                </div>
                            </div>
                            
                            {/* Bottom: Recent Activity + Quick Actions */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Recent Activity Feed */}
                                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                                        <h3 className="font-bold text-gray-900 flex items-center">
                                            <i className="fa-solid fa-clock-rotate-left text-primary mr-2"></i>
                                            Recent Activity
                                        </h3>
                                        <button onClick={() => setActiveTab('audit')} className="text-xs font-bold text-primary hover:underline">
                                            View All <i className="fa-solid fa-arrow-right ml-1"></i>
                                        </button>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {stats?.recentAudit && stats.recentAudit.length > 0 ? (
                                            stats.recentAudit.slice(0, 8).map((log, idx) => (
                                                <div key={idx} className="px-5 py-3 hover:bg-gray-50/50 transition flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getActionColor(log.action)}`}>
                                                        <i className={`fa-solid ${getActionIcon(log.action)} text-sm`}></i>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{log.action?.replace(/_/g, ' ')}</p>
                                                        <p className="text-xs text-gray-500 truncate">{log.details || 'No details'}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-xs text-gray-400 font-medium">{formatTimeAgo(log.created_at)}</p>
                                                        <p className="text-[10px] text-gray-400 truncate max-w-[100px]">{log.admin_email?.split('@')[0]}</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center">
                                                <i className="fa-solid fa-inbox text-gray-300 text-3xl mb-2"></i>
                                                <p className="text-gray-400 text-sm">No recent activity recorded yet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                                        <i className="fa-solid fa-bolt text-amber-500 mr-2"></i>
                                        Quick Actions
                                    </h3>
                                    <div className="space-y-3">
                                        <button onClick={() => setActiveTab('elections')} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition group text-left">
                                            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <i className="fa-solid fa-plus"></i>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">Create Election</p>
                                                <p className="text-[11px] text-gray-500">Draft new election cycle</p>
                                            </div>
                                        </button>
                                        <button onClick={() => setActiveTab('voters')} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50/50 transition group text-left">
                                            <div className="w-9 h-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <i className="fa-solid fa-user-plus"></i>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">Manage Voters</p>
                                                <p className="text-[11px] text-gray-500">Whitelist or import CSV</p>
                                            </div>
                                        </button>
                                        <button onClick={() => setActiveTab('audit')} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 transition group text-left">
                                            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <i className="fa-solid fa-timeline"></i>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">Audit Trail</p>
                                                <p className="text-[11px] text-gray-500">Export logs & CSV</p>
                                            </div>
                                        </button>
                                        <a href="/" target="_blank" rel="noreferrer" className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50/50 transition group text-left">
                                            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">View Public Portal</p>
                                                <p className="text-[11px] text-gray-500">Open voter-facing site</p>
                                            </div>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'elections' && <ElectionWizard />}
                    {activeTab === 'voters' && <VoterRolls />}
                    {activeTab === 'audit' && <AuditLogs />}
                </main>
            </div>
        </div>
    );
}

export default AdminPanel;
