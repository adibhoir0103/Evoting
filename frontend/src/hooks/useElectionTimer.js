import { useEffect, useState, useCallback, useRef } from 'react';
import { BlockchainService } from '../services/blockchainService';

/**
 * useElectionTimer — Syncs voting countdown with the blockchain smart contract.
 * 
 * Reads `getVotingTimeline()` from VotingV2 contract and provides:
 * - Real-time countdown that decrements every second
 * - Re-syncs with blockchain every 30 seconds to prevent drift
 * - Election state: NOT_STARTED, ACTIVE, ENDED, NOT_CONFIGURED
 * 
 * @returns {{ timelineEnabled, startTime, endTime, isActive, timeLeftSeconds, electionState, days, hours, minutes, seconds, error, refetch }}
 */
const useElectionTimer = () => {
    const [state, setState] = useState({
        timelineEnabled: false,
        startTime: 0,
        endTime: 0,
        isActive: false,
        timeLeftSeconds: 0,
        electionState: 'LOADING', // LOADING, NOT_CONFIGURED, NOT_STARTED, ACTIVE, ENDED
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        error: null
    });

    const endTimeRef = useRef(0);
    const startTimeRef = useRef(0);
    const countdownRef = useRef(null);

    // Decompose seconds into days/hours/minutes/seconds
    const decompose = (totalSeconds) => {
        const s = Math.max(0, totalSeconds);
        return {
            days: Math.floor(s / 86400),
            hours: Math.floor((s % 86400) / 3600),
            minutes: Math.floor((s % 3600) / 60),
            seconds: Math.floor(s % 60)
        };
    };

    // Fetch timeline from blockchain
    const fetchTimeline = useCallback(async () => {
        try {
            const service = BlockchainService.getInstance();
            if (!service || !service.votingContract) {
                // Contract not available — fall back to non-blockchain mode
                setState(prev => ({
                    ...prev,
                    electionState: 'NOT_CONFIGURED',
                    error: 'Blockchain contract not connected'
                }));
                return;
            }

            const timeline = await service.votingContract.getVotingTimeline();
            const timelineEnabled = timeline[0]; // bool _timelineEnabled
            const startTimeBN = timeline[1];      // uint256 _startTime
            const endTimeBN = timeline[2];         // uint256 _endTime
            const isActive = timeline[3];          // bool _isActive

            const startTime = Number(startTimeBN);
            const endTime = Number(endTimeBN);
            const now = Math.floor(Date.now() / 1000);

            startTimeRef.current = startTime;
            endTimeRef.current = endTime;

            let timeLeftSeconds = 0;
            let electionState = 'NOT_CONFIGURED';

            if (!timelineEnabled && !isActive) {
                electionState = 'NOT_CONFIGURED';
            } else if (!timelineEnabled && isActive) {
                // Active but no timeline — show as active with no countdown
                electionState = 'ACTIVE';
                timeLeftSeconds = 0;
            } else if (now < startTime) {
                electionState = 'NOT_STARTED';
                timeLeftSeconds = startTime - now;
            } else if (now < endTime && isActive) {
                electionState = 'ACTIVE';
                timeLeftSeconds = endTime - now;
            } else {
                electionState = 'ENDED';
                timeLeftSeconds = 0;
            }

            const { days, hours, minutes, seconds } = decompose(timeLeftSeconds);

            setState({
                timelineEnabled,
                startTime,
                endTime,
                isActive,
                timeLeftSeconds,
                electionState,
                days, hours, minutes, seconds,
                error: null
            });
        } catch (err) {
            console.warn('Election timer: could not reach blockchain', err.message);
            setState(prev => ({
                ...prev,
                error: err.message
            }));
        }
    }, []);

    // Local countdown — decrements every second for smooth display
    useEffect(() => {
        if (countdownRef.current) clearInterval(countdownRef.current);

        if (state.electionState === 'ACTIVE' || state.electionState === 'NOT_STARTED') {
            countdownRef.current = setInterval(() => {
                setState(prev => {
                    const now = Math.floor(Date.now() / 1000);
                    let newTimeLeft;

                    if (prev.electionState === 'NOT_STARTED') {
                        newTimeLeft = Math.max(0, startTimeRef.current - now);
                        // Transition to ACTIVE when start time passes
                        if (newTimeLeft <= 0 && prev.isActive) {
                            newTimeLeft = Math.max(0, endTimeRef.current - now);
                            return {
                                ...prev,
                                electionState: 'ACTIVE',
                                timeLeftSeconds: newTimeLeft,
                                ...decompose(newTimeLeft)
                            };
                        }
                    } else {
                        newTimeLeft = Math.max(0, endTimeRef.current - now);
                        // Transition to ENDED when end time passes
                        if (newTimeLeft <= 0) {
                            clearInterval(countdownRef.current);
                            return {
                                ...prev,
                                electionState: 'ENDED',
                                timeLeftSeconds: 0,
                                days: 0, hours: 0, minutes: 0, seconds: 0
                            };
                        }
                    }

                    return {
                        ...prev,
                        timeLeftSeconds: newTimeLeft,
                        ...decompose(newTimeLeft)
                    };
                });
            }, 1000);
        }

        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [state.electionState]);

    // Initial fetch + periodic blockchain re-sync every 30 seconds
    useEffect(() => {
        fetchTimeline();
        const syncInterval = setInterval(fetchTimeline, 30000);
        return () => clearInterval(syncInterval);
    }, [fetchTimeline]);

    return { ...state, refetch: fetchTimeline };
};

export default useElectionTimer;
