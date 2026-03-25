import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BlockchainService } from '../services/blockchainService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

function AdminPanel() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ totalUsers: 0, votedUsers: 0, totalVotes: 0, votingPercentage: 0 });
    const [users, setUsers] = useState([]);
    const [votes, setVotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    // Election Controls state
    const [walletConnected, setWalletConnected] = useState(false);
    const [adminWallet, setAdminWallet] = useState('');
    const [isBlockchainAdmin, setIsBlockchainAdmin] = useState(false);
    const [votingActive, setVotingActive] = useState(false);
    const [blockchainCandidates, setBlockchainCandidates] = useState([]);
    const [newCandidateName, setNewCandidateName] = useState('');
    const [newPartyName, setNewPartyName] = useState('');
    const [newPartySymbol, setNewPartySymbol] = useState('');
    const [newCandidateState, setNewCandidateState] = useState(0);
    const [newCandidateConstituency, setNewCandidateConstituency] = useState(0);
    const [voterAddressInput, setVoterAddressInput] = useState('');
    const [batchAddresses, setBatchAddresses] = useState('');
    const [txLoading, setTxLoading] = useState('');
    const [txSuccess, setTxSuccess] = useState('');
    const [txError, setTxError] = useState('');
    // Timeline state
    const [timelineStart, setTimelineStart] = useState('');
    const [timelineEnd, setTimelineEnd] = useState('');
    const [timelineInfo, setTimelineInfo] = useState(null);

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
    const getStateName = (code) => (indianStates.find(s => s.code === Number(code)) || {}).name || '';

    const adminToken = localStorage.getItem('adminToken');

    useEffect(() => {
        if (!adminToken) {
            navigate('/admin-login');
            return;
        }
        loadData();
    // eslint-disable-next-line
    }, [adminToken, navigate]);

    const loadData = async () => {
        try {
            setLoading(true);
            const headers = { 'Authorization': `Bearer ${adminToken}` };

            const [statsRes, usersRes, votesRes] = await Promise.all([
                fetch('http://localhost:5000/api/v1/admin/stats', { headers }),
                fetch('http://localhost:5000/api/v1/admin/users', { headers }),
                fetch('http://localhost:5000/api/v1/admin/votes', { headers })
            ]);

            // Server-side token validation: redirect if unauthorized
            if (statsRes.status === 401 || statsRes.status === 403 ||
                usersRes.status === 401 || usersRes.status === 403 ||
                votesRes.status === 401 || votesRes.status === 403) {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('admin');
                navigate('/admin-login');
                return;
            }

            if (!statsRes.ok || !usersRes.ok || !votesRes.ok) {
                throw new Error('Failed to load admin data');
            }

            const [statsData, usersData, votesData] = await Promise.all([
                statsRes.json(),
                usersRes.json(),
                votesRes.json()
            ]);

            setStats(statsData);
            setUsers(usersData.users);
            setVotes(votesData.votes);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin');
        navigate('/');
    };

    // ============ Blockchain Functions ============

    const connectAdminWallet = async () => {
        try {
            setTxLoading('wallet');
            setTxError('');
            setTxSuccess('');

            const service = BlockchainService.getInstance();
            const account = await service.connectWallet();
            setAdminWallet(account);
            setWalletConnected(true);

            try {
                const isAdmin = await service.isAdmin();
                setIsBlockchainAdmin(isAdmin);

                if (!isAdmin) {
                    setTxError('⚠️ This wallet is NOT the contract deployer/admin. You need to connect with the deployer wallet to manage elections.');
                } else {
                    setTxSuccess('✅ Admin wallet connected! You can now manage elections.');
                }
            } catch (adminErr) {
                setIsBlockchainAdmin(false);
                setTxError('❌ ' + adminErr.message);
            }

            await loadBlockchainData(service);
        } catch (err) {
            setTxError(err.message || 'Failed to connect wallet');
        } finally {
            setTxLoading('');
        }
    };

    const loadBlockchainData = useCallback(async (serviceOverride) => {
        try {
            const service = serviceOverride || BlockchainService.getInstance();
            const [candidates, active] = await Promise.all([
                service.getAllCandidates(),
                service.isVotingActive()
            ]);
            setBlockchainCandidates(candidates);
            setVotingActive(active);
        } catch (err) {
            console.error('Error loading blockchain data:', err);
        }
    }, []);

    const addCandidate = async () => {
        if (!newCandidateName.trim()) {
            setTxError('Candidate name cannot be empty');
            return;
        }
        try {
            setTxLoading('addCandidate');
            setTxError('');
            setTxSuccess('');

            const service = BlockchainService.getInstance();
            await service.addCandidate(
                newCandidateName.trim(),
                newPartyName.trim(),
                newPartySymbol.trim(),
                parseInt(newCandidateState) || 0,
                parseInt(newCandidateConstituency) || 0
            );

            const partyStr = newPartyName.trim() ? ` (${newPartyName.trim()})` : '';
            setTxSuccess(`✅ Candidate "${newCandidateName.trim()}${partyStr}" added successfully!`);
            setNewCandidateName('');
            setNewPartyName('');
            setNewPartySymbol('');
            setNewCandidateState(0);
            setNewCandidateConstituency(0);

            await loadBlockchainData(service);
        } catch (err) {
            setTxError(err.message || 'Failed to add candidate');
        } finally {
            setTxLoading('');
        }
    };

    const setTimeline = async () => {
        if (!timelineStart || !timelineEnd) {
            setTxError('Both start and end times are required');
            return;
        }
        try {
            setTxLoading('timeline');
            setTxError('');
            setTxSuccess('');
            const startTs = Math.floor(new Date(timelineStart).getTime() / 1000);
            const endTs = Math.floor(new Date(timelineEnd).getTime() / 1000);
            if (endTs <= startTs) {
                setTxError('End time must be after start time');
                setTxLoading('');
                return;
            }
            const service = BlockchainService.getInstance();
            await service.setVotingTimeline(startTs, endTs);
            setTxSuccess(`✅ Timeline set: ${new Date(timelineStart).toLocaleString()} → ${new Date(timelineEnd).toLocaleString()}`);
            setTimelineInfo({ startTime: startTs, endTime: endTs, timelineEnabled: true });
        } catch (err) {
            setTxError(err.message || 'Failed to set timeline');
        } finally {
            setTxLoading('');
        }
    };

    const authorizeVoter = async () => {
        if (!voterAddressInput.trim()) {
            setTxError('Voter wallet address is required');
            return;
        }
        try {
            setTxLoading('authorize');
            setTxError('');
            setTxSuccess('');

            const service = BlockchainService.getInstance();
            await service.authorizeVoter(voterAddressInput.trim());

            setTxSuccess(`✅ Voter ${voterAddressInput.trim().slice(0, 8)}... authorized successfully!`);
            setVoterAddressInput('');
        } catch (err) {
            setTxError(err.message || 'Failed to authorize voter');
        } finally {
            setTxLoading('');
        }
    };

    const batchAuthorizeVoters = async () => {
        if (!batchAddresses.trim()) {
            setTxError('Enter at least one wallet address');
            return;
        }
        try {
            setTxLoading('batchAuthorize');
            setTxError('');
            setTxSuccess('');

            const addresses = batchAddresses
                .split(/[\n,]+/)
                .map(a => a.trim())
                .filter(a => a.length > 0);

            if (addresses.length === 0) {
                setTxError('No valid addresses found');
                return;
            }

            const service = BlockchainService.getInstance();
            await service.authorizeVotersBatch(addresses);

            setTxSuccess(`✅ ${addresses.length} voter(s) authorized successfully!`);
            setBatchAddresses('');
        } catch (err) {
            setTxError(err.message || 'Failed to batch authorize voters');
        } finally {
            setTxLoading('');
        }
    };

    const authorizeAllRegistered = async () => {
        const walletsToAuthorize = users
            .filter(u => u.wallet_address && u.wallet_address.length > 0)
            .map(u => u.wallet_address);

        if (walletsToAuthorize.length === 0) {
            setTxError('No registered users have linked wallets yet.');
            return;
        }

        try {
            setTxLoading('authorizeAll');
            setTxError('');
            setTxSuccess('');

            const service = BlockchainService.getInstance();
            await service.authorizeVotersBatch(walletsToAuthorize);

            setTxSuccess(`✅ All ${walletsToAuthorize.length} registered voter wallets authorized!`);
        } catch (err) {
            setTxError(err.message || 'Failed to authorize all voters');
        } finally {
            setTxLoading('');
        }
    };

    const toggleVoting = async () => {
        try {
            setTxLoading('toggleVoting');
            setTxError('');
            setTxSuccess('');

            const service = BlockchainService.getInstance();

            if (votingActive) {
                await service.endVoting();
                setVotingActive(false);
                setTxSuccess('✅ Voting has been ENDED.');
            } else {
                await service.startVoting();
                setVotingActive(true);
                setTxSuccess('✅ Voting has been STARTED!');
            }
        } catch (err) {
            setTxError(err.message || 'Failed to toggle voting');
        } finally {
            setTxLoading('');
        }
    };

    // ============ Render ============

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <i className="fa-solid fa-circle-notch fa-spin text-red-600 text-4xl mb-4"></i>
                <p className="text-gray-600 font-medium">Loading Admin Portal...</p>
            </div>
        );
    }

    return (
        <React.Fragment>
            {/* Admin Top Bar */}
            <div className="bg-red-800 text-white py-1.5 px-4 sm:px-6 lg:px-8 text-xs font-medium shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="flex items-center gap-3">
                        <span className="bg-white text-red-800 px-2 py-0.5 rounded font-bold text-[10px] tracking-wide">SECURE ADMIN</span>
                        <span>Election Commission of India | Control Panel</span>
                    </div>
                </div>
            </div>

            {/* Main Admin Navbar */}
            <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20">
                        {/* Logo */}
                        <div className="flex items-center">
                            <Link to="/" className="flex items-center gap-3">
                                <img
                                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/220px-Emblem_of_India.svg.png"
                                    alt="Emblem"
                                    className="h-12 w-auto"
                                />
                                <div>
                                    <span className="block text-2xl font-bold text-gray-900 leading-none">Bharat E-Vote</span>
                                    <span className="text-[11px] uppercase font-bold text-red-600 tracking-wider">Admin Dashboard</span>
                                </div>
                            </Link>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-4">
                            <button onClick={loadData} className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm">
                                <i className="fa-solid fa-refresh mr-2"></i> Refresh Data
                            </button>
                            <button onClick={handleLogout} className="px-5 py-2 rounded text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm">
                                <i className="fa-solid fa-sign-out-alt mr-2"></i> Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="min-h-screen bg-gray-50 pb-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6 shadow-sm">
                            <p className="text-sm text-red-700 font-medium whitespace-pre-wrap"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</p>
                        </div>
                    )}

                    {/* Stats Header Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                            <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wide"><i className="fa-solid fa-users mr-2"></i> Registered Voters</h3>
                            <span className="text-4xl font-bold text-primary mt-2">{stats.totalUsers}</span>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                            <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wide"><i className="fa-solid fa-check-to-slot mr-2 text-green-600"></i> Votes Cast</h3>
                            <span className="text-4xl font-bold text-green-600 mt-2">{stats.votedUsers}</span>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                            <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wide"><i className="fa-solid fa-chart-pie mr-2 text-accent-saffron"></i> Voter Turnout</h3>
                            <span className="text-4xl font-bold text-accent-saffron mt-2">{stats.votingPercentage}%</span>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                            <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wide"><i className="fa-solid fa-clock mr-2 text-red-500"></i> Pending Votes</h3>
                            <span className="text-4xl font-bold text-red-500 mt-2">{stats.totalUsers - stats.votedUsers}</span>
                        </div>
                    </div>

                    {/* Dashboard Tabs Segmented Control */}
                    <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm inline-flex mb-8 overflow-x-auto w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-6 py-2.5 text-sm font-bold rounded-md whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'bg-primary text-white shadow' : 'text-gray-600 hover:text-primary hover:bg-gray-50'}`}
                        >
                            <i className="fa-solid fa-chart-bar mr-2"></i> Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('election')}
                            className={`px-6 py-2.5 text-sm font-bold rounded-md whitespace-nowrap transition-colors ${activeTab === 'election' ? 'bg-accent-saffron text-white shadow' : 'text-gray-600 hover:text-accent-saffron hover:bg-gray-50'}`}
                        >
                            <i className="fa-solid fa-gavel mr-2"></i> Election Controls
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-6 py-2.5 text-sm font-bold rounded-md whitespace-nowrap transition-colors ${activeTab === 'users' ? 'bg-primary text-white shadow' : 'text-gray-600 hover:text-primary hover:bg-gray-50'}`}
                        >
                            <i className="fa-solid fa-address-book mr-2"></i> Users ({users.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('votes')}
                            className={`px-6 py-2.5 text-sm font-bold rounded-md whitespace-nowrap transition-colors ${activeTab === 'votes' ? 'bg-primary text-white shadow' : 'text-gray-600 hover:text-primary hover:bg-gray-50'}`}
                        >
                            <i className="fa-solid fa-vote-yea mr-2"></i> Votes ({votes.length})
                        </button>
                    </div>

                    {/* Tab Content Areas */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
                        
                        {/* ===== OVERVIEW TAB ===== */}
                        {activeTab === 'overview' && (
                            <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4"><i className="fa-solid fa-chart-line text-primary mr-3"></i>Election Overview</h2>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4">Live Statistics</h3>
                                        <ul className="space-y-3">
                                            <li className="flex justify-between"><span className="text-gray-600 font-medium">Total Registered Voters</span> <span className="font-bold text-gray-900">{stats.totalUsers}</span></li>
                                            <li className="flex justify-between"><span className="text-gray-600 font-medium">Votes Cast</span> <span className="font-bold text-green-600">{stats.votedUsers}</span></li>
                                            <li className="flex justify-between"><span className="text-gray-600 font-medium">Voter Turnout</span> <span className="font-bold text-accent-saffron">{stats.votingPercentage}%</span></li>
                                            <li className="flex justify-between items-center pt-3 border-t">
                                                <span className="text-gray-600 font-medium">Blockchain Voting Status</span> 
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${votingActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {votingActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                                                </span>
                                            </li>
                                        </ul>
                                        <div className="mt-8">
                                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
                                                <span>Turnout Progress</span>
                                                <span>{stats.votingPercentage}%</span>
                                            </div>
                                            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary transition-all duration-1000 ease-out" style={{ width: `${stats.votingPercentage}%` }}></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        {blockchainCandidates.length > 0 ? (
                                            <>
                                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                                    <i className="fa-solid fa-chart-bar text-accent-saffron mr-2"></i> Live Results Chart
                                                </h3>
                                                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                                    <ResponsiveContainer width="100%" height={280}>
                                                        <BarChart data={blockchainCandidates.map(c => ({ name: c.name.length > 12 ? c.name.slice(0,12) + '…' : c.name, votes: Number(c.voteCount), party: c.partySymbol || c.partyName || 'IND', fullName: c.name }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} />
                                                            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                                                            <Tooltip
                                                                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                                                formatter={(value, name, props) => [value, `Votes (${props.payload.party})`]}
                                                                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                                                            />
                                                            <Bar dataKey="votes" fill="#1e40af" radius={[6, 6, 0, 0]} maxBarSize={50}>
                                                                {blockchainCandidates.map((_, idx) => (
                                                                    <Cell key={idx} fill={['#1e40af','#f97316','#10b981','#8b5cf6','#ef4444','#06b6d4','#d946ef','#f59e0b'][idx % 8]} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                                <i className="fa-regular fa-folder-open text-4xl text-gray-400 mb-3"></i>
                                                <p className="text-gray-500 font-medium">No candidates on the blockchain yet.</p>
                                                <button onClick={() => setActiveTab('election')} className="mt-4 text-primary font-bold hover:underline">Go to Election Controls <i className="fa-solid fa-arrow-right ml-1"></i></button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Voter Turnout Analytics */}
                                <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                            <i className="fa-solid fa-chart-pie text-primary mr-2"></i> Voter Turnout Breakdown
                                        </h3>
                                        <ResponsiveContainer width="100%" height={220}>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Voted', value: stats.votedUsers || 0 },
                                                        { name: 'Pending', value: Math.max(0, (stats.totalUsers || 0) - (stats.votedUsers || 0)) }
                                                    ]}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={55}
                                                    outerRadius={85}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                >
                                                    <Cell fill="#10b981" />
                                                    <Cell fill="#e5e7eb" />
                                                </Pie>
                                                <Tooltip formatter={(value) => [value, 'Voters']} />
                                                <Legend
                                                    verticalAlign="bottom"
                                                    iconType="circle"
                                                    formatter={(value) => <span className="text-sm font-semibold text-gray-700">{value}</span>}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                            <i className="fa-solid fa-clipboard-list text-primary mr-2"></i> Quick Analytics
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                                        <i className="fa-solid fa-check-double"></i>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-500 font-bold uppercase">Votes Cast</span>
                                                        <span className="block text-lg font-bold text-gray-900">{stats.votedUsers}</span>
                                                    </div>
                                                </div>
                                                <span className="text-green-600 font-bold text-lg">{stats.votingPercentage}%</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
                                                        <i className="fa-solid fa-clock"></i>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-500 font-bold uppercase">Pending</span>
                                                        <span className="block text-lg font-bold text-gray-900">{stats.totalUsers - stats.votedUsers}</span>
                                                    </div>
                                                </div>
                                                <span className="text-red-500 font-bold text-lg">{stats.totalUsers > 0 ? (100 - parseFloat(stats.votingPercentage)).toFixed(1) : 0}%</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                                        <i className="fa-solid fa-link"></i>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-500 font-bold uppercase">Wallets Linked</span>
                                                        <span className="block text-lg font-bold text-gray-900">{users.filter(u => u.wallet_address).length}</span>
                                                    </div>
                                                </div>
                                                <span className="text-blue-600 font-bold text-lg">{stats.totalUsers > 0 ? ((users.filter(u => u.wallet_address).length / stats.totalUsers) * 100).toFixed(1) : 0}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ===== ELECTION CONTROLS TAB ===== */}
                        {activeTab === 'election' && (
                            <div className="animate-fade-in max-w-4xl mx-auto">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2 border-b pb-4"><i className="fa-solid fa-gavel text-accent-saffron mr-3"></i>Election Control Center</h2>
                                <p className="text-gray-500 mb-8 font-medium">Manage smart contract state directly. These actions execute transactions on the blockchain.</p>

                                {txError && (
                                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6 shadow-sm animate-pulse-once">
                                        <p className="text-sm text-red-700 font-bold"><i className="fa-solid fa-triangle-exclamation mr-2"></i>{txError}</p>
                                    </div>
                                )}
                                {txSuccess && (
                                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded mb-6 shadow-sm animate-pulse-once">
                                        <p className="text-sm text-green-700 font-bold"><i className="fa-solid fa-check-circle mr-2"></i>{txSuccess}</p>
                                    </div>
                                )}

                                {/* Step 1: Connect Admin Wallet */}
                                <div className={`mb-8 border rounded-xl overflow-hidden transition-all ${walletConnected ? 'border-green-200 bg-green-50/30' : 'border-yellow-200 bg-yellow-50/50 shadow-md'}`}>
                                    <div className={`px-6 py-4 border-b ${walletConnected ? 'border-green-100 bg-green-50' : 'border-yellow-200 bg-yellow-100/50'}`}>
                                        <h3 className="text-lg font-bold flex items-center">
                                            <span className={`w-6 h-6 rounded-full text-white text-sm flex items-center justify-center mr-3 ${walletConnected ? 'bg-green-600' : 'bg-yellow-500'}`}>1</span>
                                            Connect Deployer Wallet
                                        </h3>
                                    </div>
                                    <div className="p-6">
                                        {!walletConnected ? (
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                <p className="text-sm text-gray-600 lg:pr-12">Connect MetaMask using the <strong>contract deployer account</strong> to authorize voters and manage candidates securely on-chain.</p>
                                                <button onClick={connectAdminWallet} disabled={txLoading === 'wallet'} className="shrink-0 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2.5 px-6 rounded-lg shadow transition-colors">
                                                    {txLoading === 'wallet' ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Connecting...</> : <><i className="fa-brands fa-ethereum mr-2"></i> Connect Wallet</>}
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex items-center text-green-700 font-bold mb-2">
                                                    <i className="fa-solid fa-link mr-2"></i> Wallet Connected
                                                </div>
                                                <p className="font-mono text-sm bg-white border border-green-200 py-1.5 px-3 rounded inline-block text-gray-800">{adminWallet}</p>
                                                <div className="mt-3 text-sm font-medium">
                                                    {isBlockchainAdmin ? (
                                                        <span className="text-green-600 bg-green-100 px-3 py-1 rounded inline-flex items-center"><i className="fa-solid fa-fingerprint mr-1.5"></i> Admin privileges confirmed</span>
                                                    ) : (
                                                        <span className="text-red-600 bg-red-100 px-3 py-1 rounded inline-flex items-center border border-red-200"><i className="fa-solid fa-ban mr-1.5"></i> Not deployer wallet</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {walletConnected && !isBlockchainAdmin && (
                                    <div className="bg-red-50 border border-red-200 p-5 rounded-lg mb-8">
                                        <h4 className="text-red-800 font-bold flex items-center mb-2"><i className="fa-solid fa-lock text-xl mr-2"></i> Unauthorized Access Restricted</h4>
                                        <p className="text-red-700 text-sm leading-relaxed">The connected wallet is not the owner of the smart contract. You cannot perform administrative actions. Please switch to Account #0 in your local Hardhat node via MetaMask.</p>
                                    </div>
                                )}

                                {walletConnected && isBlockchainAdmin && (
                                    <div className="space-y-8 animate-fade-in-up">
                                        
                                        {/* Step 2: Add Candidates */}
                                        <div className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                                <h3 className="text-lg font-bold flex items-center">
                                                    <span className="w-6 h-6 rounded-full bg-primary text-white text-sm flex items-center justify-center mr-3">2</span>
                                                    Candidate Registration
                                                </h3>
                                            </div>
                                            <div className="p-6">
                                                {votingActive ? (
                                                    <div className="bg-yellow-50 text-yellow-800 p-4 rounded border border-yellow-200 flex items-center">
                                                        <i className="fa-solid fa-lock text-xl mr-3"></i>
                                                        <p className="text-sm font-medium">Candidate registration is locked while voting is active.</p>
                                                    </div>
                                                ) : (
                                                    <form onSubmit={(e) => { e.preventDefault(); addCandidate(); }} className="space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Candidate Name *</label>
                                                                <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none" value={newCandidateName} onChange={(e) => setNewCandidateName(e.target.value)} placeholder="e.g. Rahul Sharma" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Party Name</label>
                                                                <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none" value={newPartyName} onChange={(e) => setNewPartyName(e.target.value)} placeholder="e.g. Independent" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Party Symbol Code</label>
                                                                <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none" value={newPartySymbol} onChange={(e) => setNewPartySymbol(e.target.value)} placeholder="e.g. IND" />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">State</label>
                                                                    <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none" value={newCandidateState} onChange={(e) => setNewCandidateState(e.target.value)}>
                                                                        <option value={0}>All / National</option>
                                                                        {indianStates.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Constituency #</label>
                                                                    <input type="number" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none" value={newCandidateConstituency || ''} onChange={(e) => setNewCandidateConstituency(e.target.value)} min="0" placeholder="0" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button type="submit" disabled={txLoading === 'addCandidate'} className="btn-primary w-full py-2.5 mt-2">
                                                            {txLoading === 'addCandidate' ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Registering on Blockchain...</> : <><i className="fa-solid fa-user-plus mr-2"></i> Add Candidate to Ballot</>}
                                                        </button>
                                                    </form>
                                                )}

                                                {/* Listed Candidates Preview */}
                                                {blockchainCandidates.length > 0 && (
                                                    <div className="mt-6 pt-5 border-t border-gray-100">
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Currently Registered ({blockchainCandidates.length})</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {blockchainCandidates.map(c => (
                                                                <div key={c.id} className="bg-gray-100 border border-gray-200 rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 flex items-center shadow-sm">
                                                                    <span className="bg-gray-800 text-white w-5 h-5 rounded-full flex items-center justify-center mr-2 text-[10px]">#{c.id}</span>
                                                                    {c.name} {c.partySymbol ? <span className="text-gray-400 ml-1">({c.partySymbol})</span> : ''}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Step 3: Authorize Voters */}
                                        <div className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
                                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                                <h3 className="text-lg font-bold flex items-center">
                                                    <span className="w-6 h-6 rounded-full bg-primary text-white text-sm flex items-center justify-center mr-3">3</span>
                                                    Voter Authorization (Whitelist)
                                                </h3>
                                            </div>
                                            <div className="p-6">
                                                
                                                <p className="text-sm text-gray-600 mb-6 font-medium">Wallets must be cryptographically authorized on the EVM before they can interact with the Voting contract.</p>

                                                <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                                                    <div>
                                                        <h4 className="font-bold text-blue-900 mb-1"><i className="fa-solid fa-bolt mr-2 text-blue-600"></i> One-Click Batch Authorization</h4>
                                                        <p className="text-sm text-blue-700">Authorize all {users.filter(u => u.wallet_address).length} registered users who have linked their MetaMask wallets.</p>
                                                    </div>
                                                    <button onClick={authorizeAllRegistered} disabled={txLoading === 'authorizeAll'} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-md font-bold py-2.5 px-6 rounded-lg transition-colors w-full md:w-auto">
                                                        {txLoading === 'authorizeAll' ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Authorizing...</> : <><i className="fa-solid fa-check-double mr-2"></i> Authorize All DB Users</>}
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Single Wallet Authorization</label>
                                                        <div className="flex bg-white border border-gray-300 rounded overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-primary">
                                                            <div className="px-3 py-2 bg-gray-50 border-r border-gray-300 text-gray-500 font-mono text-sm">0x</div>
                                                            <input type="text" className="w-full px-3 py-2 text-sm outline-none font-mono" value={voterAddressInput} onChange={(e) => setVoterAddressInput(e.target.value)} placeholder="000...000" onKeyDown={(e) => e.key === 'Enter' && authorizeVoter()} />
                                                        </div>
                                                        <button onClick={authorizeVoter} disabled={txLoading === 'authorize'} className="btn-secondary w-full py-2 mt-3 text-sm">
                                                            {txLoading === 'authorize' ? 'Processing Tx...' : 'Authorize Wallet'}
                                                        </button>
                                                    </div>
                                                    
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Manual Batch List (Newline separated)</label>
                                                        <textarea className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono h-[86px] outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none" value={batchAddresses} onChange={(e) => setBatchAddresses(e.target.value)} placeholder="0xAddress1&#10;0xAddress2"></textarea>
                                                        <button onClick={batchAuthorizeVoters} disabled={txLoading === 'batchAuthorize'} className="btn-outline w-full py-2 mt-2 text-sm border-gray-300 text-gray-700 hover:bg-gray-50">
                                                            {txLoading === 'batchAuthorize' ? 'Processing Tx...' : 'Process Batch Array'}
                                                        </button>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>

                                        {/* Step 4: Voting Control */}
                                        <div className={`border-2 rounded-xl shadow-lg overflow-hidden transition-all text-center p-8 ${votingActive ? 'border-primary bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
                                            <div className="max-w-xl mx-auto flex flex-col items-center">
                                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 border-4 shadow-inner ${votingActive ? 'bg-green-100 border-green-200 text-green-600 animate-pulse' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                                    <i className={`fa-solid ${votingActive ? 'fa-satellite-dish' : 'fa-power-off'} text-3xl`}></i>
                                                </div>
                                                
                                                <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">EVM Smart Contract State</h3>
                                                
                                                <div className="mb-6">
                                                   <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold border ${votingActive ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                                                       {votingActive ? <><span className="w-2.5 h-2.5 bg-green-500 rounded-full mr-2 animate-ping"></span> ELECTION LIVE</> : <><i className="fa-solid fa-lock mr-2"></i> METADATA LOCKED</>}
                                                   </span>
                                                </div>
                                                
                                                <p className="text-gray-500 font-medium leading-relaxed mb-8">
                                                    {votingActive 
                                                        ? 'The voting contract is unpaused globally. Authorized wallets can cast cryptographic votes permanently mapped to the ledger.' 
                                                        : `Candidates initialized: ${blockchainCandidates.length}. Contract paused. Ready to accept votes once you slide the master switch.`}
                                                </p>

                                                <button onClick={toggleVoting} disabled={txLoading === 'toggleVoting'} className={`w-full max-w-sm py-4 rounded-xl text-lg font-black tracking-wide text-white shadow-xl transition-transform active:scale-95 ${votingActive ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30' : 'bg-green-600 hover:bg-green-700 shadow-green-600/30'}`}>
                                                    {txLoading === 'toggleVoting' ? <i className="fa-solid fa-spinner fa-spin text-2xl"></i> : (votingActive ? <><i className="fa-solid fa-stop-circle mr-2"></i> HALT VOTING</> : <><i className="fa-solid fa-play-circle mr-2"></i> DEPLOY & START VOTING</>)}
                                                </button>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>
                        )}

                        {/* ===== USERS TAB ===== */}
                        {activeTab === 'users' && (
                            <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4"><i className="fa-solid fa-address-book text-primary mr-3"></i>Voter Directory</h2>
                                
                                {users.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                                        <i className="fa-solid fa-users-slash text-gray-300 text-5xl mb-3"></i>
                                        <p className="text-gray-500 font-medium">No users registered in the central database.</p>
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Voter INFO</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Digital Wallet</th>
                                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">DB State</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {users.map((user) => (
                                                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center">
                                                                    <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center text-primary font-bold">
                                                                        {user.fullname ? user.fullname.charAt(0) : 'U'}
                                                                    </div>
                                                                    <div className="ml-4">
                                                                        <div className="text-sm font-bold text-gray-900">{user.fullname}</div>
                                                                        <div className="text-xs text-gray-500 font-mono bg-gray-100 px-1 py-0.5 rounded inline-block mt-0.5">{user.voter_id}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="text-sm text-gray-900">{user.email}</div>
                                                                <div className="text-xs text-gray-500 flex items-center mt-0.5"><i className="fa-solid fa-fingerprint mr-1"></i> {user.aadhaar_number ? `****${user.aadhaar_number.slice(-4)}` : 'No Aadhaar'}</div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                {user.wallet_address ? (
                                                                    <span 
                                                                        className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-medium bg-blue-50 text-blue-800 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                                                                        onClick={() => {
                                                                            setVoterAddressInput(user.wallet_address);
                                                                            setActiveTab('election');
                                                                            setTxSuccess(`Wallet address ${user.wallet_address.slice(0,6)}... copied to Auth field.`);
                                                                        }}
                                                                        title="Click to authorize in Election Controls"
                                                                    >
                                                                        <i className="fa-solid fa-copy mr-1.5 opacity-60"></i>
                                                                        {user.wallet_address.slice(0, 8)}...{user.wallet_address.slice(-6)}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                                        <i className="fa-solid fa-unlink mr-1"></i> Not Linked
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                                {user.has_voted ? (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                                                        <i className="fa-solid fa-check mr-1 text-[10px]"></i> VOTED
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                                                        PENDING
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ===== VOTES TAB ===== */}
                        {activeTab === 'votes' && (
                            <div className="animate-fade-in">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4"><i className="fa-solid fa-shield-halved text-primary mr-3"></i>Encrypted Vote Registry</h2>
                                
                                {votes.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                                        <i className="fa-solid fa-box-archive text-gray-300 text-5xl mb-3"></i>
                                        <p className="text-gray-500 font-medium">No blockchain votes recorded yet.</p>
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-[#f8fafc]">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Log ID</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Voter Index (Encrypted)</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Target Node (Candidate)</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ledger Tx Hash</th>
                                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200 font-mono text-sm">
                                                    {votes.map((vote) => (
                                                        <tr key={vote.id} className="hover:bg-blue-50/50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">#{vote.id}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">{vote.voter_id}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-primary font-bold">C-{vote.candidate_id}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                {vote.tx_hash ? (
                                                                    <a href={`https://etherscan.io/tx/${vote.tx_hash}`} target="_blank" rel="noreferrer" className="text-accent-saffron hover:underline flex items-center">
                                                                        <i className="fa-brands fa-ethereum text-gray-400 mr-2"></i>
                                                                        {vote.tx_hash.slice(0, 16)}...
                                                                        <i className="fa-solid fa-arrow-up-right-from-square ml-1 text-[10px]"></i>
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-gray-400 italic">Off-chain log only</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs tracking-wide">
                                                                {vote.voted_at ? new Date(vote.voted_at).toLocaleString() : '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </React.Fragment>
    );
}

export default AdminPanel;
