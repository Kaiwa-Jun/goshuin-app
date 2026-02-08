import { colors, typography, spacing, borderRadius, shadows } from '@theme/index';

describe('Theme', () => {
  describe('colors', () => {
    it('should export primary color palette', () => {
      expect(colors.primary[500]).toBe('#f27f0d');
      expect(colors.primary[50]).toBeDefined();
      expect(colors.primary[900]).toBeDefined();
    });

    it('should export shrine colors', () => {
      expect(colors.shrine[500]).toBe('#EF4444');
      expect(colors.shrine[100]).toBe('#FEE2E2');
      expect(colors.shrine[600]).toBe('#DC2626');
    });

    it('should export temple colors', () => {
      expect(colors.temple[500]).toBe('#A855F7');
      expect(colors.temple[100]).toBe('#F3E8FF');
      expect(colors.temple[600]).toBe('#9333EA');
    });

    it('should export pin colors', () => {
      expect(colors.pin.shrineVisited).toBe('#EF4444');
      expect(colors.pin.templeVisited).toBe('#A855F7');
      expect(colors.pin.unvisited).toBe('#9CA3AF');
      expect(colors.pin.currentLocation).toBe('#3B82F6');
    });

    it('should export semantic colors', () => {
      expect(colors.background).toBe('#FFFFFF');
      expect(colors.surface).toBe('#F9FAFB');
      expect(colors.success).toBeDefined();
      expect(colors.error).toBeDefined();
    });
  });

  describe('typography', () => {
    it('should export heading styles', () => {
      expect(typography.h1.fontSize).toBe(28);
      expect(typography.h2.fontSize).toBe(22);
      expect(typography.h3.fontSize).toBe(18);
    });

    it('should export body styles', () => {
      expect(typography.body.fontSize).toBe(16);
      expect(typography.bodySmall.fontSize).toBe(14);
    });

    it('should export label and button styles', () => {
      expect(typography.label.fontSize).toBe(12);
      expect(typography.button.fontSize).toBe(16);
      expect(typography.buttonSmall.fontSize).toBe(14);
    });
  });

  describe('spacing', () => {
    it('should export spacing scale', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(12);
      expect(spacing.lg).toBe(16);
      expect(spacing.xl).toBe(20);
    });
  });

  describe('borderRadius', () => {
    it('should export border radius scale', () => {
      expect(borderRadius.sm).toBe(4);
      expect(borderRadius.md).toBe(8);
      expect(borderRadius.lg).toBe(12);
      expect(borderRadius.full).toBe(9999);
    });
  });

  describe('shadows', () => {
    it('should export shadow styles', () => {
      expect(shadows.sm.shadowOpacity).toBe(0.05);
      expect(shadows.md.shadowOpacity).toBe(0.1);
      expect(shadows.lg.shadowOpacity).toBe(0.15);
    });

    it('should include elevation for Android', () => {
      expect(shadows.sm.elevation).toBe(1);
      expect(shadows.md.elevation).toBe(3);
      expect(shadows.lg.elevation).toBe(5);
    });
  });
});
