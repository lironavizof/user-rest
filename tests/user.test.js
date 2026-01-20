process.env.NODE_ENV = 'test';

const request = require('supertest');

/**
 * Prevent real DB connection when importing app
 */
jest.mock('../config/db', () => jest.fn(() => Promise.resolve()));

/**
 * Mock cost service client (used by GET /users/api/:id)
 */
jest.mock('../services/cost_service_client', () => ({
    getUserTotalCosts: jest.fn()
}));

/**
 * Mock User model (constructor + static methods)
 */
jest.mock('../models/User', () => {
    const saveMock = jest.fn();

    const User = jest.fn((data) => ({
        ...data,
        save: saveMock
    }));

    User.find = jest.fn();
    User.findOne = jest.fn();
    User.exists = jest.fn();

    User.__saveMock = saveMock;
    return User;
});

const app = require('../app');
const User = require('../models/User');
const { getUserTotalCosts } = require('../services/cost_service_client');

describe('User service routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ----------------
    // Health check
    // ----------------
    test('GET / returns health message', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain('User REST API is running');
    });

    // ----------------
    // GET /users/api/users
    // ----------------
    test('GET /users/api/users returns users list', async () => {
        const mockUsers = [
            { id: 1, first_name: 'A', last_name: 'B', birthday: '2000-01-01' },
            { id: 2, first_name: 'C', last_name: 'D', birthday: '2001-01-01' }
        ];
        User.find.mockResolvedValue(mockUsers);

        const res = await request(app).get('/users/api/users');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(mockUsers);
        expect(User.find).toHaveBeenCalledTimes(1);
    });

    test('GET /users/api/users when DB fails -> 500', async () => {
        User.find.mockRejectedValue(new Error('DB fail'));

        const res = await request(app).get('/users/api/users');
        expect(res.statusCode).toBe(500);
        expect(res.body).toHaveProperty('error');
    });

    // ----------------
    // POST /users/api/add
    // ----------------
    test('POST /users/api/add missing fields -> 400', async () => {
        const res = await request(app).post('/users/api/add').send({ id: 10 });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('Missing required fields');
    });

    test('POST /users/api/add id not number -> 400', async () => {
        const res = await request(app).post('/users/api/add').send({
            id: 'abc',
            first_name: 'Test',
            last_name: 'User',
            birthday: '2000-01-01'
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('id must be a number');
    });

    test('POST /users/api/add invalid birthday -> 400', async () => {
        const res = await request(app).post('/users/api/add').send({
            id: 10,
            first_name: 'Test',
            last_name: 'User',
            birthday: 'bad-date'
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('birthday must be a valid date');
    });

    test('POST /users/api/add user already exists -> 409', async () => {
        User.exists.mockResolvedValue({ _id: 'x' });

        const res = await request(app).post('/users/api/add').send({
            id: 10,
            first_name: 'Test',
            last_name: 'User',
            birthday: '2000-01-01'
        });
        expect(res.statusCode).toBe(409);
        expect(res.body.error).toContain('User already exists');
    });

    test('POST /users/api/add success -> 201', async () => {
        User.exists.mockResolvedValue(null);

        User.__saveMock.mockResolvedValue({
            id: 10,
            first_name: 'Test',
            last_name: 'User',
            birthday: new Date('2000-01-01')
        });

        const res = await request(app).post('/users/api/add').send({
            id: 10,
            first_name: 'Test',
            last_name: 'User',
            birthday: '2000-01-01'
        });

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('id', 10);
        expect(res.body).toHaveProperty('first_name', 'Test');
        expect(res.body).toHaveProperty('last_name', 'User');
        expect(User.__saveMock).toHaveBeenCalledTimes(1);
    });

    test('POST /users/api/add duplicate key error -> 409', async () => {
        User.exists.mockResolvedValue(null);
        User.__saveMock.mockRejectedValue({ code: 11000 });

        const res = await request(app).post('/users/api/add').send({
            id: 11,
            first_name: 'Test',
            last_name: 'User',
            birthday: '2000-01-01'
        });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toContain('already exists');
    });

    test('POST /users/api/add other error -> 400', async () => {
        User.exists.mockResolvedValue(null);
        User.__saveMock.mockRejectedValue(new Error('some error'));

        const res = await request(app).post('/users/api/add').send({
            id: 12,
            first_name: 'Test',
            last_name: 'User',
            birthday: '2000-01-01'
        });

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    // ----------------
    // GET /users/api/exists/:id
    // ----------------
    test('GET /users/api/exists/:id invalid id -> 400', async () => {
        const res = await request(app).get('/users/api/exists/abc');
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('GET /users/api/exists/:id exists true', async () => {
        User.exists.mockResolvedValue({ _id: 'x' });

        const res = await request(app).get('/users/api/exists/10');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ exists: true });
    });

    test('GET /users/api/exists/:id exists false', async () => {
        User.exists.mockResolvedValue(null);

        const res = await request(app).get('/users/api/exists/10');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ exists: false });
    });

    // ----------------
    // GET /users/api/:id
    // ----------------
    test('GET /users/api/:id invalid id -> 400', async () => {
        const res = await request(app).get('/users/api/abc');
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('must be a number');
    });

    test('GET /users/api/:id user not found -> 404', async () => {
        User.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue(null)
        });

        const res = await request(app).get('/users/api/99');
        expect(res.statusCode).toBe(404);
        expect(res.body.error).toContain('User not found');
    });

    test('GET /users/api/:id success includes total', async () => {
        User.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                id: 10,
                first_name: 'Test',
                last_name: 'User'
            })
        });

        getUserTotalCosts.mockResolvedValue(123.45);

        const res = await request(app).get('/users/api/10');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            first_name: 'Test',
            last_name: 'User',
            id: 10,
            total: 123.45
        });
        expect(getUserTotalCosts).toHaveBeenCalledWith(10);
    });

    test('GET /users/api/:id cost service fails -> 500', async () => {
        User.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({
                id: 10,
                first_name: 'Test',
                last_name: 'User'
            })
        });

        getUserTotalCosts.mockRejectedValue(new Error('cost down'));

        const res = await request(app).get('/users/api/10');
        expect(res.statusCode).toBe(500);
        expect(res.body).toHaveProperty('error');
    });
});
