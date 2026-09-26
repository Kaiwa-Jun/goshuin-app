import { act } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';

import { buildAnnualReport, type AnnualReport } from '@utils/annualReport';
import { ANNUAL_REPORT_SAMPLES } from '@utils/annualReportSample';

/** 見本 full の年報（8シーン） */
export const fullReport = (currentYear = 2026): AnnualReport =>
  buildAnnualReport({
    year: 2026,
    currentYear,
    ...ANNUAL_REPORT_SAMPLES.full,
  }) as AnnualReport;

export const newClock = (t = 0) => new Animated.Value(t);

/** 時計を t に置く（シーンの部品は時計から style を作る） */
export const at = (clock: Animated.Value, t: number) =>
  act(() => {
    clock.setValue(t);
  });

type El = { props: { style?: unknown } };

export const styleOf = (el: El) => StyleSheet.flatten(el.props.style) as Record<string, unknown>;

/** transform の配列を1つのオブジェクトにまとめる */
export const transformOf = (el: El) =>
  ((styleOf(el).transform as Record<string, unknown>[] | undefined) ?? []).reduce<
    Record<string, unknown>
  >((acc, t) => ({ ...acc, ...t }), {});

export const num = (v: unknown) => parseFloat(String(v));

/** react-native-svg は fill / stroke を { type, payload }（ARGB の数）にして渡す */
export const asPayload = (hex: string) => 0xff000000 + parseInt(hex.slice(1), 16);
export const paintOf = (el: { props: Record<string, unknown> }, key: 'fill' | 'stroke') =>
  (el.props[key] as { payload?: number } | undefined)?.payload;
