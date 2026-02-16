import React, { useState } from 'react';
import { BlockchainService } from '../services/blockchainService';

function WalletConnect({ onConnect, onError }) {
    const [loading, setLoading] = useState(false);

    const handleConnect = async () => {
        try {
            setLoading(true);
            const service = BlockchainService.getInstance();
            const account = await service.connectWallet();
            onConnect(account);
        } catch (error) {
            console.error('Connection error:', error);
            if (onError) {
                onError(error.message || 'Failed to connect wallet');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="card max-w-md w-full text-center animate-slide-up">
                <div className="text-6xl mb-6">🦊</div>
                <h2 className="text-3xl font-bold mb-4">Connect Your Wallet</h2>
                <p className="text-gray-300 mb-8">
                    Connect your MetaMask wallet to participate in the voting process
                </p>

                <button
                    onClick={handleConnect}
                    disabled={loading}
                    className="btn-primary w-full"
                >
                    {loading ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Connecting...
                        </span>
                    ) : (
                        'Connect MetaMask'
                    )}
                </button>

                <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-sm text-gray-400 mb-2">Don't have MetaMask?</p>
                    <a
                        href="https://metamask.io/download/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        Download MetaMask →
                    </a>
                </div>
            </div>
        </div>
    );
}

export default WalletConnect;
