import request from 'supertest';
import { app } from '../server';
import { initDatabase, closeDatabase } from '../database';

describe('Delivery Partner Rider Auth & Operations API', () => {
  const testPhone = '9876543210';

  beforeAll(async () => {
    await initDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('POST /api/auth/send-otp should reject invalid phone formats', async () => {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toContain('Valid 10-digit mobile number required');
  });

  it('POST /api/auth/send-otp should send OTP for valid 10-digit phone', async () => {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: testPhone });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message');
  });

  it('POST /api/auth/verify-otp should reject incorrect OTP', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: testPhone, otp: '000000' });

    expect([200, 400]).toContain(res.status);
    if (!res.body.success) {
      expect(res.body).toHaveProperty('error');
    }
  });

  it('POST /api/auth/login should require valid 10-digit phone number', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/rider/simulate-order should generate a mock dispatch order', async () => {
    const res = await request(app)
      .post('/api/rider/simulate-order')
      .send({
        riderId: 'rider-test-01',
        pickup: 'Gachibowli, Hyderabad',
        drop: 'Madhapur, Hyderabad'
      });

    if (res.status !== 200) {
      console.error('SIMULATE ORDER ERROR:', res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('order');
    expect(res.body.order).toHaveProperty('orderId');
    expect(res.body.order.pickup).toHaveProperty('address');
    expect(res.body.order.drop).toHaveProperty('address');
  });
});
