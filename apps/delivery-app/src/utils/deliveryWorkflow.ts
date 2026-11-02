/**
 * Enterprise ONDC Delivery Workflow & Pricing Engine
 * Handles fulfillment state transitions, Haversine routing distance, and partner payouts
 */

import { ONDCDeliveryState, DeliveryPayoutBreakdown } from '../types';

/**
 * Valid lifecycle transitions for ONDC LOG10 on-demand logistics
 */
export const STATE_TRANSITION_MAP: Record<ONDCDeliveryState, ONDCDeliveryState[]> = {
  Pending: ['Order-assigned', 'Cancelled'],
  'Order-assigned': ['At-pickup', 'Cancelled'],
  'At-pickup': ['Order-picked-up', 'Cancelled'],
  'Order-picked-up': ['At-delivery', 'Cancelled'],
  'At-delivery': ['Order-delivered', 'Cancelled'],
  'Order-delivered': [],
  Cancelled: [],
};

/**
 * Returns human-readable business step labels (strictly non-technical)
 */
export function getDeliveryStateLabel(status: ONDCDeliveryState | string): string {
  switch (status) {
    case 'Pending':
      return 'Looking for Delivery Partner';
    case 'Order-assigned':
      return 'Delivery Partner Assigned';
    case 'At-pickup':
      return 'Arrived at Merchant Store';
    case 'Order-picked-up':
      return 'Package Picked Up';
    case 'At-delivery':
      return 'Arrived at Delivery Address';
    case 'Order-delivered':
      return 'Package Delivered';
    case 'Cancelled':
      return 'Delivery Cancelled';
    default:
      return 'Delivery In Progress';
  }
}

/**
 * Calculates Haversine great-circle distance between two GPS coordinates in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 100) / 100;
}

/**
 * Calculates delivery fee and delivery partner earnings breakdown
 */
export function calculateDeliveryPayout(
  distanceKm: number,
  baseFare: number = 40,
  perKmRate: number = 12,
  surgeMultiplier: number = 1.0,
  partnerCommissionRate: number = 0.85
): DeliveryPayoutBreakdown {
  const safeDistance = Math.max(0, distanceKm);
  const baseDistanceIncludedKm = 2;

  let distanceFee = 0;
  if (safeDistance > baseDistanceIncludedKm) {
    distanceFee = Math.round((safeDistance - baseDistanceIncludedKm) * perKmRate);
  }

  const subtotal = baseFare + distanceFee;
  const surgeFee = Math.round(subtotal * (Math.max(1.0, surgeMultiplier) - 1.0));
  const totalFee = subtotal + surgeFee;
  const partnerShare = Math.round(totalFee * partnerCommissionRate);

  return {
    baseFee: baseFare,
    distanceFee,
    surgeFee,
    totalFee,
    partnerShare,
  };
}

/**
 * Validates whether transition from current status to next status is permissible
 */
export function canTransitionOrderStatus(
  currentStatus: ONDCDeliveryState | string,
  nextStatus: ONDCDeliveryState | string
): boolean {
  const allowed = STATE_TRANSITION_MAP[currentStatus as ONDCDeliveryState];
  if (!allowed) return false;
  return allowed.includes(nextStatus as ONDCDeliveryState);
}

/**
 * Gets the next sequential active delivery step
 */
export function getNextOrderStatus(currentStatus: ONDCDeliveryState | string): ONDCDeliveryState | null {
  switch (currentStatus) {
    case 'Pending':
      return 'Order-assigned';
    case 'Order-assigned':
      return 'At-pickup';
    case 'At-pickup':
      return 'Order-picked-up';
    case 'Order-picked-up':
      return 'At-delivery';
    case 'At-delivery':
      return 'Order-delivered';
    default:
      return null;
  }
}

/**
 * Estimates delivery arrival time based on distance
 */
export function formatDeliveryTimeEstimate(
  distanceKm: number,
  averageSpeedKmh: number = 22
): { minutes: number; formatted: string } {
  if (distanceKm <= 0) return { minutes: 0, formatted: 'Arrived' };
  const travelMinutes = Math.round((distanceKm / averageSpeedKmh) * 60);
  const bufferMinutes = 5; // buffer for traffic and handoff
  const totalMinutes = Math.max(5, travelMinutes + bufferMinutes);

  if (totalMinutes < 60) {
    return { minutes: totalMinutes, formatted: `${totalMinutes} mins` };
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return { minutes: totalMinutes, formatted: `${hours}h ${mins}m` };
}

/**
 * Checks if order is active (not finished or cancelled)
 */
export function isOrderActive(status: ONDCDeliveryState | string): boolean {
  return status !== 'Order-delivered' && status !== 'Cancelled';
}

/**
 * Checks if order reached final terminal state
 */
export function isDeliveryComplete(status: ONDCDeliveryState | string): boolean {
  return status === 'Order-delivered';
}
