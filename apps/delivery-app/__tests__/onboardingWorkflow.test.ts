import {
  getOnboardingProgress,
  isStepComplete,
  canAdvanceToNextStep,
  getPreviousStep,
  getNextStep,
  formatKycStatus,
  STEP_NAMES,
} from '../src/utils/onboardingWorkflow';

describe('Onboarding Workflow Utilities', () => {
  it('reports percentage progress for each step', () => {
    expect(getOnboardingProgress(1)).toBe(20);
    expect(getOnboardingProgress(2)).toBe(40);
    expect(getOnboardingProgress(3)).toBe(60);
    expect(getOnboardingProgress(4)).toBe(80);
    expect(getOnboardingProgress(5)).toBe(95);
    expect(getOnboardingProgress(6)).toBe(100);
    expect(getOnboardingProgress(99 as any)).toBe(0);
  });

  describe('Step Completion Checks', () => {
    it('validates Step 1: Personal Details', () => {
      expect(isStepComplete(1, { name: 'Sai', city: 'Hyderabad', phone: '9876543210' })).toBe(true);
      expect(isStepComplete(1, { name: 'Sai' })).toBe(false);
      expect(isStepComplete(1, null)).toBe(false);
    });

    it('validates Step 2: Vehicle Details', () => {
      expect(isStepComplete(2, { vehicleType: 'Bike', vehicleNumber: 'TS09EA1234' })).toBe(true);
      expect(isStepComplete(2, { vehicleType: 'Bike' })).toBe(false);
    });

    it('validates Step 3: Identity Documents', () => {
      expect(isStepComplete(3, { aadhaarNumber: '123456789012', panNumber: 'ABCDE1234F' })).toBe(true);
      expect(isStepComplete(3, { aadhaarNumber: '123456789012' })).toBe(false);
    });

    it('validates Step 4: Bank Details', () => {
      expect(isStepComplete(4, { bankAccountNumber: '1122334455', bankIfsc: 'SBIN0001234' })).toBe(true);
      expect(isStepComplete(4, { bankAccountNumber: '1122334455' })).toBe(false);
    });

    it('validates Step 5: Application Review', () => {
      expect(isStepComplete(5, { kycStatus: 'APPROVED' })).toBe(true);
      expect(isStepComplete(5, { kycStatus: 'PENDING' })).toBe(false);
    });

    it('validates Step 6: Ready', () => {
      expect(isStepComplete(6, {})).toBe(true);
      expect(isStepComplete(99 as any, {})).toBe(false);
    });
  });

  describe('Advancing Steps', () => {
    it('allows advance when fields are satisfied', () => {
      const res = canAdvanceToNextStep(1, { name: 'Sai', city: 'Hyd', phone: '9876543210' });
      expect(res.allowed).toBe(true);
      expect(res.missingFields.length).toBe(0);
    });

    it('reports specific missing fields when incomplete', () => {
      const res = canAdvanceToNextStep(1, { name: 'Sai' });
      expect(res.allowed).toBe(false);
      expect(res.missingFields).toContain('Operating City');
      expect(res.missingFields).toContain('Mobile Number');
    });

    it('handles missing fields across Step 2, 3, 4', () => {
      expect(canAdvanceToNextStep(2, {}).allowed).toBe(false);
      expect(canAdvanceToNextStep(3, {}).allowed).toBe(false);
      expect(canAdvanceToNextStep(4, {}).allowed).toBe(false);
      expect(canAdvanceToNextStep(1, null).allowed).toBe(false);
    });
  });

  describe('Step Navigation', () => {
    it('navigates next and previous steps within bounds', () => {
      expect(getNextStep(1)).toBe(2);
      expect(getNextStep(5)).toBe(6);
      expect(getNextStep(6)).toBe(6);

      expect(getPreviousStep(4)).toBe(3);
      expect(getPreviousStep(1)).toBe(1);
    });
  });

  describe('KYC Status Formatting', () => {
    it('formats approved status with green badge', () => {
      const kyc = formatKycStatus('APPROVED');
      expect(kyc.label).toBe('Verified Partner');
      expect(kyc.badgeColor).toBe('#10B981');
      expect(kyc.isApproved).toBe(true);
    });

    it('formats pending and rejected statuses', () => {
      expect(formatKycStatus('PENDING').label).toBe('Verification In Progress');
      expect(formatKycStatus('INITIATED').label).toBe('Verification In Progress');
      expect(formatKycStatus('REJECTED').label).toBe('Needs Re-submission');
      expect(formatKycStatus(undefined).label).toBe('Verification Pending');
    });
  });
});

