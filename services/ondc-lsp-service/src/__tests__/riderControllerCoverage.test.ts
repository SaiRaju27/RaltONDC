import request from 'supertest';
import { app } from '../server';
import { initDatabase, closeDatabase } from '../database';
import { signRiderToken } from '../security';

describe('RiderController Deep Coverage Suite', () => {
  const phone = '9112233445';
  let token: string;
  let riderId: string;

  beforeAll(async () => {
    await initDatabase();

    const reg = await request(app)
      .post('/api/rider/register')
      .send({
        phone,
        name: 'Deep Test Partner',
        city: 'Hyderabad',
        vehicleType: 'Bike'
      });
    riderId = reg.body?.rider?.id || 'RALT-RIDER-001';
    token = signRiderToken(riderId, phone);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('GET /api/rider/profile by phone should return rider', async () => {
    const res = await request(app).get(`/api/rider/profile?phone=${phone}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/rider/profile for non-existent rider should return 404', async () => {
    const res = await request(app).get('/api/rider/profile?riderId=non-existent-999');
    expect(res.status).toBe(404);
  });

  it('POST /api/auth/login for registered rider should return token and status', async () => {
    const res = await request(app).post('/api/auth/login').send({ phone });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isRegistered).toBe(true);
  });

  it('POST /api/auth/login for unregistered rider should return isRegistered: false', async () => {
    const res = await request(app).post('/api/auth/login').send({ phone: '9000000001' });
    expect(res.status).toBe(200);
    expect(res.body.isRegistered).toBe(false);
  });

  it('POST /api/auth/verify-otp with valid default test OTPs should succeed', async () => {
    await request(app).post('/api/auth/send-otp').send({ phone });

    const res1234 = await request(app).post('/api/auth/verify-otp').send({ phone, code: '1234' });
    expect(res1234.status).toBe(200);
    expect(res1234.body.success).toBe(true);

    const res123456 = await request(app).post('/api/auth/verify-otp').send({ phone, code: '123456' });
    expect(res123456.status).toBe(200);
    expect(res123456.body.success).toBe(true);
  });

  it('POST /api/auth/verify-otp with invalid formats should return 400', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({ phone: '12', code: '1' });
    expect(res.status).toBe(400);
  });

  it('POST /api/rider/register should handle duplicate registration idempotently', async () => {
    const res = await request(app).post('/api/rider/register').send({
      phone,
      name: 'Deep Test Partner',
      city: 'Hyderabad'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/rider/save-step should handle all onboarding steps (1 through 5)', async () => {
    for (const step of [1, 2, 3, 4, 5]) {
      const res = await request(app)
        .post('/api/rider/save-step')
        .send({
          riderId,
          step,
          data: {
            father_name: 'Test Parent',
            aadhaar_number: '123456789012',
            pan_number: 'ABCDE1234F',
            dl_number: 'TS0920200001234',
            vehicle_number: 'TS09EA1234'
          }
        });
      expect(res.status).toBe(200);
    }
  });

  it('POST /api/rider/location should support heading and speed', async () => {
    const res = await request(app)
      .post('/api/rider/location')
      .send({
        riderId,
        lat: 17.4483,
        lng: 78.3915,
        heading: 90,
        speed: 35
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/auth/login and /api/rider/register should reject invalid phone formats', async () => {
    const resLogin = await request(app).post('/api/auth/login').send({ phone: '123' });
    expect(resLogin.status).toBe(400);

    const resReg = await request(app).post('/api/rider/register').send({ phone: '123' });
    expect(resReg.status).toBe(400);
  });

  it('POST /api/rider/save-step should reject missing riderId and phone', async () => {
    const res = await request(app).post('/api/rider/save-step').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/rider/verify-bank should validate account number and IFSC format', async () => {
    const resShortAcc = await request(app)
      .post('/api/rider/verify-bank')
      .send({ accountNumber: '1234', ifsc: 'HDFC0001234' });
    expect(resShortAcc.status).toBe(400);

    const resInvalidIfsc = await request(app)
      .post('/api/rider/verify-bank')
      .send({ accountNumber: '1234567890', ifsc: 'INVALID_IFSC' });
    expect(resInvalidIfsc.status).toBe(400);
  });

  it('POST /api/auth/send-otp should reject invalid phone and unregistered login', async () => {
    const resInvalidPhone = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '123', mode: 'login' });
    expect(resInvalidPhone.status).toBe(400);

    const resLoginUnreg = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '9000000001', mode: 'login' });
    expect(resLoginUnreg.status).toBe(404);
  });

  it('GET /api/rider/all-orders and /api/rider/earnings should succeed', async () => {
    const resOrders = await request(app).get('/api/rider/all-orders');
    expect(resOrders.status).toBe(200);

    const resEarnings = await request(app).get('/api/rider/earnings');
    expect(resEarnings.status).toBe(200);
  });
});

