const request = require('supertest');
const app = require('../server');

describe('SLICT Property API', () => {
  it('should serve index.html on GET /', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('<!DOCTYPE html>');
  });

  it('should serve static files', async () => {
    const res = await request(app).get('/index.html');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('SLICT Property');
  });

  it('should return health status on GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('date');
  });

  it('should return test message on GET /api/test', async () => {
    const res = await request(app).get('/api/test');
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Test endpoint working');
  });

  it('should return index.html for unknown routes (fallback)', async () => {
    const res = await request(app).get('/random-nonexistent-route');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('<!DOCTYPE html>');
  });
});