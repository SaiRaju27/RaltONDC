import {
  signRiderToken,
  verifyRiderToken,
  SendOtpSchema,
  VerifyOtpSchema,
  LocationUpdateSchema,
  StatusUpdateSchema
} from '../security';

describe('Security & Authentication Module', () => {
  const testRiderId = 'rider-test-uuid-1234';
  const testPhone = '9876543210';

  describe('JWT Rider Token Management', () => {
    it('should successfully sign and verify a valid rider JWT token', () => {
      const token = signRiderToken(testRiderId, testPhone, 'RIDER');
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = verifyRiderToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.riderId).toBe(testRiderId);
      expect(decoded?.phone).toBe(testPhone);
      expect(decoded?.role).toBe('RIDER');
    });

    it('should reject tampered or corrupted JWT tokens', () => {
      const token = signRiderToken(testRiderId, testPhone);
      const tamperedToken = token.slice(0, -6) + 'abc123';
      const decoded = verifyRiderToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    it('should reject completely malformed token strings', () => {
      expect(verifyRiderToken('')).toBeNull();
      expect(verifyRiderToken('not-a-token')).toBeNull();
      expect(verifyRiderToken('Bearer 12345')).toBeNull();
    });
  });

  describe('Zod Input Validation Schemas', () => {
    it('should validate 10-digit phone number in SendOtpSchema', () => {
      const valid = SendOtpSchema.safeParse({ phone: '9876543210' });
      expect(valid.success).toBe(true);

      const tooShort = SendOtpSchema.safeParse({ phone: '12345' });
      expect(tooShort.success).toBe(false);

      const tooLong = SendOtpSchema.safeParse({ phone: '1234567890123456' });
      expect(tooLong.success).toBe(false);

      const nonNumeric = SendOtpSchema.safeParse({ phone: '98765abcde' });
      expect(nonNumeric.success).toBe(false);
    });

    it('should validate 6-digit OTP in VerifyOtpSchema', () => {
      const valid = VerifyOtpSchema.safeParse({ phone: '9876543210', otp: '123456' });
      expect(valid.success).toBe(true);

      const invalidLength = VerifyOtpSchema.safeParse({ phone: '9876543210', otp: '123' });
      expect(invalidLength.success).toBe(false);

      const nonNumericOtp = VerifyOtpSchema.safeParse({ phone: '9876543210', otp: 'abcdef' });
      expect(nonNumericOtp.success).toBe(false);
    });

    it('should validate geographic coordinates in LocationUpdateSchema', () => {
      const valid = LocationUpdateSchema.safeParse({
        riderId: testRiderId,
        lat: 17.3850,
        lng: 78.4867
      });
      expect(valid.success).toBe(true);

      const invalidLat = LocationUpdateSchema.safeParse({
        riderId: testRiderId,
        lat: 95.0,
        lng: 78.4867
      });
      expect(invalidLat.success).toBe(false);

      const invalidLng = LocationUpdateSchema.safeParse({
        riderId: testRiderId,
        lat: 17.3850,
        lng: 195.0
      });
      expect(invalidLng.success).toBe(false);
    });

    it('should validate online/offline states in StatusUpdateSchema', () => {
      const validOnline = StatusUpdateSchema.safeParse({
        riderId: testRiderId,
        isOnline: true
      });
      expect(validOnline.success).toBe(true);

      const validOffline = StatusUpdateSchema.safeParse({
        riderId: testRiderId,
        isOnline: false
      });
      expect(validOffline.success).toBe(true);
    });
  });
});
