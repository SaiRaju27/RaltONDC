import {
  calculateHaversineDistance,
  calculateDeliveryPayout,
  canTransitionOrderStatus,
  getNextOrderStatus,
  getDeliveryStateLabel,
  formatDeliveryTimeEstimate,
  isOrderActive,
  isDeliveryComplete,
} from '../src/utils/deliveryWorkflow';

describe('Delivery Workflow & Pricing Utilities', () => {
  describe('Haversine Distance Calculator', () => {
    it('returns 0 for identical points', () => {
      expect(calculateHaversineDistance(17.4483, 78.3915, 17.4483, 78.3915)).toBe(0);
    });

    it('calculates realistic distance between two city locations', () => {
      // Hitec City (17.4483, 78.3915) to Inorbit Mall (17.4375, 78.3887) is approx 1.2-1.5 km
      const dist = calculateHaversineDistance(17.4483, 78.3915, 17.4375, 78.3887);
      expect(dist).toBeGreaterThan(1.0);
      expect(dist).toBeLessThan(2.0);
    });
  });

  describe('Delivery Payout Engine', () => {
    it('calculates minimum base fare for trips under included distance', () => {
      const payout = calculateDeliveryPayout(1.5, 40, 12, 1.0, 0.85);
      expect(payout.baseFee).toBe(40);
      expect(payout.distanceFee).toBe(0);
      expect(payout.totalFee).toBe(40);
      expect(payout.partnerShare).toBe(34); // 85% of 40
    });

    it('calculates distance fee and surge pricing', () => {
      // 5 km trip: 2 km included, 3 km extra @ 12 = 36. Subtotal = 40 + 36 = 76.
      // 1.5x surge: surge fee = 38. Total = 114.
      const payout = calculateDeliveryPayout(5.0, 40, 12, 1.5, 0.85);
      expect(payout.distanceFee).toBe(36);
      expect(payout.totalFee).toBe(114);
      expect(payout.partnerShare).toBe(Math.round(114 * 0.85));
    });
  });

  describe('Order State Machine', () => {
    it('allows sequential forward state transitions', () => {
      expect(canTransitionOrderStatus('Pending', 'Order-assigned')).toBe(true);
      expect(canTransitionOrderStatus('Order-assigned', 'At-pickup')).toBe(true);
      expect(canTransitionOrderStatus('At-pickup', 'Order-picked-up')).toBe(true);
      expect(canTransitionOrderStatus('Order-picked-up', 'At-delivery')).toBe(true);
      expect(canTransitionOrderStatus('At-delivery', 'Order-delivered')).toBe(true);
    });

    it('allows cancellation from any active state', () => {
      expect(canTransitionOrderStatus('Pending', 'Cancelled')).toBe(true);
      expect(canTransitionOrderStatus('Order-assigned', 'Cancelled')).toBe(true);
      expect(canTransitionOrderStatus('At-pickup', 'Cancelled')).toBe(true);
      expect(canTransitionOrderStatus('Order-picked-up', 'Cancelled')).toBe(true);
      expect(canTransitionOrderStatus('At-delivery', 'Cancelled')).toBe(true);
    });

    it('prevents invalid backward or skipping transitions', () => {
      expect(canTransitionOrderStatus('Pending', 'Order-delivered')).toBe(false);
      expect(canTransitionOrderStatus('Order-delivered', 'At-pickup')).toBe(false);
      expect(canTransitionOrderStatus('Cancelled', 'Order-delivered')).toBe(false);
      expect(canTransitionOrderStatus('UnknownState', 'At-pickup')).toBe(false);
    });

    it('returns the correct next sequential status', () => {
      expect(getNextOrderStatus('Pending')).toBe('Order-assigned');
      expect(getNextOrderStatus('Order-assigned')).toBe('At-pickup');
      expect(getNextOrderStatus('At-pickup')).toBe('Order-picked-up');
      expect(getNextOrderStatus('Order-picked-up')).toBe('At-delivery');
      expect(getNextOrderStatus('At-delivery')).toBe('Order-delivered');
      expect(getNextOrderStatus('Order-delivered')).toBeNull();
      expect(getNextOrderStatus('Cancelled')).toBeNull();
    });
  });

  describe('Delivery Labels & State Queries', () => {
    it('returns clean business labels with zero technical jargon', () => {
      expect(getDeliveryStateLabel('Pending')).toBe('Looking for Delivery Partner');
      expect(getDeliveryStateLabel('Order-assigned')).toBe('Delivery Partner Assigned');
      expect(getDeliveryStateLabel('At-pickup')).toBe('Arrived at Merchant Store');
      expect(getDeliveryStateLabel('Order-picked-up')).toBe('Package Picked Up');
      expect(getDeliveryStateLabel('At-delivery')).toBe('Arrived at Delivery Address');
      expect(getDeliveryStateLabel('Order-delivered')).toBe('Package Delivered');
      expect(getDeliveryStateLabel('Cancelled')).toBe('Delivery Cancelled');
      expect(getDeliveryStateLabel('Unknown')).toBe('Delivery In Progress');
    });

    it('estimates arrival time correctly', () => {
      expect(formatDeliveryTimeEstimate(0).formatted).toBe('Arrived');
      expect(formatDeliveryTimeEstimate(3).formatted).toContain('mins');
      expect(formatDeliveryTimeEstimate(30).formatted).toContain('h');
    });

    it('identifies active and completed states', () => {
      expect(isOrderActive('At-pickup')).toBe(true);
      expect(isOrderActive('Order-delivered')).toBe(false);
      expect(isOrderActive('Cancelled')).toBe(false);

      expect(isDeliveryComplete('Order-delivered')).toBe(true);
      expect(isDeliveryComplete('At-pickup')).toBe(false);
    });
  });
});

