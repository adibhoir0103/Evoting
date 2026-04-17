import { API_URL } from '../config/api';

/**
 * Auth service — handles voter authentication, JWT tokens, and API calls.
 * Supports both real JWT auth and dev-mode test-token fallback.
 */
export const authService = {

    /**
     * Get the stored JWT token
     */
    getToken() {
        return localStorage.getItem('token') || 'test-token';
    },

    /**
     * Get auth headers for API calls
     */
    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getToken()}`
        };
    },

    /**
     * Register a new voter
     */
    async register(formData) {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        // Store auth data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    },

    /**
     * Login voter
     */
    async login(identifier, password) {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Store auth data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    },

    /**
     * Get current user from backend (verifies token)
     */
    async getCurrentUser() {
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${this.getToken()}` }
            });

            if (!response.ok) {
                // Token invalid — clear it
                if (response.status === 401) {
                    this.logout();
                }
                return null;
            }

            const user = await response.json();
            localStorage.setItem('user', JSON.stringify(user));
            return user;
        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    },

    /**
     * Get stored user (synchronous)
     */
    getStoredUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    /**
     * Check if user is logged in (has a real token, not test-token)
     */
    isLoggedIn() {
        const token = localStorage.getItem('token');
        // In dev mode, allow test-token. In production, require real JWT.
        if (!token) return false;
        if (token === 'test-token') return true; // dev fallback
        // Check if token is not expired (basic check)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 > Date.now();
        } catch {
            return false;
        }
    },

    /**
     * Logout user
     */
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    /**
     * Link wallet address to user account
     */
    async linkWallet(walletAddress) {
        const response = await fetch(`${API_URL}/user/link-wallet`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ walletAddress })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to link wallet');
        }

        const user = this.getStoredUser();
        if (user) {
            user.walletAddress = walletAddress;
            localStorage.setItem('user', JSON.stringify(user));
        }

        return data;
    },

    /**
     * Record vote in database after blockchain transaction
     */
    async recordVote(txHash) {
        const response = await fetch(`${API_URL}/vote/record`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ txHash })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to record vote');
        }

        const user = this.getStoredUser();
        if (user) {
            user.hasVoted = true;
            localStorage.setItem('user', JSON.stringify(user));
        }

        return data;
    },

    /**
     * Update user profile
     */
    async updateProfile(data) {
        const response = await fetch(`${API_URL}/user/profile`, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Failed to update profile');
        }

        const currentUser = this.getStoredUser();
        if (currentUser) {
            const updatedUser = { ...currentUser, ...data };
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }

        return result;
    },

    /**
     * Check if user has voted
     */
    async checkVoteStatus() {
        try {
            const response = await fetch(`${API_URL}/vote/status`, {
                headers: { 'Authorization': `Bearer ${this.getToken()}` }
            });

            if (!response.ok) return false;

            const data = await response.json();
            return data.hasVoted;
        } catch (error) {
            return false;
        }
    }
};
