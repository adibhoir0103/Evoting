/**
 * Shared API configuration — Single source of truth for backend URL.
 * Import this everywhere instead of duplicating the rawUrl/API_URL pattern.
 *
 * In PRODUCTION (Vercel), we ALWAYS use the relative path "/api/v1"
 * so requests go through Vercel's proxy rewrite (vercel.json) to Render.
 * This avoids ALL cross-domain cookie issues.
 *
 * In DEVELOPMENT, VITE_API_URL can be set to a full URL for direct calls.
 */
const isDevMode = import.meta.env.DEV;
const rawUrl = isDevMode
    ? (import.meta.env.VITE_API_URL || '/api/v1')
    : '/api/v1'; // ALWAYS use Vercel proxy in production

let API_URL;
if (rawUrl.startsWith('/')) {
    // Relative path — use as-is (works with Vite dev proxy or Vercel rewrite)
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
