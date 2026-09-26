import React from 'react';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';
import { Animated, Image, StyleSheet } from 'react-native';
import { GalleryScreen } from '@screens/GalleryScreen';
import { useGalleryStamps } from '@hooks/useGalleryStamps';
import { ensureStampVariants } from '@services/stamps';
import {
  isLoadingClockRunning,
  loadingClock,
  resetLoadingClockForTests,
} from '@components/gallery/loadingClock';
import { colors } from '@theme/colors';
import type { StampWithSpot } from '@/types/supabase';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

let mockAuth: { user: { id: string } | null; isAuthenticated: boolean } = {
  user: { id: 'user-1' },
  isAuthenticated: true,
};

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@hooks/useGalleryStamps', () => ({
  useGalleryStamps: jest.fn(),
}));

const mockHandleDelete = jest.fn();

jest.mock('@hooks/useStampDetail', () => ({
  useStampDetail: () => ({
    stamp: null,
    isLoading: false,
    error: null,
    isUpdating: false,
    isDeleting: false,
    handleUpdate: jest.fn(),
    handleDelete: (...args: unknown[]) => mockHandleDelete(...args),
    refresh: jest.fn(),
  }),
}));

/*
 * 実物の useHeroTransition は measureInWindow が返らないテスト環境では飛ばずに開く。
 * 削除後の後始末（飛ばした1枚を手放すか）を見るため、end だけ観測できる形にする
 */
const mockHeroEnd = jest.fn();
jest.mock('@hooks/useHeroTransition', () => ({
  useHeroTransition: () => ({
    flight: null,
    registerTile: jest.fn(),
    rememberAspect: jest.fn(),
    start: (_params: unknown, onReady: (started: boolean) => void) => onReady(false),
    turnBack: jest.fn(),
    end: (...args: unknown[]) => mockHeroEnd(...args),
  }),
}));

jest.mock('@services/stamps', () => ({
  getStampImageUrl: jest.fn((path: string) => `https://example.com/${path}`),
  getStampThumbUrl: jest.fn((path: string) => `https://example.com/thumb-400/${path}`),
  getStampViewUrl: jest.fn((path: string) => `https://example.com/view-1200/${path}`),
  ensureStampVariants: jest.fn(() => Promise.resolve()),
}));

jest
  .spyOn(Image, 'getSize')
  .mockImplementation((_uri: string, success: (width: number, height: number) => void) => {
    success(800, 1200);
  });

const mockUseGalleryStamps = useGalleryStamps as jest.MockedFunction<typeof useGalleryStamps>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(),
  canGoBack: jest.fn(),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
};

const mockRoute = { key: 'test', name: 'Gallery' as const, params: undefined };

/*
 * 読み込み中の動きの時計（Issue #275）。本物の loop を回すと値がネイティブ扱いになり、
 * 後のテストで setValue が描画に届かなくなることがある。呼ぶたびに新しいスタブを返す
 */
type Anim = { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };
const stubAnim = (): Anim => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
let loopSpy: jest.SpyInstance;

beforeEach(() => {
  resetLoadingClockForTests();
  loopSpy = jest
    .spyOn(Animated, 'loop')
    .mockImplementation(() => stubAnim() as unknown as Animated.CompositeAnimation);
});

afterEach(() => {
  loopSpy.mockRestore();
  act(() => resetLoadingClockForTests());
});

function renderGalleryScreen() {
  return render(<GalleryScreen navigation={mockNavigation as never} route={mockRoute} />);
}

/**
 * 既定の表示モードはめくり（Issue #116）。グリッド前提のケースはここを通す。
 * アサーションの中身は変えず、モードを切り替える1行を前置きするだけにしている。
 */
function renderGalleryScreenInGrid() {
  const utils = renderGalleryScreen();
  fireEvent.press(utils.getByTestId('view-mode-grid'));
  return utils;
}

const makeStamp = (overrides: Partial<StampWithSpot> = {}): StampWithSpot => ({
  id: '1',
  user_id: 'user-1',
  spot_id: 'spot-1',
  goshuincho_id: null,
  visited_at: '2024-01-15',
  image_path: 'user-1/stamp-1.jpg',
  memo: null,
  is_public: false,
  extracted_info: null,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  spots: { name: '明治神宮', type: 'shrine' },
  ...overrides,
});

