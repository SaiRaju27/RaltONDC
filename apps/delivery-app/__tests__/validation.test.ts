import {
  validatePhoneNumber,
  validateOtp,
  validateAadhaar,
  validatePan,
  validateDrivingLicense,
  validateVehicleRc,
  validateIfsc,
  validateBankAccount,
  validateName,
} from '../src/utils/validation';

describe('Frontend Validation Utilities', () => {
  describe('Phone Number Validation', () => {
    it('validates standard 10-digit Indian numbers starting with 6,7,8,9', () => {
      expect(validatePhoneNumber('9876543210').isValid).toBe(true);
      expect(validatePhoneNumber('+91 9876543210').isValid).toBe(true);
      expect(validatePhoneNumber('98765-43210').isValid).toBe(true);
      expect(validatePhoneNumber('8123456789').isValid).toBe(true);
      expect(validatePhoneNumber('7000000000').isValid).toBe(true);
      expect(validatePhoneNumber('6300000000').isValid).toBe(true);
    });

    it('rejects numbers starting with invalid digits (1-5) or improper length', () => {
      expect(validatePhoneNumber('5123456789').isValid).toBe(false);
      expect(validatePhoneNumber('12345').isValid).toBe(false);
      expect(validatePhoneNumber('').isValid).toBe(false);
      expect(validatePhoneNumber('987654321000').cleaned).toBe('7654321000');
    });
  });

  describe('OTP Validation', () => {
    it('accepts 4-digit and 6-digit numeric OTPs', () => {
      expect(validateOtp('1234').isValid).toBe(true);
      expect(validateOtp('123456').isValid).toBe(true);
      expect(validateOtp(' 9999 ').isValid).toBe(true);
    });

    it('rejects invalid or non-numeric OTPs', () => {
      expect(validateOtp('12').isValid).toBe(false);
      expect(validateOtp('12345').isValid).toBe(false);
      expect(validateOtp('abcd').isValid).toBe(false);
      expect(validateOtp('').isValid).toBe(false);
    });
  });

  describe('Aadhaar Validation', () => {
    it('accepts valid 12-digit Aadhaar numbers and formats them', () => {
      const res = validateAadhaar('234567890123');
      expect(res.isValid).toBe(true);
      expect(res.formatted).toBe('2345 6789 0123');
    });

    it('rejects Aadhaar starting with 0 or 1, or improper length', () => {
      expect(validateAadhaar('012345678901').isValid).toBe(false);
      expect(validateAadhaar('112345678901').isValid).toBe(false);
      expect(validateAadhaar('123').isValid).toBe(false);
      expect(validateAadhaar('').isValid).toBe(false);
    });
  });

  describe('PAN Validation', () => {
    it('accepts standard Indian PAN format (5 letters, 4 digits, 1 letter)', () => {
      const res = validatePan('abcde1234f');
      expect(res.isValid).toBe(true);
      expect(res.formatted).toBe('ABCDE1234F');
    });

    it('rejects non-standard PAN patterns', () => {
      expect(validatePan('12345ABCDE').isValid).toBe(false);
      expect(validatePan('ABCDE12345').isValid).toBe(false);
      expect(validatePan('ABCD1234F').isValid).toBe(false);
      expect(validatePan('').isValid).toBe(false);
    });
  });

  describe('Driving License Validation', () => {
    it('accepts valid Driving License numbers across states', () => {
      expect(validateDrivingLicense('TS0920210001234').isValid).toBe(true);
      expect(validateDrivingLicense('DL-0420110012345').isValid).toBe(true);
      expect(validateDrivingLicense('KA0120150000001').isValid).toBe(true);
    });

    it('rejects empty or too short DL numbers', () => {
      expect(validateDrivingLicense('TS1').isValid).toBe(false);
      expect(validateDrivingLicense('').isValid).toBe(false);
    });
  });

  describe('Vehicle RC Validation', () => {
    it('accepts standard Indian vehicle registration numbers', () => {
      expect(validateVehicleRc('TS09EA1234').isValid).toBe(true);
      expect(validateVehicleRc('KA-01-AB-1234').isValid).toBe(true);
      expect(validateVehicleRc('DL1CAB1234').isValid).toBe(true);
    });

    it('rejects invalid RC formats', () => {
      expect(validateVehicleRc('123456').isValid).toBe(false);
      expect(validateVehicleRc('').isValid).toBe(false);
    });
  });

  describe('IFSC Code Validation', () => {
    it('accepts valid 11-character RBI IFSC codes', () => {
      expect(validateIfsc('SBIN0001234').isValid).toBe(true);
      expect(validateIfsc('HDFC0000123').isValid).toBe(true);
      expect(validateIfsc('ICIC0001122').isValid).toBe(true);
    });

    it('rejects IFSC codes without 0 as the 5th character or wrong length', () => {
      expect(validateIfsc('SBIN1001234').isValid).toBe(false);
      expect(validateIfsc('SBIN001').isValid).toBe(false);
      expect(validateIfsc('').isValid).toBe(false);
    });
  });

  describe('Bank Account Validation', () => {
    it('accepts account numbers between 9 and 18 digits', () => {
      expect(validateBankAccount('123456789').isValid).toBe(true);
      expect(validateBankAccount('123456789012345').isValid).toBe(true);
    });

    it('validates account confirmation match', () => {
      expect(validateBankAccount('123456789', '123456789').isValid).toBe(true);
      expect(validateBankAccount('123456789', '987654321').isValid).toBe(false);
    });

    it('rejects empty or out-of-range account numbers', () => {
      expect(validateBankAccount('12345').isValid).toBe(false);
      expect(validateBankAccount('').isValid).toBe(false);
    });
  });

  describe('Full Name Validation', () => {
    it('accepts valid partner names', () => {
      expect(validateName('Sai Raju').isValid).toBe(true);
      expect(validateName('A. R. Rahman').isValid).toBe(true);
    });

    it('rejects names with numbers, special chars, or too short', () => {
      expect(validateName('R2D2').isValid).toBe(false);
      expect(validateName('Al').isValid).toBe(false);
      expect(validateName('').isValid).toBe(false);
    });
  });
});
