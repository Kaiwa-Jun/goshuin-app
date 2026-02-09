import {
  calculateDistance,
  getBoundingBox,
  DEFAULT_RADIUS_KM,
  RADIUS_STEPS,
  MIN_SPOTS_THRESHOLD,
  DEFAULT_LOCATION,
} from '@utils/geo';

describe('geo utilities', () => {
  describe('calculateDistance', () => {
    it('returns 0 for the same point', () => {
      const d = calculateDistance(35.6762, 139.6503, 35.6762, 139.6503);
      expect(d).toBe(0);
    });

    it('calculates distance between Tokyo and Osaka (~400km)', () => {
      // Tokyo Station: 35.6812, 139.7671
      // Osaka Station: 34.7024, 135.4959
      const d = calculateDistance(35.6812, 139.7671, 34.7024, 135.4959);
      expect(d).toBeGreaterThan(390);
      expect(d).toBeLessThan(410);
    });

    it('calculates short distance (~1km)', () => {
      // Sendai Station: 38.2601, 140.8822
      // ~1km north
      const d = calculateDistance(38.2601, 140.8822, 38.2691, 140.8822);
      expect(d).toBeGreaterThan(0.9);
      expect(d).toBeLessThan(1.1);
    });
  });

  describe('getBoundingBox', () => {
    it('returns bounding box around a point', () => {
      const box = getBoundingBox(38.2682, 140.8694, 2);
      expect(box.minLat).toBeLessThan(38.2682);
      expect(box.maxLat).toBeGreaterThan(38.2682);
      expect(box.minLng).toBeLessThan(140.8694);
      expect(box.maxLng).toBeGreaterThan(140.8694);
    });

    it('is symmetric around the center point', () => {
      const box = getBoundingBox(38.2682, 140.8694, 3);
      const latDiffSouth = 38.2682 - box.minLat;
      const latDiffNorth = box.maxLat - 38.2682;
      expect(latDiffSouth).toBeCloseTo(latDiffNorth, 4);
    });

    it('larger radius produces larger bounding box', () => {
      const small = getBoundingBox(38.2682, 140.8694, 2);
      const large = getBoundingBox(38.2682, 140.8694, 5);
      expect(large.maxLat - large.minLat).toBeGreaterThan(small.maxLat - small.minLat);
      expect(large.maxLng - large.minLng).toBeGreaterThan(small.maxLng - small.minLng);
    });
  });

  describe('constants', () => {
    it('DEFAULT_RADIUS_KM is 2', () => {
      expect(DEFAULT_RADIUS_KM).toBe(2);
    });

    it('RADIUS_STEPS is [2, 3, 5, 10]', () => {
      expect(RADIUS_STEPS).toEqual([2, 3, 5, 10]);
    });

    it('MIN_SPOTS_THRESHOLD is 5', () => {
      expect(MIN_SPOTS_THRESHOLD).toBe(5);
    });

    it('DEFAULT_LOCATION is Sendai city center', () => {
      expect(DEFAULT_LOCATION.latitude).toBeCloseTo(38.2682, 2);
      expect(DEFAULT_LOCATION.longitude).toBeCloseTo(140.8694, 2);
    });
  });
});
