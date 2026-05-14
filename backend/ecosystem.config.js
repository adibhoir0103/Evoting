/**
 * PM2 Ecosystem Configuration
 * 
 * Production process management for Bharat E-Vote backend.
 * Supports cluster mode for load balancing across CPU cores.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 */

module.exports = {
    apps: [
        {
            name: 'bharat-evote-api',
            script: './server.js',
            instances: process.env.NODE_ENV === 'production' ? 'max' : 2,
            exec_mode: 'cluster',
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'development',
                PORT: 5000
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 5000
            },
            // Log configuration
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            merge_logs: true,
            // Graceful shutdown
            kill_timeout: 5000,
            listen_timeout: 10000,
            // Health monitoring
            max_restarts: 10,
            min_uptime: '10s'
        }
    ]
};
