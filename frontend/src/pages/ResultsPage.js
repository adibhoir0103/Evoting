import React, { useState, useEffect, useCallback } from 'react';
import { BlockchainService } from '../services/blockchainService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CHART_COLORS = ['#1e40af', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#d946ef', '#f59e0b'];

function ResultsPage() {
    const [allCandidates, setAllCandidates] = useState([]);
    const [filteredCandidates, setFilteredCandidates] = useState([]);
    const [selectedState, setSelectedState] = useState(0);
    const [selectedConstituency, setSelectedConstituency] = useState(0);
    const [votingActive, setVotingActive] = useState(false);
    const [totalVotes, setTotalVotes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
    const getStateName = (code) => (indianStates.find(s => s.code === Number(code)) || {}).name || 'National';

    const loadResults = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const service = BlockchainService.getInstance();
            await service.connectWallet();

            const [candidates, active] = await Promise.all([
                service.getAllCandidates(),
                service.isVotingActive()
            ]);

            setAllCandidates(candidates);
            setVotingActive(active);

            const total = candidates.reduce((sum, c) => sum + Number(c.voteCount), 0);
            setTotalVotes(total);

            setFilteredCandidates(candidates);
        } catch (err) {
            setError('Connect MetaMask to view live blockchain results: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadResults();
    }, [loadResults]);

    // Filter when state/constituency changes
    useEffect(() => {
        let filtered = allCandidates;
        if (selectedState > 0) {
            filtered = filtered.filter(c => c.stateCode === 0 || c.stateCode === selectedState);
        }
        if (selectedConstituency > 0) {
            filtered = filtered.filter(c => c.constituencyCode === 0 || c.constituencyCode === selectedConstituency);
        }
        setFilteredCandidates(filtered);
    }, [selectedState, selectedConstituency, allCandidates]);

    // Determine winner
    const getWinner = (candidates) => {
        if (candidates.length === 0) return null;
        return candidates.reduce((best, c) => Number(c.voteCount) > Number(best.voteCount) ? c : best, candidates[0]);
    };

    // Get unique constituencies from candidates
    const getConstituencies = () => {
        const codes = [...new Set(allCandidates
            .filter(c => selectedState === 0 || c.stateCode === selectedState || c.stateCode === 0)
            .map(c => c.constituencyCode)
            .filter(c => c > 0)
        )];
        return codes.sort((a, b) => a - b);
    };

    // Get per-state breakdown
    const stateBreakdown = () => {
        const statesWithCandidates = [...new Set(allCandidates.map(c => c.stateCode).filter(s => s > 0))];
        return statesWithCandidates.map(stateCode => {
            const stateCandidates = allCandidates.filter(c => c.stateCode === stateCode);
            const winner = getWinner(stateCandidates);
            const stateVotes = stateCandidates.reduce((s, c) => s + Number(c.voteCount), 0);
            return {
                stateCode,
                stateName: getStateName(stateCode),
                candidates: stateCandidates.length,
                totalVotes: stateVotes,
                winner: winner?.name || '—',
                winnerParty: winner?.partyName || '',
                winnerVotes: winner ? Number(winner.voteCount) : 0
            };
        });
    };

    const winner = getWinner(filteredCandidates);
    const chartData = filteredCandidates.map(c => ({
        name: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name,
        fullName: c.name,
        votes: Number(c.voteCount),
        party: c.partySymbol || c.partyName || 'IND'
    })).sort((a, b) => b.votes - a.votes);

    if (loading) {
        return (
            <main id="main-content" className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <i className="fa-solid fa-circle-notch fa-spin text-primary text-4xl mb-4"></i>
                <p className="text-gray-600 font-medium">Loading election results from blockchain...</p>
            </main>
        );
    }

    return (
        <main id="main-content" className="min-h-screen bg-[#f3f4f6] pb-12" role="main" aria-label="Election Results">
            {/* Header */}
            <div className="bg-primary text-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">
                                <i className="fa-solid fa-chart-column mr-3"></i>Election Results 2026
                            </h1>
                            <p className="text-blue-100 mt-1">Live blockchain-verified constituency results</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className={`px-4 py-2 rounded-lg text-sm font-bold ${votingActive ? 'bg-green-500/20 text-green-100 border border-green-400/30' : 'bg-red-500/20 text-red-100 border border-red-400/30'}`}>
                                {votingActive ? '🟢 Polls Open' : '🔴 Polls Closed'}
                            </div>
                            <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/20">
                                <span className="text-xs text-blue-200 block">Total Votes</span>
                                <span className="text-2xl font-bold">{totalVotes}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6 shadow-sm" role="alert">
                        <p className="text-sm text-red-700 font-medium"><i className="fa-solid fa-circle-exclamation mr-2"></i>{error}</p>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8" role="search" aria-label="Filter results by constituency">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                        <i className="fa-solid fa-filter mr-2"></i>Filter by Constituency
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label htmlFor="state-filter" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">State / UT</label>
                            <select
                                id="state-filter"
                                className="input-field"
                                value={selectedState}
                                onChange={(e) => { setSelectedState(Number(e.target.value)); setSelectedConstituency(0); }}
                                aria-label="Select state to filter results"
                            >
                                <option value={0}>All States (National View)</option>
                                {indianStates.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="constituency-filter" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Constituency</label>
                            <select
                                id="constituency-filter"
                                className="input-field"
                                value={selectedConstituency}
                                onChange={(e) => setSelectedConstituency(Number(e.target.value))}
                                disabled={selectedState === 0}
                                aria-label="Select constituency to filter results"
                            >
                                <option value={0}>All Constituencies</option>
                                {getConstituencies().map(code => <option key={code} value={code}>Constituency #{code}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={() => { setSelectedState(0); setSelectedConstituency(0); }}
                            className="btn-secondary py-2.5"
                            aria-label="Clear all filters"
                        >
                            <i className="fa-solid fa-rotate-left mr-2"></i>Reset Filters
                        </button>
                    </div>
                </div>

                {/* Winner Banner */}
                {winner && Number(winner.voteCount) > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 mb-8 shadow-sm" role="status" aria-live="polite">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-green-100 border-4 border-green-300 flex items-center justify-center text-green-600 shadow-inner">
                                <i className="fa-solid fa-trophy text-3xl"></i>
                            </div>
                            <div className="text-center md:text-left">
                                <span className="text-xs font-bold text-green-600 uppercase tracking-widest">
                                    {selectedState > 0 ? `${getStateName(selectedState)} — ` : ''}Leading Candidate
                                </span>
                                <h2 className="text-2xl font-black text-gray-900 mt-1">{winner.name}</h2>
                                <p className="text-green-700 font-bold">{winner.partyName || 'Independent'} {winner.partySymbol ? `(${winner.partySymbol})` : ''}</p>
                            </div>
                            <div className="md:ml-auto text-center bg-white rounded-xl px-8 py-4 shadow-sm border border-green-200">
                                <span className="text-4xl font-black text-green-600">{Number(winner.voteCount)}</span>
                                <span className="block text-xs font-bold text-gray-500 uppercase mt-1">Votes Received</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Chart */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <i className="fa-solid fa-chart-bar text-primary mr-2"></i>
                            Vote Distribution {selectedState > 0 ? `— ${getStateName(selectedState)}` : ''}
                        </h3>
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                        formatter={(value, name, props) => [value, `Votes (${props.payload.party})`]}
                                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                                    />
                                    <Bar dataKey="votes" radius={[6, 6, 0, 0]} maxBarSize={50}>
                                        {chartData.map((_, idx) => (
                                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                                <i className="fa-solid fa-chart-simple text-5xl mb-3"></i>
                                <p className="font-medium">No candidates found for this constituency</p>
                            </div>
                        )}
                    </div>

                    {/* Candidate Leaderboard */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <i className="fa-solid fa-ranking-star text-accent-saffron mr-2"></i>
                            Candidate Leaderboard ({filteredCandidates.length})
                        </h3>
                        <div className="space-y-3 max-h-[340px] overflow-y-auto" role="list" aria-label="Candidate rankings">
                            {[...filteredCandidates].sort((a, b) => Number(b.voteCount) - Number(a.voteCount)).map((c, idx) => {
                                const totalFiltered = filteredCandidates.reduce((s, x) => s + Number(x.voteCount), 0);
                                const pct = totalFiltered > 0 ? ((Number(c.voteCount) / totalFiltered) * 100).toFixed(1) : 0;
                                return (
                                    <div key={c.id} className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${idx === 0 && Number(c.voteCount) > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`} role="listitem">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 && Number(c.voteCount) > 0 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <span className="block font-bold text-gray-900 text-sm">{c.name}</span>
                                                <span className="text-xs text-gray-500">{c.partyName || 'Independent'} {c.stateCode > 0 ? `• ${getStateName(c.stateCode)}` : ''}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-lg font-bold text-gray-900">{Number(c.voteCount)}</span>
                                            <span className="text-xs text-gray-500 font-medium">{pct}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredCandidates.length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                    <i className="fa-solid fa-user-slash text-3xl mb-2"></i>
                                    <p className="font-medium">No candidates in selected constituency</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* State-wise Breakdown Table */}
                {selectedState === 0 && stateBreakdown().length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <i className="fa-solid fa-map-location-dot text-primary mr-2"></i>
                            State-wise Winners
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="State-wise election results">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">State</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Leading Candidate</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Candidates</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Total Votes</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Winner Votes</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {stateBreakdown().map(s => (
                                        <tr key={s.stateCode} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedState(s.stateCode)}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-bold text-gray-900 text-sm">{s.stateName}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <span className="font-bold text-gray-900 text-sm">{s.winner}</span>
                                                    <span className="text-xs text-gray-500 block">{s.winnerParty}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium text-gray-600">{s.candidates}</td>
                                            <td className="px-6 py-4 text-center font-bold text-gray-900">{s.totalVotes}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">{s.winnerVotes}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Refresh */}
                <div className="text-center mt-8">
                    <button onClick={loadResults} className="btn-outline px-6 py-2" aria-label="Refresh results from blockchain">
                        <i className="fa-solid fa-arrows-rotate mr-2"></i>Refresh Live Results
                    </button>
                </div>
            </div>
        </main>
    );
}

export default ResultsPage;
