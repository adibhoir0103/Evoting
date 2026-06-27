const sanitizeHtml = require('sanitize-html');
const { ZodError } = require('zod');

/**
 * Aggressive HTML stripping options for sanitize-html.
 * We want to strip EVERYTHING (no tags allowed) for generic string inputs.
 */
const strictSanitizeOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
};

/**
 * Sanitizes all string values within an object deeply.
 * Modifies the object in place (or returns a new one if you prefer, but we'll return a new structure).
 */
const sanitizeObject = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
        // Strip HTML
        const cleanHtml = sanitizeHtml(obj, strictSanitizeOptions);
        // Trim whitespace
        return cleanHtml.trim();
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
    }
    return obj;
};

/**
 * Middleware factory for validating req.body against a Zod schema.
 * @param {import('zod').ZodSchema} schema 
 */
const validate = (schema) => {
    return (req, res, next) => {
        try {
            // 1. Sanitize the incoming request body
            const sanitizedBody = sanitizeObject(req.body);
            
            // 2. Validate against Zod schema
            const validatedData = schema.parse(sanitizedBody);
            
            // 3. Replace req.body with the perfectly sanitized & validated data
            req.body = validatedData;
            
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                // Log the specific validation errors on the server for monitoring/auditing
                console.warn(`[VALIDATION_FAILED] Path: ${req.originalUrl} | IP: ${req.ip} | Errors:`, JSON.stringify(error.errors));
                
                // Return the first user-friendly Zod error message
                const firstError = error.errors[0];
                const errorMsg = firstError?.message || 'Invalid input provided. Please verify your details and try again.';
                return res.status(400).json({ 
                    error: errorMsg
                });
            }
            
            // Pass any other unexpected errors to the global error handler
            next(error);
        }
    };
};

module.exports = {
    validate,
    sanitizeObject
};
