import { DeliveryApiClient } from '../src/services/apiClient';

describe('DeliveryApiClient Suite', () => {
  let client: DeliveryApiClient;
  const mockFetch = jest.fn();

  beforeAll(() => {
    (globalThis as any).fetch = mockFetch;
    client = new DeliveryApiClient({
      baseUrl: 'http://localhost:5001',
      getToken: () => 'mock-jwt-token',
    });
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('dispatches sendOtp with phone payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'OTP sent' }),
    });

    const res = await client.sendOtp('9876543210');
    expect(res.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5001/api/rider/send-otp',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-jwt-token',
        }),
      })
    );
  });

  it('verifies OTP code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, token: 'new-jwt' }),
    });

    const res = await client.verifyOtp('9876543210', '1234');
    expect(res.success).toBe(true);
    expect(res.data.token).toBe('new-jwt');
  });

  it('fetches rider profile', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, rider: { id: 'R1', name: 'Sai' } }),
    });

    const res = await client.getProfile('R1');
    expect(res.success).toBe(true);
    expect(res.data.rider.name).toBe('Sai');
  });

  it('updates partner location and online toggle', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const locRes = await client.updateLocation('R1', 17.4483, 78.3915, 90, 20);
    expect(locRes.success).toBe(true);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, isOnline: true }),
    });

    const onlineRes = await client.toggleOnline('R1', true);
    expect(onlineRes.success).toBe(true);
  });

  it('updates order status, gets earnings and metrics', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, status: 'At-pickup' }),
    });

    const orderRes = await client.updateOrderStatus('ord-1', 'At-pickup');
    expect(orderRes.success).toBe(true);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, total: 1500 }),
    });
    const earnRes = await client.getEarnings('R1');
    expect(earnRes.success).toBe(true);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, metrics: { tripsCompleted: 10 } }),
    });
    const metricsRes = await client.getMetrics('R1');
    expect(metricsRes.success).toBe(true);
  });

  it('saves onboarding step, requests KYC, and verifies bank', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    const stepRes = await client.saveOnboardingStep('R1', 2, { vehicleType: 'Bike' });
    expect(stepRes.success).toBe(true);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, status: 'initiated' }),
    });
    const kycRes = await client.requestDigioKyc('R1');
    expect(kycRes.success).toBe(true);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, verified: true }),
    });
    const bankRes = await client.verifyBankDetails('R1', 'SBIN0001234', '1122334455');
    expect(bankRes.success).toBe(true);
  });

  it('handles HTTP error responses and network exceptions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: 'Invalid phone' }),
    });

    const errRes = await client.sendOtp('invalid');
    expect(errRes.success).toBe(false);
    expect(errRes.error).toBe('Invalid phone');

    mockFetch.mockRejectedValueOnce(new Error('Network offline'));
    const netErr = await client.getProfile('R1');
    expect(netErr.success).toBe(false);
    expect(netErr.error).toBe('Network offline');
  });
});

