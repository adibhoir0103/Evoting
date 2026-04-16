/**
 * Structured Logger — replaces console.log with leveled, timestamped output.
 * 
 * Provides consistent log format across the application:
 *   [2026-04-15T12:30:00.000Z] [INFO] [auth] User registered: user@example.com
 * 
 * In production, only WARN and ERROR levels are output.
 * In development, all levels are output (DEBUG, INFO, WARN, ERROR).
 * 
 * NOTE: For a full production system, replace this with winston or pino.
 * This lightweight wrapper avoids adding a dependency while providing
 * structured format, timestamps, context tags, and level filtering.
 */

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

const CURRENT_LEVEL = process.env.NODE_ENV === 'production' ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;

/**
 * Format a log message with timestamp, level, and context.
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
 * @param {string} context - Module/feature context (e.g., 'auth', 'zkp', 'vote')
 * @param {string} message - Human-readable log message
 * @param {object} [meta] - Optional structured metadata
 */
function formatLog(level, context, message, meta) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${context}]`;
    if (meta && Object.keys(meta).length > 0) {
        return `${prefix} ${message} ${JSON.stringify(meta)}`;
    }
    return `${prefix} ${message}`;
}

const logger = {
    /**
     * Create a child logger with a fixed context tag.
     * Usage: const log = logger.child('auth');
     *        log.info('User registered', { email: 'x@y.com' });
     */
    child(context) {
        return {
            debug: (message, meta) => logger.debug(context, message, meta),
            info: (message, meta) => logger.info(context, message, meta),
            warn: (message, meta) => logger.warn(context, message, meta),
            error: (message, meta) => logger.error(context, message, meta),
        };
    },

    debug(context, message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
            console.log(formatLog('DEBUG', context, message, meta));
        }
    },

    info(context, message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
            console.log(formatLog('INFO', context, message, meta));
        }
    },

    warn(context, message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
            console.warn(formatLog('WARN', context, message, meta));
        }
    },

    error(context, message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
            console.error(formatLog('ERROR', context, message, meta));
            // Also send to Sentry if available
            if (process.env.SENTRY_DSN) {
                try {
                    const Sentry = require('@sentry/node');
                    Sentry.captureMessage(`[${context}] ${message}`, {
                        level: 'error',
                        extra: meta,
                    });
                } catch (e) {
                    // Sentry not available — skip silently
                }
            }
        }
    },
};

module.exports = logger;
