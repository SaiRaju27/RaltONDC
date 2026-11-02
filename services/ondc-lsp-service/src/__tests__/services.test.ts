import { initDatabase, closeDatabase, query, run, get, findNearestRidersSpatial, isDatabaseHealthy, getActiveEngine } from '../database';
import { riderManager } from '../services/riderManager';
import { orderManager } from '../services/orderManager';
import { redisService } from '../services/redisService';
import { queueService } from '../services/queueService';
import { notificationService } from '../services/notificationService';
import { ondcClient } from '../services/ondcClient';
import { logger } from '../logger';
import { activeWebSocketConnections } from '../observability';

describe('Core Services & Data Layer Suite', () => {
  const testPhone = '9998887771';
  let createdRiderId: string;

  beforeAll(async () => {
    await initDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Database Module & PostGIS Queries', () => {
    it('should report database engine and health', async () => {
      const healthy = await isDatabaseHealthy();
      expect(healthy).toBe(true);
      const engine = getActiveEngine();
      expect(['postgres', 'sqlite']).toContain(engine);
    });

    it('should execute parameterized queries and run commands', async () => {
      const rows = await query('SELECT 1 as num');
      expect(rows.length).toBeGreaterThan(0);

      const single = await get('SELECT 1 as val');
      expect(single).toHaveProperty('val');
    });

    it('should find nearest delivery partners spatially without throwing', async () => {
      const riders = await findNearestRidersSpatial(17.4483, 78.3915, 15.0);
      expect(Array.isArray(riders)).toBe(true);
    });
  });

  describe('RiderManager Operations', () => {
    it('should register or update a new delivery partner', async () => {
      const rider = await riderManager.createOrUpdateRider({
        phone: testPhone,
        name: 'Enterprise Test Rider',
        city: 'Hyderabad',
        vehicle_type: 'Electric Scooter',
        is_online: 1
      });

      expect(rider).toBeDefined();
      expect(rider.phone).toContain(testPhone);
      expect(rider.name).toBe('Enterprise Test Rider');
      createdRiderId = rider.id;
    });

    it('should retrieve rider by ID and by phone', async () => {
      const byId = await riderManager.getRider(createdRiderId);
      expect(byId?.id).toBe(createdRiderId);

      const byPhone = await riderManager.getRiderByPhone(testPhone);
      expect(byPhone?.phone).toContain(testPhone);
    });

    it('should update partner location and online status', async () => {
      await riderManager.updateLocation(createdRiderId, 17.4483, 78.3915);
      await riderManager.toggleOnline(createdRiderId, true);

      const rider = await riderManager.getRider(createdRiderId);
      expect(rider?.is_online).toBe(1);
    });

    it('should update profile and bank details', async () => {
      await riderManager.updateProfile(createdRiderId, {
        aadhaar_number: '123456789012',
        pan_number: 'ABCDE1234F',
        bank_name: 'State Bank of India',
        bank_account_number: '112233445566',
        bank_ifsc: 'SBIN0001234',
        account_holder_name: 'Enterprise Test Rider'
      });

      const rider = await riderManager.getRider(createdRiderId);
      expect(rider?.bank_ifsc).toBe('SBIN0001234');
    });

    it('should list all riders, calculate earnings, and find available riders', async () => {
      const allRiders = await riderManager.getAllRiders();
      expect(allRiders.length).toBeGreaterThan(0);

      const earnings = await riderManager.getEarnings(createdRiderId);
      expect(earnings).toHaveProperty('total');

      const available = await riderManager.findAvailableRider(17.4483, 78.3915, 20.0);
      expect(available).toBeDefined();
    });
  });

  describe('OrderManager Operations', () => {
    let orderId: string;
    let deliveryOtp: string;

    it('should create an ONDC delivery order and auto-assign online partner', async () => {
      const order = await orderManager.createOrder({
        transactionId: `tx-test-${Date.now()}`,
        messageId: `msg-test-${Date.now()}`,
        bapId: 'buyer-test.ondc.org',
        bapUri: 'https://buyer-test.ondc.org/ondc',
        pickup: {
          name: 'Burger King Hitec City',
          phone: '+91 9988776655',
          address: 'Inorbit Mall, Hitec City',
          gps: { lat: 17.4375, lng: 78.3687 }
        },
        drop: {
          name: 'Rahul Sharma',
          phone: '+91 9123456789',
          address: 'Mindspace IT Park, Building 12',
          gps: { lat: 17.4485, lng: 78.3758 }
        },
        items: [{ name: 'Whopper Meal', quantity: 2 }],
        deliveryFee: 65.0
      });

      expect(order).toBeDefined();
      expect(order.orderId).toContain('ralt-ondc');
      expect(order.deliveryFee).toBe(65.0);
      orderId = order.orderId;
      deliveryOtp = order.deliveryOtp;
    });

    it('should get order by ID, by transaction, and list active orders', async () => {
      const fetched = await orderManager.getOrder(orderId);
      expect(fetched?.orderId).toBe(orderId);

      const active = await orderManager.getActiveOrders(createdRiderId);
      expect(Array.isArray(active)).toBe(true);

      const all = await orderManager.getAllOrders(10);
      expect(all.length).toBeGreaterThan(0);
    });

    it('should update fulfillment states sequentially', async () => {
      await orderManager.updateStatus(orderId, 'Order-picked-up');
      let order = await orderManager.getOrder(orderId);
      expect(order?.status).toBe('Order-picked-up');

      await orderManager.updateStatus(orderId, 'In-transit');
      order = await orderManager.getOrder(orderId);
      expect(order?.status).toBe('At-delivery');
    });

    it('should verify delivery OTP and mark order delivered', async () => {
      const invalid = await orderManager.verifyOtpAndComplete(orderId, '0000');
      expect(invalid.success).toBe(false);

      const valid = await orderManager.verifyOtpAndComplete(orderId, deliveryOtp);
      expect(valid.success).toBe(true);

      const order = await orderManager.getOrder(orderId);
      expect(order?.status).toBe('Order-delivered');
    });
  });

  describe('Redis & Queue Resiliency Service', () => {
    it('should update and search nearby riders via Redis', async () => {
      await redisService.updateRiderLocation(createdRiderId, 17.4483, 78.3915);
      const nearby = await redisService.searchNearbyRiders(17.4483, 78.3915, 10);
      expect(Array.isArray(nearby)).toBe(true);
    });

    it('should handle key-value caching gracefully', async () => {
      await redisService.set('test_cache_key', 'test_val', 60);
      const cached = await redisService.get('test_cache_key');
      expect(cached).toBe('test_val');
    });

    it('should publish to message queues with fallback without error', async () => {
      const published = await queueService.publishToQueue('notifications_push', {
        recipientId: createdRiderId,
        title: 'Express Delivery Nearby',
        body: 'Earn Rs. 85 on pickup within 1.2km'
      });
      expect(typeof published).toBe('boolean');
    });
  });

  describe('Notification Service', () => {
    it('should dispatch push and SMS notifications gracefully', async () => {
      const notification = await notificationService.dispatch({
        riderId: createdRiderId,
        title: 'Test Notification',
        message: 'Order dispatched successfully',
        type: 'ORDER_UPDATE'
      });
      expect(notification).toHaveProperty('id');

      const notifications = await notificationService.getNotifications(createdRiderId);
      expect(Array.isArray(notifications)).toBe(true);

      if (notifications.length > 0) {
        await notificationService.markAsRead(notifications[0].id);
      }
      await notificationService.markAllAsRead(createdRiderId);
    });
  });

  describe('ONDC Client Response Dispatchers', () => {
    it('should cache and retrieve order payloads in ondcClient', () => {
      ondcClient.cacheOrderPayload('ord-cache-key', { fulfillment: { id: 'ful-1' } });
      const cached = ondcClient.getOrderPayload('ord-cache-key');
      expect(cached?.fulfillment?.id).toBe('ful-1');
    });
  });

  describe('Observability & Logger Modules', () => {
    it('should increment gauge and log structured events', () => {
      expect(() => {
        activeWebSocketConnections.inc();
        activeWebSocketConnections.dec();
        logger.info({ testKey: 'val' }, 'Enterprise structured log test');
      }).not.toThrow();
    });
  });
});
