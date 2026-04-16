import React, { useState, useEffect, useCallback } from 'react';
import { BlockchainService } from '../services/blockchainService';
import { useDropzone } from 'react-dropzone';
import LoadingSpinner from './LoadingSpinner';

function AdminDashboard({ account, onError }) {
    const [candidates, setCandidates] = useState([]);
    const [votingActive, setVotingActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [candidateName, setCandidateName] = useState('');
    const [voterAddress, setVoterAddress] = useState('');
    const [batchVoters, setBatchVoters] = useState('');
    const [csvFile, setCsvFile] = useState(null);
    const [targetElectionId, setTargetElectionId] = useState(1);


    const service = BlockchainService.getInstance();

    useEffect(() => {
        loadData();

        // Listen for events
        const unsubscribeVote = service.onVoteCast(loadData);
        const unsubscribeCandidate = service.onCandidateAdded(loadData);

        return () => {
            unsubscribeVote();
            unsubscribeCandidate();
        };
    }, []);

    const loadData = async () => {
        try {
            const [candidatesData, status] = await Promise.all([
                service.getCandidates(),
                service.contract.votingActive()
            ]);
            setCandidates(candidatesData);
            setVotingActive(status);
        } catch (error) {
            console.error('Error loading data:', error);
            onError('Failed to load data');
        }
    };

    const handleAddCandidate = async (e) => {
        e.preventDefault();
        if (!candidateName.trim()) {
            onError('Please enter a candidate name');
            return;
        }

        setLoading(true);
        try {
            await service.addCandidate(candidateName);
            setCandidateName('');
            onError('');
            // Data will refresh via event listener
        } catch (error) {
            console.error('Error adding candidate:', error);
            onError(error.message || 'Failed to add candidate');
        } finally {
            setLoading(false);
        }
    };

    const handleAuthorizeVoter = async (e) => {
        e.preventDefault();
        if (!voterAddress.trim()) {
            onError('Please enter a voter address');
            return;
        }

        setLoading(true);
        try {
            await service.authorizeVoter(voterAddress);
            setVoterAddress('');
            onError('');
        } catch (error) {
            console.error('Error authorizing voter:', error);
            onError(error.message || 'Failed to authorize voter');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchAuthorize = async (e) => {
        e.preventDefault();
        const addresses = batchVoters
            .split('\n')
            .map(addr => addr.trim())
            .filter(addr => addr.length > 0);

        if (addresses.length === 0) {
            onError('Please enter at least one address');
            return;
        }

        setLoading(true);
        try {
            await service.authorizeVotersBatch(addresses);
            setBatchVoters('');
            onError('');
        } catch (error) {
            console.error('Error batch authorizing:', error);
            onError(error.message || 'Failed to authorize voters');
        } finally {
            setLoading(false);
        }
    };

    const onDrop = useCallback(acceptedFiles => {
        setCsvFile(acceptedFiles[0]);
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] } });

    const handleCsvUpload = async (e) => {
        e.preventDefault();
        if (!csvFile) {
            onError('Please drop a CSV file first');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', csvFile);

            const token = localStorage.getItem('adminToken');
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/admin/elections/${targetElectionId}/voters/bulk`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                onError(`✅ Success! Whitelisted ${data.successCount} voters. (Skipped ${data.errorCount})`);
                setCsvFile(null);
            } else {
                onError(`❌ CSV Error: ${data.error}`);
            }
        } catch (error) {
            onError('❌ Failed to push CSV to server network');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleVoting = async () => {
        setLoading(true);
        try {
            if (votingActive) {
                await service.endVoting();
            } else {
                await service.startVoting();
            }
            await loadData();
        } catch (error) {
            console.error('Error toggling voting:', error);
            onError(error.message || 'Failed to toggle voting status');
        } finally {
            setLoading(false);
        }
    };

    const totalVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0);

    return (
        <div className="space-y-6">
            {loading && <LoadingSpinner />}

            {/* Status Card */}
            <div className="card">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Admin Dashboard</h2>
                        <p className="text-gray-300">Manage candidates and control voting</p>
                    </div>
                    <div className="text-right">
                        <span className={`status-badge ${votingActive ? 'bg-green-500' : 'bg-red-500'}`}>
                            {votingActive ? '🟢 Voting Active' : '🔴 Voting Inactive'}
                        </span>
                        <button
                            onClick={handleToggleVoting}
                            disabled={loading}
                            className="btn-secondary mt-2 w-full"
                        >
                            {votingActive ? 'End Voting' : 'Start Voting'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Add Candidate Form */}
            <div className="card">
                <h3 className="text-xl font-semibold text-white mb-4">➕ Add Candidate</h3>
                <form onSubmit={handleAddCandidate} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Enter candidate name"
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        className="input-field"
                        disabled={loading}
                    />
                    <button type="submit" disabled={loading} className="btn-primary w-full">
                        Add Candidate
                    </button>
                </form>
            </div>

            {/* Authorize Voter Forms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                    <h3 className="text-xl font-semibold text-white mb-4">👤 Authorize Single Voter</h3>
                    <form onSubmit={handleAuthorizeVoter} className="space-y-4">
                        <input
                            type="text"
                            placeholder="0x... voter address"
                            value={voterAddress}
                            onChange={(e) => setVoterAddress(e.target.value)}
                            className="input-field"
                            disabled={loading}
                        />
                        <button type="submit" disabled={loading} className="btn-primary w-full">
                            Authorize Voter
                        </button>
                    </form>
                </div>

                <div className="card">
                    <h3 className="text-xl font-semibold text-white mb-4">👥 DB Bulk Upload Pipeline</h3>
                    <form onSubmit={handleCsvUpload} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Target Election ID</label>
                            <input type="number" value={targetElectionId} onChange={(e) => setTargetElectionId(e.target.value)} className="input-field w-24" />
                        </div>
                        <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/20' : 'border-gray-500 bg-gray-800 hover:border-gray-400'}`}>
                            <input {...getInputProps()} />
                            <i className="fa-solid fa-file-csv text-3xl text-gray-400 mb-2"></i>
                            {csvFile ? (
                                <p className="text-sm text-green-400 font-bold">{csvFile.name}</p>
                            ) : (
                                <p className="text-sm text-gray-300">Drag 'n' drop a CSV file here, or click to browse</p>
                            )}
                        </div>
                        <button type="submit" disabled={loading || !csvFile} className="btn-secondary w-full">
                            Upload CSV via Backend API
                        </button>
                    </form>
                </div>
            </div>

            {/* Candidates List */}
            <div className="card">
                <h3 className="text-xl font-semibold text-white mb-4">📊 Candidates & Results</h3>
                <div className="space-y-3">
                    {candidates.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">No candidates added yet</p>
                    ) : (
                        candidates.map((candidate) => (
                            <div
                                key={candidate.id}
                                className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-lg font-semibold text-white">{candidate.name}</h4>
                                    <span className="text-2xl font-bold text-purple-400">
                                        {candidate.voteCount} votes
                                    </span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                                        style={{
                                            width: totalVotes > 0 ? `${(candidate.voteCount / totalVotes) * 100}%` : '0%'
                                        }}
                                    />
                                </div>
                                <p className="text-sm text-gray-400 mt-1">
                                    {totalVotes > 0 ? ((candidate.voteCount / totalVotes) * 100).toFixed(1) : 0}% of total votes
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;
