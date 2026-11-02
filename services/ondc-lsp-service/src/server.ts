import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';
import { initDatabase, isDatabaseHealthy, closeDatabase, getActiveEngine } from './database';
import { redisService } from './services/redisService';
import { queueService } from './services/queueService';
import { logger, httpLoggerMiddleware } from './logger';
import {
  helmetMiddleware,
  corsMiddleware,
  apiRateLimiter,
  otpRateLimiter,
  ondcRateLimiter,
  requireRiderAuth
} from './security';
import { metricsMiddleware, getMetrics, activeWebSocketConnections } from './observability';
import { ONDCController } from './controllers/ondcController';
import { RiderController } from './controllers/riderController';
import { riderManager } from './services/riderManager';
import { orderManager } from './services/orderManager';

const app = express();
const server = http.createServer(app);

// Initialize WebSocket server on /ws path
const wss = new WebSocketServer({ server, path: '/ws' });

// =============================================================================
// 1. ENTERPRISE SECURITY & LOGGING MIDDLEWARES
// =============================================================================
app.set('trust proxy', 1); // Trust reverse proxy (Caddy / Lightsail Load Balancer)
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(httpLoggerMiddleware);
app.use(metricsMiddleware);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Static asset delivery for Web Dashboard & Delivery Partner App
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// =============================================================================
// 2. OBSERVABILITY & HEALTH PROBES
// =============================================================================

// Prometheus metrics scraper endpoint
app.get('/metrics', getMetrics);

// Liveness probe (Kubernetes / Lightsail Load Balancer)
app.get('/health', (req: any, res: any) => {
  res.status(200).json({
    status: 'ok',
    version: '1.2.6-enterprise',
    service: 'RALT ONDC Logistics Provider (BPP)',
    subscriber_id: config.ondc.subscriberId,
    domain: config.ondc.domain,
    role: config.ondc.role,
    uptime_seconds: Math.floor(process.uptime()),
    database_engine: getActiveEngine(),
    time: new Date().toISOString()
  });
});

// Deep Readiness probe (checks PostgreSQL + PostGIS, Redis, RabbitMQ, ONDC credentials)
app.get('/ready', async (req: any, res: any) => {
  const dbHealthy = await isDatabaseHealthy();
  const redisHealthy = redisService.isHealthy;
  const rabbitHealthy = queueService.isHealthy;
  const ondcConfigured = Boolean(config.ondc.signingPrivateKey && config.ondc.subscriberId);

  const isReady = dbHealthy; // DB is critical, others have resilient fallbacks
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    status: isReady ? 'READY' : 'DEGRADED',
    checks: {
      database: dbHealthy ? 'HEALTHY' : 'DOWN',
      database_engine: getActiveEngine(),
      redis: redisHealthy ? 'CONNECTED' : 'STANDALONE_FALLBACK',
      rabbitmq: rabbitHealthy ? 'CONNECTED' : 'IN_PROCESS_FALLBACK',
      ondc_keys: ondcConfigured ? 'CONFIGURED' : 'DEV_MOCK'
    },
    timestamp: new Date().toISOString()
  });
});

// Root & Web Dashboard
app.get('/', (req: any, res: any) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err: any) => {
    if (err) res.status(200).send('RALT ONDC Logistics Provider (BPP) Active');
  });
});

app.get(['/rider', '/rider/*'], (req: any, res: any) => {
  res.sendFile(path.join(publicDir, 'rider', 'index.html'), (err: any) => {
    if (err) res.status(200).send('RALT Delivery Partner Portal');
  });
});

// =============================================================================
// 3. ONDC OPEN PROTOCOL WEBHOOKS (Protected by ondcRateLimiter)
// =============================================================================
app.post(['/ondc/search', '/search'], ondcRateLimiter, ONDCController.handleSearch);
app.post(['/ondc/init', '/init'], ondcRateLimiter, ONDCController.handleInit);
app.post(['/ondc/confirm', '/confirm'], ondcRateLimiter, ONDCController.handleConfirm);
app.post(['/ondc/update', '/update'], ondcRateLimiter, ONDCController.handleUpdate);
app.post(['/ondc/status', '/status'], ondcRateLimiter, ONDCController.handleStatus);
app.post(['/ondc/track', '/track'], ondcRateLimiter, ONDCController.handleTrack);
app.post(['/ondc/cancel', '/cancel'], ondcRateLimiter, ONDCController.handleCancel);

// =============================================================================
// 4. DELIVERY PARTNER MOBILE APP AUTH & ONBOARDING (Protected by otpRateLimiter)
// =============================================================================
app.all(['/api/auth/send-otp', '/api/rider/send-otp'], otpRateLimiter, RiderController.sendOtp);
app.all(['/api/auth/verify-otp', '/api/rider/verify-otp'], otpRateLimiter, RiderController.verifyOtp);
app.all(['/api/auth/login', '/api/rider/login'], apiRateLimiter, RiderController.login);

