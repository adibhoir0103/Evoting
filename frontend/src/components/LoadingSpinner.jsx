import React from 'react';

function LoadingSpinner({ text = 'Loading...' }) {
    return (
        <div className="flex flex-col items-center justify-center p-8">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.75s' }}></div>
                </div>
            </div>
            <p className="mt-4 text-gray-300">{text}</p>
        </div>
    );
}

export default LoadingSpinner;
