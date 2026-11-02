/**
 * Enterprise ONDC Delivery Partner Types
 */

export type OnboardingStepNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'INITIATED' | 'APPROVED' | 'REJECTED';

export type ONDCDeliveryState =
  | 'Pending'
  | 'Order-assigned'
  | 'At-pickup'
  | 'Order-picked-up'
  | 'At-delivery'
  | 'Order-delivered'
  | 'Cancelled';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LocationPoint {
  address: string;
  name?: string;
  phone?: string;
  gps?: LatLng;
}

export interface DeliveryOrder {
  orderId: string;
  transactionId?: string;
  bapOrderId?: string;
  status: ONDCDeliveryState;
  pickup: LocationPoint;
  drop: LocationPoint;
  deliveryFee: number;
  partnerPayout: number;
  customerName?: string;
  customerPhone?: string;
  merchantName?: string;
  merchantPhone?: string;
  otp?: string;
  distanceKm?: number;
  items?: Array<{ name: string; quantity: number }>;
  createdAt?: string;
  deliveredAt?: string;
}

export interface RiderProfile {
  id: string;
  phone: string;
  name: string;
  city: string;
  vehicleType: string;
  vehicleNumber?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  drivingLicenseNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  accountHolderName?: string;
  isOnline: boolean;
  kycStatus: KycStatus;
  onboardingStep: OnboardingStepNumber;
  onboardingCompleted: boolean;
  rating?: number;
  totalTrips?: number;
}

export interface DeliveryPayoutBreakdown {
  baseFee: number;
  distanceFee: number;
  surgeFee: number;
  totalFee: number;
  partnerShare: number;
}
