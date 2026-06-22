const request = require('supertest');
const express = require('express');

// Mock middlewares
jest.mock('../middleware/authenticate', () => ({
    injectUser: (req, res, next) => {
        if (req.headers.authorization) {
            req.user = { id: 1, voterId: 'VOTER123', email: 'test@test.com' };
            return next();
        }
        res.status(401).json({ error: 'Authentication required' });
    }
}));

const app = express();
app.use(express.json());
const zkpRoutes = require('../routes/zkpRoutes');
app.use('/api/v1/zkp', zkpRoutes);

describe('ZKP API Endpoints (Cryptographic Ballot Privacy)', () => {
    
    describe('GET /api/v1/zkp/status', () => {
        it('should return feature flags and status', async () => {
            const res = await request(app).get('/api/v1/zkp/status');
            expect(res.statusCode).toBe(200);
            expect(res.body.zkpEnabled).toBe(true);
            expect(res.body.features).toContain('pedersen-commitments');
            expect(res.body.features).toContain('schnorr-challenges');
        });
    });

    describe('POST /api/v1/zkp/generate-commitment', () => {
        it('should return 401 if unauthenticated', async () => {
            const res = await request(app)
                .post('/api/v1/zkp/generate-commitment')
                .send({ candidateId: 1 });
            expect(res.statusCode).toBe(401);
        });

        it('should return 400 if candidateId is missing', async () => {
            const res = await request(app)
                .post('/api/v1/zkp/generate-commitment')
                .set('Authorization', 'Bearer dummy')
                .send({});
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Valid candidateId is required');
        });
    });

    describe('POST /api/v1/zkp/verify-proof', () => {
        it('should return 400 if proof components are missing', async () => {
            const res = await request(app)
                .post('/api/v1/zkp/verify-proof')
                .set('Authorization', 'Bearer dummy')
                .send({ 
                    commitment: '0x123',
                    // missing proof and nullifier
                });
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('All verification parameters are required');
        });
    });
});
