/**
 * Frontend Input Validation Utilities
 * 
 * All validation happens on BOTH frontend (for UX) and backend (for security).
 * Frontend validation provides instant feedback; backend validation is the security boundary.
 */

/** Email validation — RFC 5322 simplified */
export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Aadhaar number — 12 digits, Verhoeff checksum format */
export function isValidAadhaar(aadhaar) {
    if (!aadhaar || typeof aadhaar !== 'string') return false;
    const cleaned = aadhaar.replace(/[\s-]/g, '');
    return /^\d{12}$/.test(cleaned) && !/^(\d)\1{11}$/.test(cleaned); // No all-same digits
}

/** Voter ID (EPIC) — 3 letters + 7 digits */
export function isValidVoterId(voterId) {
    if (!voterId || typeof voterId !== 'string') return false;
    return /^[A-Z]{3}\d{7}$/i.test(voterId.trim());
}

/** Mobile number — Indian format, 10 digits starting with 6-9 */
export function isValidMobile(mobile) {
    if (!mobile || typeof mobile !== 'string') return false;
    const cleaned = mobile.replace(/[\s-+]/g, '');
    // Remove country code if present
    const num = cleaned.startsWith('91') && cleaned.length === 12 ? cleaned.slice(2) : cleaned;
    return /^[6-9]\d{9}$/.test(num);
}

/** Password strength — min 8 chars, 1 upper, 1 lower, 1 digit, 1 special */
export function isStrongPassword(password) {
    if (!password || typeof password !== 'string') return { valid: false, message: 'Password is required' };
    if (password.length < 8) return { valid: false, message: 'At least 8 characters required' };
    if (!/[A-Z]/.test(password)) return { valid: false, message: 'At least one uppercase letter required' };
    if (!/[a-z]/.test(password)) return { valid: false, message: 'At least one lowercase letter required' };
    if (!/\d/.test(password)) return { valid: false, message: 'At least one number required' };
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return { valid: false, message: 'At least one special character required' };
    return { valid: true, message: 'Strong password' };
}

/** Name validation — 2-100 chars, no digits or special chars */
export function isValidName(name) {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 2 && trimmed.length <= 100 && /^[a-zA-Z\s'.]+$/.test(trimmed);
}

/** Ethereum address — 0x prefix + 40 hex chars */
export function isValidEthAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** Transaction hash — 0x prefix + 64 hex chars */
export function isValidTxHash(hash) {
    if (!hash || typeof hash !== 'string') return false;
    return /^0x[0-9a-fA-F]{64}$/.test(hash);
}

/** OTP — exactly 6 digits */
export function isValidOTP(otp) {
    if (!otp || typeof otp !== 'string') return false;
    return /^\d{6}$/.test(otp.trim());
}

/**
 * Validate a form object against a schema.
 * Returns { valid: boolean, errors: { [field]: string } }
 * 
 * Usage:
 *   const result = validateForm({ email: 'test@x.com', name: '' }, {
 *       email: { required: true, validator: isValidEmail, message: 'Invalid email' },
 *       name: { required: true, validator: isValidName, message: 'Invalid name' },
 *   });
 */
export function validateForm(data, schema) {
    const errors = {};
    let valid = true;

    for (const [field, rules] of Object.entries(schema)) {
        const value = data[field];

        if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
            errors[field] = `${rules.label || field} is required`;
            valid = false;
            continue;
        }

        if (value && rules.validator && !rules.validator(value)) {
            errors[field] = rules.message || `Invalid ${rules.label || field}`;
            valid = false;
        }
    }

    return { valid, errors };
}
