/**
 * Geographic Math and Telemetry Utilities for Real-Time Tracking
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

/**
 * Calculates Great-Circle distance between two coordinates using Haversine formula (in meters).
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates initial bearing from point 1 to point 2 in degrees (0 - 360°).
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  const bearing = ((theta * 180) / Math.PI + 360) % 360;
  return Math.round(bearing);
}

/**
 * Calculates dynamic delivery ETA in minutes based on distance and vehicle speed.
 * Defaults to 25 km/h for dense urban 2-wheeler delivery if speed is 0 or stopped.
 */
export function calculateEtaMinutes(
  distanceMeters: number,
  speedKmh: number = 0
): number {
  if (distanceMeters <= 50) return 1;
  const effectiveSpeedKmh = speedKmh > 5 ? Math.min(speedKmh, 50) : 25;
  const speedMetersPerMin = (effectiveSpeedKmh * 1000) / 60;
  const rawMinutes = distanceMeters / speedMetersPerMin;
  // Add 1.5 min urban buffer for traffic lights & turns
  return Math.max(1, Math.ceil(rawMinutes + 1.5));
}

/**
 * Human-readable distance formatter
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

/**
 * Human-readable ETA formatter
 */
export function formatEta(minutes: number): string {
  if (minutes <= 1) return '< 1 min';
  if (minutes < 60) return `${minutes} mins`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs} hr`;
}

/**
 * Normalizes latitude and longitude coordinates into 2D canvas pixel coordinates
 * with proportional bounding-box scaling and aspect ratio preservation.
 */
export function projectCoordinates(
  coords: LatLng[],
  width: number = 360,
  height: number = 240,
  padding: number = 40
): ProjectedPoint[] {
  if (!coords || coords.length === 0) return [];
  if (coords.length === 1) {
    return [{ x: width / 2, y: height / 2 }];
  }

  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latSpan = Math.max(maxLat - minLat, 0.002);
  const lngSpan = Math.max(maxLng - minLng, 0.002);

  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  return coords.map((c) => {
    const normX = (c.lng - minLng) / lngSpan;
    // Latitude decreases as pixel Y increases (top-to-bottom)
    const normY = 1 - (c.lat - minLat) / latSpan;

    return {
      x: Math.round(padding + normX * drawWidth),
      y: Math.round(padding + normY * drawHeight),
    };
  });
}

/**
 * Interpolates intermediate point along line between point A and point B
 */
export function interpolateLatLng(a: LatLng, b: LatLng, fraction: number): LatLng {
  const f = Math.max(0, Math.min(1, fraction));
  return {
    lat: Number((a.lat + (b.lat - a.lat) * f).toFixed(6)),
    lng: Number((a.lng + (b.lng - a.lng) * f).toFixed(6)),
  };
}
