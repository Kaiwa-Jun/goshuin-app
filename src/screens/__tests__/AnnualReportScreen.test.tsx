import { act, fireEvent, render, within } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';
import type { ComponentProps } from 'react';

import { AnnualReportScreen } from '@screens/AnnualReportScreen';
import { colors } from '@theme/colors';
import { buildAnnualReport, SCENE_MS, type AnnualSceneId } from '@utils/annualReport';
import { ANNUAL_REPORT_SAMPLES } from '@utils/annualReportSample';

jest.mock('@services/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

const mockUseAnnualReport = jest.fn();
jest.mock('@hooks/useAnnualReport', () => ({
  useAnnualReport: (...args: unknown[]) => mockUseAnnualReport(...args),
}));

type Props = ComponentProps<typeof AnnualReportScreen>;

const ALL: AnnualSceneId[] = [
  'cover',
  'count',
  'months',
  'map',
  'photos',
  'memory',
  'badges',
  'end',
];
const W = Dimensions.get('window').width;
const LEFT = { nativeEvent: { pageX: W * 0.2 } };
const RIGHT = { nativeEvent: { pageX: W * 0.8 } };

let reduceHandler: ((enabled: boolean) => void) | null = null;

function setup(params: Props['route']['params'] = { year: 2026, sample: 'full' }) {
  const navigation = { goBack: jest.fn() };
  const ui = render(
    <AnnualReportScreen
      navigation={navigation as unknown as Props['navigation']}
      route={{ key: 'AnnualReport-1', name: 'AnnualReport', params } as Props['route']}
    />
  );

  const style = (testID: string) =>
    StyleSheet.flatten(ui.getByTestId(testID).props.style) as Record<string, unknown>;
  const fill = (i: number) => parseFloat(String(style(`annual-report-bar-fill-${i}`).width));
  const scene = () => ALL.find(id => ui.queryByTestId(`annual-report-scene-${id}`) !== null);
  const rootTransform = () =>
    (style('annual-report').transform as Record<string, number>[]).reduce(
      (acc, t) => ({ ...acc, ...t }),
      {} as Record<string, number>
    );
  const stage = () => ui.getByTestId('annual-report-stage');
  const tap = (at: typeof LEFT, ms = 100) => {
    fireEvent(stage(), 'pressIn', at);
    advance(ms);
    fireEvent(stage(), 'pressOut', at);
  };

  return { ui, navigation, style, fill, scene, rootTransform, stage, tap };
}

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

/** useReduceMotion の Promise を流す */
const settle = () => act(async () => {});

beforeEach(() => {
  jest.useFakeTimers();
  reduceHandler = null;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
    event: string,
    handler: (enabled: boolean) => void
  ) => {
    if (event === 'reduceMotionChanged') reduceHandler = handler;
    return { remove: jest.fn() };
  }) as unknown as typeof AccessibilityInfo.addEventListener);
  mockUseAnnualReport.mockImplementation(
    jest.requireActual('@hooks/useAnnualReport').useAnnualReport
  );
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('AnnualReportScreen — 再生の骨組み', () => {
  it('AC-27: バーはシーンの数だけ。今のシーンは時計で伸びる', async () => {
    const { ui, fill } = setup();
    await settle();

    expect(ui.getAllByTestId(/^annual-report-bar-\d+$/)).toHaveLength(8);
    expect(fill(0)).toBe(0);

    advance(2400);
    expect(fill(0)).toBeGreaterThan(48);
    expect(fill(0)).toBeLessThan(52);
  });

  it('AC-27: 見本 few ではバーが5本', async () => {
    const { ui } = setup({ year: 2026, sample: 'few' });
    await settle();
    expect(ui.getAllByTestId(/^annual-report-bar-\d+$/)).toHaveLength(5);
  });

  it('AC-28: 表紙は 4800ms で次へ。前のバーは 100%、次は 0% から', async () => {
    const { scene, fill } = setup();
    await settle();

    advance(4700);
    expect(scene()).toBe('cover');

    advance(200);
    expect(scene()).toBe('count');
    expect(fill(0)).toBe(100);
    expect(fill(1)).toBeLessThan(3);
  });

  /*
   * 約38秒ぶんのフレームを JS の driver で描くので、ほかのテストより遅い（手元で約7秒）。
   * 既定の5秒で CI が揺れないように、このテストだけ長くしておく
   */
  it('AC-28: months → map → photos → memory → badges → end の順に進み、締めで止まる', async () => {
    const { scene, fill } = setup();
    await settle();

    const seen: (AnnualSceneId | undefined)[] = [scene()];
    for (let t = 0; t < 38400; t += 100) {
      advance(100);
      const now = scene();
      if (now !== seen[seen.length - 1]) seen.push(now);
    }
    expect(seen).toEqual(ALL);
    // 合計 37800ms の少し後（シーンの切り替えごとに1フレームほど遅れる）には締め
    expect(scene()).toBe('end');

    const total = ALL.reduce((sum, id) => sum + SCENE_MS[id], 0);
    expect(total).toBe(37800);

    advance(60000);
    expect(scene()).toBe('end');
    expect(fill(7)).toBe(100);
  }, 30000);

  it('AC-29: 押している間は止まり、260ms 後に「止まっています」。離すと続きから', async () => {
    const { ui, scene, fill, stage } = setup();
    await settle();

    advance(1000);
    fireEvent(stage(), 'pressIn', RIGHT);
    advance(259);
    expect(ui.queryByTestId('annual-report-paused')).toBeNull();

    advance(3000 - 259);
    expect(scene()).toBe('cover');
    expect(fill(0)).toBeGreaterThan(19.8);
    expect(fill(0)).toBeLessThan(21.8);
    expect(ui.getByText('止まっています')).toBeTruthy();

    fireEvent(stage(), 'pressOut', RIGHT);
    expect(ui.queryByTestId('annual-report-paused')).toBeNull();
    expect(scene()).toBe('cover');

    advance(3700);
    expect(scene()).toBe('cover');
    advance(200);
    expect(scene()).toBe('count');
  });

  it('AC-30: 右を押すと次、左を押すと前のシーンの頭', async () => {
    const { scene, fill, tap } = setup();
    await settle();

    tap(RIGHT);
    expect(scene()).toBe('count');
    expect(fill(1)).toBe(0);

    advance(1000);
    tap(LEFT);
    expect(scene()).toBe('cover');
    expect(fill(0)).toBe(0);
  });

  it('AC-30: 最初のシーンで左を押しても、そのシーンの頭', async () => {
    const { scene, fill, tap } = setup();
    await settle();

    advance(2000);
    tap(LEFT);
    expect(scene()).toBe('cover');
    expect(fill(0)).toBe(0);
  });

  it('AC-30: 締めで右を押しても締めのまま', async () => {
    const { scene, tap } = setup();
    await settle();

    for (let i = 0; i < 7; i += 1) tap(RIGHT);
    expect(scene()).toBe('end');
    tap(RIGHT);
    expect(scene()).toBe('end');
  });

  it('長く押して離したら、前後には動かない', async () => {
    const { scene, tap } = setup();
    await settle();

    tap(RIGHT, 400);
    expect(scene()).toBe('cover');
  });

  it('AC-31: ✕ で閉じる', async () => {
    const { ui, navigation } = setup();
    await settle();

    fireEvent.press(ui.getByLabelText('閉じる'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('AC-32: 開く動き（薄く小さい → はっきり）', async () => {
    const { style, rootTransform } = setup();

    expect(style('annual-report').opacity).toBeCloseTo(0);
    expect(rootTransform().scale).toBeCloseTo(0.96);

    await settle();
    advance(350);
    expect(style('annual-report').opacity).toBeCloseTo(1);
    expect(rootTransform().scale).toBeCloseTo(1);
  });

  it('開く動きの間も、下は和紙の地（ナビゲーションの灰色が透けない。S11 のシミュレータで見つけた）', () => {
    const { ui, style } = setup();
    const backdrop = ui.getByTestId('annual-report-backdrop');
    expect(StyleSheet.flatten(backdrop.props.style).backgroundColor).toBe(colors.washi);
    expect(within(backdrop).getByTestId('annual-report')).toBeTruthy();
    expect(style('annual-report').opacity).toBeCloseTo(0);
  });

  it('AC-33: 視差効果を減らす なら最後の形ですぐ出し、自動では進まない', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { ui, style, rootTransform, fill, scene, stage, tap } = setup();
    await settle();

    expect(style('annual-report').opacity).toBeCloseTo(1);
    expect(rootTransform().scale).toBeCloseTo(1);
    expect(fill(0)).toBe(100);

    advance(60000);
    expect(scene()).toBe('cover');

    fireEvent(stage(), 'pressIn', RIGHT);
    advance(1000);
    expect(ui.queryByTestId('annual-report-paused')).toBeNull();
    fireEvent(stage(), 'pressOut', RIGHT);
    expect(scene()).toBe('cover');

    tap(RIGHT);
    expect(scene()).toBe('count');
    expect(fill(1)).toBe(100);
    // 数え上げは最後の値から（listener を待たない）
    expect(ui.getByTestId('annual-count-spots').props.children).toBe(24);
  });

  it('AC-34: 途中で視差効果を減らす がオンになったら、その場で最後の形にして止まる', async () => {
    const { scene, fill } = setup();
    await settle();

    advance(1000);
    expect(fill(0)).toBeLessThan(30);
    act(() => reduceHandler?.(true));
    expect(fill(0)).toBe(100);

    advance(10000);
    expect(scene()).toBe('cover');
  });

  it('AC-45: 締めの「もう一度見る」で表紙の頭から（開く動きも）。前後には動かない', async () => {
    const { ui, scene, fill, style, tap } = setup();
    await settle();
    advance(400);

    for (let i = 0; i < 7; i += 1) tap(RIGHT);
    expect(scene()).toBe('end');
    advance(2000);

    fireEvent.press(ui.getByText('もう一度見る'));
    expect(scene()).toBe('cover');
    expect(fill(0)).toBe(0);
    expect(style('annual-report').opacity).toBeCloseTo(0);
    advance(350);
    expect(style('annual-report').opacity).toBeCloseTo(1);
  });

  it('AC-45: 締めの「閉じる」で閉じる。締めのまま', async () => {
    const { ui, scene, navigation, tap } = setup();
    await settle();

    for (let i = 0; i < 7; i += 1) tap(RIGHT);
    fireEvent.press(ui.getByText('閉じる'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(scene()).toBe('end');
  });
});

describe('AnnualReportScreen — 読み込み中・空・失敗', () => {
  it('AC-35: 読み込み中は ✕ と読み込みの印', () => {
    mockUseAnnualReport.mockReturnValue({ status: 'loading', report: null });
    const { ui } = setup({ year: 2026 });

    expect(ui.getByTestId('annual-report-loading')).toBeTruthy();
    expect(ui.getByLabelText('閉じる')).toBeTruthy();
  });

  it('AC-35: 空なら「{年}年の記録はまだありません」と「閉じる」', () => {
    mockUseAnnualReport.mockReturnValue({ status: 'empty', report: null });
    const { ui, navigation } = setup({ year: 2026 });

    expect(ui.getByTestId('annual-report-empty')).toBeTruthy();
    expect(ui.getByText('2026年の記録はまだありません')).toBeTruthy();
    fireEvent.press(ui.getByText('閉じる'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('AC-35: 失敗なら「ふりかえりを読み込めませんでした」と「閉じる」', () => {
    mockUseAnnualReport.mockReturnValue({ status: 'error', report: null });
    const { ui, navigation } = setup({ year: 2026 });

    expect(ui.getByTestId('annual-report-error')).toBeTruthy();
    expect(ui.getByText('ふりかえりを読み込めませんでした')).toBeTruthy();
    fireEvent.press(ui.getByText('閉じる'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('見本を渡したとき、hook に年と見本をそのまま渡す', () => {
    setup({ year: 2026, sample: 'few' });
    expect(mockUseAnnualReport).toHaveBeenCalledWith({ year: 2026, sample: 'few' });
  });
});

describe('AnnualReportScreen — 見た目（UI-1）', () => {
  it('地は和紙。バーの地は墨色の 0.22、進みは墨色、高さ 3', async () => {
    const { style } = setup();
    await settle();

    expect(style('annual-report').backgroundColor).toBe(colors.washi);
    expect(style('annual-report-bar-track-0')).toMatchObject({
      backgroundColor: colors.gray[900],
      opacity: 0.22,
    });
    expect(style('annual-report-bar-fill-0').backgroundColor).toBe(colors.gray[900]);
    expect(style('annual-report-bar-0').height).toBe(3);
  });

  it('✕ は close・26・墨色・0.6', async () => {
    const { ui } = setup();
    await settle();

    const icon = ui.getByText('close');
    expect(icon.props.size).toBe(26);
    expect(icon.props.color).toBe(colors.gray[900]);
    expect(StyleSheet.flatten(icon.props.style).opacity).toBe(0.6);
  });

  it('「止まっています」の地は sumi の 0.8、字は白', async () => {
    const { ui, style, stage } = setup();
    await settle();

    fireEvent(stage(), 'pressIn', RIGHT);
    advance(300);
    expect(style('annual-report-paused-bg')).toMatchObject({
      backgroundColor: colors.sumi,
      opacity: 0.8,
    });
    expect(StyleSheet.flatten(ui.getByText('止まっています').props.style).color).toBe(colors.white);
    fireEvent(stage(), 'pressOut', RIGHT);
  });

  it('見本 full の年報は8シーン', () => {
    const report = buildAnnualReport({
      year: 2026,
      currentYear: 2026,
      ...ANNUAL_REPORT_SAMPLES.full,
    });
    expect(report?.scenes).toEqual(ALL);
  });
});
