import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';
import { initDatabase } from './database';
import { ONDCController } from './controllers/ondcController';
import { RiderController } from './controllers/riderController';
import { riderManager } from './services/riderManager';
import { orderManager } from './services/orderManager';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Root & Health
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RALT ONDC Logistics Provider (BPP)',
    subscriber_id: config.ondc.subscriberId,
    domain: config.ondc.domain,
    role: config.ondc.role,
    time: new Date().toISOString()
  });
});

// ONDC Open Delivery Protocol Webhook Endpoints (Called by ONDC Network / Sellers)
app.post('/ondc/search', ONDCController.handleSearch);
app.post('/ondc/init', ONDCController.handleInit);
app.post('/ondc/confirm', ONDCController.handleConfirm);
app.post('/ondc/status', ONDCController.handleStatus);
app.post('/ondc/track', ONDCController.handleTrack);
app.post('/ondc/cancel', ONDCController.handleCancel);

// Mobile App / Rider APIs (Real database persistence)
app.get('/api/rider/profile', RiderController.getProfile);
app.post('/api/rider/status', RiderController.toggleOnline);
app.post('/api/rider/location', RiderController.updateLocation);
app.get('/api/rider/orders', RiderController.getActiveOrders);
app.get('/api/rider/all-orders', RiderController.getAllOrders);
app.get('/api/rider/earnings', RiderController.getEarnings);
app.post('/api/rider/orders/:orderId/update-status', RiderController.updateOrderStatus);
app.post('/api/rider/orders/:orderId/verify-otp', RiderController.verifyDeliveryOtp);
app.post('/api/rider/simulate-order', RiderController.simulateIncomingOrder);

// Mock BAP endpoint for local test loopbacks
app.post('/mock/bap/:action', (req, res) => {
  console.log(`[Mock BAP] Received callback /${req.params.action}`);
  res.status(200).json({ message: { ack: { status: 'ACK' } } });
});

// WebSocket for Rider Mobile App (Real-time live push)
wss.on('connection', async (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const riderId = url.searchParams.get('riderId') || 'rider-ralt-001';

  console.log(`[WebSocket] Rider connected: ${riderId}`);
  riderManager.registerSocket(riderId, ws);

  // Send initial connection state and sync active orders from DB
  const activeOrders = await orderManager.getActiveOrders(riderId);
  const rider = await riderManager.getRider(riderId);

  ws.send(JSON.stringify({
    type: 'CONNECTED',
    message: 'Connected to RALT ONDC Fleet Real-time Dispatch',
    rider,
    activeOrders
  }));

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'LOCATION_UPDATE') {
        await riderManager.updateLocation(riderId, data.lat, data.lng);
      } else if (data.type === 'TOGGLE_ONLINE') {
        await riderManager.toggleOnline(riderId, data.isOnline);
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Rider disconnected: ${riderId}`);
    riderManager.removeSocket(riderId);
  });
});

// Initialize SQLite Database and Start Server
async function start() {
  await initDatabase();
  console.log('[Database] SQLite initialized successfully.');

  server.listen(config.port, () => {
    console.log(`==================================================================`);
    console.log(`🚀 RALT ONDC Logistics Provider (BPP) running on port ${config.port}`);
    console.log(`📡 Subscriber ID:   ${config.ondc.subscriberId}`);
    console.log(`🌐 Subscriber URL:  ${config.ondc.subscriberUrl}`);
    console.log(`📦 Domain:          ${config.ondc.domain}`);
    console.log(`📊 Dashboard:       http://localhost:${config.port}`);
    console.log(`==================================================================`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
