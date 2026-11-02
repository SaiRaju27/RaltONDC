/**
 * Enterprise API Client for RALT ONDC Delivery Mobile Application
 */

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | null;
}

export class DeliveryApiClient {
  private baseUrl: string;
  private getToken?: () => string | null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getToken = options.getToken;
  }

  private async request<T = any>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<{ success: boolean; data?: T; error?: string; status: number }> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    if (this.getToken) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          error: data?.error || data?.message || `Request failed with status ${response.status}`,
        };
      }

      return {
        success: true,
        status: response.status,
        data,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 0,
        error: err.message || 'Network connection failed',
      };
    }
  }

  /**
   * Dispatches OTP to delivery partner phone
   */
  public async sendOtp(phone: string) {
    return this.request('/api/rider/send-otp', {
      method: 'POST',
      body: { phone },
    });
  }

  /**
   * Verifies OTP code and returns JWT token
   */
  public async verifyOtp(phone: string, code: string) {
    return this.request('/api/rider/verify-otp', {
      method: 'POST',
      body: { phone, code },
    });
  }

  /**
   * Fetches delivery partner profile
   */
  public async getProfile(riderId: string) {
    return this.request(`/api/rider/profile?riderId=${encodeURIComponent(riderId)}`);
  }

  /**
   * Updates real-time GPS location
   */
  public async updateLocation(
    riderId: string,
    lat: number,
    lng: number,
    heading: number = 0,
    speed: number = 0
  ) {
    return this.request('/api/rider/location', {
      method: 'POST',
      body: { riderId, lat, lng, heading, speed },
    });
  }

  /**
   * Toggles partner online/offline dispatch status
   */
  public async toggleOnline(riderId: string, isOnline: boolean) {
    return this.request('/api/rider/toggle-online', {
      method: 'POST',
      body: { riderId, isOnline },
    });
  }

  /**
   * Updates active order fulfillment status
   */
  public async updateOrderStatus(orderId: string, status: string, otp?: string) {
    return this.request('/api/rider/order/status', {
      method: 'POST',
      body: { orderId, status, otp },
    });
  }

  /**
   * Fetches partner earnings report
   */
  public async getEarnings(riderId: string) {
    return this.request(`/api/rider/earnings?riderId=${encodeURIComponent(riderId)}`);
  }

  /**
   * Fetches summary performance metrics
   */
  public async getMetrics(riderId: string) {
    return this.request(`/api/rider/metrics?riderId=${encodeURIComponent(riderId)}`);
  }

  /**
   * Saves onboarding step progress
   */
  public async saveOnboardingStep(riderId: string, step: number, data: any) {
    return this.request('/api/rider/onboarding/save-step', {
      method: 'POST',
      body: { riderId, step, data },
    });
  }

  /**
   * Triggers Digio Aadhaar KYC screening
   */
  public async requestDigioKyc(riderId: string) {
    return this.request(`/api/kyc/request/${encodeURIComponent(riderId)}`, {
      method: 'POST',
    });
  }

  /**
   * Verifies bank details with penny-drop / IFSC checks
   */
  public async verifyBankDetails(riderId: string, ifsc: string, accountNumber: string) {
    return this.request('/api/rider/bank/verify', {
      method: 'POST',
      body: { riderId, ifsc, accountNumber },
    });
  }
}

