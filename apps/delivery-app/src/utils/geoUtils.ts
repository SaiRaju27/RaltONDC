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

/**
 * Real Map Tile representation for rendering Slippy Map layers
 */
export interface MapTile {
  key: string;
  url: string;
  x: number;
  y: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Projects (lat, lng) to global Web Mercator pixel coordinates at a given zoom level.
 */
export function latLngToMercatorPixels(
  lat: number,
  lng: number,
  zoom: number
): { px: number; py: number } {
  const n = Math.pow(2, zoom);
  const px = ((lng + 180) / 360) * n * 256;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const clampedRad = (clampedLat * Math.PI) / 180;
  const py = ((1 - Math.asinh(Math.tan(clampedRad)) / Math.PI) / 2) * n * 256;
  return { px, py };
}

/**
 * Projects a geographic coordinate into screen (x, y) relative to a given center and zoom.
 */
export function projectMercatorToScreen(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  width: number,
  height: number
): ProjectedPoint {
  const pt = latLngToMercatorPixels(lat, lng, zoom);
  const center = latLngToMercatorPixels(centerLat, centerLng, zoom);
  return {
    x: Math.round(pt.px - (center.px - width / 2)),
    y: Math.round(pt.py - (center.py - height / 2)),
  };
}

/**
 * Inverts Web Mercator pixel coordinates back into (lat, lng) at a given zoom level.
 */
export function mercatorPixelsToLatLng(
  px: number,
  py: number,
  zoom: number
): LatLng {
  const n = Math.pow(2, zoom);
  const lng = (px / (n * 256)) * 360 - 180;
  const yVal = 1 - (2 * py) / (n * 256);
  const clampedY = Math.max(-10, Math.min(10, yVal));
  const lat = (Math.atan(Math.sinh(Math.PI * clampedY)) * 180) / Math.PI;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

/**
 * Computes all required 256x256 map tiles to cover a viewport of (width x height) around (centerLat, centerLng).
 */
export function getVisibleTiles(
  centerLat: number,
  centerLng: number,
  zoom: number,
  width: number,
  height: number,
  tileUrlTemplate: string = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'
): MapTile[] {
  const center = latLngToMercatorPixels(centerLat, centerLng, zoom);
  const originX = center.px - width / 2;
  const originY = center.py - height / 2;

  // Add 1-tile buffer around edges for seamless panning and rotation coverage
  const minTileX = Math.floor(originX / 256) - 1;
  const maxTileX = Math.floor((originX + width) / 256) + 1;
  const minTileY = Math.floor(originY / 256) - 1;
  const maxTileY = Math.floor((originY + height) / 256) + 1;
  const maxTiles = Math.pow(2, zoom);

  const tiles: MapTile[] = [];
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    if (ty < 0 || ty >= maxTiles) continue;
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      const left = tx * 256 - originX;
      const top = ty * 256 - originY;
      const normalizedX = ((tx % maxTiles) + maxTiles) % maxTiles;
      const url = tileUrlTemplate
        .replace('{z}', String(zoom))
        .replace('{x}', String(normalizedX))
        .replace('{y}', String(ty));
      tiles.push({
        key: `${zoom}-${tx}-${ty}`,
        url,
        x: normalizedX,
        y: ty,
        left: Math.round(left),
        top: Math.round(top),
        width: 256,
        height: 256,
      });
    }
  }
  return tiles;
}

/**
 * Computes the optimal map zoom level so all provided coordinates fit inside the viewport with comfortable padding.
 */
export function calculateAutoZoom(
  coords: LatLng[],
  width: number,
  height: number,
  targetPadding: number = 50
): number {
  if (!coords || coords.length < 2) return 15;
  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  for (let z = 18; z >= 11; z--) {
    const p1 = latLngToMercatorPixels(minLat, minLng, z);
    const p2 = latLngToMercatorPixels(maxLat, maxLng, z);
    const spanX = Math.abs(p2.px - p1.px);
    const spanY = Math.abs(p2.py - p1.py);
    if (spanX <= width - targetPadding * 2 && spanY <= height - targetPadding * 2) {
      return z;
    }
  }
  return 13;
}

