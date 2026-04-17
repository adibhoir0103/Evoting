/**
 * Shared API configuration — Single source of truth for backend URL.
 * Import this everywhere instead of duplicating the rawUrl/API_URL pattern.
 */
const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const API_URL = rawUrl.startsWith('http')
    ? (rawUrl.endsWith('/api/v1') ? rawUrl : rawUrl.replace(/\/$/, '') + '/api/v1')
    : 'https://' + rawUrl.replace(/\/$/, '') + (rawUrl.endsWith('/api/v1') ? '' : '/api/v1');

export const API_BASE = API_URL.replace('/api/v1', '');
