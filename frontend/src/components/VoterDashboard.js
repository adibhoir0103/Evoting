import React, { useState, useEffect } from 'react';
import { BlockchainService } from '../services/blockchainService';
import LoadingSpinner from './LoadingSpinner';

function VoterDashboard({ account }) {
    const [candidates, setCandidates] = useState([]);
    const [votingActive, setVotingActive] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [txLoading, setTxLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [totalVotes, setTotalVotes] = useState(0);

    const service = BlockchainService.getInstance();

    useEffect(() => {
        if (service.contract) {
            loadData();
            setupEventListeners();
        }

        return () => {
            service.removeAllListeners();
        };
    }, [account]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Ensure contract is initialized
            if (!service.contract) {
                throw new Error('Contract not initialized. Please refresh and reconnect.');
            }

            const [candidatesData, status, voted, authorized, total] = await Promise.all([
                service.getAllCandidates(),
                service.isVotingActive(),
                service.hasVoted(account),
                service.isAuthorized(account),
                service.getTotalVotes()
            ]);

            setCandidates(candidatesData);
            setVotingActive(status);
            setHasVoted(voted);
            setIsAuthorized(authorized);
            setTotalVotes(total);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const setupEventListeners = () => {
        service.onVoteCast((data) => {
            loadData();
            if (data.voter.toLowerCase() === account.toLowerCase()) {
                setSuccess('Your vote has been recorded on the blockchain! 🎉');
            }
        });

        service.onCandidateAdded(() => {
            loadData();
        });
    };

    const handleVote = async (candidateId) => {
        try {
            setTxLoading(true);
            setError(null);
            setSuccess(null);
            await service.vote(candidateId);
            // Success message will be set by event listener
        } catch (err) {
            setError(err.message);
        } finally {
            setTxLoading(false);
        }
    };

    const confirmVote = (candidate) => {
        setSelectedCandidate(candidate);
    };

    const cancelVote = () => {
        setSelectedCandidate(null);
    };

    const submitVote = async () => {
        if (selectedCandidate) {
            await handleVote(selectedCandidate.id);
            setSelectedCandidate(null);
        }
    };

    if (loading) {
        return <LoadingSpinner text="Loading voter dashboard..." />;
    }

    // Calculate percentages
    const getCandidatePercentage = (voteCount) => {
        if (totalVotes === 0) return 0;
        return ((voteCount / totalVotes) * 100).toFixed(1);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6">🗳️ Voter Dashboard</h2>

            {/* Status Messages */}
            {error && (
                <div className="card bg-red-500/20 border-red-500/50">
                    <p className="text-red-400">❌ {error}</p>
                </div>
            )}

            {success && (
                <div className="card bg-green-500/20 border-green-500/50">
                    <p className="text-green-400">✅ {success}</p>
                </div>
            )}

            {/* Voter Status */}
            <div className="card">
                <h3 className="text-xl font-semibold mb-4">Your Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-sm mb-1">Authorization</p>
                        <span className={`status-badge ${isAuthorized ? 'bg-green-500' : 'bg-red-500'}`}>
                            {isAuthorized ? '✅ Authorized' : '❌ Not Authorized'}
                        </span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-sm mb-1">Voting Status</p>
                        <span className={`status-badge ${votingActive ? 'bg-green-500' : 'bg-gray-500'}`}>
                            {votingActive ? '🟢 Active' : '⚫ Inactive'}
                        </span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <p className="text-gray-400 text-sm mb-1">Your Vote</p>
                        <span className={`status-badge ${hasVoted ? 'bg-blue-500' : 'bg-yellow-500'}`}>
                            {hasVoted ? '✅ Voted' : '⏳ Not Voted'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Information Messages */}
            {!isAuthorized && (
                <div className="card bg-yellow-500/20 border-yellow-500/50">
                    <div className="flex items-start">
                        <span className="text-2xl mr-3">ℹ️</span>
                        <div>
                            <h4 className="font-semibold text-yellow-400 mb-1">Not Authorized</h4>
                            <p className="text-yellow-200">
                                You need to be authorized by the admin before you can vote.
                                Please contact the election administrator.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {!votingActive && isAuthorized && (
                <div className="card bg-blue-500/20 border-blue-500/50">
                    <div className="flex items-start">
                        <span className="text-2xl mr-3">⏰</span>
                        <div>
                            <h4 className="font-semibold text-blue-400 mb-1">Voting Not Active</h4>
                            <p className="text-blue-200">
                                Voting has not started yet. Please wait for the admin to start the voting process.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {hasVoted && (
                <div className="card bg-green-500/20 border-green-500/50">
                    <div className="flex items-start">
                        <span className="text-2xl mr-3">🎉</span>
                        <div>
                            <h4 className="font-semibold text-green-400 mb-1">Vote Recorded</h4>
                            <p className="text-green-200">
                                Your vote has been successfully recorded on the blockchain and cannot be changed.
                                Thank you for participating!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Candidates */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">Candidates</h3>
                    <div className="text-sm text-gray-400">
                        Total Votes: <span className="text-white font-semibold">{totalVotes}</span>
                    </div>
                </div>

                {candidates.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No candidates available</p>
                ) : (
                    <div className="space-y-4">
                        {candidates.map((candidate) => {
                            const percentage = getCandidatePercentage(candidate.voteCount);
                            return (
                                <div
                                    key={candidate.id}
                                    className="bg-white/5 rounded-lg p-5 border border-white/10 hover:border-blue-500/50 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold">
                                                {candidate.id}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-lg">{candidate.name}</h4>
                                                <p className="text-gray-400 text-sm">Candidate #{candidate.id}</p>
                                            </div>
                                        </div>
                                        {votingActive && isAuthorized && !hasVoted && (
                                            <button
                                                onClick={() => confirmVote(candidate)}
                                                disabled={txLoading}
                                                className="btn-primary"
                                            >
                                                Vote
                                            </button>
                                        )}
                                    </div>

                                    {/* Vote Count and Progress Bar */}
                                    <div className="mt-3">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-400">Votes</span>
                                            <span className="text-blue-400 font-semibold">
                                                {candidate.voteCount} ({percentage}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {selectedCandidate && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="card max-w-md w-full animate-slide-up">
                        <h3 className="text-2xl font-bold mb-4">Confirm Your Vote</h3>
                        <p className="text-gray-300 mb-6">
                            You are about to vote for:
                        </p>
                        <div className="bg-white/5 rounded-lg p-4 border border-white/20 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold">
                                    {selectedCandidate.id}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-lg">{selectedCandidate.name}</h4>
                                    <p className="text-gray-400 text-sm">Candidate #{selectedCandidate.id}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
                            <p className="text-yellow-200 text-sm">
                                ⚠️ Once you submit your vote, it will be recorded on the blockchain and
                                <strong> cannot be changed</strong>.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={cancelVote}
                                disabled={txLoading}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitVote}
                                disabled={txLoading}
                                className="btn-primary flex-1"
                            >
                                {txLoading ? '⏳ Submitting...' : 'Confirm Vote'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default VoterDashboard;
