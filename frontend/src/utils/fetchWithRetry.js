/**
 * fetchWithRetry — Resilient API client with exponential backoff.
 * 
 * Automatically retries failed requests (network errors, 5xx) with
 * increasing delays: 1s → 2s → 4s (default 3 retries).
 * 
 * Does NOT retry 4xx errors (client errors — these won't self-resolve).
 * 
 * @param {string} url - The URL to fetch
 * @param {object} options - Standard fetch options
 * @param {number} maxRetries - Maximum retry attempts (default 3)
 * @returns {Promise<Response>} - The fetch response
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: options.signal || AbortSignal.timeout(15000), // 15s timeout
            });

            // Don't retry client errors (4xx) — they won't self-resolve
            if (response.ok || (response.status >= 400 && response.status < 500)) {
                return response;
            }

            // Server error (5xx) — retry with backoff
            lastError = new Error(`Server error: ${response.status}`);
        } catch (err) {
            lastError = err;

            // Don't retry if request was explicitly aborted
            if (err.name === 'AbortError' && options.signal) {
                throw err;
            }
        }

        // Wait with exponential backoff before retrying (1s, 2s, 4s...)
        if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
            const jitter = Math.random() * 500; // Add jitter to avoid thundering herd
            await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
    }

    throw lastError || new Error(`Request failed after ${maxRetries + 1} attempts`);
}

/**
 * Resilient JSON fetcher — fetches with retry + auto-parses JSON.
 * 
 * @param {string} url 
 * @param {object} options 
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function fetchJSON(url, options = {}, maxRetries = 3) {
    const response = await fetchWithRetry(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    }, maxRetries);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Request failed (${response.status})`);
    }

    return response.json();
}
