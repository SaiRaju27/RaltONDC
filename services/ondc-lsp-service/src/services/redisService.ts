import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';

class RedisService {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.client = new Redis(config.redis.url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 5) return null; // Don't crash or spin indefinitely
          return Math.min(times * 1000, 3000);
        }
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info({ url: config.redis.url }, 'Redis connected successfully');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        logger.warn({ err: err.message }, 'Redis connection warning (operating in standalone fallback)');
      });

      this.client.connect().catch((err) => {
        logger.warn({ err: err.message }, 'Redis initial connection deferred');
      });
    } catch (e: any) {
      logger.warn({ err: e.message }, 'Redis initialization deferred');
    }
  }

  public get isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Update Rider GPS in Redis Geospatial Index
   */
  public async updateRiderLocation(riderId: string, lat: number, lng: number): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await (this.client as any).geoadd(config.redis.activeRidersGeoKey, lng, lat, riderId);
      // Also cache metadata
      await this.client.set(`rider:${riderId}:last_seen`, Date.now().toString(), 'EX', 3600);
    } catch (err: any) {
      logger.warn({ err: err.message, riderId }, 'Redis geoadd failed');
    }
  }

  /**
   * Search nearby riders using Redis GEORADIUS / GEOSEARCH
   */
  public async searchNearbyRiders(lat: number, lng: number, radiusKm: number = 10): Promise<Array<{ riderId: string; distanceKm: number }>> {
    if (!this.isConnected || !this.client) return [];
    try {
      const results: any = await (this.client as any).geosearch(
        config.redis.activeRidersGeoKey,
        'FROMLONLAT',
        lng,
        lat,
        'BYRADIUS',
        radiusKm,
        'km',
        'WITHDIST',
        'ASC'
      );

      if (!Array.isArray(results)) return [];
      return results.map(([riderId, distStr]) => ({
        riderId,
        distanceKm: parseFloat(distStr)
      }));
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Redis geosearch failed');
      return [];
    }
  }

  /**
   * Publish real-time events to Redis Pub/Sub channel
   */
  public async publish(channel: string, payload: any): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      await this.client.publish(channel, message);
    } catch (err: any) {
      logger.warn({ err: err.message, channel }, 'Redis publish failed');
    }
  }

  /**
   * Set cache with TTL
   */
  public async set(key: string, val: string, ttlSeconds: number = 300): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.set(key, val, 'EX', ttlSeconds);
    } catch {}
  }

  /**
   * Get cache value
   */
  public async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  public async close(): Promise<void> {
    if (this.client) await this.client.quit().catch(() => {});
    if (this.subscriber) await this.subscriber.quit().catch(() => {});
  }
}

export const redisService = new RedisService();

