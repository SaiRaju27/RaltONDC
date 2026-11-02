/**
 * Enterprise Onboarding Workflow Engine
 * Manages 5-step registration, required documents, and KYC approval states
 */

import { OnboardingStepNumber, KycStatus } from '../types';

export const STEP_NAMES: Record<OnboardingStepNumber, string> = {
  1: 'Personal Details',
  2: 'Vehicle Details',
  3: 'Identity Documents',
  4: 'Bank Details',
  5: 'Application Review',
  6: 'Partner Ready',
};

/**
 * Calculates percentage completion of delivery partner onboarding
 */
export function getOnboardingProgress(step: OnboardingStepNumber): number {
  switch (step) {
    case 1:
      return 20;
    case 2:
      return 40;
    case 3:
      return 60;
    case 4:
      return 80;
    case 5:
      return 95;
    case 6:
      return 100;
    default:
      return 0;
  }
}

/**
 * Checks if a specific onboarding step has satisfied required fields
 */
export function isStepComplete(step: OnboardingStepNumber, profile: any): boolean {
  if (!profile) return false;
  switch (step) {
    case 1:
      return Boolean(profile.name && profile.city && profile.phone);
    case 2:
      return Boolean(profile.vehicleType && (profile.vehicleNumber || profile.vehicle_number));
    case 3:
      return Boolean(
        (profile.aadhaarNumber || profile.aadhaar_number) &&
        (profile.panNumber || profile.pan_number)
      );
    case 4:
      return Boolean(
        (profile.bankAccountNumber || profile.bank_account_number) &&
        (profile.bankIfsc || profile.bank_ifsc)
      );
    case 5:
      return Boolean(profile.kycStatus === 'APPROVED' || profile.kyc_status === 'APPROVED' || profile.onboarding_completed === 1);
    case 6:
      return true;
    default:
      return false;
  }
}

/**
 * Evaluates whether the partner can advance to the next step
 */
export function canAdvanceToNextStep(
  currentStep: OnboardingStepNumber,
  profile: any
): { allowed: boolean; missingFields: string[] } {
  const missing: string[] = [];
  if (!profile) {
    return { allowed: false, missingFields: ['Profile data required'] };
  }

  if (currentStep === 1) {
    if (!profile.name) missing.push('Full Name');
    if (!profile.city) missing.push('Operating City');
    if (!profile.phone) missing.push('Mobile Number');
  } else if (currentStep === 2) {
    if (!profile.vehicleType && !profile.vehicle_type) missing.push('Vehicle Type');
    if (!profile.vehicleNumber && !profile.vehicle_number) missing.push('Vehicle Number');
  } else if (currentStep === 3) {
    if (!profile.aadhaarNumber && !profile.aadhaar_number) missing.push('Aadhaar Number');
    if (!profile.panNumber && !profile.pan_number) missing.push('PAN Number');
  } else if (currentStep === 4) {
    if (!profile.bankAccountNumber && !profile.bank_account_number) missing.push('Bank Account Number');
    if (!profile.bankIfsc && !profile.bank_ifsc) missing.push('IFSC Code');
  }

  return {
    allowed: missing.length === 0,
    missingFields: missing,
  };
}

/**
 * Returns previous sequential step
 */
export function getPreviousStep(currentStep: OnboardingStepNumber): OnboardingStepNumber {
  if (currentStep <= 1) return 1;
  return (currentStep - 1) as OnboardingStepNumber;
}

/**
 * Returns next sequential step
 */
export function getNextStep(currentStep: OnboardingStepNumber): OnboardingStepNumber {
  if (currentStep >= 6) return 6;
  return (currentStep + 1) as OnboardingStepNumber;
}

/**
 * Formats KYC status for business user UI
 */
export function formatKycStatus(status?: KycStatus | string): {
  label: string;
  badgeColor: string;
  isApproved: boolean;
} {
  const normalized = (status || '').toUpperCase();
  switch (normalized) {
    case 'APPROVED':
      return { label: 'Verified Partner', badgeColor: '#10B981', isApproved: true };
    case 'INITIATED':
    case 'PENDING':
      return { label: 'Verification In Progress', badgeColor: '#F59E0B', isApproved: false };
    case 'REJECTED':
      return { label: 'Needs Re-submission', badgeColor: '#EF4444', isApproved: false };
    default:
      return { label: 'Verification Pending', badgeColor: '#6B7280', isApproved: false };
  }
}
