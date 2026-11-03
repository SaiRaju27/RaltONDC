import {
  calculateDistanceMeters,
  calculateBearing,
  calculateEtaMinutes,
  formatDistance,
  formatEta,
  projectCoordinates,
  interpolateLatLng,
  latLngToMercatorPixels,
  projectMercatorToScreen,
  mercatorPixelsToLatLng,
  getVisibleTiles,
  calculateAutoZoom,
} from '../src/utils/geoUtils';

describe('Geographic Math & Telemetry Suite', () => {
  // Hyderabad Landmark Coordinates (Hitec City Cyber Towers to Inorbit Mall)
  const CYBER_TOWERS = { lat: 17.4504, lng: 78.3808 };
  const INORBIT_MALL = { lat: 17.4338, lng: 78.3867 };

  describe('calculateDistanceMeters', () => {
    it('returns 0 when coordinates are identical', () => {
      expect(calculateDistanceMeters(17.45, 78.38, 17.45, 78.38)).toBe(0);
    });

    it('calculates accurate distance between Hyderabad coordinates', () => {
      const dist = calculateDistanceMeters(
        CYBER_TOWERS.lat,
        CYBER_TOWERS.lng,
        INORBIT_MALL.lat,
        INORBIT_MALL.lng
      );
      // Roughly 1.9 km
      expect(dist).toBeGreaterThan(1700);
      expect(dist).toBeLessThan(2100);
    });
  });

  describe('calculateBearing', () => {
    it('returns 0 for identical points', () => {
      expect(calculateBearing(17.45, 78.38, 17.45, 78.38)).toBe(0);
    });

    it('calculates direction from north to south (~180 degrees)', () => {
      const bearing = calculateBearing(17.50, 78.38, 17.40, 78.38);
      expect(bearing).toBe(180);
    });

    it('calculates direction from west to east (~90 degrees)', () => {
      const bearing = calculateBearing(17.40, 78.30, 17.40, 78.40);
      expect(bearing).toBe(90);
    });
  });

  describe('calculateEtaMinutes', () => {
    it('returns 1 minute for near arrivals (< 50m)', () => {
      expect(calculateEtaMinutes(30)).toBe(1);
    });

    it('calculates realistic ETA for 2 km distance', () => {
      const eta = calculateEtaMinutes(2000, 30);
      // At 30 km/h: 2000m / 500m/min = 4 min + 1.5 min buffer = 6 min
      expect(eta).toBe(6);
    });

    it('uses default urban speed fallback when vehicle speed is zero or low', () => {
      const eta = calculateEtaMinutes(1000, 0);
      expect(eta).toBeGreaterThan(1);
      expect(eta).toBeLessThan(10);
    });
  });

  describe('formatDistance', () => {
    it('formats meters under 1km', () => {
      expect(formatDistance(450)).toBe('450 m');
    });

    it('formats kilometers for >= 1000m', () => {
      expect(formatDistance(2400)).toBe('2.4 km');
    });
  });

  describe('formatEta', () => {
    it('formats sub-minute arrival', () => {
      expect(formatEta(1)).toBe('< 1 min');
    });

    it('formats minutes', () => {
      expect(formatEta(8)).toBe('8 mins');
    });

    it('formats hours and minutes', () => {
      expect(formatEta(75)).toBe('1h 15m');
      expect(formatEta(120)).toBe('2 hr');
    });
  });

  describe('projectCoordinates', () => {
    it('handles empty input safely', () => {
      expect(projectCoordinates([])).toEqual([]);
    });

    it('centers single coordinate', () => {
      const projected = projectCoordinates([CYBER_TOWERS], 400, 300, 20);
      expect(projected).toEqual([{ x: 200, y: 150 }]);
    });

    it('projects multiple coordinates within canvas bounds', () => {
      const coords = [CYBER_TOWERS, INORBIT_MALL];
      const projected = projectCoordinates(coords, 400, 300, 30);
      expect(projected.length).toBe(2);
      expect(projected[0].x).toBeGreaterThanOrEqual(30);
      expect(projected[0].x).toBeLessThanOrEqual(370);
      expect(projected[0].y).toBeGreaterThanOrEqual(30);
      expect(projected[0].y).toBeLessThanOrEqual(270);
    });
  });

  describe('interpolateLatLng', () => {
    it('interpolates midpoint accurately', () => {
      const start = { lat: 10, lng: 20 };
      const end = { lat: 20, lng: 40 };
      const mid = interpolateLatLng(start, end, 0.5);
      expect(mid.lat).toBe(15);
      expect(mid.lng).toBe(30);
    });

    it('clamps fraction between 0 and 1', () => {
      const start = { lat: 10, lng: 20 };
      const end = { lat: 20, lng: 40 };
      expect(interpolateLatLng(start, end, -0.5)).toEqual(start);
      expect(interpolateLatLng(start, end, 1.5)).toEqual(end);
    });
  });

  describe('Web Mercator Tile Math', () => {
    it('latLngToMercatorPixels projects equator and poles within finite bounds', () => {
      const equator = latLngToMercatorPixels(0, 0, 10);
      expect(equator.px).toBeGreaterThan(0);
      expect(equator.py).toBeGreaterThan(0);

      const highLat = latLngToMercatorPixels(89, 78, 12);
      expect(Number.isFinite(highLat.px)).toBe(true);
      expect(Number.isFinite(highLat.py)).toBe(true);
    });

    it('projectMercatorToScreen centers point when coordinates match center', () => {
      const screenPt = projectMercatorToScreen(17.3457, 78.5522, 17.3457, 78.5522, 15, 360, 240);
      expect(screenPt.x).toBe(180);
      expect(screenPt.y).toBe(120);
    });

    it('mercatorPixelsToLatLng accurately inverts pixel coordinates', () => {
      const orig = { lat: 17.3457, lng: 78.5522 };
      const px = latLngToMercatorPixels(orig.lat, orig.lng, 15);
      const inv = mercatorPixelsToLatLng(px.px, px.py, 15);
      expect(Math.abs(inv.lat - orig.lat)).toBeLessThan(0.0001);
      expect(Math.abs(inv.lng - orig.lng)).toBeLessThan(0.0001);
    });

    it('getVisibleTiles generates correct grid of Slippy map tiles', () => {
      const tiles = getVisibleTiles(17.3457, 78.5522, 15, 360, 240);
      expect(tiles.length).toBeGreaterThanOrEqual(4);
      expect(tiles[0].url).toContain('https://basemaps.cartocdn.com/rastertiles/voyager/15/');
      expect(tiles[0].width).toBe(256);
      expect(tiles[0].height).toBe(256);
    });

    it('calculateAutoZoom computes appropriate zoom level for distance', () => {
      const lbNagar = { lat: 17.3457, lng: 78.5522 };
      const kothapet = { lat: 17.3625, lng: 78.5412 };
      const autoZ = calculateAutoZoom([lbNagar, kothapet], 360, 240, 40);
      expect(autoZ).toBeGreaterThanOrEqual(12);
      expect(autoZ).toBeLessThanOrEqual(16);

      // Single or empty coord fallback
      expect(calculateAutoZoom([lbNagar], 360, 240)).toBe(15);
      expect(calculateAutoZoom([], 360, 240)).toBe(15);
    });
  });
});

