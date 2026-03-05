const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');
const { getDb } = require('../src/db/database');
const { initializeCA } = require('../src/ca/authority');

// Generate unique usernames for each test run to avoid DB conflicts
const runId = Date.now().toString().slice(-4);

// Mock headers for replay tests
const getHeaders = (token) => {
    const headers = {
        'x-timestamp': Date.now().toString(),
        'x-nonce': Date.now().toString() + '-' + Math.random().toString(36).substring(2, 10)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
};

beforeAll(() => {
    getDb();
    initializeCA();
});

describe('Crypto Exchange Integration Tests', () => {
    let tokenA, tokenB;
    let userA, userB;
    let docId;

    test('1. Register Users', async () => {
        const resA = await request(app)
            .post('/api/auth/register')
            .set(getHeaders())
            .send({
                username: `alice_${runId}`,
                email: `alice_${runId}@test.com`,
                password: 'password123',
                fullName: 'Alice Test',
                role: 'lawyer'
            });
        expect(resA.status).toBe(201);
        tokenA = resA.body.token;
        userA = resA.body.user;

        const resB = await request(app)
            .post('/api/auth/register')
            .set(getHeaders())
            .send({
                username: `bob_${runId}`,
                email: `bob_${runId}@test.com`,
                password: 'password123',
                fullName: 'Bob Test',
                role: 'client'
            });
        expect(resB.status).toBe(201);
        tokenB = resB.body.token;
        userB = resB.body.user;
    });

    test('2. Upload Document (Sign, Encrypt)', async () => {
        const fileBuffer = Buffer.from('This is a highly confidential legal document.');

        const headers = getHeaders(tokenA);
        const res = await request(app)
            .post('/api/documents/upload')
            .set(headers)
            .field('recipientId', userB.id)
            .field('password', 'password123')
            .attach('file', fileBuffer, 'secret.pdf');

        expect(res.status).toBe(201);
        expect(res.body.document).toHaveProperty('id');
        expect(res.body.document.signatureVerified).toBe(true);
        docId = res.body.document.id;
    });

    test('3. Download & Decrypt Document as Recipient', async () => {
        const res = await request(app)
            .post(`/api/documents/${docId}/download`)
            .set(getHeaders(tokenB))
            .send({ password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.document.integrityValid).toBe(true);
        expect(res.body.document.signatureValid).toBe(true);

        const decoded = Buffer.from(res.body.document.data, 'base64').toString('utf8');
        expect(decoded).toBe('This is a highly confidential legal document.');
    });

    test('4. Prevent Unauthorized User Download', async () => {
        // Create user C
        const resC = await request(app)
            .post('/api/auth/register')
            .set(getHeaders())
            .send({
                username: `eve_${runId}`,
                email: `eve_${runId}@test.com`,
                password: 'password123',
                fullName: 'Eve Attacker'
            });

        const tokenC = resC.body.token;

        const res = await request(app)
            .post(`/api/documents/${docId}/download`)
            .set(getHeaders(tokenC))
            .send({ password: 'password123' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied');
    });

    test('5. Replay Attack Detection', async () => {
        const timestamp = Date.now().toString();
        const nonce = 'replay-nonce-' + runId;

        // Request 1: Should succeed
        const res1 = await request(app)
            .post('/api/auth/login')
            .set({
                'x-timestamp': timestamp,
                'x-nonce': nonce
            })
            .send({ username: `alice_${runId}`, password: 'password123' });

        expect(res1.status).toBe(200);

        // Request 2: Replay same request => should fail
        const res2 = await request(app)
            .post('/api/auth/login')
            .set({
                'x-timestamp': timestamp,
                'x-nonce': nonce
            })
            .send({ username: `alice_${runId}`, password: 'password123' });

        expect(res2.status).toBe(400);
        expect(res2.body.error).toContain('replay attack');
    });
});
