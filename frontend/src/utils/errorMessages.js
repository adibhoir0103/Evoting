/**
 * Utility for humanizing technical error messages, particularly those
 * originating from blockchain infrastructure (ethers.js), network failures,
 * or generic server 500 errors.
 * 
 * This helps prevent exposing raw stack traces or complex hexadecimal
 * error codes to end users, improving both security and UX.
 */

export const humanizeError = (error) => {
    if (!error) return 'An unexpected error occurred. Please try again.';

    const message = (typeof error === 'string' ? error : error.message || '').toLowerCase();

    // 1. Blockchain / Ethers.js specific errors
    if (message.includes('user rejected') || message.includes('action rejected')) {
        return 'Transaction cancelled. Please approve the transaction in your wallet to continue.';
    }
    if (message.includes('insufficient funds') || message.includes('gas required exceeds')) {
        return 'Insufficient network fee (gas) to process this transaction. Please contact support.';
    }
    if (message.includes('network error') || message.includes('could not detect network') || message.includes('underlying network changed')) {
        return 'Blockchain network connection lost. Please check your internet connection and try again.';
    }
    if (message.includes('nonce too low') || message.includes('replacement fee too low')) {
        return 'A previous transaction is still pending. Please wait a moment and try again.';
    }
    if (message.includes('execution reverted')) {
        // Try to extract reason if provided by contract
        const match = message.match(/execution reverted: (.*?)(",|$)/);
        if (match && match[1]) return match[1];
        return 'The operation was rejected by the smart contract. You may have already voted or are not authorized.';
    }
    if (message.includes('missing revert data')) {
         return 'Transaction failed. The network might be congested or the smart contract state is invalid.';
    }

    // 2. Generic Network Errors (Fetch/Axios)
    if (message.includes('failed to fetch') || message.includes('network request failed')) {
        return 'Unable to connect to the server. Please check your internet connection.';
    }
    if (message.includes('timeout')) {
        return 'The request timed out. The server might be experiencing heavy load.';
    }

    // 3. Known application specific API errors
    if (message.includes('unauthorized') || message.includes('invalid token')) {
        return 'Your session has expired or is invalid. Please log in again.';
    }
    if (message.includes('rate limit')) {
        return 'Too many requests. Please wait a few minutes before trying again.';
    }

    // 4. Default fallback for generic/unhandled technical errors
    // Instead of showing [object Object] or weird RPC JSON errors:
    if (message.includes('internal server error') || message.includes('rpc error') || message.includes('{')) {
        console.error('Raw system error:', error); // Keep in console for debugging
        return 'A system error occurred. Our team has been notified. Please try again later.';
    }

    // If it's short and doesn't look like a technical trace, return as is
    if (message.length < 100 && !message.includes('stack:') && !message.includes('0x')) {
        return typeof error === 'string' ? error : error.message;
    }

    // Absolute fallback
    console.error('Unhandled raw error:', error);
    return 'An unexpected issue occurred. Please try again or contact support if the problem persists.';
};
