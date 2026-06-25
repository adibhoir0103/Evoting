import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ElectionWizard from '../components/Admin/ElectionWizard';
import VoterRolls from '../components/Admin/VoterRolls';
import AuditLogs from '../components/Admin/AuditLogs';
import PendingRegistrations from '../components/Admin/PendingRegistrations';
import { BlockchainService } from '../services/blockchainService';
import { TurnoutChart, ActivityChart } from '../components/Admin/AdminCharts';

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
            const res = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/admin/stats`, {
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
            <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
                <div className="hidden md:block w-full md:w-64 bg-slate-900 flex-shrink-0 min-h-screen shadow-xl z-20"></div>
                <div className="flex-1 p-8 space-y-6">
                    <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse mb-8"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-32 animate-pulse"></div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-32 animate-pulse"></div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-32 animate-pulse"></div>
                    </div>
                </div>
            </div>
        );
    }

    const sidebarTabs = [
        { key: 'overview', icon: 'fa-chart-pie', label: 'System Dashboard' },
        { key: 'registrations', icon: 'fa-user-clock', label: 'Voter Applications' },
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
                            {activeTab === 'registrations' && 'Voter Registration Applications'}
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
                                {/* Voter Card */}
                                <div className="bg-gradient-to-br from-white to-blue-50/30 p-5 md:p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-100 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div>
                                            <h3 className="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-1">Eligible Voters</h3>
                                            <p className="text-4xl font-black text-gray-900 tracking-tight">{stats?.totalUsers ?? 0}</p>
                                        </div>
                                        <div className="bg-blue-500 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-md">
                                            <i className="fa-solid fa-users"></i>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium relative z-10 flex items-center">
                                        <i className="fa-solid fa-shield-halved text-blue-400 mr-1.5"></i>
                                        Cryptographically verified identities
                                    </p>
                                </div>
                                
                                {/* Cast Ballots Card */}
                                <div className="bg-gradient-to-br from-white to-emerald-50/30 p-5 md:p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(16,185,129,0.1)] border border-emerald-100 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div>
                                            <h3 className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-1">Cast Ballots</h3>
                                            <p className="text-4xl font-black text-gray-900 tracking-tight">{stats?.votedUsers ?? 0}</p>
                                        </div>
                                        <div className="bg-emerald-500 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-md">
                                            <i className="fa-solid fa-check-to-slot"></i>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium relative z-10 flex items-center">
                                        <i className="fa-solid fa-link text-emerald-400 mr-1.5"></i>
                                        Immutable blockchain records
                                    </p>
                                </div>

                                {/* Turnout Card (Recharts) */}
                                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300 row-span-2 sm:col-span-2 lg:col-span-1 lg:row-span-2 flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Electoral Turnout</h3>
                                        <div className="bg-purple-100 text-purple-600 w-8 h-8 rounded-lg flex items-center justify-center">
                                            <i className="fa-solid fa-chart-pie"></i>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center min-h-[160px]">
                                        <TurnoutChart stats={stats} />
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: System Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 lg:col-span-2 lg:-mt-[110px]">
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:border-slate-300 transition">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                                        <i className="fa-brands fa-ethereum text-xl"></i>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Network Validations</p>
                                        <p className="text-2xl font-black text-slate-800">{stats?.totalVotes ?? 0}</p>
                                    </div>
                                </div>
                                
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:border-slate-300 transition">
                                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                        <i className="fa-solid fa-bolt text-xl"></i>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Active Elections</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-2xl font-black text-slate-800">{stats?.activeElections ?? 0}</p>
                                            {stats?.pendingApprovals > 0 && (
                                                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-md">
                                                    {stats.pendingApprovals} pending
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Bottom: Recent Activity + Quick Actions */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Activity & Trends Column */}
                                <div className="lg:col-span-2 space-y-6">
                                    
                                    {/* Network Activity Trends Chart */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-slate-800 flex items-center">
                                                <i className="fa-solid fa-chart-area text-blue-500 mr-2"></i>
                                                7-Day Network Activity
                                            </h3>
                                        </div>
                                        <ActivityChart />
                                    </div>

                                    {/* Recent Activity Feed */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                            <h3 className="font-bold text-slate-800 flex items-center">
                                                <i className="fa-solid fa-terminal text-slate-500 mr-2"></i>
                                                System Audit Log
                                            </h3>
                                            <button onClick={() => setActiveTab('audit')} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider bg-white border border-slate-200 px-3 py-1 rounded-md shadow-sm transition">
                                                View Complete Log <i className="fa-solid fa-arrow-right ml-1"></i>
                                            </button>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {stats?.recentAudit && stats.recentAudit.length > 0 ? (
                                                stats.recentAudit.slice(0, 6).map((log, idx) => (
                                                    <div key={idx} className="px-5 py-3 hover:bg-slate-50/80 transition flex items-start gap-4 group">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${getActionColor(log.action)} group-hover:scale-110 transition-transform`}>
                                                            <i className={`fa-solid ${getActionIcon(log.action)} text-[11px]`}></i>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <p className="text-sm font-bold text-slate-800 truncate">{log.action?.replace(/_/g, ' ')}</p>
                                                                <p className="text-[11px] text-slate-400 font-medium shrink-0">{formatTimeAgo(log.created_at)}</p>
                                                            </div>
                                                            <p className="text-[13px] text-slate-600 truncate">{log.details || 'No details provided'}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono mt-1 opacity-70">EXEC: {log.admin_email}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-10 text-center">
                                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                        <i className="fa-solid fa-wind text-slate-300 text-2xl"></i>
                                                    </div>
                                                    <p className="text-slate-500 text-sm font-medium">No recent audit logs found.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Actions Column */}
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl shadow-md border border-slate-700 p-1 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                                        
                                        <div className="bg-slate-900/50 rounded-xl p-5 relative z-10 backdrop-blur-sm">
                                            <h3 className="font-bold text-white mb-5 flex items-center text-sm uppercase tracking-wider">
                                                <i className="fa-solid fa-wand-magic-sparkles text-indigo-400 mr-2"></i>
                                                Command Palette
                                            </h3>
                                            <div className="space-y-2">
                                                <button onClick={() => setActiveTab('elections')} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-indigo-600/20 border border-slate-700/50 hover:border-indigo-500/30 transition group text-left">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-inner">
                                                            <i className="fa-solid fa-plus text-xs"></i>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-200 group-hover:text-white transition">New Election</p>
                                                            <p className="text-[10px] text-slate-400">Initialize secure cycle</p>
                                                        </div>
                                                    </div>
                                                    <i className="fa-solid fa-chevron-right text-slate-600 text-xs group-hover:text-indigo-400 transition"></i>
                                                </button>
                                                
                                                <button onClick={() => setActiveTab('voters')} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-emerald-600/20 border border-slate-700/50 hover:border-emerald-500/30 transition group text-left">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-inner">
                                                            <i className="fa-solid fa-file-csv text-xs"></i>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-200 group-hover:text-white transition">Import Roll</p>
                                                            <p className="text-[10px] text-slate-400">CSV bulk whitelist</p>
                                                        </div>
                                                    </div>
                                                    <i className="fa-solid fa-chevron-right text-slate-600 text-xs group-hover:text-emerald-400 transition"></i>
                                                </button>

                                                <a href="/" target="_blank" rel="noreferrer" className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-amber-600/20 border border-slate-700/50 hover:border-amber-500/30 transition group text-left mt-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-inner">
                                                            <i className="fa-solid fa-globe text-xs"></i>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-200 group-hover:text-white transition">Public Portal</p>
                                                            <p className="text-[10px] text-slate-400">View live interface</p>
                                                        </div>
                                                    </div>
                                                    <i className="fa-solid fa-arrow-up-right-from-square text-slate-600 text-[10px] group-hover:text-amber-400 transition"></i>
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Small Info Widget */}
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-indigo-900 shadow-sm flex items-start gap-3">
                                        <i className="fa-solid fa-shield-halved text-indigo-500 mt-0.5"></i>
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider mb-1">Security Status</p>
                                            <p className="text-[11px] opacity-80 leading-relaxed">System is running in strict compliance mode. All administrative actions are cryptographically logged and immutable.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'elections' && <ElectionWizard />}
                    {activeTab === 'voters' && <VoterRolls />}
                    {activeTab === 'audit' && <AuditLogs />}
                    {activeTab === 'registrations' && <PendingRegistrations />}
                </main>
            </div>
        </div>
    );
}

export default AdminPanel;
