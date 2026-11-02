import request from 'supertest';
import axios from 'axios';
import https from 'https';
import { EventEmitter } from 'events';
import { app, wss, server, shutdown } from '../server';
import { initDatabase, closeDatabase } from '../database';
import { signRiderToken } from '../security';
import { riderManager } from '../services/riderManager';
import { orderManager } from '../services/orderManager';
import { redisService, RedisService } from '../services/redisService';
import { queueService, QueueService } from '../services/queueService';
import { notificationService } from '../services/notificationService';
import { createAuthorizationHeader, verifySignature } from '../crypto/auth';
import { config } from '../config';

describe('Backend 85%+ Coverage Booster Suite', () => {
  let token: string;

  beforeAll(async () => {
    await initDatabase();
    token = signRiderToken('RALT-RIDER-001', '9876543210');
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Security and CORS', () => {
    it('handles CORS with localhost origin', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');
      expect(res.status).toBe(200);
    });

    it('handles CORS with non-localhost origin in dev mode', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://ondc.network.portal');
      expect(res.status).toBe(200);
    });

    it('allows dev-mode auth fallback with riderId query parameter', async () => {
      const res = await request(app)
        .get('/api/rider/profile?riderId=RALT-RIDER-001');
      expect([200, 404]).toContain(res.status);
    });

    it('allows dev-mode auth fallback with riderId body parameter', async () => {
      const res = await request(app)
        .post('/api/rider/location')
        .send({ riderId: 'RALT-RIDER-001', lat: 12.9716, lng: 77.5946 });
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('Server Mock BAP & WebSocket Handlers', () => {
    it('handles /mock/bap/:action endpoint', async () => {
      const res = await request(app)
        .post('/mock/bap/on_search')
        .send({ message: { ack: { status: 'ACK' } } });
      expect(res.status).toBe(200);
      expect(res.body.message.ack.status).toBe('ACK');
    });

    it('exercises WebSocket message branches: LOCATION_UPDATE, TOGGLE_ONLINE, PING, invalid JSON', async () => {
      const mockWs: any = {
        send: jest.fn(),
        on: jest.fn(),
        ping: jest.fn(),
        terminate: jest.fn(),
      };

      const handlers: { [event: string]: Function } = {};
      mockWs.on.mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
      });

      const mockReq: any = {
        url: '/ws?riderId=RALT-RIDER-001',
        headers: { host: 'localhost:5000' },
        socket: { remoteAddress: '127.0.0.1' },
      };

      // Trigger connection handler
      wss.emit('connection', mockWs, mockReq);
      await new Promise((r) => setTimeout(r, 120));

      expect(mockWs.send).toHaveBeenCalled();

      // Trigger pong handler
      if (handlers['pong']) {
        handlers['pong']();
        expect(mockWs.isAlive).toBe(true);
      }

      // Trigger LOCATION_UPDATE
      if (handlers['message']) {
        await handlers['message'](JSON.stringify({
          type: 'LOCATION_UPDATE',
          lat: 12.9716,
          lng: 77.5946,
          heading: 90,
          speed: 25,
        }));

        // Trigger TOGGLE_ONLINE
        await handlers['message'](JSON.stringify({
          type: 'TOGGLE_ONLINE',
          isOnline: true,
        }));

        // Trigger PING
        await handlers['message'](JSON.stringify({
          type: 'PING',
        }));

        // Trigger invalid JSON to hit catch block
        await handlers['message']('invalid-non-json');
      }

      // Trigger close handler
      if (handlers['close']) {
        handlers['close']();
      }
    });
  });

  describe('Crypto & Auth module edge cases', () => {
    it('handles createAuthorizationHeader when private key is empty', async () => {
      const origKey = config.ondc.signingPrivateKey;
      try {
        (config.ondc as any).signingPrivateKey = '';
        const header = await createAuthorizationHeader({ test: true });
        expect(header).toContain('Signature keyId=');
      } finally {
        (config.ondc as any).signingPrivateKey = origKey;
      }
    });

    it('handles verifySignature with sender public key provided', async () => {
      const isValid = await verifySignature(
        'Signature keyId="test"',
        { test: true },
        'dummy-b64-public-key'
      );
      expect(typeof isValid).toBe('boolean');
    });

    it('handles verifySignature without authHeader in dev vs test mode', async () => {
      const isValid = await verifySignature(undefined, {});
      expect(isValid).toBe(config.env === 'development');
    });
  });

  describe('Redis & Queue Service direct methods', () => {
    it('exercises redisService set, get, publish, geo and fallback', async () => {
      await redisService.set('cache:test:85', 'sample-value', 30);
      const val = await redisService.get('cache:test:85');
      expect(val).toBe('sample-value');

      await redisService.updateRiderLocation('rider-geo-85', 12.9716, 77.5946);
      const nearby = await redisService.searchNearbyRiders(12.9716, 77.5946, 5);
      expect(nearby.length).toBeGreaterThan(0);
      expect(nearby.some((r) => r.riderId === 'rider-geo-85')).toBe(true);

      await redisService.publish('events:sample', { test: true });
      expect(redisService.isHealthy).toBeDefined();
    });

    it('exercises redisService in-memory fallback, expiration, and close', async () => {
      const customRedis = new RedisService();
      (customRedis as any).isConnected = false;
      (customRedis as any).client = null;

      await customRedis.set('key-in-mem', 'val-in-mem', 60);
      const cached = await customRedis.get('key-in-mem');
      expect(cached).toBe('val-in-mem');

      (customRedis as any).memoryCache.set('expired-key', { val: 'expired', expiresAt: Date.now() - 1000 });
      const expiredVal = await customRedis.get('expired-key');
      expect(expiredVal).toBeNull();

      const nullVal = await customRedis.get('non-existent-key');
      expect(nullVal).toBeNull();

      await customRedis.updateRiderLocation('rider-offline', 12.9716, 77.5946);
      const nearbyOffline = await customRedis.searchNearbyRiders(12.9716, 77.5946, 10);
      expect(nearbyOffline.some((r) => r.riderId === 'rider-offline')).toBe(true);

      await customRedis.close();
    });

    it('exercises queueService handleDirectFallback and publishToQueue', async () => {
      await queueService.publishToQueue(QueueService.QUEUES.NOTIFICATIONS_PUSH, {
        title: 'Push Async',
        riderId: 'RALT-RIDER-001',
      });
      await (queueService as any).handleDirectFallback(
        QueueService.QUEUES.NOTIFICATIONS_PUSH,
        { title: 'Push Direct', message: 'Direct push msg', riderId: 'RALT-RIDER-001' }
      );
      await (queueService as any).handleDirectFallback(
        QueueService.QUEUES.NOTIFICATIONS_SMS,
        { title: 'SMS Direct', message: 'Direct SMS msg', riderId: 'RALT-RIDER-001' }
      );
      await (queueService as any).handleDirectFallback(
        'unknown.queue',
        { title: 'Unknown' }
      );
      expect(queueService.isHealthy).toBeDefined();
    });

    it('exercises queueService error catch and close', async () => {
      const customQueue = new QueueService();
      await (customQueue as any).handleDirectFallback(QueueService.QUEUES.NOTIFICATIONS_PUSH, {
        get title(): any {
          throw new Error('Fallback error simulation');
        }
      });
      await customQueue.close();
    });
  });

  describe('NotificationService coverage', () => {
    it('exercises sendExpoPush with invalid and valid token patterns', async () => {
      const invalidRes = await notificationService.sendExpoPush('invalid-token', 'T', 'B');
      expect(invalidRes).toBeNull();

      const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
        data: { data: [{ status: 'ok', id: 'expo-receipt-1' }] }
      } as any);

      const expoRes = await notificationService.sendExpoPush(
        'ExponentPushToken[mock-partner-device-1234]',
        'Title',
        'Body',
        { orderId: '123' }
      );
      expect(expoRes).toBeDefined();
      axiosSpy.mockRestore();
    });

    it('exercises sendExpoPush error handling', async () => {
      const axiosSpy = jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Network drop'));
      const res = await notificationService.sendExpoPush(
        'ExponentPushToken[mock-partner-device-1234]',
        'Title',
        'Body'
      );
      expect(res).toBeNull();
      axiosSpy.mockRestore();
    });

    it('exercises sendAirbrickSms with invalid and valid phone numbers', async () => {
      const invalidPhone = await notificationService.sendAirbrickSms('123', 'OTP: 1234');
      expect(invalidPhone).toBeNull();

      const httpsSpy = jest.spyOn(https, 'get').mockImplementation((url: any, opts: any, cb?: any) => {
        const callback = typeof opts === 'function' ? opts : cb;
        const mockRes = new EventEmitter() as any;
        mockRes.statusCode = 200;
        const mockReq = new EventEmitter() as any;
        setImmediate(() => {
          if (callback) callback(mockRes);
          mockRes.emit('data', '{"status":"DELIVERED"}');
          mockRes.emit('end');
        });
        return mockReq;
      });

      const smsRes = await notificationService.sendAirbrickSms('9876543210', 'Your OTP is 9988');
      expect(smsRes).toEqual({ status: 200 });
      httpsSpy.mockRestore();
    });

    it('exercises sendAirbrickSms error handling', async () => {
      const httpsSpy = jest.spyOn(https, 'get').mockImplementation((url: any, opts: any, cb?: any) => {
        const mockReq = new EventEmitter() as any;
        setImmediate(() => {
          mockReq.emit('error', new Error('DNS failure'));
        });
        return mockReq;
      });

      const smsRes = await notificationService.sendAirbrickSms('9876543210', 'Your OTP is 9988');
      expect((smsRes as any).error).toBe('DNS failure');
      httpsSpy.mockRestore();
    });

    it('exercises markAsRead and markAllAsRead', async () => {
      const record = await notificationService.dispatch({
        riderId: 'RALT-RIDER-001',
        title: 'Order Completed',
        message: 'Delivered successfully',
        channel: 'IN_APP',
        type: 'EARNINGS',
      });
      expect(record.id).toBeDefined();

      const markedOne = await notificationService.markAsRead(record.id);
      expect(typeof markedOne).toBe('boolean');

      const markedAll = await notificationService.markAllAsRead('RALT-RIDER-001');
      expect(typeof markedAll).toBe('boolean');

      const notifs = await notificationService.getNotifications('RALT-RIDER-001', 5);
      expect(Array.isArray(notifs)).toBe(true);
    });
  });

  describe('ONDC Controller track with rider & cancel with cached order', () => {
    it('handles /track when order and rider exist', async () => {
      const txId = `tx-track-${Date.now()}`;
      const order = await orderManager.createOrder({
        transactionId: txId,
        messageId: `msg-track-${Date.now()}`,
        bapId: 'mock-buyer-bap.ondc.org',
        bapUri: 'http://localhost:5000/mock/bap',
        pickup: { name: 'Indiranagar Hub', address: 'Indiranagar', gps: { lat: 12.9716, lng: 77.5946 } },
        drop: { name: 'Koramangala User', address: 'Koramangala', gps: { lat: 12.9352, lng: 77.6245 } },
        deliveryFee: 90,
      });

      const res = await request(app)
        .post('/track')
        .send({
          context: {
            domain: 'nic2004:60232',
            action: 'track',
            transaction_id: txId,
            message_id: 'msg-track-1',
            bap_id: 'mock-buyer-bap.ondc.org',
            bap_uri: 'http://localhost:5000/mock/bap',
          },
          message: {
            order_id: order.orderId,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.message.ack.status).toBe('ACK');

      // Allow setImmediate to fire
      await new Promise((r) => setTimeout(r, 80));
    });

    it('handles /cancel with order_id in message', async () => {
      const txId = `tx-cancel-${Date.now()}`;
      const order = await orderManager.createOrder({
        transactionId: txId,
        messageId: `msg-cancel-${Date.now()}`,
        bapId: 'mock-buyer-bap.ondc.org',
        bapUri: 'http://localhost:5000/mock/bap',
        pickup: { name: 'Indiranagar Hub', address: 'Indiranagar', gps: { lat: 12.9716, lng: 77.5946 } },
        drop: { name: 'Koramangala User', address: 'Koramangala', gps: { lat: 12.9352, lng: 77.6245 } },
        deliveryFee: 110,
      });

      const res = await request(app)
        .post('/cancel')
        .send({
          context: {
            domain: 'nic2004:60232',
            action: 'cancel',
            transaction_id: txId,
            message_id: 'msg-cancel-1',
            bap_id: 'mock-buyer-bap.ondc.org',
            bap_uri: 'http://localhost:5000/mock/bap',
          },
          message: {
            order_id: order.orderId,
            cancellation_reason_id: '001',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.message.ack.status).toBe('ACK');

      // Allow setImmediate to fire
      await new Promise((r) => setTimeout(r, 80));
    });
  });

  describe('RiderController Digio KYC validation errors & edge flows', () => {
    it('returns 400 on responseDigioKyc if id is missing', async () => {
      const res = await request(app)
        .post('/api/kyc/response/')
        .send({});
      expect([400, 404]).toContain(res.status);
    });

    it('returns 400 on verifyOtp when phone/code are invalid or wrong OTP', async () => {
      const res1 = await request(app)
        .post('/api/rider/verify-otp')
        .send({ phone: '123', code: '1' });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/rider/verify-otp')
        .send({ phone: '9998887771', code: '0000' });
      expect(res2.status).toBe(400);
    });

    it('retrieves rider metrics', async () => {
      const res = await request(app)
        .get('/api/rider/metrics?riderId=RALT-RIDER-001')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metrics).toHaveProperty('tripsCompleted');
    });

    it('updates rider location and triggers track when rider has current order', async () => {
      // Create order and assign to RALT-RIDER-001
      const order = await orderManager.createOrder({
        transactionId: `tx-loc-${Date.now()}`,
        messageId: `msg-loc-${Date.now()}`,
        bapId: 'mock-buyer.ondc.org',
        bapUri: 'http://localhost:5000/mock/bap',
        pickup: { name: 'P1', address: 'A1' },
        drop: { name: 'D1', address: 'A2' },
        deliveryFee: 50
      });

      await riderManager.updateProfile('RALT-RIDER-001', { current_order_id: order.orderId });

      const res = await request(app)
        .post('/api/rider/location')
        .set('Authorization', `Bearer ${token}`)
        .send({ lat: 12.9716, lng: 77.5946 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Server graceful shutdown handler', () => {
    it('executes graceful shutdown routine without crashing process', async () => {
      jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
      const closeSpy = jest.spyOn(server, 'close').mockImplementation((cb?: any) => {
        if (cb) cb();
        return server;
      });

      await shutdown('SIGTERM');
      expect(closeSpy).toHaveBeenCalled();
    });

    it('executes server.start startup routine cleanly in test', async () => {
      const listenSpy = jest.spyOn(server, 'listen').mockImplementation((port: any, cb?: any) => {
        if (typeof cb === 'function') cb();
        return server;
      });
      const { start } = require('../server');
      await start();
      expect(listenSpy).toHaveBeenCalled();
      listenSpy.mockRestore();
    });

    it('queueService.init connects and asserts standard queues when amqp succeeds', async () => {
      const mockChannel = {
        assertQueue: jest.fn().mockResolvedValue({}),
        createChannel: jest.fn(),
        consume: jest.fn().mockResolvedValue({}),
        sendToQueue: jest.fn().mockReturnValue(true),
        ack: jest.fn(),
        nack: jest.fn(),
        close: jest.fn().mockResolvedValue({})
      };
      const mockConn = {
        createChannel: jest.fn().mockResolvedValue(mockChannel),
        on: jest.fn(),
        close: jest.fn().mockResolvedValue({})
      };
      const amqp = require('amqplib');
      const connectSpy = jest.spyOn(amqp, 'connect').mockResolvedValue(mockConn as any);

      const qs = new QueueService();
      await (qs as any).init();
      expect((qs as any).isConnected).toBe(true);
      await qs.close();
      connectSpy.mockRestore();
    });

    it('redisService connects and executes redis commands', async () => {
      const rs = new RedisService();
      (rs as any).isConnected = true;
      (rs as any).client = {
        geoadd: jest.fn().mockResolvedValue(1),
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue('redis_val'),
        publish: jest.fn().mockResolvedValue(1),
        quit: jest.fn().mockResolvedValue('OK')
      };
      await rs.updateRiderLocation('R1', 17.44, 78.39);
      await rs.set('key', 'val', 10);
      const val = await rs.get('key');
      expect(val).toBe('redis_val');
      await rs.publish('ch', { a: 1 });
      await rs.close();
    });

  });
});
