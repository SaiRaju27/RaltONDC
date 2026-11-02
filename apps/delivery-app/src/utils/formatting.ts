/**
 * Enterprise Formatting Utilities for Delivery Partner UI
 * User-facing display helpers adhering to Indian numbering and zero technical jargon
 */

/**
 * Formats monetary amounts in Indian Rupee format (₹)
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  const numeric = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  if (isNaN(numeric)) return '₹0';
  return `₹${Math.round(numeric).toLocaleString('en-IN')}`;
}

/**
 * Formats distance with appropriate units (m or km)
 */
export function formatDistance(kmOrMeters: number, isKm: boolean = true): string {
  if (kmOrMeters <= 0) return '0 m';
  if (isKm) {
    if (kmOrMeters < 1) {
      return `${Math.round(kmOrMeters * 1000)} m`;
    }
    return `${kmOrMeters.toFixed(1)} km`;
  } else {
    if (kmOrMeters >= 1000) {
      return `${(kmOrMeters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(kmOrMeters)} m`;
  }
}

/**
 * Masks bank account number, exposing only the last 4 digits
 */
export function maskAccountNumber(account?: string): string {
  if (!account) return '•••• ••••';
  const clean = account.replace(/[^0-9]/g, '');
  if (clean.length < 4) return clean;
  return `•••• •••• ${clean.slice(-4)}`;
}

/**
 * Masks Aadhaar number, exposing only the last 4 digits (UIDAI compliance)
 */
export function maskAadhaar(aadhaar?: string): string {
  if (!aadhaar) return '•••• •••• ••••';
  const clean = aadhaar.replace(/[^0-9]/g, '');
  if (clean.length < 4) return clean;
  return `•••• •••• ${clean.slice(-4)}`;
}

/**
 * Formats partner rating to single decimal place (e.g. 4.9)
 */
export function formatPartnerRating(rating?: number): string {
  if (typeof rating !== 'number' || rating <= 0) return '5.0';
  return Math.min(5.0, Math.max(1.0, rating)).toFixed(1);
}

/**
 * Formats timestamp to 12-hour clock (e.g. "02:30 PM")
 */
export function formatTime(timestamp?: string | number | Date): string {
  if (!timestamp) return '--:--';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '--:--';
  }
}

