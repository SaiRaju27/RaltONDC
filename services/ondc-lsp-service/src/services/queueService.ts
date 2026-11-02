import amqp from 'amqplib';
import { config } from '../config';
import { logger } from '../logger';
import { notificationService } from './notificationService';

export class QueueService {
  private connection: any = null;
  private channel: any = null;
  private isConnected: boolean = false;
  private retryTimeout: NodeJS.Timeout | null = null;

  public static QUEUES = {
    NOTIFICATIONS_PUSH: 'ondc.notifications.push',
    NOTIFICATIONS_SMS: 'ondc.notifications.sms',
    ORDER_DISPATCH: 'ondc.orders.dispatch',
    BAP_CALLBACKS: 'ondc.callbacks.outbound',
  };

  constructor() {
    if (config.rabbitmq.enabled) {
      this.init();
    }
  }

  private async init() {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;

      logger.info({ url: config.rabbitmq.url }, 'RabbitMQ connected successfully');

      // Assert standard queues
      for (const queue of Object.values(QueueService.QUEUES)) {
        await this.channel.assertQueue(queue, { durable: true });
      }

      // Register background consumers
      this.registerConsumers();

      this.connection.on('error', (err: any) => {
        this.isConnected = false;
        logger.warn({ err: err?.message || err }, 'RabbitMQ connection error (using in-process fallback)');
      });

      this.connection.on('close', () => {
        this.isConnected = false;
        if (config.env !== 'test') {
          logger.warn('RabbitMQ connection closed. Retrying in 5s...');
          this.retryTimeout = setTimeout(() => this.init(), 5000);
        }
      });
    } catch (err: any) {
      this.isConnected = false;
      logger.warn({ err: err.message }, 'RabbitMQ deferred; operating in resilient standalone fallback');
      if (config.env !== 'test') {
        this.retryTimeout = setTimeout(() => this.init(), 10000);
      }
    }
  }

  public get isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Publish a message to RabbitMQ queue with persistent delivery and in-memory fallback
   */
  public async publishToQueue(queue: string, message: any): Promise<boolean> {
    const payload = Buffer.from(JSON.stringify(message));

    if (this.isConnected && this.channel) {
      try {
        return this.channel.sendToQueue(queue, payload, { persistent: true });
      } catch (err: any) {
        logger.warn({ err: err.message, queue }, 'Failed to publish to RabbitMQ, executing directly');
      }
    }

    // Standalone fallback: execute directly in background
    setImmediate(() => this.handleDirectFallback(queue, message));
    return true;
  }

  /**
   * Background Queue Consumers
   */
  private async registerConsumers() {
    if (!this.channel) return;

    // 1. Push notification consumer
    await this.channel.consume(QueueService.QUEUES.NOTIFICATIONS_PUSH, async (msg: any) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await notificationService.dispatch({ ...payload, channel: 'PUSH' });
        this.channel?.ack(msg);
      } catch (err: any) {
        logger.error({ err: err.message }, 'Error consuming push notification queue');
        this.channel?.nack(msg, false, false);
      }
    });

    // 2. SMS notification consumer
    await this.channel.consume(QueueService.QUEUES.NOTIFICATIONS_SMS, async (msg: any) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await notificationService.dispatch({ ...payload, channel: 'SMS' });
        this.channel?.ack(msg);
      } catch (err: any) {
        logger.error({ err: err.message }, 'Error consuming SMS notification queue');
        this.channel?.nack(msg, false, false);
      }
    });

    logger.info('RabbitMQ background consumers registered for push & SMS queues');
  }

  /**
   * In-process fallback when RabbitMQ broker is offline
   */
  public async handleDirectFallback(queue: string, message: any) {
    try {
      if (queue === QueueService.QUEUES.NOTIFICATIONS_PUSH) {
        await notificationService.dispatch({ ...message, channel: 'PUSH' });
      } else if (queue === QueueService.QUEUES.NOTIFICATIONS_SMS) {
        await notificationService.dispatch({ ...message, channel: 'SMS' });
      }
    } catch (err: any) {
      logger.warn({ err: err.message, queue }, 'Error in queue direct fallback handler');
    }
  }

  public async close(): Promise<void> {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.channel) {
      await this.channel.close().catch(() => {});
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close().catch(() => {});
      this.connection = null;
    }
    this.isConnected = false;
  }
}

export const queueService = new QueueService();
