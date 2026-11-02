import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Security & Authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'ralt_ondc_jwt_production_secret_key_2026',
    expiry: process.env.JWT_EXPIRY || '30d',
  },
  security: {
    corsOrigins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '240', 10), // 240 req/min
    otpRateLimitMax: parseInt(process.env.OTP_RATE_LIMIT_MAX || '10', 10), // 10 req/min
  },

  // PostgreSQL 16 + PostGIS
  db: {
    type: process.env.DB_TYPE || (process.env.POSTGRES_HOST ? 'postgres' : 'postgres'),
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'ralt_ondc_db',
    maxConnections: parseInt(process.env.POSTGRES_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10),
  },

  // Redis Cache & Spatial Indexes
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    activeRidersGeoKey: 'active_riders:geo:ondc',
  },

  // RabbitMQ Message Broker
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    enabled: process.env.RABBITMQ_ENABLED !== 'false',
    exchange: 'ondc.logistics.exchange',
  },

  // ONDC Network Identity (P2P - ONDC:LOG10)
  ondc: {
    environment: process.env.ONDC_ENVIRONMENT || 'preprod',
    subscriberId: process.env.ONDC_SUBSCRIBER_ID || 'ralt.in',
    subscriberUrl: process.env.ONDC_SUBSCRIBER_URL || 'https://ralt.in/ondc',
    domain: process.env.ONDC_DOMAIN || 'ONDC:LOG10',
    role: process.env.ONDC_ROLE || 'BPP',
    ukid: process.env.ONDC_UKID || '2cb2bdeb-457b-47a9-bef9-c4d8954cbe49',
    signingPublicKey: process.env.ONDC_SIGNING_PUBLIC_KEY || '',
    signingPrivateKey: process.env.ONDC_SIGNING_PRIVATE_KEY || '',
    encryptionPublicKey: process.env.ONDC_ENCRYPTION_PUBLIC_KEY || '',
    encryptionPrivateKey: process.env.ONDC_ENCRYPTION_PRIVATE_KEY || '',
  },

  // Commercial / Logistics Configuration
  commercial: {
    defaultDeliveryFee: parseFloat(process.env.DEFAULT_DELIVERY_FEE || '50'),
    currency: process.env.CURRENCY || 'INR',
    maxServiceRadiusKm: parseFloat(process.env.MAX_SERVICE_RADIUS_KM || '10.0'),
    estimatedDeliveryTimeMins: parseInt(process.env.ESTIMATED_DELIVERY_TIME_MINS || '25', 10),
  },

  // Notifications (Delivery Partner App)
  notifications: {
    expoPushUrl: 'https://exp.host/--/api/v2/push/send',
    airbrickApiBase: process.env.AIRBRICK_API_BASE || 'https://abapi.airbrick.com',
  },

  // Observability & Logging
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  }
};
