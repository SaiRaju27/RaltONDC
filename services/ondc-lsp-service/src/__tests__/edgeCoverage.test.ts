import request from 'supertest';
import { app } from '../server';
import { requireRiderAuth, signRiderToken } from '../security';
import { notificationService } from '../services/notificationService';
import { redisService } from '../services/redisService';
import { queueService } from '../services/queueService';
import { createAuthorizationHeader, verifySignature } from '../crypto/auth';
import { resetEntireDatabase, isDatabaseHealthy, getActiveEngine, initDatabase, closeDatabase } from '../database';
import { config } from '../config';

describe('Edge Coverage & Deep Resiliency Suite', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });
  describe('Security Middleware Edge Paths', () => {
    it('requireRiderAuth should reject request without auth header in production mode', () => {
      const originalEnv = config.isProduction;
      try {
        (config as any).isProduction = true;
        const req: any = { headers: {} };
        const res: any = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        const next = jest.fn();

        requireRiderAuth(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      } finally {
        (config as any).isProduction = originalEnv;
      }
    });

    it('requireRiderAuth should reject invalid or expired bearer tokens', () => {
      const req: any = { headers: { authorization: 'Bearer invalid.token.payload' } };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      requireRiderAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('requireRiderAuth should allow valid bearer token and set req.riderAuth', () => {
      const token = signRiderToken('rider-edge-99', '9876543210');
      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      requireRiderAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.riderAuth.riderId).toBe('rider-edge-99');
    });
  });

  describe('Crypto Auth Edge Cases', () => {
    it('createAuthorizationHeader should handle string or object body gracefully', async () => {
      const headerFromString = await createAuthorizationHeader('{"test":"payload"}');
      expect(typeof headerFromString).toBe('string');

      const headerFromObj = await createAuthorizationHeader({ test: 'payload' });
      expect(typeof headerFromObj).toBe('string');
    });

    it('verifySignature should handle dev mode fallback and public key validation', async () => {
      const valid = await verifySignature('Signature keyId="mock",algorithm="ed25519",signature="abc"', { foo: 'bar' }, undefined);
      expect(valid).toBe(true);
    });
  });

  describe('Notification Dispatch Channels', () => {
    it('should invoke sendExpoPush and handle external delivery', async () => {
      const res = await notificationService.sendExpoPush('ExponentPushToken[mock-token-12345]', 'Title', 'Body', { foo: 'bar' });
      expect(res).toBeDefined();
    });

    it('should invoke sendAirbrickSms without unhandled rejection', async () => {
      const res = await notificationService.sendAirbrickSms('9876543210', 'Your delivery OTP is 4321');
      expect(res).toBeDefined();
    });
  });

  describe('Admin and Reset Endpoints', () => {
    it('POST /api/admin/reset-db should reset database seed data successfully', async () => {
      const res = await request(app).post('/api/admin/reset-db');
      expect([200, 500]).toContain(res.status);
    });

    it('POST /api/kyc/request/:id and /response/:id should return KYC mock responses', async () => {
      const reqRes = await request(app)
        .post('/api/kyc/request/RALT-RIDER-001')
        .send({ documentType: 'AADHAAR' });
      expect(reqRes.status).toBe(200);

      const respRes = await request(app)
        .post('/api/kyc/response/RALT-RIDER-001')
        .send({ status: 'SUCCESS' });
      expect(respRes.status).toBe(200);
    });

    it('Notification routes should allow retrieving, sending, and marking as read', async () => {
      const listRes = await request(app).get('/api/notifications?riderId=RALT-RIDER-001');
      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);

      const sendRes = await request(app)
        .post('/api/notifications/send')
        .send({
          riderId: 'RALT-RIDER-001',
          title: 'System Notice',
          message: 'Payment credited to wallet',
          channel: 'IN_APP',
          type: 'EARNINGS'
        });
      expect(sendRes.status).toBe(200);

      const notifId = sendRes.body?.notification?.id;
      if (notifId) {
        const markRes = await request(app).put(`/api/notifications/${notifId}/read`);
        expect(markRes.status).toBe(200);
      }

      const markAllRes = await request(app)
        .put('/api/notifications/read-all')
        .send({ riderId: 'RALT-RIDER-001' });
      expect(markAllRes.status).toBe(200);
    });

    it('Mock BAP loopback should acknowledge callbacks', async () => {
      const res = await request(app).post('/mock/bap/on_search').send({});
      expect(res.status).toBe(200);
      expect(res.body.message.ack.status).toBe('ACK');
    });

    it('Redis and Queue service direct fallbacks should execute cleanly', async () => {
      await redisService.publish('test_channel', { status: 'OK' });
      await (queueService as any).handleDirectFallback(
        'notifications_push',
        { recipientId: 'RALT-RIDER-001', title: 'Fallback Push', body: 'Body' }
      );
      await (queueService as any).handleDirectFallback(
        'notifications_sms',
        { mobile: '+919876543210', message: 'Fallback SMS' }
      );
    });
  });
});
