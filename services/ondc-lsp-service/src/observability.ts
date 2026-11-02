import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Initialize Prometheus registry
export const register = new client.Registry();

// Enable standard default metrics (CPU, Memory, Event Loop, GC)
client.collectDefaultMetrics({
  register,
  prefix: 'ralt_ondc_',
  labels: { app: 'ralt-ondc-lsp' }
});

// Custom Metrics
export const httpRequestsTotal = new client.Counter({
  name: 'ralt_ondc_http_requests_total',
  help: 'Total number of HTTP requests handled',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'ralt_ondc_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register]
});

export const ondcRequestsTotal = new client.Counter({
  name: 'ralt_ondc_requests_total',
  help: 'Total ONDC Protocol webhook requests received',
  labelNames: ['action', 'status'],
  registers: [register]
});

export const ondcRequestDurationSeconds = new client.Histogram({
  name: 'ralt_ondc_request_duration_seconds',
  help: 'Latency of processing ONDC actions in seconds',
  labelNames: ['action'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

export const ordersTotal = new client.Counter({
  name: 'ralt_ondc_orders_total',
  help: 'Total number of ONDC orders created or transitioned',
  labelNames: ['status'],
  registers: [register]
});

export const activeOnlineRidersGauge = new client.Gauge({
  name: 'ralt_ondc_active_online_riders',
  help: 'Current count of online delivery partners',
  registers: [register]
});

export const activeWebSocketConnections = new client.Gauge({
  name: 'ralt_ondc_websocket_connections',
  help: 'Current number of active Rider WebSocket connections',
  registers: [register]
});

export const notificationsDispatchedTotal = new client.Counter({
  name: 'ralt_ondc_notifications_dispatched_total',
  help: 'Total notifications sent across channels',
  labelNames: ['channel', 'status'],
  registers: [register]
});

/**
 * Observability middleware to record HTTP metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    const statusCode = res.statusCode.toString();

    httpRequestsTotal.inc({ method: req.method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method: req.method, route, status_code: statusCode }, durationSeconds);
  });

  next();
}

/**
 * Controller to expose /metrics
 */
export async function getMetrics(req: Request, res: Response) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err: any) {
    res.status(500).end(err.message);
  }
}

