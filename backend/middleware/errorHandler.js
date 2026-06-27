/**
 * Centralized Error Handling Middleware
 * 
 * Provides:
 * 1. asyncHandler — wraps async route handlers to catch rejections
 * 2. errorHandler — Express error middleware for consistent JSON responses
 */

const logger = require('../lib/logger');
const serverLog = logger.child('server');

/**
 * Wraps an async Express route handler to automatically catch
 * rejected promises and forward them to the error handler.
 * 
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Centralized Express error handler.
 * Must be registered LAST with app.use().
 */
function errorHandler(err, req, res, next) {
    serverLog.error('API Pipeline Fault', {
        error: err.message,
        status: err.status,
        path: req.path,
        method: req.method
    });

    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        error: `[DEBUG] ${err.message}` // Temporarily expose the real error message for debugging
    });
}

module.exports = { asyncHandler, errorHandler };
