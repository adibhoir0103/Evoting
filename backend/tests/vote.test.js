const request = require('supertest');
const express = require('express');

// Mock middlewares
jest.mock('../middleware/authenticate', () => ({
    injectUser: (req, res, next) => {
        // Simple mock: if auth header exists, let them pass
        if (req.headers.authorization) {
            req.user = { id: 1, voterId: 'VOTER123', email: 'test@test.com' };
            return next();
        }
        res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
}));

// Mock prisma
jest.mock('../lib/prisma', () => ({
    vote: {
        findFirst: jest.fn(),
        create: jest.fn()
    },
    user: {
        update: jest.fn(),
        findUnique: jest.fn()
    },
    electionVoter: {
        update: jest.fn()
    }
}));
const prisma = require('../lib/prisma');

jest.mock('../services/emailService', () => ({
    sendVoteReceipt: jest.fn()
}));

const app = express();
app.use(express.json());
const voteRoutes = require('../routes/voteRoutes');
app.use('/api/v1/vote', voteRoutes);

describe('Vote API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/v1/vote/status', () => {
        it('should return 401 if unauthenticated', async () => {
            const res = await request(app).get('/api/v1/vote/status');
            expect(res.statusCode).toBe(401);
        });

        it('should return vote status for authenticated user', async () => {
            prisma.user.findUnique.mockResolvedValueOnce({ has_voted: true, wallet_address: '0x123' });

            const res = await request(app)
                .get('/api/v1/vote/status')
                .set('Authorization', 'Bearer dummy_token');
            
            expect(res.statusCode).toBe(200);
            expect(res.body.hasVoted).toBe(true);
        });
    });

    describe('POST /api/v1/vote/record', () => {
        it('should return 400 if txHash is missing', async () => {
            const res = await request(app)
                .post('/api/v1/vote/record')
                .set('Authorization', 'Bearer dummy_token')
                .send({ electionId: 'bharat-evote-2026' });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Transaction hash is required');
        });

        it('should return 400 for invalid txHash format', async () => {
            const res = await request(app)
                .post('/api/v1/vote/record')
                .set('Authorization', 'Bearer dummy_token')
                .send({ 
                    txHash: 'invalid_hash', 
                    electionId: 'bharat-evote-2026' 
                });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Invalid transaction hash format');
        });
    });
});
