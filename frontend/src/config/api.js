/**
 * Shared API configuration — Single source of truth for backend URL.
 * Import this everywhere instead of duplicating the rawUrl/API_URL pattern.
 *
 * Supports three forms:
 *   1. Relative path:  "/api/v1"         → used as-is (Vite proxy in dev)
 *   2. Full URL:       "http(s)://…"     → ensures /api/v1 suffix
 *   3. Bare hostname:  "my-api.render.com"→ prepends https:// + /api/v1
 */
const rawUrl = import.meta.env.VITE_API_URL || '/api/v1';

let API_URL;
if (rawUrl.startsWith('/')) {
    // Relative path — use as-is (works with Vite dev proxy or same-origin deploy)
    API_URL = rawUrl;
} else if (rawUrl.startsWith('http')) {
    // Full URL — ensure /api/v1 suffix
    API_URL = rawUrl.endsWith('/api/v1') ? rawUrl : rawUrl.replace(/\/$/, '') + '/api/v1';
} else {
    // Bare hostname — prepend https:// and append /api/v1
    API_URL = 'https://' + rawUrl.replace(/\/$/, '') + (rawUrl.endsWith('/api/v1') ? '' : '/api/v1');
}

export { API_URL };
export const API_BASE = API_URL.replace('/api/v1', '') || '';
