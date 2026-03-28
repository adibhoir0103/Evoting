const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

/**
 * Authentication service to interact with backend API
 */
export const authService = {

    /**
     * Get current user from token
     */
    async getCurrentUser() {
        const token = localStorage.getItem('token');
        if (!token) return null;

        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                this.logout();
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
     * Check if user is logged in
     */
    isLoggedIn() {
        return !!localStorage.getItem('token') || !!localStorage.getItem('adminToken');
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
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${API_URL}/user/link-wallet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ walletAddress })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to link wallet');
        }

        // Update stored user
        const user = this.getStoredUser();
        if (user) {
            user.walletAddress = walletAddress;
            localStorage.setItem('user', JSON.stringify(user));
        }

        return data;
    },

    /**
     * Fetch a 5-minute single-use TTL token before voting on-chain
     */
    async getPreflightToken(clerkToken) {
        if (!clerkToken) throw new Error('Not authenticated');

        const response = await fetch(`${API_URL}/vote/pre-flight`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${clerkToken}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to acquire pre-flight token');
        }

        return data.upstashToken;
    },

    /**
     * Record vote in database after blockchain transaction
     */
    async recordVote(txHash, upstashToken, turnstileToken, clerkToken) {
        if (!clerkToken) throw new Error('Not authenticated');

        const response = await fetch(`${API_URL}/vote/record`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clerkToken}`
            },
            body: JSON.stringify({ txHash, upstashToken, turnstileToken })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to record vote');
        }

        // Update stored user
        const user = this.getStoredUser();
        if (user) {
            user.hasVoted = true;
            localStorage.setItem('user', JSON.stringify(user));
        }

        return data;
    },

    /**
     * Update user profile (Father's Name, etc)
     */
    async updateProfile(data) {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${API_URL}/user/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to update profile');
        }

        // Update stored user
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
        const token = localStorage.getItem('token');
        if (!token) return false;

        try {
            const response = await fetch(`${API_URL}/vote/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return false;

            const data = await response.json();
            return data.hasVoted;
        } catch (error) {
            return false;
        }
    },

    /**
     * Get auth token
     */
    getToken() {
        return localStorage.getItem('token');
    }
};
