import React, { useState, useEffect, useCallback } from 'react';
import { BlockchainService } from '../services/blockchainService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { indianStates, getStateName } from '../utils/indianStates';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const CHART_COLORS = ['#2563eb', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#d946ef', '#f97316'];

function ResultsPage() {
    const [allCandidates, setAllCandidates] = useState([]);
    const [filteredCandidates, setFilteredCandidates] = useState([]);
    const [selectedState, setSelectedState] = useState(0);
    const [selectedConstituency, setSelectedConstituency] = useState(0);
    const [votingActive, setVotingActive] = useState(false);
    const [totalVotes, setTotalVotes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadResults = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const service = BlockchainService.getInstance();
            
            // Try to connect, but don't fail if we can't (for public visibility)
            try {
                if (window.ethereum) await service.connectWallet();
            } catch (e) {
                console.log("Viewing in read-only mode");
            }

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
            setError('Failed to load blockchain ledger data: ' + err.message);
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

    const generateResultsPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // --- Header Graphic ---
        doc.setFillColor(0, 51, 102); // Deep Blue
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setFillColor(255, 153, 51); // Saffron line under header
        doc.rect(0, 40, pageWidth, 2, 'F');
        
        // --- Header Text ---
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Bharat E-Vote', pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Official Cryptographic Election Results', pageWidth / 2, 30, { align: 'center' });
        
        // --- Metadata Box ---
        doc.setTextColor(0, 0, 0);
        const constituencyString = selectedState === 0 
            ? 'National Level / All States' 
            : `${getStateName(selectedState)} ${selectedConstituency > 0 ? `- Constituency #${selectedConstituency}` : '(State Level)'}`;
            
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        let metaY = 55;
        doc.text(`Scope: ${constituencyString}`, 20, metaY); metaY += 7;
        doc.text(`Total Cast Votes: ${totalVotes}`, 20, metaY); metaY += 7;
        doc.text(`Network Status: ${votingActive ? 'Active (Live)' : 'Closed (Final Sealed Results)'}`, 20, metaY);
        
        // --- Leading Box (if closed and winner exists) ---
        let startY = metaY + 15;
        if (!votingActive && winner && Number(winner.voteCount) > 0) {
            doc.setFillColor(240, 249, 255);
            doc.setDrawColor(0, 51, 102);
            doc.roundedRect(20, startY, pageWidth - 40, 20, 3, 3, 'FD');
            doc.setTextColor(0, 51, 102);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('LEADING CANDIDATE / WINNER', 25, startY + 7);
            doc.setFontSize(14);
            doc.text(`${winner.name} (${winner.partyName || 'IND'}) - ${Number(winner.voteCount)} Votes`, 25, startY + 15);
            startY += 30;
        }

        // --- Table ---
        if (votingActive) {
            doc.setFontSize(14);
            doc.setTextColor(200, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text('Tally Data is Sealed during Active Polls.', pageWidth / 2, startY + 20, { align: 'center' });
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.setFont('helvetica', 'normal');
            doc.text('Wait for the Election Officer to close the smart contract before retrieving tallies.', pageWidth / 2, startY + 30, { align: 'center' });
        } else {
            const sorted = [...filteredCandidates].sort((a,b) => Number(b.voteCount) - Number(a.voteCount));
            const tableData = sorted.map((c, index) => [
                index + 1,
                c.name,
                c.partyName || 'Independent',
                c.stateCode > 0 ? getStateName(c.stateCode) : 'National',
                Number(c.voteCount)
            ]);
            
            doc.autoTable({
                startY: startY,
                head: [['Rank', 'Candidate', 'Party', 'Region', 'Votes']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 20, right: 20 },
                styles: { fontSize: 9, cellPadding: 4 }
            });
        }

        // --- Footer ---
        const pageCount = doc.internal.getNumberOfPages();
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Generated exactly at: ${timestamp}`, 20, pageHeight - 10);
            doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
            doc.text(`Generated from highly secure Blockchain Database`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
        
        doc.save(`BharatEVote_Results_${Date.now()}.pdf`);
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
            <main id="main-content" className="min-h-screen bg-gray-50" role="main" aria-label="Loading election results" aria-busy="true">
                {/* Skeleton: Header bar */}
                <div className="bg-primary animate-pulse">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="h-8 bg-white/20 rounded w-72 mb-2"></div>
                        <div className="h-4 bg-white/10 rounded w-56"></div>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 animate-pulse">
                    {/* Skeleton: Filter card */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
                        <div className="h-4 bg-gray-200 rounded w-40 mb-4"></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="h-10 bg-gray-100 rounded-lg"></div>
                            <div className="h-10 bg-gray-100 rounded-lg"></div>
                            <div className="h-10 bg-gray-100 rounded-lg"></div>
                        </div>
                    </div>
                    {/* Skeleton: Chart + Leaderboard */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="h-5 bg-gray-200 rounded w-48 mb-6"></div>
                            <div className="flex items-end gap-3 h-[260px] pb-4">
                                {[180, 120, 220, 90, 160].map((h, i) => (
                                    <div key={i} className="flex-1 bg-gray-100 rounded-t-lg" style={{ height: `${h}px` }}></div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="h-5 bg-gray-200 rounded w-52 mb-6"></div>
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                                            <div>
                                                <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                                                <div className="h-3 bg-gray-100 rounded w-20"></div>
                                            </div>
                                        </div>
                                        <div className="h-6 bg-gray-200 rounded w-12"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
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
                            <p className="text-blue-100 mt-1">Live mathematically-verified constituency results</p>
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

                {/* Winner Banner (Only visibile when CLOSED) */}
                {!votingActive && winner && Number(winner.voteCount) > 0 && (
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
                            {votingActive && <span className="ml-3 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200 uppercase tracking-widest font-black flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>Live</span>}
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
                            {votingActive && <span className="ml-3 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200 uppercase tracking-widest font-black flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>Live</span>}
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

                {/* Refresh and Export Actions */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
                    <button onClick={loadResults} className="btn-outline px-6 py-2" aria-label="Refresh results from cryptographic ledger">
                        <i className="fa-solid fa-arrows-rotate mr-2"></i>Refresh Live Results
                    </button>
                    <button onClick={generateResultsPDF} className="btn-secondary px-6 py-2" aria-label="Export Cryptographic PDF Report">
                        <i className="fa-solid fa-file-pdf mr-2"></i>Export PDF Report
                    </button>
                </div>
            </div>
        </main>
    );
}

export default ResultsPage;