app.all('/api/rider/save-step', apiRateLimiter, RiderController.saveStep);
app.all('/api/rider/metrics', apiRateLimiter, RiderController.getMetrics);
app.all('/api/kyc/request/:id', apiRateLimiter, RiderController.requestDigioKyc);
app.all('/api/kyc/response/:id', apiRateLimiter, RiderController.responseDigioKyc);
app.get('/api/rider/profile', apiRateLimiter, RiderController.getProfile);
app.post('/api/rider/profile', apiRateLimiter, RiderController.updateProfile);
app.post('/api/rider/register', apiRateLimiter, RiderController.registerRider);
app.post('/api/rider/verify-bank', apiRateLimiter, RiderController.verifyBank);
app.post('/api/rider/status', apiRateLimiter, RiderController.toggleOnline);
app.post('/api/rider/location', apiRateLimiter, RiderController.updateLocation);
app.get('/api/rider/orders', apiRateLimiter, RiderController.getActiveOrders);
app.get('/api/rider/all-orders', apiRateLimiter, RiderController.getAllOrders);
app.get('/api/rider/earnings', apiRateLimiter, RiderController.getEarnings);
app.post('/api/rider/orders/:orderId/update-status', apiRateLimiter, RiderController.updateOrderStatus);
app.post('/api/rider/orders/:orderId/verify-otp', apiRateLimiter, RiderController.verifyDeliveryOtp);
app.all(['/api/rider/complete-current'], apiRateLimiter, RiderController.completeCurrentOrder);
app.post('/api/rider/simulate-order', apiRateLimiter, RiderController.simulateIncomingOrder);
app.all('/api/admin/reset-db', RiderController.resetDatabase);

// =============================================================================
// 5. ENTERPRISE NOTIFICATION SYSTEM REST APIS
// =============================================================================
app.get('/api/notifications', apiRateLimiter, RiderController.getNotifications);
app.post('/api/notifications/send', apiRateLimiter, RiderController.sendNotification);
app.put('/api/notifications/:id/read', apiRateLimiter, RiderController.markNotificationRead);
app.put('/api/notifications/read-all', apiRateLimiter, RiderController.markAllNotificationsRead);

// Mock BAP endpoint for local integration test loopbacks
app.post('/mock/bap/:action', (req: any, res: any) => {
  logger.info({ action: req.params.action }, '[Mock BAP] Received network callback');
  res.status(200).json({ message: { ack: { status: 'ACK' } } });
});

// =============================================================================
// 6. WEBSOCKET REAL-TIME FLEET DISPATCH & TRACKING
// =============================================================================
wss.on('connection', async (ws: any, req: any) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const riderId = url.searchParams.get('riderId') || 'RALT-RIDER-001';

  logger.info({ riderId, ip: req.socket.remoteAddress }, 'Delivery Partner connected via WebSocket');
  riderManager.registerSocket(riderId, ws);

  // Setup periodic heartbeat ping/pong to prevent reverse proxy timeouts (30s)
  (ws as any).isAlive = true;
  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });

  // Sync initial state
  const activeOrders = await orderManager.getActiveOrders(riderId);
  const rider = await riderManager.getRider(riderId);

  ws.send(JSON.stringify({
    type: 'CONNECTED',
    message: 'Connected to RALT ONDC Fleet Real-time Dispatch',
    database_engine: getActiveEngine(),
    rider,
    activeOrders
  }));

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'LOCATION_UPDATE') {
        await riderManager.updateLocation(riderId, data.lat, data.lng, data.heading, data.speed);
      } else if (data.type === 'TOGGLE_ONLINE') {
        await riderManager.toggleOnline(riderId, data.isOnline);
      } else if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (e: any) {
      logger.warn({ err: e.message }, 'Failed to parse WebSocket incoming frame');
    }
  });

  ws.on('close', () => {
    logger.info({ riderId }, 'Delivery Partner disconnected from WebSocket');
    riderManager.removeSocket(riderId, ws);
  });
});

// Heartbeat ping interval
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if ((ws as any).isAlive === false) return ws.terminate();
    (ws as any).isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(pingInterval);
});

// =============================================================================
// 7. GRACEFUL INITIALIZATION & SHUTDOWN LIFECYCLE
// =============================================================================
async function start() {
  logger.info('Initializing RALT ONDC Logistics Provider platform...');

  // Initialize PostGIS Database
  await initDatabase();

  server.listen(config.port, () => {
    logger.info({
      port: config.port,
      env: config.env,
      engine: getActiveEngine(),
      subscriberId: config.ondc.subscriberId,
      domain: config.ondc.domain
    }, '🚀 RALT ONDC Logistics Provider Server started successfully');
    
    console.log(`==================================================================`);
    console.log(`🚀 RALT ONDC Logistics Provider (BPP) running on port ${config.port}`);
    console.log(`📡 Subscriber ID:   ${config.ondc.subscriberId}`);
    console.log(`🌐 Subscriber URL:  ${config.ondc.subscriberUrl}`);
    console.log(`📦 Domain:          ${config.ondc.domain}`);
    console.log(`🗺️ Spatial DB:      ${getActiveEngine().toUpperCase()}`);
    console.log(`📊 Prometheus:      http://localhost:${config.port}/metrics`);
    console.log(`🩺 Health:          http://localhost:${config.port}/health`);
    console.log(`==================================================================`);
  });
}

// Graceful process exit
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Graceful shutdown initiated...');
  server.close(async () => {
    logger.info('HTTP server closed');
    wss.close();
    await redisService.close();
    await queueService.close();
    await closeDatabase();
    logger.info('All connections terminated. Process exiting safely.');
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, server, wss, start, shutdown };

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  start().catch(err => {
    logger.fatal({ err: err.message }, 'Fatal error during server startup');
    process.exit(1);
  });
}
