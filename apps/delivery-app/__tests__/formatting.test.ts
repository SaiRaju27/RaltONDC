import {
  formatCurrency,
  formatDistance,
  maskAccountNumber,
  maskAadhaar,
  formatPartnerRating,
  formatTime,
} from '../src/utils/formatting';

describe('Frontend Formatting Utilities', () => {
  describe('Currency Formatting', () => {
    it('formats Indian Rupee numbers and strings with comma separators', () => {
      expect(formatCurrency(100)).toBe('₹100');
      expect(formatCurrency(12500)).toBe('₹12,500');
      expect(formatCurrency('3500.50')).toBe('₹3,501');
      expect(formatCurrency(0)).toBe('₹0');
      expect(formatCurrency(null)).toBe('₹0');
      expect(formatCurrency('abc')).toBe('₹0');
    });
  });

  describe('Distance Formatting', () => {
    it('formats distance in meters when under 1 km', () => {
      expect(formatDistance(0.4, true)).toBe('400 m');
      expect(formatDistance(450, false)).toBe('450 m');
    });

    it('formats distance in kilometers when 1 km or more', () => {
      expect(formatDistance(3.75, true)).toBe('3.8 km');
      expect(formatDistance(2500, false)).toBe('2.5 km');
      expect(formatDistance(0, true)).toBe('0 m');
    });
  });

  describe('Masking Sensitive Data', () => {
    it('masks bank account numbers and preserves last 4 digits', () => {
      expect(maskAccountNumber('123456789012')).toBe('•••• •••• 9012');
      expect(maskAccountNumber('123')).toBe('123');
      expect(maskAccountNumber('')).toBe('•••• ••••');
    });

    it('masks Aadhaar numbers complying with UIDAI rules', () => {
      expect(maskAadhaar('123456789012')).toBe('•••• •••• 9012');
      expect(maskAadhaar('123')).toBe('123');
      expect(maskAadhaar('')).toBe('•••• •••• ••••');
    });
  });

  describe('Rating & Time Formatting', () => {
    it('formats partner rating between 1.0 and 5.0', () => {
      expect(formatPartnerRating(4.8)).toBe('4.8');
      expect(formatPartnerRating(5.5)).toBe('5.0');
      expect(formatPartnerRating(0)).toBe('5.0');
      expect(formatPartnerRating(undefined)).toBe('5.0');
    });

    it('formats time to 12-hour format or handles invalid timestamps', () => {
      const fixedDate = new Date('2026-11-02T14:30:00Z');
      expect(formatTime(fixedDate)).not.toBe('--:--');
      expect(formatTime('')).toBe('--:--');
      expect(formatTime('invalid-date')).toBe('--:--');
    });
  });
});
