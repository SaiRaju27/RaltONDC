import axios from 'axios';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { query, run } from '../database';
import { config } from '../config';
import { logger } from '../logger';
import { notificationsDispatchedTotal } from '../observability';

export interface NotificationPayload {
  riderId?: string;
  title: string;
  message: string;
  channel?: 'PUSH' | 'SMS' | 'IN_APP';
  type?: 'ORDER_UPDATE' | 'DISPATCH' | 'KYC' | 'EARNINGS' | 'ALERT';
  data?: Record<string, any>;
  pushToken?: string;
  phone?: string;
}

export interface NotificationRecord {
  id: string;
  rider_id: string;
  title: string;
  message: string;
  channel: string;
  type: string;
  data: any;
  is_read: number;
  created_at: string;
}

class NotificationService {
  /**
   * Dispatch a notification across selected channel and persist to PostGIS database
   */
  public async dispatch(notification: NotificationPayload): Promise<NotificationRecord> {
    const id = `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const channel = notification.channel || 'PUSH';
    const type = notification.type || 'ORDER_UPDATE';
    const riderId = notification.riderId || 'RALT-RIDER-001';
    const now = new Date().toISOString();
    const title = notification.title || 'Delivery Update';
    const message = notification.message || notification.title || 'Delivery Notification';
    const dataJson = JSON.stringify(notification.data || {});

    // 1. Channel-specific delivery
    try {
      if (channel === 'PUSH' && notification.pushToken) {
        await this.sendExpoPush(notification.pushToken, title, message, notification.data);
      } else if (channel === 'SMS' && notification.phone) {
        await this.sendAirbrickSms(notification.phone, `${title}: ${message}`);
      }
      notificationsDispatchedTotal.inc({ channel, status: 'success' });
    } catch (err: any) {
      notificationsDispatchedTotal.inc({ channel, status: 'error' });
      logger.warn({ err: err.message, channel }, 'Failed to deliver notification externally; recording to database');
    }

    // 2. Persist record in PostGIS DB
    try {
      await run(
        `INSERT INTO notifications (id, rider_id, title, message, channel, type, data, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [id, riderId, title, message, channel, type, dataJson, now]
      );
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to persist notification record');
    }

    logger.info({ id, riderId, channel, type, title }, 'Notification dispatched and stored');

    return {
      id,
      rider_id: riderId,
      title,
      message,
      channel,
      type,
      data: notification.data || {},
      is_read: 0,
      created_at: now
    };
  }

  /**
   * Send Expo Push Notification to Delivery Partner App
   */
  public async sendExpoPush(to: string, title: string, body: string, data: any = {}): Promise<any> {
    if (!to || !to.startsWith('ExponentPushToken[')) {
      return null;
    }

    const payload = {
      to,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'orders'
    };

    try {
      const response = await axios.post(config.notifications.expoPushUrl, payload, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      return response.data;
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Expo push notification request failed');
      return null;
    }
  }

  /**
   * Send SMS via Airbrick SMS Gateway (Matching RaltEnterprise standard)
   */
  public async sendAirbrickSms(mobile: string, message: string): Promise<any> {
    const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);
    if (cleanMobile.length !== 10) return null;

    return new Promise((resolve) => {
      const req = https.get(
        `${config.notifications.airbrickApiBase}/api/v1/otp/${cleanMobile}`,
        { timeout: 5000 },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({ status: res.statusCode });
          });
        }
      );
      req.on('error', (err) => {
        logger.warn({ err: err.message }, 'Airbrick SMS dispatch warning');
        resolve({ error: err.message });
      });
    });
  }

  /**
   * Query Notifications for Rider
   */
  public async getNotifications(riderId: string, limit: number = 50): Promise<NotificationRecord[]> {
    const rows = await query<any>(
      'SELECT * FROM notifications WHERE rider_id = ? OR rider_id IS NULL ORDER BY created_at DESC LIMIT ?',
      [riderId, limit]
    );
    return rows.map(r => ({
      ...r,
      data: typeof r.data === 'string' ? JSON.parse(r.data || '{}') : r.data
    }));
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(id: string): Promise<boolean> {
    const res = await run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    return res.changes > 0;
  }

  /**
   * Mark all notifications as read for rider
   */
  public async markAllAsRead(riderId: string): Promise<boolean> {
    const res = await run('UPDATE notifications SET is_read = 1 WHERE rider_id = ?', [riderId]);
    return res.changes > 0;
  }
}

export const notificationService = new NotificationService();

