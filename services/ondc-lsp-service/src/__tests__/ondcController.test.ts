import request from 'supertest';
import { app } from '../server';

describe('ONDC LOG10 Logistics Controller Webhooks', () => {
  const mockContext = {
    domain: 'ONDC:LOG10',
    country: 'IND',
    city: 'std:040',
    action: 'search',
    core_version: '1.2.0',
    bap_id: 'buyer-app.network.org',
    bap_uri: 'https://buyer-app.network.org/ondc',
    bpp_id: 'lsp.ralt.in',
    bpp_uri: 'https://lsp.ralt.in/ondc',
    transaction_id: 'tx-test-999',
    message_id: 'msg-test-999',
    timestamp: new Date().toISOString(),
    ttl: 'PT30S'
  };

  it('POST /ondc/search should acknowledge with ACK', async () => {
    const payload = {
      context: { ...mockContext, action: 'search' },
      message: {
        intent: {
          category: { id: 'Immediate Delivery' },
          fulfillment: {
            type: 'Delivery',
            start: { location: { gps: '17.4483,78.3915' } },
            end: { location: { gps: '17.4375,78.4482' } }
          }
        }
      }
    };

    const res = await request(app)
      .post('/ondc/search')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toHaveProperty('ack');
    expect(res.body.message.ack.status).toBe('ACK');
  });

  it('POST /ondc/init should initialize order and return ACK', async () => {
    const payload = {
      context: { ...mockContext, action: 'init' },
      message: {
        order: {
          items: [{ id: 'standard-delivery' }],
          fulfillment: {
            start: { location: { gps: '17.4483,78.3915', address: { area_code: '500081' } } },
            end: { location: { gps: '17.4375,78.4482', address: { area_code: '500034' } } }
          }
        }
      }
    };

    const res = await request(app)
      .post('/ondc/init')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body?.message?.ack?.status).toBe('ACK');
  });

  it('POST /ondc/status should return ACK for order status tracking', async () => {
    const payload = {
      context: { ...mockContext, action: 'status' },
      message: {
        order_id: 'order-test-101'
      }
    };

    const res = await request(app)
      .post('/ondc/status')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body?.message?.ack?.status).toBe('ACK');
  });

  it('POST /ondc/confirm should process confirm request and acknowledge', async () => {
    const payload = {
      context: { ...mockContext, action: 'confirm' },
      message: {
        order: {
          id: 'ord-confirm-test',
          items: [{ id: 'item-1' }],
          fulfillment: {
            start: { location: { gps: '17.4483,78.3915' } },
            end: { location: { gps: '17.4375,78.4482' } }
          }
        }
      }
    };

    const res = await request(app)
      .post('/ondc/confirm')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message.ack.status).toBe('ACK');
  });

  it('POST /ondc/update should process update request and acknowledge', async () => {
    const payload = {
      context: { ...mockContext, action: 'update' },
      message: {
        update_target: 'fulfillment',
        order: { id: 'ord-101' }
      }
    };

    const res = await request(app)
      .post('/ondc/update')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message.ack.status).toBe('ACK');
  });

  it('POST /ondc/track should process track request and acknowledge', async () => {
    const payload = {
      context: { ...mockContext, action: 'track' },
      message: { order_id: 'ord-101' }
    };

    const res = await request(app)
      .post('/ondc/track')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message.ack.status).toBe('ACK');
  });

  it('POST /ondc/cancel should return ACK for cancellation request', async () => {
    const payload = {
      context: { ...mockContext, action: 'cancel' },
      message: {
        order_id: 'order-test-101',
        cancellation_reason_id: '001'
      }
    };

    const res = await request(app)
      .post('/ondc/cancel')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body?.message?.ack?.status).toBe('ACK');
  });
});
