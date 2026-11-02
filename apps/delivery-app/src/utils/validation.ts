/**
 * Enterprise Validation Utilities for ONDC Delivery Partners
 * Strict Indian regulatory & business rules (UIDAI, IT Dept, MoRTH, RBI)
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  formatted?: string;
  cleaned?: string;
}

/**
 * Validates 10-digit Indian Mobile Numbers (starts with 6, 7, 8, or 9)
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone) {
    return { isValid: false, error: 'Mobile number is required' };
  }
  const cleaned = phone.replace(/[^0-9]/g, '').slice(-10);
  if (cleaned.length !== 10) {
    return { isValid: false, cleaned, error: 'Enter a valid 10-digit mobile number' };
  }
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    return { isValid: false, cleaned, error: 'Mobile number must start with 6, 7, 8, or 9' };
  }
  return { isValid: true, cleaned, formatted: `+91 ${cleaned}` };
}

/**
 * Validates 4 or 6-digit OTP codes
 */
export function validateOtp(otp: string): ValidationResult {
  if (!otp) {
    return { isValid: false, error: 'OTP code is required' };
  }
  const cleaned = otp.trim();
  if (!/^\d{4}$|^\d{6}$/.test(cleaned)) {
    return { isValid: false, cleaned, error: 'OTP must be 4 or 6 digits' };
  }
  return { isValid: true, cleaned };
}

/**
 * Validates 12-digit Indian Aadhaar Numbers
 */
export function validateAadhaar(aadhaar: string): ValidationResult {
  if (!aadhaar) {
    return { isValid: false, error: 'Aadhaar number is required' };
  }
  const cleaned = aadhaar.replace(/[^0-9]/g, '');
  if (cleaned.length !== 12) {
    return { isValid: false, cleaned, error: 'Aadhaar number must be exactly 12 digits' };
  }
  // Aadhaar numbers cannot start with 0 or 1
  if (/^[01]/.test(cleaned)) {
    return { isValid: false, cleaned, error: 'Invalid Aadhaar number format' };
  }
  const formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)}`;
  return { isValid: true, cleaned, formatted };
}

/**
 * Validates Permanent Account Number (PAN) according to Income Tax rules
 * Format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
 */
export function validatePan(pan: string): ValidationResult {
  if (!pan) {
    return { isValid: false, error: 'PAN number is required' };
  }
  const cleaned = pan.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== 10) {
    return { isValid: false, cleaned, error: 'PAN number must be 10 characters' };
  }
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(cleaned)) {
    return { isValid: false, cleaned, error: 'Enter valid PAN (e.g., ABCDE1234F)' };
  }
  return { isValid: true, cleaned, formatted: cleaned };
}

/**
 * Validates Indian Driving License (DL) Number
 * Format: 2-letter state code + 2-digit RTO + 11-digit license number or 15-16 standard alphanumeric
 */
export function validateDrivingLicense(dl: string): ValidationResult {
  if (!dl) {
    return { isValid: false, error: 'Driving License is required' };
  }
  const cleaned = dl.toUpperCase().trim().replace(/[\s-]/g, '');
  if (cleaned.length < 10 || cleaned.length > 18) {
    return { isValid: false, cleaned, error: 'Driving License must be between 10 and 18 characters' };
  }
  if (!/^[A-Z]{2}[0-9A-Z]{8,16}$/.test(cleaned)) {
    return { isValid: false, cleaned, error: 'Invalid Driving License format' };
  }
  return { isValid: true, cleaned, formatted: cleaned };
}

/**
 * Validates Vehicle Registration Certificate (RC) Number
 * Format: State code (2 letters) + District (2 digits) + Series (1-2 letters) + 4 digits (e.g., TS09EA1234)
 */
export function validateVehicleRc(rc: string): ValidationResult {
  if (!rc) {
    return { isValid: false, error: 'Vehicle registration number is required' };
  }
  const cleaned = rc.toUpperCase().trim().replace(/[\s-]/g, '');
  if (cleaned.length < 8 || cleaned.length > 12) {
    return { isValid: false, cleaned, error: 'Enter a valid registration number (e.g., TS09EA1234)' };
  }
  if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(cleaned)) {
    return { isValid: false, cleaned, error: 'Invalid Vehicle RC format (e.g., TS09EA1234)' };
  }
  return { isValid: true, cleaned, formatted: cleaned };
}

/**
 * Validates Indian Financial System Code (IFSC)
 * Format: 4 letters (Bank code) + 0 + 6 alphanumeric (Branch code)
 */
export function validateIfsc(ifsc: string): ValidationResult {
  if (!ifsc) {
    return { isValid: false, error: 'IFSC code is required' };
  }
  const cleaned = ifsc.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== 11) {
    return { isValid: false, cleaned, error: 'IFSC code must be exactly 11 characters' };
  }
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(cleaned)) {
    return { isValid: false, cleaned, error: 'Invalid IFSC format (5th character must be 0)' };
  }
  return { isValid: true, cleaned, formatted: cleaned };
}

/**
 * Validates Bank Account Number
 * Format: 9 to 18 digits with optional matching confirmation
 */
export function validateBankAccount(account: string, confirmAccount?: string): ValidationResult {
  if (!account) {
    return { isValid: false, error: 'Bank account number is required' };
  }
  const cleaned = account.replace(/[^0-9]/g, '');
  if (cleaned.length < 9 || cleaned.length > 18) {
    return { isValid: false, cleaned, error: 'Account number must be between 9 and 18 digits' };
  }
  if (confirmAccount !== undefined) {
    const cleanedConfirm = confirmAccount.replace(/[^0-9]/g, '');
    if (cleaned !== cleanedConfirm) {
      return { isValid: false, cleaned, error: 'Bank account numbers do not match' };
    }
  }
  return { isValid: true, cleaned, formatted: cleaned };
}

/**
 * Validates delivery partner full name
 */
export function validateName(name: string): ValidationResult {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Name is required' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Name must be at least 3 characters' };
  }
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
    return { isValid: false, error: 'Name should only contain letters and spaces' };
  }
  return { isValid: true, formatted: trimmed };
}
