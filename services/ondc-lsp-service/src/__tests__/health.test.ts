import request from 'supertest';
import { app } from '../server';

describe('Observability & Health Endpoints', () => {
  it('GET /health should return HTTP 200 with service metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'RALT ONDC Logistics Provider (BPP)');
    expect(res.body).toHaveProperty('domain', 'ONDC:LOG10');
    expect(res.body).toHaveProperty('role', 'BPP');
    expect(res.body).toHaveProperty('uptime_seconds');
    expect(res.body).toHaveProperty('time');
  });

  it('GET /ready should return readiness probes for DB, Redis, and RabbitMQ', async () => {
    const res = await request(app).get('/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('database');
    expect(res.body.checks).toHaveProperty('redis');
    expect(res.body.checks).toHaveProperty('rabbitmq');
  });

  it('GET /metrics should expose Prometheus formatted metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('# HELP');
    expect(res.text).toContain('# TYPE');
  });

  it('GET / should serve the portal or welcome message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });
});

