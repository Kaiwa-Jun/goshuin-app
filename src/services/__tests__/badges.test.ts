import { evaluateNewBadge, getAllBadges } from '@services/badges';

describe('badges service', () => {
  describe('evaluateNewBadge', () => {
    it('returns "初めての御朱印" badge when visiting first spot', () => {
      const result = evaluateNewBadge(0, 1);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('初めての御朱印');
    });

    it('returns "5箇所達成" badge when reaching 5 spots', () => {
      const result = evaluateNewBadge(4, 5);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('5箇所達成');
    });

    it('returns only the highest threshold badge when skipping multiple thresholds', () => {
      const result = evaluateNewBadge(0, 10);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('10箇所達成');
    });

    it('returns null when count does not cross any threshold (re-visit)', () => {
      const result = evaluateNewBadge(5, 5);
      expect(result).toBeNull();
    });

    it('returns null when count does not cross any threshold', () => {
      const result = evaluateNewBadge(10, 11);
      expect(result).toBeNull();
    });
  });

  describe('getAllBadges', () => {
    it('returns all 6 badge definitions', () => {
      const badges = getAllBadges();
      expect(badges).toHaveLength(6);
    });

    it('includes badges with required fields', () => {
      const badges = getAllBadges();
      for (const badge of badges) {
        expect(badge).toHaveProperty('id');
        expect(badge).toHaveProperty('name');
        expect(badge).toHaveProperty('description');
        expect(badge).toHaveProperty('icon');
        expect(badge.condition.type).toBe('visit_count');
        expect(typeof badge.condition.threshold).toBe('number');
      }
    });
  });
});
