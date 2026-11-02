import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export class RedisService {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private isConnected: boolean = false;
  private memoryCache: Map<string, { val: string; expiresAt: number }> = new Map();
  private memoryGeo: Map<string, { lat: number; lng: number; updatedAt: number }> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.client = new Redis(config.redis.url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times: number) => {
          if (config.env === 'test' || times > 3) return null;
          return Math.min(times * 1000, 3000);
        }
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info({ url: config.redis.url }, 'Redis connected successfully');
      });

      this.client.on('error', (err: any) => {
        this.isConnected = false;
        logger.warn({ err: err.message }, 'Redis connection warning (operating in standalone fallback)');
      });

      this.client.connect().catch((err: any) => {
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
   * Update Rider GPS in Redis Geospatial Index with in-memory fallback
   */
  public async updateRiderLocation(riderId: string, lat: number, lng: number): Promise<void> {
    this.memoryGeo.set(riderId, { lat, lng, updatedAt: Date.now() });

    if (!this.isConnected || !this.client) return;
    try {
      await (this.client as any).geoadd(config.redis.activeRidersGeoKey, lng, lat, riderId);
      await this.client.set(`rider:${riderId}:last_seen`, Date.now().toString(), 'EX', 3600);
    } catch (err: any) {
      logger.warn({ err: err.message, riderId }, 'Redis geoadd failed; in-memory geo updated');
    }
  }

  /**
   * Search nearby riders using Redis GEORADIUS / GEOSEARCH with in-memory fallback
   */
  public async searchNearbyRiders(
    lat: number,
    lng: number,
    radiusKm: number = 10
  ): Promise<Array<{ riderId: string; distanceKm: number }>> {
    if (this.isConnected && this.client) {
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

        if (Array.isArray(results) && results.length > 0) {
          return results.map(([riderId, distStr]) => ({
            riderId,
            distanceKm: parseFloat(distStr)
          }));
        }
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Redis geosearch failed; using in-memory geo fallback');
      }
    }

    // In-memory fallback calculation
    const nearby: Array<{ riderId: string; distanceKm: number }> = [];
    for (const [riderId, loc] of this.memoryGeo.entries()) {
      const distance = haversineDistanceKm(lat, lng, loc.lat, loc.lng);
      if (distance <= radiusKm) {
        nearby.push({ riderId, distanceKm: distance });
      }
    }
    return nearby.sort((a, b) => a.distanceKm - b.distanceKm);
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
   * Set cache with TTL (always updates memory fallback and Redis if connected)
   */
  public async set(key: string, val: string, ttlSeconds: number = 300): Promise<void> {
    this.memoryCache.set(key, {
      val,
      expiresAt: Date.now() + ttlSeconds * 1000
    });

    if (!this.isConnected || !this.client) return;
    try {
      await this.client.set(key, val, 'EX', ttlSeconds);
    } catch {}
  }

  /**
   * Get cache value from Redis or in-memory fallback
   */
  public async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        const res = await this.client.get(key);
        if (res !== null && res !== undefined) return res;
      } catch {}
    }

    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    return cached.val;
  }

  public async close(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.client = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => {});
      this.subscriber = null;
    }
    this.isConnected = false;
  }
}

export const redisService = new RedisService();
