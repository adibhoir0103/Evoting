const { z } = require('zod');

// Shared basic validators
const emailValidator = z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(100, 'Email is too long')
    .toLowerCase();

const voterIdValidator = z.string()
    .min(1, 'Voter ID is required')
    .regex(/^[A-Za-z]{3}\d{7}$/, 'Voter ID must be 3 letters followed by 7 digits (e.g., ABC1234567)')
    .toUpperCase();

const aadhaarValidator = z.string()
    .transform(val => val.replace(/\s/g, '')) // Strip spaces first
    .refine(val => val === '' || /^\d{12}$/.test(val), 'Aadhaar must be exactly 12 digits')
    .optional();

const passwordValidator = z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and at least one number')
    .max(128, 'Password is too long');


// Route-specific Schemas

exports.registrationSchema = z.object({
    fullname: z.string().min(1, 'Full name is required').max(100),
    email: emailValidator,
    voter_id: voterIdValidator,
    aadhaar_number: aadhaarValidator,
    father_name: z.string().max(100).optional().nullable(),
    gender: z.enum(['Male', 'Female', 'Other', '']).optional().nullable(),
    dob: z.string().max(20).optional().nullable(),
    mobile_number: z.string().max(15).optional().nullable(),
    state_code: z.union([z.string(), z.number()]).optional().nullable(),
    constituency_code: z.union([z.string(), z.number()]).optional().nullable(),
    address: z.string().max(500).optional().nullable()
}).passthrough(); // Allow Turnstile token and other metadata to pass through if necessary


exports.loginSchema = z.object({
    identifier: z.string().min(1, 'Identifier required').max(100),
    password: z.string().min(1, 'Password required').max(128)
}).passthrough();


exports.setPasswordSchema = z.object({
    newPassword: passwordValidator,
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
});
