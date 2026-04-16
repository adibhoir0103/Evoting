import { useRef, useCallback } from 'react';

/**
 * KeystrokeDynamics — Invisible biometric capture hook
 * 
 * Captures typing patterns during password entry:
 * - holdTimes: Duration each key is held down (ms)
 * - flightTimes: Time between releasing a key and pressing the next (ms)
 * - meanSpeed: Characters per second 
 * - stdDeviation: Consistency of typing
 * 
 * Usage:
 *   const { getKeystrokeProps, getKeystrokeData, resetKeystroke } = useKeystrokeDynamics();
 *   <input {...getKeystrokeProps()} type="password" />
 *   // On submit: const data = getKeystrokeData();
 */

export function useKeystrokeDynamics() {
    const keyDownTimes = useRef({});
    const holdTimes = useRef([]);
    const flightTimes = useRef([]);
    const lastKeyUpTime = useRef(null);
    const startTime = useRef(null);
    const keyCount = useRef(0);
    const allIntervals = useRef([]);

    const handleKeyDown = useCallback((e) => {
        // Ignore modifier keys, Tab, Enter, etc.
        if (e.key.length > 1 && !['Backspace', 'Delete'].includes(e.key)) return;
        
        const now = performance.now();
        
        if (!startTime.current) {
            startTime.current = now;
        }

        // Record key-down time (avoid duplicates from key repeat)
        if (!keyDownTimes.current[e.key]) {
            keyDownTimes.current[e.key] = now;
        }

        // Flight time: time since last key-up
        if (lastKeyUpTime.current !== null) {
            const flight = now - lastKeyUpTime.current;
            flightTimes.current.push(flight);
            allIntervals.current.push(flight);
        }
    }, []);

    const handleKeyUp = useCallback((e) => {
        if (e.key.length > 1 && !['Backspace', 'Delete'].includes(e.key)) return;

        const now = performance.now();
        const downTime = keyDownTimes.current[e.key];

        if (downTime) {
            // Hold time
            const hold = now - downTime;
            holdTimes.current.push(hold);
            allIntervals.current.push(hold);
            delete keyDownTimes.current[e.key];
        }

        lastKeyUpTime.current = now;
        keyCount.current++;
    }, []);

    const getKeystrokeData = useCallback(() => {
        const elapsed = startTime.current ? (performance.now() - startTime.current) / 1000 : 0;
        const meanSpeed = elapsed > 0 ? keyCount.current / elapsed : 0;

        // Calculate standard deviation
        const intervals = allIntervals.current;
        let stdDeviation = 0;
        if (intervals.length > 1) {
            const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
            stdDeviation = Math.sqrt(variance);
        }

        return {
            holdTimes: [...holdTimes.current],
            flightTimes: [...flightTimes.current],
            meanSpeed: parseFloat(meanSpeed.toFixed(3)),
            stdDeviation: parseFloat(stdDeviation.toFixed(3)),
            keyCount: keyCount.current,
            elapsedSeconds: parseFloat(elapsed.toFixed(3))
        };
    }, []);

    const resetKeystroke = useCallback(() => {
        keyDownTimes.current = {};
        holdTimes.current = [];
        flightTimes.current = [];
        lastKeyUpTime.current = null;
        startTime.current = null;
        keyCount.current = 0;
        allIntervals.current = [];
    }, []);

    const getKeystrokeProps = useCallback(() => ({
        onKeyDown: handleKeyDown,
        onKeyUp: handleKeyUp
    }), [handleKeyDown, handleKeyUp]);

    return {
        getKeystrokeProps,
        getKeystrokeData,
        resetKeystroke
    };
}

/**
 * KeystrokeIndicator — Visual indicator showing keystroke capture status
 * Shows a small animated fingerprint icon during typing
 */
export function KeystrokeIndicator({ isCapturing, sampleCount, samplesNeeded }) {
    if (!isCapturing) return null;

    return (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 mt-2 animate-pulse">
            <i className="fa-solid fa-fingerprint"></i>
            <span className="font-medium">
                Keystroke biometrics capturing
                {samplesNeeded && ` (${sampleCount || 0}/${samplesNeeded} samples)`}
            </span>
        </div>
    );
}
