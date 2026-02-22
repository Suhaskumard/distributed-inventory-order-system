const request = require('supertest');
const app = require('../index');

describe('Order Service health', () => {
  test('GET /health returns 200 and JSON', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('service', 'order-service');
  });
});
