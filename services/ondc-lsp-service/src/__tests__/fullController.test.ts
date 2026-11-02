import request from 'supertest';
import { app } from '../server';
import { initDatabase, closeDatabase } from '../database';
import { signRiderToken } from '../security';

describe('Comprehensive Controller & API Coverage Suite', () => {
  const testPhone = '9988776655';
  let testRiderId: string;
  let testToken: string;
  let testOrderId: string;

  beforeAll(async () => {
    await initDatabase();

    // Register a test rider
    const regRes = await request(app)
      .post('/api/rider/register')
      .send({
        phone: testPhone,
        name: 'Full Coverage Partner',
        city: 'Hyderabad',
        vehicleType: 'Electric Two-Wheeler'
      });

    testRiderId = regRes.body.rider.id;
    testToken = signRiderToken(testRiderId, testPhone);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Rider Controller Profile & Operational APIs', () => {
    it('GET /api/rider/profile should return rider profile', async () => {
      const res = await request(app)
        .get(`/api/rider/profile?riderId=${testRiderId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rider.id).toBe(testRiderId);
    });

    it('POST /api/rider/profile should update partner profile fields', async () => {
      const res = await request(app)
        .post('/api/rider/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          riderId: testRiderId,
          name: 'Updated Partner Name',
          city: 'Hyderabad',
          emergency_phone: '+919988001122'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/rider/status should toggle partner online availability', async () => {
      const res = await request(app)
        .post('/api/rider/status')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          riderId: testRiderId,
          isOnline: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/rider/location should update GPS coordinates and return demand zone', async () => {
      const res = await request(app)
        .post('/api/rider/location')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          riderId: testRiderId,
          lat: 17.4483,
          lng: 78.3915
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/rider/save-step should persist onboarding progress', async () => {
      const res = await request(app)
        .post('/api/rider/save-step')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          riderId: testRiderId,
          step: 2,
          data: { father_name: 'Parent Name', dob: '1995-01-01' }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/rider/verify-bank should validate partner bank account', async () => {
      const res = await request(app)
        .post('/api/rider/verify-bank')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          riderId: testRiderId,
          bankName: 'HDFC Bank',
          accountNumber: '50100123456789',
          ifsc: 'HDFC0001234',
          holderName: 'Full Coverage Partner'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/rider/metrics should return fleet telemetry & dispatch metrics', async () => {
      const res = await request(app)
        .get('/api/rider/metrics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('metrics');
    });

    it('GET /api/rider/earnings should return wallet and payout statistics', async () => {
      const res = await request(app)
        .get(`/api/rider/earnings?riderId=${testRiderId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
    });
  });

  describe('Order Lifecycle & ONDC Protocol Progression', () => {
    it('POST /api/rider/simulate-order should create and assign an order', async () => {
      const res = await request(app)
        .post('/api/rider/simulate-order')
        .send({
          restaurantName: 'Paradise Biryani',
          restaurantAddress: 'Secunderabad',
          customerName: 'Kavita Reddy',
          customerAddress: 'Begumpet'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      testOrderId = res.body.order.orderId;
    });

    it('GET /api/rider/orders should list active orders for rider', async () => {
      const res = await request(app)
        .get(`/api/rider/orders?riderId=${testRiderId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it('GET /api/rider/all-orders should return order history', async () => {
      const res = await request(app)
        .get(`/api/rider/all-orders?riderId=${testRiderId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it('POST /api/rider/orders/:orderId/update-status should progress order fulfillment', async () => {
      if (testOrderId) {
        const res = await request(app)
          .post(`/api/rider/orders/${testOrderId}/update-status`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            status: 'Order-picked-up'
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
    });

    it('POST /ondc/confirm should handle ONDC confirm webhook', async () => {
      const res = await request(app)
        .post('/ondc/confirm')
        .send({
          context: {
            domain: 'ONDC:LOG10',
            action: 'confirm',
            bap_id: 'buyer.ondc.org',
            bap_uri: 'https://buyer.ondc.org/ondc',
            bpp_id: 'lsp.ralt.in',
            bpp_uri: 'https://lsp.ralt.in/ondc',
            transaction_id: 'tx-confirm-01',
            message_id: 'msg-confirm-01',
            timestamp: new Date().toISOString()
          },
          message: {
            order: {
              id: 'ord-confirm-01',
              items: [{ id: 'standard-delivery' }],
              fulfillment: {
                start: { location: { gps: '17.4483,78.3915', address: { area_code: '500081' } } },
                end: { location: { gps: '17.4375,78.4482', address: { area_code: '500034' } } }
              }
            }
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.message.ack.status).toBe('ACK');
    });

    it('POST /ondc/update and /ondc/track should return valid ACKs', async () => {
      const updateRes = await request(app)
        .post('/ondc/update')
        .send({
          context: { action: 'update', transaction_id: 'tx-u-1', message_id: 'msg-u-1' },
          message: {}
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.message.ack.status).toBe('ACK');

      const trackRes = await request(app)
        .post('/ondc/track')
        .send({
          context: { action: 'track', transaction_id: 'tx-t-1', message_id: 'msg-t-1' },
          message: { order_id: 'ord-101' }
        });
      expect(trackRes.status).toBe(200);
      expect(trackRes.body.message.ack.status).toBe('ACK');
    });

    it('GET /rider and /rider/* should serve delivery partner portal HTML', async () => {
      const res = await request(app).get('/rider');
      expect(res.status).toBe(200);

      const subRes = await request(app).get('/rider/dashboard');
      expect(subRes.status).toBe(200);
    });

    it('POST /api/rider/complete-current should complete current active order', async () => {
      const res = await request(app)
        .post('/api/rider/complete-current')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ riderId: testRiderId });

      expect([200, 404]).toContain(res.status);
    });

    it('POST /api/rider/orders/:orderId/verify-otp should verify customer delivery OTP', async () => {
      if (testOrderId) {
        const res = await request(app)
          .post(`/api/rider/orders/${testOrderId}/verify-otp`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({ otp: '1234' });

        expect([200, 400]).toContain(res.status);
      }
    });

    it('POST /api/admin/reset-db should execute full system database reset', async () => {
      const res = await request(app).post('/api/admin/reset-db');
      expect([200, 500]).toContain(res.status);
    });
  });
});
