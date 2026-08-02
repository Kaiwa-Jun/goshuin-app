import {
  CLUSTER_REGION_DEBOUNCE_MS,
  HYSTERESIS_CENTER_RATIO,
  HYSTERESIS_DELTA_RATIO,
  shouldRecomputeRegion,
} from '@utils/regionHysteresis';
import { VIEWPORT_MARGIN, type MapRegion } from '@utils/spotSelection';

const baseRegion: MapRegion = {
  latitude: 38.2682,
  longitude: 140.8694,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

describe('shouldRecomputeRegion', () => {
  it('AC-16: prev が null なら常に true', () => {
    expect(shouldRecomputeRegion(null, baseRegion)).toBe(true);
  });

  it('AC-17: 中心移動が delta の 9% なら false（再計算しない）', () => {
    const next = { ...baseRegion, latitude: baseRegion.latitude + 0.009 };
    expect(shouldRecomputeRegion(baseRegion, next)).toBe(false);
  });

  it('AC-18: 中心移動が delta の 11% なら true（再計算する）', () => {
    const next = { ...baseRegion, latitude: baseRegion.latitude + 0.011 };
    expect(shouldRecomputeRegion(baseRegion, next)).toBe(true);
  });

  it('AC-19: delta が +21% なら true（再計算する）', () => {
    const next = { ...baseRegion, latitudeDelta: 0.121, longitudeDelta: 0.121 };
    expect(shouldRecomputeRegion(baseRegion, next)).toBe(true);
  });

  it('AC-20: delta が +19% なら false（再計算しない）', () => {
    const next = { ...baseRegion, latitudeDelta: 0.119, longitudeDelta: 0.119 };
    expect(shouldRecomputeRegion(baseRegion, next)).toBe(false);
  });

  it('AC-41: クラスタ region 採用のデバウンスが 300ms である', () => {
    expect(CLUSTER_REGION_DEBOUNCE_MS).toBe(300);
  });

  it('AC-21: ヒステリシス定数が VIEWPORT_MARGIN から導出した不変条件を満たす', () => {
    expect(HYSTERESIS_CENTER_RATIO).toBe(0.1);
    expect(HYSTERESIS_DELTA_RATIO).toBe(0.2);
    // (1.2 - 1) は浮動小数点で 0.1999... になるため厳密比較には 1e-12 の許容誤差が要る
    expect(HYSTERESIS_CENTER_RATIO).toBeLessThanOrEqual((VIEWPORT_MARGIN - 1) / 2 + 1e-12);
    expect(HYSTERESIS_DELTA_RATIO).toBeLessThanOrEqual(VIEWPORT_MARGIN - 1 + 1e-12);
  });
});
