import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import ElectionWizard from '../components/Admin/ElectionWizard';
import VoterRolls from '../components/Admin/VoterRolls';
import AuditLogs from '../components/Admin/AuditLogs';

function AdminPanel() {
    const navigate = useNavigate();
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({ totalUsers: 0, votedUsers: 0, totalVotes: 0, votingPercentage: 0 });

    useEffect(() => {
        if (!isLoaded) return;
        
        // Ensure user is loaded and authenticated
        if (!user) {
            navigate('/admin-login'); // or root
            return;
        }

        const fetchStats = async () => {
             // Let's use localStorage token if that's what we were banking on, 
             // but if we are using Clerk, we fetch DB token using getSession
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/admin/stats`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [isLoaded, user, navigate]);

    if (!isLoaded || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <i className="fa-solid fa-spinner fa-spin text-primary text-5xl"></i>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col min-h-screen shadow-xl z-10">
                <div className="p-6">
                    <h2 className="text-xl font-extrabold tracking-tight">BharatE-Vote <span className="text-blue-400">Admin</span></h2>
                </div>
                
                <nav className="flex-1 mt-4 px-4 space-y-1">
                    <button 
                        onClick={() => setActiveTab('overview')} 
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center mb-2 transition-colors ${activeTab === 'overview' ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                        <i className="fa-solid fa-chart-pie w-6"></i> System Dashboard
                    </button>
                    
                    <button 
                        onClick={() => setActiveTab('elections')} 
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center mb-2 transition-colors ${activeTab === 'elections' ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                        <i className="fa-solid fa-check-to-slot w-6"></i> Election Engine
                    </button>

                    <button 
                        onClick={() => setActiveTab('voters')} 
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center mb-2 transition-colors ${activeTab === 'voters' ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                        <i className="fa-solid fa-file-csv w-6"></i> Voter Whitelists
                    </button>

                    <button 
                        onClick={() => setActiveTab('audit')} 
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center mb-2 transition-colors ${activeTab === 'audit' ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                        <i className="fa-solid fa-timeline w-6"></i> Security Audits
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-700 bg-slate-900">
                    <div className="flex items-center space-x-3 p-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs uppercase">
                            {user?.firstName?.charAt(0) || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user?.fullName || 'Administrator'}</p>
                            <p className="text-xs text-slate-400 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                        </div>
                    </div>
                    <button onClick={() => signOut(() => navigate('/'))} className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">
                        <i className="fa-solid fa-power-off"></i>
                        <span className="font-bold text-sm">Sign Out Node</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden max-h-screen">
                <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center shadow-sm z-0">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                            {activeTab === 'overview' && 'Constituency Operations Center'}
                            {activeTab === 'elections' && 'Dynamic Election Controller'}
                            {activeTab === 'voters' && 'Electoral Roll Management'}
                            {activeTab === 'audit' && 'Immutable Event Trails'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">GIGW 3.0 Compliant High-Security SaaS Panel</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="text-sm font-bold text-gray-600 bg-gray-100 flex items-center px-4 py-2 rounded-full border border-gray-200 shadow-sm">
                            <span className="relative flex h-3 w-3 mr-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            API LINKED
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 p-8">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Eligible Voters</h3>
                                        <div className="bg-blue-100 p-2 rounded-lg"><i className="fa-solid fa-users text-blue-600"></i></div>
                                    </div>
                                    <p className="text-4xl font-black text-gray-900">{stats.totalUsers}</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Cast Ballots</h3>
                                        <div className="bg-green-100 p-2 rounded-lg"><i className="fa-solid fa-check-to-slot text-green-600"></i></div>
                                    </div>
                                    <p className="text-4xl font-black text-gray-900">{stats.votedUsers}</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Turnout Index</h3>
                                        <div className="bg-purple-100 p-2 rounded-lg"><i className="fa-solid fa-chart-line text-purple-600"></i></div>
                                    </div>
                                    <p className="text-4xl font-black text-gray-900">{stats.votingPercentage}%</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Blockchain Validations</h3>
                                        <div className="bg-amber-100 p-2 rounded-lg"><i className="fa-brands fa-ethereum text-amber-600"></i></div>
                                    </div>
                                    <p className="text-4xl font-black text-gray-900">{stats.totalVotes}</p>
                                </div>
                            </div>
                            
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex items-center justify-center h-64">
                                <p className="text-gray-400 italic">Select an advanced dashboard tool from the sidebar to configure granular administrative policies.</p>
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
