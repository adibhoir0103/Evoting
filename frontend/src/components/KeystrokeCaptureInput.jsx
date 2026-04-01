import React, { useRef, useCallback } from 'react';

/**
 * KeystrokeCaptureInput — Drop-in password input with keystroke dynamics capture
 * 
 * Records typing rhythm (hold times + flight times) invisibly during password entry.
 * Emits timing vectors via onTimingCapture callback when the user finishes typing.
 * 
 * Usage:
 *   <KeystrokeCaptureInput
 *     value={password}
 *     onChange={(e) => setPassword(e.target.value)}
 *     onTimingCapture={(timingData) => setKeystrokeData(timingData)}
 *     className="..."
 *     placeholder="••••••••"
 *   />
 */
function KeystrokeCaptureInput({ value, onChange, onTimingCapture, className, placeholder, ...props }) {
    // Timing state stored in refs to avoid re-renders on every keystroke
    const keyDownTimestamps = useRef({});  // { keyCode: timestamp }
    const holdTimes = useRef([]);         // Duration each key was held (ms)
    const flightTimes = useRef([]);       // Time between consecutive key releases and next key press
    const lastKeyUpTime = useRef(null);   // Timestamp of last keyUp event
    const startTime = useRef(null);       // When typing started
    const keyCount = useRef(0);           // Total keys pressed

    const handleKeyDown = useCallback((e) => {
        // Ignore modifier keys and functional keys
        if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 'Escape'].includes(e.key)) return;
        
        const now = performance.now();
        
        // Record start time on first keystroke
        if (!startTime.current) {
            startTime.current = now;
        }

        // Record keyDown timestamp (only if not already held — prevents key repeat)
        if (!keyDownTimestamps.current[e.key]) {
            keyDownTimestamps.current[e.key] = now;
            keyCount.current++;

            // Calculate flight time (time since last keyUp to this keyDown)
            if (lastKeyUpTime.current !== null) {
                const flightTime = now - lastKeyUpTime.current;
                // Only record if the flight time is reasonable (< 2 seconds)
                if (flightTime > 0 && flightTime < 2000) {
                    flightTimes.current.push(flightTime);
                }
            }
        }
    }, []);

    const handleKeyUp = useCallback((e) => {
        if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 'Escape'].includes(e.key)) return;
        
        const now = performance.now();
        const downTime = keyDownTimestamps.current[e.key];

        if (downTime) {
            const holdTime = now - downTime;
            // Only record reasonable hold times (< 1 second)
            if (holdTime > 0 && holdTime < 1000) {
                holdTimes.current.push(holdTime);
            }
            delete keyDownTimestamps.current[e.key];
        }

        lastKeyUpTime.current = now;

        // Emit timing data after each keyUp (caller decides when to use it)
        if (onTimingCapture && holdTimes.current.length >= 3) {
            const totalTime = now - (startTime.current || now);
            onTimingCapture({
                holdTimes: [...holdTimes.current],
                flightTimes: [...flightTimes.current],
                totalTime,
                keyCount: keyCount.current
            });
        }
    }, [onTimingCapture]);

    const handleFocus = useCallback(() => {
        // Reset on focus — fresh capture each time user starts typing
        keyDownTimestamps.current = {};
        holdTimes.current = [];
        flightTimes.current = [];
        lastKeyUpTime.current = null;
        startTime.current = null;
        keyCount.current = 0;
    }, []);

    return (
        <input
            type="password"
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onFocus={handleFocus}
            className={className}
            placeholder={placeholder}
            autoComplete="current-password"
            {...props}
        />
    );
}

export default KeystrokeCaptureInput;