describe('GalleryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = { user: { id: 'user-1' }, isAuthenticated: true };
  });

  it('ローディング中に ActivityIndicator を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: true,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = renderGalleryScreen();
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('スタンプデータがある場合にスポット名を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', spots: { name: '明治神宮', type: 'shrine' } })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByText } = renderGalleryScreenInGrid();
    expect(getByText('明治神宮')).toBeTruthy();
  });

  it('スタンプデータがある場合に画像を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', image_path: 'user-1/stamp-1.jpg' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = renderGalleryScreenInGrid();
    expect(getByTestId('stamp-image-1')).toBeTruthy();
  });

  it('スタンプがない場合に空状態メッセージを表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = renderGalleryScreenInGrid();
    expect(getByTestId('empty-state')).toBeTruthy();
  });

  it('ソートボタンを押すと sortOrder が切り替わる', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId, getByText } = renderGalleryScreenInGrid();
    expect(getByText('日付順 ▼')).toBeTruthy();
    fireEvent.press(getByTestId('sort-button'));
    expect(getByText('スポット順 ▼')).toBeTruthy();
  });

  it('date ソート時に訪問日を表示する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', visited_at: '2024-01-15' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByText } = renderGalleryScreenInGrid();
    expect(getByText('2024/01/15')).toBeTruthy();
  });

  it('spot ソート時に訪問日を表示しない', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1', visited_at: '2024-01-15' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId, queryByText } = renderGalleryScreenInGrid();
    fireEvent.press(getByTestId('sort-button'));
    expect(queryByText('2024/01/15')).toBeNull();
  });

  // 位置を測ってから飛ばすので、開くのは1フレーム後になった（Issue #192）。
  // 測れない環境では演出を飛ばして開く。開かないのが一番まずい
  it('アイテムタップでギャラリーモーダルが開く', async () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: 'stamp-abc' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = renderGalleryScreenInGrid();
    fireEvent.press(getByTestId('gallery-item-stamp-abc'));

    await waitFor(() => {
      expect(getByTestId('gallery-image')).toBeTruthy();
    });
  });

  describe('表示モードの切り替え（Issue #116）', () => {
    const withStamps = (stamps: StampWithSpot[]) =>
      mockUseGalleryStamps.mockReturnValue({
        stamps,
        totalCount: stamps.length,
        isLoading: false,
        error: null,
        removeStamp: jest.fn(),
        updateStamp: jest.fn(),
      });

    it('既定でめくり表示になり、グリッドは出ない', () => {
      withStamps([makeStamp({ id: '1' })]);
      const { getByTestId, queryByTestId } = renderGalleryScreen();
      expect(getByTestId('flip-list')).toBeTruthy();
      expect(queryByTestId('gallery-list')).toBeNull();
    });

    it('グリッドに切り替えるとめくりが消える', () => {
      withStamps([makeStamp({ id: '1' })]);
      const { getByTestId, queryByTestId } = renderGalleryScreen();
      fireEvent.press(getByTestId('view-mode-grid'));
      expect(getByTestId('gallery-list')).toBeTruthy();
      expect(queryByTestId('flip-list')).toBeNull();
    });

    it('めくりに戻すとグリッドが消える', () => {
      withStamps([makeStamp({ id: '1' })]);
      const { getByTestId, queryByTestId } = renderGalleryScreen();
      fireEvent.press(getByTestId('view-mode-grid'));
      fireEvent.press(getByTestId('view-mode-flip'));
      expect(getByTestId('flip-list')).toBeTruthy();
      expect(queryByTestId('gallery-list')).toBeNull();
    });

    it('ソートボタンはグリッドモードでのみ出る', () => {
      withStamps([makeStamp({ id: '1' })]);
      const { getByTestId, queryByTestId } = renderGalleryScreen();
      expect(queryByTestId('sort-button')).toBeNull();
      fireEvent.press(getByTestId('view-mode-grid'));
      expect(getByTestId('sort-button')).toBeTruthy();
    });

    it('未ログイン時は表示切り替えトグルを出さない', () => {
      mockAuth = { user: null, isAuthenticated: false };
      withStamps([]);
      const { queryByTestId } = renderGalleryScreen();
      expect(queryByTestId('view-mode-toggle')).toBeNull();
    });

    it('ログイン済みなら表示切り替えトグルを出す', () => {
      withStamps([]);
      const { getByTestId } = renderGalleryScreen();
      expect(getByTestId('view-mode-toggle')).toBeTruthy();
    });

    it('ローディング中はめくり表示を出さない', () => {
      mockUseGalleryStamps.mockReturnValue({
        stamps: [],
        totalCount: 0,
        isLoading: true,
        error: null,
        removeStamp: jest.fn(),
        updateStamp: jest.fn(),
      });
      const { getByTestId, queryByTestId } = renderGalleryScreen();
      expect(getByTestId('loading-indicator')).toBeTruthy();
      expect(queryByTestId('flip-list')).toBeNull();
    });

    it('スタンプ0件のめくり表示では白紙ページを出し、通常空状態は出さない', () => {
      withStamps([]);
      const { getByTestId, queryByTestId } = renderGalleryScreen();
      expect(getByTestId('flip-blank-page')).toBeTruthy();
      expect(queryByTestId('empty-state')).toBeNull();
    });

    it('中央の白紙ページをタップすると Record へ navigate する', () => {
      withStamps([]);
      const { getByTestId } = renderGalleryScreen();
      fireEvent.press(getByTestId('flip-blank-page'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Record', { origin: 'gallery' });
    });

    // 一覧のタイルと同じく、位置を測ってから飛ばすので開くのは1フレーム後になる。
    // 測れない環境では演出を飛ばして開く（Issue #202）
    it('めくり表示で中央のページをタップするとギャラリーモーダルが開く', async () => {
      withStamps([makeStamp({ id: 'stamp-abc' })]);
      const { getByTestId } = renderGalleryScreen();

      fireEvent.press(getByTestId('flip-page-stamp-abc'));

      await waitFor(() => {
        expect(getByTestId('gallery-image')).toBeTruthy();
      });
    });

    it('めくり表示のフッターに和暦の訪問日を出す', () => {
      withStamps([makeStamp({ id: 'stamp-abc', visited_at: '2026-05-03' })]);
      const { getByTestId } = renderGalleryScreen();
      expect(getByTestId('flip-page-date-stamp-abc').props.children).toBe('令和8年5月3日');
    });
  });

  describe('未ログイン時のゲスト空状態', () => {
    beforeEach(() => {
      mockAuth = { user: null, isAuthenticated: false };
      mockUseGalleryStamps.mockReturnValue({
        stamps: [],
        totalCount: 0,
        isLoading: false,
        error: null,
        removeStamp: jest.fn(),
        updateStamp: jest.fn(),
      });
    });

    it('ゲスト空状態を表示し、一覧と通常空状態は表示しない', () => {
      const { getByTestId, queryByTestId } = renderGalleryScreen();
      expect(getByTestId('gallery-guest-empty-state')).toBeTruthy();
      expect(queryByTestId('gallery-list')).toBeNull();
      expect(queryByTestId('empty-state')).toBeNull();
    });

    it('スタンプが返っていても一覧を表示しない（認証で分岐する）', () => {
      mockUseGalleryStamps.mockReturnValue({
        stamps: [makeStamp({ id: '1' })],
        totalCount: 1,
        isLoading: false,
        error: null,
        removeStamp: jest.fn(),
        updateStamp: jest.fn(),
      });

      const { queryByTestId } = renderGalleryScreen();
      expect(queryByTestId('gallery-list')).toBeNull();
    });

    it('ソートボタンを表示しない', () => {
      const { queryByTestId } = renderGalleryScreen();
      expect(queryByTestId('sort-button')).toBeNull();
    });

    it('CTA を押すと Login へ navigate する', () => {
      const { getByTestId } = renderGalleryScreen();
      fireEvent.press(getByTestId('gallery-login-cta'));
      expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
    });

    it('タイトル・説明・プレビュー3行を表示する', () => {
      const { getByText } = renderGalleryScreen();
      expect(getByText('あなたの御朱印帳')).toBeTruthy();
      expect(getByText('記録した御朱印がここに一覧で並びます')).toBeTruthy();
      expect(getByText('写真で御朱印を残す')).toBeTruthy();
      expect(getByText('日付順・スポット順で並べ替え')).toBeTruthy();
      expect(getByText('タップで大きく表示')).toBeTruthy();
    });
  });

  it('ログイン済みでスタンプ0件のとき通常空状態を表示しゲスト空状態は表示しない', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId, getByText, queryByTestId } = renderGalleryScreenInGrid();
    expect(getByTestId('empty-state')).toBeTruthy();
    expect(getByText('御朱印がまだありません')).toBeTruthy();
    expect(queryByTestId('gallery-guest-empty-state')).toBeNull();
  });

  it('ログイン済みでスタンプありのとき一覧を表示しゲスト空状態は表示しない', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1' })],
      totalCount: 1,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId, queryByTestId } = renderGalleryScreenInGrid();
    expect(getByTestId('gallery-list')).toBeTruthy();
    expect(queryByTestId('gallery-guest-empty-state')).toBeNull();
  });
});

