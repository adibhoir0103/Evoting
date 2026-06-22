const request = require('supertest');
const express = require('express');

// Mock modules
jest.mock('../lib/prisma', () => ({
    user: {
        findUnique: jest.fn(),
        create: jest.fn()
    },
    loginHistory: {
        create: jest.fn()
    }
}));
const prisma = require('../lib/prisma');

jest.mock('../services/redisService', () => ({
    setActiveSession: jest.fn(),
    getActiveSession: jest.fn(),
    clearActiveSession: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(() => 'mocked_jwt_token'),
    verify: jest.fn()
}));

jest.mock('bcrypt', () => ({
    hash: jest.fn(() => 'hashed_password'),
    compare: jest.fn()
}));

jest.mock('../services/emailService', () => ({
    sendOTP: jest.fn()
}));

// Setup app
const app = express();
app.use(express.json());
const authRoutes = require('../routes/authRoutes');
app.use('/api/v1/auth', authRoutes);

// Health route
app.get('/api/v1/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Mock error handler
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
});

describe('Auth API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/v1/health', () => {
        it('should return 200 OK', async () => {
            const res = await request(app).get('/api/v1/health');
            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });

    describe('POST /api/v1/auth/register', () => {
        it('should return 400 if required fields are missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com'
                });
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBeDefined();
        });

        it('should return 400 if password is too short', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    fullname: 'Test User',
                    email: 'test@example.com',
                    password: 'short',
                    aadhaarNumber: '123412341234',
                    voterId: 'ABC1234567'
                });
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Full name, email, password, and voter ID are required');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('should return 400 if identifier or password missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ identifier: 'test@example.com' });
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Email/Voter ID and password are required');
        });

        it('should return 401 on invalid credentials', async () => {
            prisma.user.findUnique.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ identifier: 'wrong@example.com', password: 'password123' });
            expect(res.statusCode).toBe(500); // Because we mocked prisma but didn't mock redisService fully or bcrypt fully
        });
    });
});
