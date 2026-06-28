import { API_URL } from '../config/api';

/**
 * Auth service — handles voter authentication via Supabase and API calls.
 */
export const authService = {

    async getAuthHeaders() {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    /**
     * Register a new voter (Pending Admin Approval)
     */
    async register(formData) {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        return data;
    },



    /**
     * Get current user from backend using Supabase JWT
     */
    async getCurrentUser() {
        try {
            const headers = await this.getAuthHeaders();

            const response = await fetch(`${API_URL}/auth/me`, {
                headers,
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await this.logout();
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

    isLoggedIn() {
        return !!localStorage.getItem('user') || !!localStorage.getItem('token');
    },

    getToken() {
        return localStorage.getItem('token');
    },

    /**
     * Logout user by clearing session
     */
    async logout() {
        try {
            const headers = await this.getAuthHeaders();
            await fetch(`${API_URL}/auth/logout`, { 
                method: 'POST', 
                headers,
                credentials: 'include' 
            }).catch(() => {});
        } catch (e) {
            console.error('Logout error', e);
        }
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    },

    /**
     * Link wallet address to user account
     */
    async linkWallet(walletAddress) {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`${API_URL}/user/link-wallet`, {
            method: 'POST',
            headers,
            credentials: 'include',
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
    async recordVote(txHash, electionId = null) {
        const headers = await this.getAuthHeaders();
        const payload = { txHash };
        if (electionId) payload.electionId = electionId;

        const response = await fetch(`${API_URL}/vote/record`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify(payload)
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
        const headers = await this.getAuthHeaders();
        const response = await fetch(`${API_URL}/user/profile`, {
            method: 'PUT',
            headers,
            credentials: 'include',
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
            const headers = await this.getAuthHeaders();
            const response = await fetch(`${API_URL}/vote/status`, {
                headers,
                credentials: 'include'
            });

            if (!response.ok) return false;

            const data = await response.json();
            return data.hasVoted;
        } catch (error) {
            return false;
        }
    }
};