describe('グリッド0件時の CTA（監査 A-10）', () => {
  it('ログイン済みで0件のとき記録への CTA が出る', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = renderGalleryScreenInGrid();

    expect(getByTestId('empty-state')).toBeTruthy();
    expect(getByTestId('gallery-record-cta')).toBeTruthy();
  });

  it('CTA をタップすると記録画面へ遷移する', () => {
    mockUseGalleryStamps.mockReturnValue({
      stamps: [],
      totalCount: 0,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

    const { getByTestId } = renderGalleryScreenInGrid();

    fireEvent.press(getByTestId('gallery-record-cta'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Record', { origin: 'gallery' });
  });

  /*
   * 1枚を詳細から削除したあと、残った1枚を押しても詳細が開かなかった（1.2.0 の実機で発覚）。
   * 詳細は一覧のタイルから「飛ばした1枚」を持ったまま開いている。削除はその1枚を手放さずに
   * 詳細だけ閉じていたため、次に押した1枚の飛行が、居残った状態に引きずられて終わらなかった
   */
  it('詳細から削除したら、飛ばした1枚も手放す（次の1枚が開けるように）', async () => {
    const removeStamp = jest.fn();
    mockHandleDelete.mockResolvedValue(true);
    mockUseGalleryStamps.mockReturnValue({
      stamps: [makeStamp({ id: '1' }), makeStamp({ id: '2', image_path: 'user-1/stamp-2.jpg' })],
      totalCount: 2,
      isLoading: false,
      error: null,
      removeStamp,
      updateStamp: jest.fn(),
    });

    const { getByTestId, getByText } = renderGalleryScreenInGrid();
    fireEvent.press(getByTestId('gallery-item-1'));
    fireEvent.press(getByTestId('gallery-delete-button'));
    mockHeroEnd.mockClear();
    fireEvent.press(getByText('削除する'));

    await waitFor(() => expect(removeStamp).toHaveBeenCalledWith('1'));
    expect(mockHeroEnd).toHaveBeenCalled();
  });
});

describe('タイル表示の読み込み中（Issue #275）', () => {
  /** 下地は読み上げない（飾り）ので、既定の検索からは外れる。外れたものも探す */
  const hidden = { includeHiddenElements: true };
  const IDS = ['1', '2', '3'];

  let timingSpy: jest.SpyInstance;
  /** 時計ではない timing（下地のふわっと） */
  let fades: { config: Animated.TimingAnimationConfig; anim: Anim }[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = { user: { id: 'user-1' }, isAuthenticated: true };
    mockUseGalleryStamps.mockReturnValue({
      stamps: IDS.map(id => makeStamp({ id, image_path: `user-1/stamp-${id}.jpg` })),
      totalCount: IDS.length,
      isLoading: false,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });
    fades = [];
    timingSpy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      const anim = stubAnim();
      if (value !== loadingClock) fades.push({ config, anim });
      return anim as unknown as Animated.CompositeAnimation;
    });
  });

  afterEach(() => {
    timingSpy.mockRestore();
  });

  /*
   * 既定はめくる表示で、そちらも読み込み中の本で時計を回している。タイルに切り替えると
   * めくる表示が外れて時計がいったん止まり、タイルの登録で回し直す（想定どおり。
   * 回数そのものは縛らない）。ここではタイルに切り替えてからの呼び出しを数える。
   * timing も同じ。めくる表示のページは開いた直後に覗きの不透明度を動かす
   */
  const renderGrid = () => {
    const utils = renderGalleryScreen();
    loopSpy.mockClear();
    fireEvent.press(utils.getByTestId('view-mode-grid'));
    fades.length = 0;
    return utils;
  };

  const flat = (el: { props: { style?: unknown } }) =>
    (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;
  const read = (value: unknown): number => {
    const v =
      value && typeof value === 'object' && '__getValue' in value
        ? (value as { __getValue: () => unknown }).__getValue()
        : value;
    return v as number;
  };
  const groundOpacities = (utils: ReturnType<typeof renderGrid>) =>
    IDS.map(id =>
      read(flat(utils.getByTestId(`stamp-image-loading-${id}-ground`, hidden)).opacity)
    );

  const loadAndFinish = (utils: ReturnType<typeof renderGrid>, id: string) => {
    fireEvent(utils.getByTestId(`stamp-image-${id}`), 'load', {
      nativeEvent: { source: { width: 600, height: 800 } },
    });
    const fade = fades[fades.length - 1];
    act(() => fade.anim.start.mock.calls[0][0]({ finished: true }));
  };

  it('各タイルの写真の上に和紙の下地を重ねる（本は置かない）（AC-22）', () => {
    const utils = renderGrid();

    for (const id of IDS) {
      const item = within(utils.getByTestId(`gallery-item-${id}`));
      expect(item.getByTestId(`stamp-image-loading-${id}`, hidden)).toBeTruthy();
      expect(item.getByTestId(`stamp-image-loading-${id}-ground`, hidden)).toBeTruthy();
      expect(item.getByTestId(`stamp-image-loading-${id}-frame`, hidden)).toBeTruthy();
      expect(item.queryByTestId(`stamp-image-loading-${id}-book`, hidden)).toBeNull();
    }
    expect(
      utils.getAllByTestId(/^stamp-image-(loading-)?1$/, hidden).map(el => el.props.testID)
    ).toEqual(['stamp-image-1', 'stamp-image-loading-1']);
  });

  it('すべての下地がそろって明滅する（AC-23）', () => {
    const utils = renderGrid();

    act(() => loadingClock.setValue(800));
    groundOpacities(utils).forEach(o => expect(o).toBeCloseTo(0.72, 3));
    act(() => loadingClock.setValue(400));
    groundOpacities(utils).forEach(o => expect(o).toBeCloseTo(0.86, 3));
    act(() => loadingClock.setValue(0));
    groundOpacities(utils).forEach(o => expect(o).toBeCloseTo(1, 3));
  });

  it('時計は1本で、最後の1枚が消え終わったら止まる（AC-24）', () => {
    const utils = renderGrid();

    expect(loopSpy).toHaveBeenCalledTimes(1);
    expect(isLoadingClockRunning()).toBe(true);
    const clock = loopSpy.mock.results[0].value as Anim;

    loadAndFinish(utils, '1');
    loadAndFinish(utils, '2');
    expect(isLoadingClockRunning()).toBe(true);

    loadAndFinish(utils, '3');
    expect(clock.stop).toHaveBeenCalledTimes(1);
    expect(isLoadingClockRunning()).toBe(false);
    expect(utils.queryAllByTestId(/^stamp-image-loading-/, hidden)).toHaveLength(0);
  });

  describe('小さい写真が無かったとき（AC-25）', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('元の写真を読みにいく間も下地のまま。元も届かなければ消えて今と同じ灰色', () => {
      const utils = renderGrid();

      fireEvent(utils.getByTestId('stamp-image-1'), 'error');

      expect(utils.getByTestId('stamp-image-1').props.source.uri).toBe(
        'https://example.com/user-1/stamp-1.jpg'
      );
      expect(utils.getByTestId('stamp-image-loading-1', hidden)).toBeTruthy();
      expect(fades).toEqual([]);
      expect(isLoadingClockRunning()).toBe(true);

      // 裏で焼かせる流れは今と同じ
      act(() => jest.advanceTimersByTime(400));
      expect(ensureStampVariants).toHaveBeenCalledWith(['user-1/stamp-1.jpg']);

      fireEvent(utils.getByTestId('stamp-image-1'), 'error');
      expect(fades).toHaveLength(1);
      expect(fades[0].config).toEqual(expect.objectContaining({ toValue: 0, duration: 250 }));
      act(() => fades[0].anim.start.mock.calls[0][0]({ finished: true }));

      expect(utils.queryByTestId('stamp-image-loading-1', hidden)).toBeNull();
      expect(flat(utils.getByTestId('stamp-image-1')).backgroundColor).toBe(colors.gray[200]);
    });
  });
});
