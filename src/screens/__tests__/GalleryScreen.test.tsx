import React from 'react';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  FlatList,
  Image,
  PixelRatio,
  StyleSheet,
  View,
} from 'react-native';
import { GalleryScreen } from '@screens/GalleryScreen';
import { useGalleryStamps } from '@hooks/useGalleryStamps';
import { ensureStampVariants } from '@services/stamps';
import {
  isLoadingClockRunning,
  loadingClock,
  resetLoadingClockForTests,
} from '@components/gallery/loadingClock';
import { computePageLayout } from '@components/gallery/GoshuinchoFlipView';
import { ViewModeToggle } from '@components/gallery/ViewModeToggle';
import { ImageGalleryModal } from '@components/common/ImageGalleryModal';
import { colors } from '@theme/colors';
import { spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
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
  /*
   * 視差効果を減らす は既定でオフ。読み出しは終わらないままにして、オフのまま置く
   * （false を返すと、同期で終わる検査のあとに届いて act の外で描き直しが走る）。
   * オンの検査はそれぞれで上書きする
   */
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockReturnValue(new Promise<boolean>(() => {}));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
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

describe('視差効果を減らす（Issue #275）', () => {
  /** 下地は読み上げない（飾り）ので、既定の検索からは外れる。外れたものも探す */
  const hidden = { includeHiddenElements: true };
  const IDS = ['1', '2', '3'];
  const withStamps = (isLoading: boolean) =>
    mockUseGalleryStamps.mockReturnValue({
      stamps: isLoading
        ? []
        : IDS.map(id => makeStamp({ id, image_path: `user-1/stamp-${id}.jpg` })),
      totalCount: isLoading ? 0 : IDS.length,
      isLoading,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

  let timingSpy: jest.SpyInstance;
  /** 時計ではない timing（下地のふわっと） */
  let fades: Animated.TimingAnimationConfig[];

  beforeEach(() => {
    jest.clearAllMocks();
    // 本を描くぶん1件が延び、FlatList が 50ms 後に回す描き直しが検査の途中で走る。時間を止める
    jest.useFakeTimers();
    mockAuth = { user: { id: 'user-1' }, isAuthenticated: true };
    fades = [];
    timingSpy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      if (value !== loadingClock) fades.push(config);
      return stubAnim() as unknown as Animated.CompositeAnimation;
    });
  });

  afterEach(() => {
    timingSpy.mockRestore();
    jest.useRealTimers();
  });

  const flat = (el: { props: { style?: unknown } }) =>
    (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;
  const read = (value: unknown): number => {
    const v =
      value && typeof value === 'object' && '__getValue' in value
        ? (value as { __getValue: () => unknown }).__getValue()
        : value;
    return typeof v === 'string' ? parseFloat(v) : (v as number);
  };
  const lastBookRotate = (utils: ReturnType<typeof renderGalleryScreen>) => {
    const leaf = utils.getByTestId('flip-page-loading-3-book-leaf-front', hidden);
    const transform = (flat(leaf).transform ?? []) as Record<string, unknown>[];
    return read(transform.find(t => 'rotateY' in t)?.rotateY);
  };

  /*
   * 御朱印帳は一覧の取得中は ActivityIndicator を出しているので、ふつうは設定を
   * 読み終えてから下地が出る。その順で描く（SavingOverlay.test.tsx と同じ）
   */
  const renderWithReduceMotion = async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    withStamps(true);
    const utils = renderGalleryScreen();
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());

    withStamps(false);
    utils.rerender(<GalleryScreen navigation={mockNavigation as never} route={mockRoute} />);
    return utils;
  };

  it('めくる表示の本は開いた形で止まり、時計を回さない（AC-29）', async () => {
    const utils = await renderWithReduceMotion();

    expect(loopSpy).not.toHaveBeenCalled();
    expect(isLoadingClockRunning()).toBe(false);

    act(() => loadingClock.setValue(425));
    expect(lastBookRotate(utils)).toBe(0);
    const seals = utils
      .getAllByTestId(/-book-seal-/, hidden)
      .filter(el => (el.props.testID as string).startsWith('flip-page-loading-3-'));
    expect(seals).toHaveLength(4);
  });

  it('タイルの下地は明滅しない（AC-30）', async () => {
    const utils = await renderWithReduceMotion();
    fireEvent.press(utils.getByTestId('view-mode-grid'));

    expect(loopSpy).not.toHaveBeenCalled();
    act(() => loadingClock.setValue(800));
    for (const id of IDS) {
      expect(
        read(flat(utils.getByTestId(`stamp-image-loading-${id}-ground`, hidden)).opacity)
      ).toBe(1);
    }
  });

  /*
   * ふわっとの timing を呼ばず、その場で外す。めくる表示のページは開いた直後に
   * 覗きの不透明度を動かすので、写真が届く直前からの呼び出しを見る
   */
  it('めくる表示で写真が届いたら、下地をその場で外す（AC-31）', async () => {
    const utils = await renderWithReduceMotion();
    fades.length = 0;

    fireEvent(utils.getByTestId('flip-page-image-3'), 'load', {
      nativeEvent: { source: { width: 600, height: 800 } },
    });

    expect(utils.queryByTestId('flip-page-loading-3', hidden)).toBeNull();
    expect(fades).toEqual([]);
  });

  it('タイル表示で写真が届いたら、下地をその場で外す（AC-31）', async () => {
    const utils = await renderWithReduceMotion();
    fireEvent.press(utils.getByTestId('view-mode-grid'));
    fades.length = 0;

    fireEvent(utils.getByTestId('stamp-image-2'), 'load', {
      nativeEvent: { source: { width: 600, height: 800 } },
    });

    expect(utils.queryByTestId('stamp-image-loading-2', hidden)).toBeNull();
    expect(fades).toEqual([]);
  });

  it('途中でオンになったら時計を止めて本を止め、オフに戻すとまた回す（AC-32）', async () => {
    withStamps(false);
    const utils = renderGalleryScreen();
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
    expect(isLoadingClockRunning()).toBe(true);

    const handler = (AccessibilityInfo.addEventListener as jest.Mock).mock.calls.find(
      ([event]) => event === 'reduceMotionChanged'
    )?.[1] as (enabled: boolean) => void;
    const clock = loopSpy.mock.results[loopSpy.mock.results.length - 1].value as Anim;

    act(() => handler(true));
    expect(clock.stop).toHaveBeenCalledTimes(1);
    expect(isLoadingClockRunning()).toBe(false);
    act(() => loadingClock.setValue(425));
    expect(lastBookRotate(utils)).toBe(0);

    act(() => handler(false));
    expect(isLoadingClockRunning()).toBe(true);
  });

  // タイルやページごとに設定の購読を作らない
  it('設定は画面で1回だけ読む（AC-33）', async () => {
    withStamps(false);
    const utils = renderGalleryScreen();
    fireEvent.press(utils.getByTestId('view-mode-grid'));
    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());

    expect(utils.getAllByTestId(/^stamp-image-loading-\d$/, hidden)).toHaveLength(3);
    expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(1);
  });

  // 切り替えボタンにも画面の値を渡す。白い台はその場で移り、timing を呼ばない（Issue #276 D-6）
  it('切り替えボタンは白い台もアイコンも動かさない（Issue #276）', async () => {
    const utils = await renderWithReduceMotion();
    fades.length = 0;

    fireEvent.press(utils.getByTestId('view-mode-grid'));

    expect(utils.getByTestId('view-mode-grid').props.accessibilityState.selected).toBe(true);
    expect(fades.filter(config => config.duration === 520 || config.duration === 260)).toEqual([]);
  });
});

describe('表示の切り替えの画面と開く位置（Issue #276）', () => {
  const W = Dimensions.get('window').width;
  const SNAP = computePageLayout(W).snapInterval;
  const makeStamps = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      makeStamp({
        id: `s${i}`,
        image_path: `user-1/stamp-${i}.jpg`,
        spots: { name: `寺${i}`, type: 'temple' },
      })
    );
  const withStamps = (stamps: StampWithSpot[], isLoading = false) =>
    mockUseGalleryStamps.mockReturnValue({
      stamps: isLoading ? [] : stamps,
      totalCount: isLoading ? 0 : stamps.length,
      isLoading,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

  const flat = (el: { props: { style?: unknown } }) =>
    (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;

  let scrollToOffsetSpy: jest.SpyInstance;
  let scrollToEndSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // FlatList が 50ms 後に回す描き直しを検査の途中で走らせない
    jest.useFakeTimers();
    mockAuth = { user: { id: 'user-1' }, isAuthenticated: true };
    scrollToOffsetSpy = jest
      .spyOn(FlatList.prototype, 'scrollToOffset')
      .mockImplementation(() => {});
    scrollToEndSpy = jest.spyOn(FlatList.prototype, 'scrollToEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    scrollToOffsetSpy.mockRestore();
    scrollToEndSpy.mockRestore();
    jest.useRealTimers();
  });

  /** めくる表示を page まで送る（めくり終えた合図） */
  const flipTo = (utils: ReturnType<typeof renderGalleryScreen>, page: number, pages: number) =>
    fireEvent(utils.getByTestId('flip-list'), 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: SNAP * page, y: 0 },
        layoutMeasurement: { width: W, height: 600 },
        contentSize: { width: SNAP * pages, height: 600 },
      },
    });

  /** 一覧の見える範囲（高さ 960）と中身の高さ（1532 = 5行 × 300 + 32）を届ける */
  const layoutGrid = (utils: ReturnType<typeof renderGalleryScreen>) => {
    fireEvent(utils.getByTestId('gallery-list'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: W, height: 960 } },
    });
    fireEvent(utils.getByTestId('gallery-list'), 'contentSizeChange', W, 1532);
  };

  const counterOf = (utils: ReturnType<typeof renderGalleryScreen>) =>
    utils.getByTestId('flip-page-counter').props.children;

  const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

  it('中身を2つの面に分け、表示している面だけを描く（AC-23）', () => {
    withStamps(makeStamps(3));
    const utils = renderGalleryScreen();
    const content = within(utils.getByTestId('gallery-content'));
    expect(content.getByTestId('gallery-flip-pane')).toBeTruthy();
    expect(content.queryByTestId('gallery-grid-pane')).toBeNull();
    expect(flat(utils.getByTestId('gallery-flip-pane'))).toEqual(expect.objectContaining(fill));

    fireEvent.press(utils.getByTestId('view-mode-grid'));

    expect(content.queryByTestId('gallery-flip-pane')).toBeNull();
    const grid = utils.getByTestId('gallery-grid-pane');
    expect(flat(grid)).toEqual(expect.objectContaining(fill));
    expect(within(grid).getByTestId('sort-button')).toBeTruthy();
    const viewport = within(grid).getByTestId('gallery-list-viewport');
    expect(within(viewport).getByTestId('gallery-list')).toBeTruthy();
  });

  it('御朱印が0枚の一覧の面には空の状態を出す（AC-23）', () => {
    withStamps([]);
    const utils = renderGalleryScreen();
    fireEvent.press(utils.getByTestId('view-mode-grid'));

    expect(within(utils.getByTestId('gallery-grid-pane')).getByTestId('empty-state')).toBeTruthy();
  });

  it('タイルは動き用の包みの中にあり、静かなときは何も付けない（AC-24）', () => {
    const stamps = makeStamps(3);
    withStamps(stamps);
    const utils = renderGalleryScreen();
    fireEvent.press(utils.getByTestId('view-mode-grid'));

    for (const stamp of stamps) {
      const id = stamp.id;
      const item = within(utils.getByTestId(`gallery-item-${id}`));
      const motion = item.getByTestId(`gallery-tile-motion-${id}`);
      const front = within(motion).getByTestId(`gallery-tile-front-${id}`);
      expect(within(front).getByTestId(`stamp-tile-${id}`)).toBeTruthy();
      const caption = item.getByTestId(`gallery-tile-caption-${id}`);
      expect(within(caption).getByText(stamp.spots.name)).toBeTruthy();

      expect(flat(motion)).not.toHaveProperty('transform');
      expect(flat(front)).not.toHaveProperty('transform');
      expect(flat(front)).not.toHaveProperty('backfaceVisibility');
      expect(flat(caption)).not.toHaveProperty('opacity');
    }
    expect(utils.queryAllByTestId(/^gallery-tile-back-/)).toHaveLength(0);
    expect(flat(utils.getByTestId('gallery-row-0'))).not.toHaveProperty('zIndex');
  });

  describe('一覧の開く位置（AC-25）', () => {
    it('めくる表示で見ていた1枚の行が、一覧の縦の真ん中に来る位置で開く', () => {
      withStamps(makeStamps(15));
      const utils = renderGalleryScreen();
      flipTo(utils, 7, 16);

      fireEvent.press(utils.getByTestId('view-mode-grid'));
      layoutGrid(utils);

      expect(scrollToOffsetSpy).toHaveBeenCalledTimes(1);
      expect(scrollToOffsetSpy).toHaveBeenCalledWith({ offset: 270, animated: false });
      expect(scrollToEndSpy).not.toHaveBeenCalled();
    });

    it('上の端より上になるなら送らない', () => {
      withStamps(makeStamps(15));
      const utils = renderGalleryScreen();
      flipTo(utils, 4, 16);

      fireEvent.press(utils.getByTestId('view-mode-grid'));
      layoutGrid(utils);

      expect(scrollToOffsetSpy).not.toHaveBeenCalled();
      expect(scrollToEndSpy).not.toHaveBeenCalled();
    });

    it('最新を見ていたときは下の端', () => {
      withStamps(makeStamps(15));
      const utils = renderGalleryScreen();

      fireEvent.press(utils.getByTestId('view-mode-grid'));
      layoutGrid(utils);

      expect(scrollToOffsetSpy).toHaveBeenCalledWith({ offset: 572, animated: false });
    });
  });

  describe('めくる表示の開く位置（AC-26・AC-27）', () => {
    it('一覧から戻ると、めくる表示で見ていたページで開く', () => {
      withStamps(makeStamps(15));
      const utils = renderGalleryScreen();
      flipTo(utils, 4, 16);

      fireEvent.press(utils.getByTestId('view-mode-grid'));
      fireEvent.press(utils.getByTestId('view-mode-flip'));

      expect(counterOf(utils)).toBe('5 ／ 15');
    });

    it('送っていなければ最新で開く', () => {
      withStamps(makeStamps(15));
      const utils = renderGalleryScreen();

      fireEvent.press(utils.getByTestId('view-mode-grid'));
      fireEvent.press(utils.getByTestId('view-mode-flip'));

      expect(counterOf(utils)).toBe('15 ／ 15');
    });

    it('白紙のページを見ていたら最新で開く', () => {
      withStamps(makeStamps(15));
      const utils = renderGalleryScreen();
      flipTo(utils, 15, 16);

      fireEvent.press(utils.getByTestId('view-mode-grid'));
      fireEvent.press(utils.getByTestId('view-mode-flip'));

      expect(counterOf(utils)).toBe('15 ／ 15');
    });

    it('取り直したときは今と同じく最新で開く（AC-27）', () => {
      const stamps = makeStamps(15);
      withStamps(stamps);
      const utils = renderGalleryScreen();
      flipTo(utils, 4, 16);
      fireEvent.press(utils.getByTestId('view-mode-grid'));
      fireEvent.press(utils.getByTestId('view-mode-flip'));
      expect(counterOf(utils)).toBe('5 ／ 15');

      withStamps(stamps, true);
      utils.rerender(<GalleryScreen navigation={mockNavigation as never} route={mockRoute} />);
      withStamps(stamps);
      utils.rerender(<GalleryScreen navigation={mockNavigation as never} route={mockRoute} />);

      expect(counterOf(utils)).toBe('15 ／ 15');
    });
  });

  /*
   * 御朱印が多いと、入ってくる側の最初の描画に見ていた1枚が入らず、描き足しを待つうちに
   * 切り替わりの動きの準備が間に合わなかった（Issue #276 S6。65枚で両方向とも動かなかった）
   */
  describe('御朱印が多いとき（最初の描画に入らない位置）', () => {
    const T = (W - spacing.lg * 2 - spacing.xs * 2) / 3;

    it('ボタンで一覧にしたとき、最初の描画から見ていた1枚の行を描く', () => {
      withStamps(makeStamps(60));
      const utils = renderGalleryScreen();
      flipTo(utils, 45, 61);

      fireEvent.press(utils.getByTestId('view-mode-grid'));

      expect(utils.getByTestId('gallery-item-s45')).toBeTruthy();
    });

    it('ボタンでめくる表示に戻したとき、最初の描画から見ていたページを描く', () => {
      withStamps(makeStamps(60));
      const utils = renderGalleryScreen();
      flipTo(utils, 45, 61);

      fireEvent.press(utils.getByTestId('view-mode-grid'));
      fireEvent.press(utils.getByTestId('view-mode-flip'));

      expect(utils.getByTestId('flip-page-surface-s45')).toBeTruthy();
      expect(counterOf(utils)).toBe('46 ／ 60');
    });

    // 行の高さが前もって分かるので、最初の中身の大きさの知らせから全体の高さになる（D-8）
    it('一覧の行の高さは、タイル・名前と日付の行・余白から決まる', () => {
      withStamps(makeStamps(60));
      const utils = renderGalleryScreen();
      fireEvent.press(utils.getByTestId('view-mode-grid'));

      const line = (typography.caption.lineHeight as number) * PixelRatio.getFontScale();
      const rowHeight = T + spacing.xs + line * 2 + spacing.lg;
      const getItemLayout = utils.UNSAFE_getByType(FlatList).props.getItemLayout;
      expect(getItemLayout(null, 3)).toEqual({
        length: rowHeight,
        offset: rowHeight * 3,
        index: 3,
      });
    });
  });

  it('並び替えたときは今と同じく新しい並びのいちばん下へ送る（AC-28）', () => {
    withStamps(makeStamps(15));
    const utils = renderGalleryScreen();
    flipTo(utils, 7, 16);
    fireEvent.press(utils.getByTestId('view-mode-grid'));
    layoutGrid(utils);
    expect(scrollToOffsetSpy).toHaveBeenCalledTimes(1);

    fireEvent.press(utils.getByTestId('sort-button'));
    fireEvent(utils.getByTestId('gallery-list'), 'contentSizeChange', W, 1532);

    expect(scrollToEndSpy).toHaveBeenCalledTimes(1);
    expect(scrollToOffsetSpy).toHaveBeenCalledTimes(1);
  });
});

describe('表示の切り替わりの動き（Issue #276）', () => {
  const W = Dimensions.get('window').width;
  const T = (W - spacing.lg * 2 - spacing.xs * 2) / 3;
  const { pageWidth: P, snapInterval: SNAP } = computePageLayout(W);
  const S = T / P;
  const STAMPS = Array.from({ length: 15 }, (_, i) =>
    makeStamp({
      id: `s${i}`,
      image_path: `user-1/stamp-${i}.jpg`,
      spots: { name: `寺${i}`, type: 'temple' },
    })
  );
  const withStamps = (stamps: StampWithSpot[], isLoading = false) =>
    mockUseGalleryStamps.mockReturnValue({
      stamps: isLoading ? [] : stamps,
      totalCount: isLoading ? 0 : stamps.length,
      isLoading,
      error: null,
      removeStamp: jest.fn(),
      updateStamp: jest.fn(),
    });

  /* ── 測った矩形（テスト方針の「準備」） ── */
  type Rect = [number, number, number, number];
  let viewportRect: Rect;
  let measureAnswers: boolean;
  /** gallery-content を測ると返す矩形（既定は測れない = 0） */
  let contentRect: Rect;
  const tileRect = (i: number): Rect => [
    spacing.lg + (i % 3) * (T + spacing.xs),
    140 + Math.floor(i / 3) * 300,
    T,
    T,
  ];
  const rectOf = (testID: string | undefined): Rect => {
    if (testID === 'gallery-content') return contentRect;
    if (testID === 'gallery-flip-pane') return [0, 100, W, 1000];
    if (testID?.startsWith('flip-page-surface-')) return [(W - P) / 2, 250, P, 1.5 * P];
    if (testID === 'gallery-list-viewport') return viewportRect;
    const tile = testID?.match(/^gallery-tile-motion-s(\d+)$/);
    if (tile) return tileRect(Number(tile[1]));
    return [0, 0, 0, 0];
  };
  /** 束の中心 − タイルの中心（D-10） */
  const dxOf = (i: number) => W / 2 - (tileRect(i)[0] + T / 2);
  const dyOf = (i: number) => 250 + 0.75 * P - (tileRect(i)[1] + T / 2);

  /* ── timing のスタブ ── */
  type Stub = { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };
  let calls: { value: unknown; config: Animated.TimingAnimationConfig; anim: Stub }[];
  const clockCalls = () =>
    calls.filter(c => c.config.duration === 565 || c.config.duration === 590);
  const slideCalls = () => calls.filter(c => c.config.duration === 520);

  let measureSpy: jest.SpyInstance;
  let timingSpy: jest.SpyInstance;
  let scrollToOffsetSpy: jest.SpyInstance;
  let scrollToEndSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAuth = { user: { id: 'user-1' }, isAuthenticated: true };
    withStamps(STAMPS);
    viewportRect = [0, 140, W, 960];
    contentRect = [0, 0, 0, 0];
    measureAnswers = true;
    measureSpy = jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (
      this: { props: { testID?: string } },
      callback: (x: number, y: number, width: number, height: number) => void
    ) {
      if (measureAnswers) callback(...rectOf(this.props.testID));
    });
    calls = [];
    timingSpy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      const anim: Stub = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
      calls.push({ value, config, anim });
      return anim as unknown as Animated.CompositeAnimation;
    });
    scrollToOffsetSpy = jest
      .spyOn(FlatList.prototype, 'scrollToOffset')
      .mockImplementation(() => {});
    scrollToEndSpy = jest.spyOn(FlatList.prototype, 'scrollToEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    measureSpy.mockRestore();
    timingSpy.mockRestore();
    scrollToOffsetSpy.mockRestore();
    scrollToEndSpy.mockRestore();
    jest.useRealTimers();
  });

  /* ── 値の読み方 ── */
  type TestNode = { props: { style?: unknown }; parent: TestNode | null };
  const flat = (el: TestNode) =>
    (StyleSheet.flatten(el.props.style) ?? {}) as Record<string, unknown>;
  const toNumber = (value: unknown): number =>
    typeof value === 'string' ? parseFloat(value) : (value as number);
  /**
   * 動きの値を読む。Animated の部品（描いた View の2つ上）の style に入ったノードの今の値。
   * 時計はめくる表示の折りの包み（スクロールのネイティブの値）と一緒に使われてネイティブ扱いに
   * なるので、setValue のあとで描いた View の style には届かない
   */
  const animatedOf = (el: TestNode, pick: (style: Record<string, unknown>) => unknown): number => {
    let node: TestNode | null = el;
    for (let i = 0; i < 3 && node; i++) {
      const value = pick(flat(node));
      if (value && typeof value === 'object' && '__getValue' in value) {
        return toNumber((value as { __getValue: () => unknown }).__getValue());
      }
      node = node.parent;
    }
    return toNumber(pick(flat(el)));
  };
  const opacityOf = (el: TestNode) => animatedOf(el, style => style.opacity);
  const transformOf = (el: TestNode, key: string) =>
    animatedOf(
      el,
      style =>
        (style.transform as Record<string, unknown>[] | undefined)?.find(t => key in t)?.[key]
    );
  /** Animated の部品に渡した transform の並び（ノードのまま） */
  const animatedTransformList = (el: TestNode) => {
    let node: TestNode | null = el;
    for (let i = 0; i < 3 && node; i++) {
      const transform = flat(node).transform as Record<string, unknown>[] | undefined;
      if (transform?.some(t => Object.values(t).some(v => v && typeof v === 'object'))) {
        return transform;
      }
      node = node.parent;
    }
    return (flat(el).transform ?? []) as Record<string, unknown>[];
  };

  type Utils = ReturnType<typeof renderGalleryScreen>;
  const layoutContent = (utils: Utils, height = 1000) =>
    fireEvent(utils.getByTestId('gallery-content'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: W, height } },
    });
  const flipTo = (utils: Utils, page: number) =>
    fireEvent(utils.getByTestId('flip-list'), 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: SNAP * page, y: 0 },
        layoutMeasurement: { width: W, height: 600 },
        contentSize: { width: SNAP * 16, height: 600 },
      },
    });
  const layoutGrid = (utils: Utils) => {
    fireEvent(utils.getByTestId('gallery-list'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: W, height: 960 } },
    });
    fireEvent(utils.getByTestId('gallery-list'), 'contentSizeChange', W, 1532);
  };
  const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

  /** 「準備」の手順のうち、view-mode-grid を押すところまで */
  const pressGrid = () => {
    const utils = renderGalleryScreen();
    layoutContent(utils);
    flipTo(utils, 4);
    fireEvent.press(utils.getByTestId('view-mode-grid'));
    return utils;
  };
  /** 「準備」の手順すべて。めくる → 一覧 の時計が回り始めたところ */
  const startToGrid = () => {
    const utils = pressGrid();
    layoutGrid(utils);
    advance(50);
    return utils;
  };
  const clockOf = (index: number) => clockCalls()[index].value as Animated.Value;
  const at = (clock: Animated.Value, t: number) => act(() => clock.setValue(t));
  const finish = (index: number) =>
    act(() => clockCalls()[index].anim.start.mock.calls[0][0]({ finished: true }));
  const backs = (utils: Utils) => utils.queryAllByTestId(/^gallery-tile-back-s\d+$/);

  describe('動かさないとき（AC-29）', () => {
    const expectSwitchedInPlace = (utils: Utils) => {
      expect(utils.queryByTestId('gallery-flip-pane')).toBeNull();
      advance(1000);
      expect(clockCalls()).toHaveLength(0);
    };

    it('中身の大きさがまだ届いていない', () => {
      const utils = renderGalleryScreen();
      fireEvent.press(utils.getByTestId('view-mode-grid'));
      expectSwitchedInPlace(utils);
    });

    it('視差効果を減らす がオン', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      withStamps(STAMPS, true);
      const utils = renderGalleryScreen();
      await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled());
      withStamps(STAMPS);
      utils.rerender(<GalleryScreen navigation={mockNavigation as never} route={mockRoute} />);
      layoutContent(utils);

      fireEvent.press(utils.getByTestId('view-mode-grid'));
      expectSwitchedInPlace(utils);
    });

    it('中身の高さが 0', () => {
      const utils = renderGalleryScreen();
      layoutContent(utils, 0);
      fireEvent.press(utils.getByTestId('view-mode-grid'));
      expectSwitchedInPlace(utils);
    });

    it('御朱印が0枚', () => {
      withStamps([]);
      const utils = renderGalleryScreen();
      layoutContent(utils);
      fireEvent.press(utils.getByTestId('view-mode-grid'));
      expectSwitchedInPlace(utils);
    });
  });

  /*
   * 中身の onLayout は、取り直しのあとで描き直した中身には届かないことがある（S6 のシミュレータで、
   * 再読み込み直後の最初の切り替えがその場で切り替わった）。届いていなければその場で測る
   */
  it('中身の大きさが届いていなくても、その場で測れて大きさがあれば動かす', () => {
    contentRect = [0, 100, W, 1000];
    const utils = renderGalleryScreen();
    flipTo(utils, 4);

    fireEvent.press(utils.getByTestId('view-mode-grid'));
    expect(utils.getByTestId('gallery-flip-pane')).toBeTruthy();
    layoutGrid(utils);
    advance(50);

    expect(clockCalls()).toHaveLength(1);
  });

  it('押したら入ってくる側を見えないまま描き足し、測れたら時計を1回だけ回す（AC-30）', () => {
    const utils = pressGrid();

    expect(utils.getByTestId('gallery-flip-pane')).toBeTruthy();
    const grid = utils.getByTestId('gallery-grid-pane');
    expect(opacityOf(grid)).toBe(0);
    expect(grid.props.pointerEvents).toBe('none');
    expect(utils.getByTestId('gallery-flip-pane').props.pointerEvents).toBe('none');
    expect(utils.getByTestId('view-mode-grid').props.accessibilityState.selected).toBe(true);
    expect(clockCalls()).toHaveLength(0);

    layoutGrid(utils);
    advance(50);

    expect(clockCalls()).toHaveLength(1);
    const [clock] = clockCalls();
    expect(clock.value).toBeInstanceOf(Animated.Value);
    expect(clock.value).not.toBe(loadingClock);
    expect(clock.config).toEqual(
      expect.objectContaining({ toValue: 565, duration: 565, useNativeDriver: true })
    );
    expect(clock.config.easing?.(0.3)).toBeCloseTo(0.3, 6);
    expect(clock.anim.start).toHaveBeenCalledTimes(1);
  });

  it('めくる → 一覧: ページが縮み、周りが消え、面が入れ替わる（AC-31）', () => {
    const utils = startToGrid();
    const clock = clockOf(0);
    const flipPane = () => utils.getByTestId('gallery-flip-pane');
    const gridPane = () => utils.getByTestId('gallery-grid-pane');
    const surface = () => utils.getByTestId('flip-page-surface-s4');
    const surrounds = () => [
      utils.getByTestId('flip-page-footer-s4'),
      utils.getByTestId('flip-fold-s3'),
      utils.getByTestId('flip-page-counter'),
    ];

    at(clock, 0);
    expect(opacityOf(flipPane())).toBeCloseTo(1, 3);
    expect(opacityOf(gridPane())).toBeCloseTo(0, 3);
    expect(transformOf(surface(), 'scale')).toBeCloseTo(1, 3);

    at(clock, 50);
    expect(transformOf(surface(), 'scale')).toBeCloseTo(1 - (1 - S) * 0.25, 3);
    surrounds().forEach(el => expect(opacityOf(el)).toBeCloseTo(0.5, 3));

    at(clock, 100);
    expect(transformOf(surface(), 'scale')).toBeCloseTo(S, 3);
    surrounds().forEach(el => expect(opacityOf(el)).toBeCloseTo(0, 3));
    expect(opacityOf(flipPane())).toBeCloseTo(1, 3);
    expect(opacityOf(gridPane())).toBeCloseTo(0, 3);

    at(clock, 101);
    expect(opacityOf(flipPane())).toBeCloseTo(0, 3);
    expect(opacityOf(gridPane())).toBeCloseTo(1, 3);
  });

  it('めくる → 一覧: 束から、めくれながら散って並ぶ（AC-32）', () => {
    const utils = startToGrid();
    const clock = clockOf(0);
    const motion = (id: string) => utils.getByTestId(`gallery-tile-motion-${id}`);
    const front = (id: string) => utils.getByTestId(`gallery-tile-front-${id}`);

    // 見ていた1枚（s4）: 表のまま束のいちばん上から最初に出る
    at(clock, 100);
    expect(transformOf(motion('s4'), 'translateX')).toBeCloseTo(dxOf(4), 3);
    expect(transformOf(motion('s4'), 'translateY')).toBeCloseTo(dyOf(4), 3);
    expect(transformOf(motion('s4'), 'rotateZ')).toBeCloseTo(0, 3);
    expect(transformOf(front('s4'), 'rotateY')).toBeCloseTo(0, 3);
    expect(utils.queryByTestId('gallery-tile-back-s4')).toBeNull();

    at(clock, 186.25);
    expect(transformOf(motion('s4'), 'translateY')).toBeCloseTo(dyOf(4) * (1 - 1.10916), 3);

    at(clock, 445);
    expect(transformOf(motion('s4'), 'translateX')).toBeCloseTo(0, 3);
    expect(transformOf(motion('s4'), 'translateY')).toBeCloseTo(0, 3);
    expect(transformOf(front('s4'), 'rotateY')).toBeCloseTo(0, 3);

    // s3（d = 20 + 200/11）: 裏を見せて傾いた束から
    at(clock, 100);
    expect(transformOf(motion('s3'), 'translateX')).toBeCloseTo(dxOf(3), 3);
    expect(transformOf(motion('s3'), 'translateY')).toBeCloseTo(dyOf(3), 3);
    expect(transformOf(motion('s3'), 'rotateZ')).toBeCloseTo(1, 3);
    expect(transformOf(front('s3'), 'rotateY')).toBeCloseTo(179.9, 3);
    const back = animatedTransformList(utils.getByTestId('gallery-tile-back-s3'));
    expect(back[back.length - 1]).toEqual({ rotateY: '180deg' });
    expect(toNumber((back[1].rotateY as { __getValue: () => unknown }).__getValue())).toBeCloseTo(
      179.9,
      3
    );

    at(clock, 100 + 20 + 200 / 11 + 345);
    expect(transformOf(motion('s3'), 'translateX')).toBeCloseTo(0, 3);
    expect(transformOf(motion('s3'), 'translateY')).toBeCloseTo(0, 3);
    expect(transformOf(motion('s3'), 'rotateZ')).toBeCloseTo(0, 3);
    expect(transformOf(front('s3'), 'rotateY')).toBeCloseTo(0, 3);

    // s11（d = 120）: 最後に出る
    at(clock, 219);
    expect(transformOf(motion('s11'), 'translateX')).toBeCloseTo(dxOf(11), 3);
    at(clock, 565);
    expect(transformOf(motion('s11'), 'translateX')).toBeCloseTo(0, 3);

    // 文字は着く直前に出る
    const caption = () => utils.getByTestId('gallery-tile-caption-s4');
    at(clock, 100);
    expect(opacityOf(caption())).toBeCloseTo(0, 3);
    at(clock, 385);
    expect(opacityOf(caption())).toBeCloseTo(0.5, 3);
    at(clock, 445);
    expect(opacityOf(caption())).toBeCloseTo(1, 3);
  });

  it('見えていないタイルは置くだけ（AC-33）', () => {
    const utils = startToGrid();
    at(clockOf(0), 300);

    for (const id of ['s12', 's13', 's14']) {
      expect(flat(utils.getByTestId(`gallery-tile-motion-${id}`))).not.toHaveProperty('transform');
      const front = flat(utils.getByTestId(`gallery-tile-front-${id}`));
      expect(front).not.toHaveProperty('transform');
      expect(front).not.toHaveProperty('backfaceVisibility');
      expect(flat(utils.getByTestId(`gallery-tile-caption-${id}`))).not.toHaveProperty('opacity');
    }
    // 裏は見えていて見ていた1枚でない11枚（s0〜s11 のうち s4 以外）。
    // 裏の中の枠（-frame）も同じ接頭辞なので、裏だけを数える
    expect(
      backs(utils)
        .map(el => el.props.testID)
        .sort()
    ).toEqual(
      ['s0', 's1', 's2', 's3', 's5', 's6', 's7', 's8', 's9', 's10', 's11']
        .map(id => `gallery-tile-back-${id}`)
        .sort()
    );
  });

  // 描き足しでコマが飛ばないよう、一覧へ切り替える間は描く行を画面の近くに絞る（S6）
  it('一覧へ切り替える間だけ、一覧の描く行を絞る', () => {
    const utils = startToGrid();
    expect(utils.getByTestId('gallery-list').props.windowSize).toBe(3);

    finish(0);
    expect(utils.getByTestId('gallery-list').props.windowSize).toBeUndefined();
  });

  it('見ていた1枚は束のいちばん上に出す（AC-34）', () => {
    const utils = startToGrid();

    expect(flat(utils.getByTestId('gallery-item-s4')).zIndex).toBe(1);
    expect(flat(utils.getByTestId('gallery-row-1')).zIndex).toBe(1);
    for (const el of utils.getAllByTestId(/^gallery-row-\d+$/)) {
      if (el.props.testID !== 'gallery-row-1') expect(flat(el)).not.toHaveProperty('zIndex');
    }
    for (const el of utils.getAllByTestId(/^gallery-item-s\d+$/)) {
      if (el.props.testID !== 'gallery-item-s4') expect(flat(el)).not.toHaveProperty('zIndex');
    }
  });

  it('終わったら、出ていく側と動きの値を外し、ロックを外す（AC-35）', () => {
    const utils = startToGrid();
    finish(0);

    expect(utils.queryByTestId('gallery-flip-pane')).toBeNull();
    expect(utils.queryByTestId('flip-list')).toBeNull();
    expect(utils.queryAllByTestId(/^gallery-tile-back-/)).toHaveLength(0);
    expect(flat(utils.getByTestId('gallery-tile-motion-s4'))).not.toHaveProperty('transform');
    expect(flat(utils.getByTestId('gallery-row-1'))).not.toHaveProperty('zIndex');
    expect(flat(utils.getByTestId('gallery-item-s4'))).not.toHaveProperty('zIndex');
    expect(utils.getByTestId('gallery-grid-pane').props.pointerEvents).not.toBe('none');

    fireEvent.press(utils.getByTestId('view-mode-flip'));
    expect(utils.getByTestId('gallery-flip-pane')).toBeTruthy();
  });

  it('一覧 → めくる: めくれながら束へ集まり、ページが広がる（AC-36）', () => {
    const utils = startToGrid();
    finish(0);
    fireEvent.press(utils.getByTestId('view-mode-flip'));

    expect(opacityOf(utils.getByTestId('gallery-flip-pane'))).toBe(0);
    expect(utils.getByTestId('flip-page-counter').props.children).toBe('5 ／ 15');

    advance(50);
    expect(clockCalls()).toHaveLength(2);
    const second = clockCalls()[1];
    expect(second.config).toEqual(expect.objectContaining({ toValue: 590, duration: 590 }));
    expect(second.value).not.toBe(clockCalls()[0].value);
    const clock = second.value as Animated.Value;
    const motion = (id: string) => utils.getByTestId(`gallery-tile-motion-${id}`);
    const front = (id: string) => utils.getByTestId(`gallery-tile-front-${id}`);

    // 見ていた1枚（s4・g = 80）は最後に来て、表のまま束のいちばん上に乗る
    at(clock, 80);
    expect(transformOf(motion('s4'), 'translateX')).toBeCloseTo(0, 3);
    expect(transformOf(motion('s4'), 'translateY')).toBeCloseTo(0, 3);
    at(clock, 205);
    expect(transformOf(motion('s4'), 'translateY')).toBeCloseTo(dyOf(4) * 0.875, 3);
    expect(transformOf(front('s4'), 'rotateY')).toBeCloseTo(0, 3);
    expect(utils.queryByTestId('gallery-tile-back-s4')).toBeNull();

    // いちばん遠い1枚（s11・g = 0）が最初
    at(clock, 125);
    expect(transformOf(motion('s11'), 'translateX')).toBeCloseTo(dxOf(11) * 0.875, 3);
    expect(transformOf(motion('s11'), 'translateY')).toBeCloseTo(dyOf(11) * 0.875, 3);
    expect(transformOf(motion('s11'), 'rotateZ')).toBeCloseTo(7, 3);
    // 179.9 × 0.875 = 157.4125（契約書の 157.413 はこれを小数3桁に丸めた値）
    expect(transformOf(front('s11'), 'rotateY')).toBeCloseTo(157.4125, 3);
    at(clock, 40);
    expect(opacityOf(utils.getByTestId('gallery-tile-caption-s11'))).toBeCloseTo(0.5, 3);

    const flipPane = () => utils.getByTestId('gallery-flip-pane');
    const gridPane = () => utils.getByTestId('gallery-grid-pane');
    const surface = () => utils.getByTestId('flip-page-surface-s4');
    at(clock, 330);
    expect(opacityOf(gridPane())).toBeCloseTo(1, 3);
    expect(opacityOf(flipPane())).toBeCloseTo(0, 3);
    expect(transformOf(surface(), 'scale')).toBeCloseTo(S, 3);
    at(clock, 331);
    expect(opacityOf(gridPane())).toBeCloseTo(0, 3);
    expect(opacityOf(flipPane())).toBeCloseTo(1, 3);
    at(clock, 395);
    expect(transformOf(surface(), 'scale')).toBeCloseTo(S + (1 - S) * 1.10916, 4);
    at(clock, 460);
    expect(opacityOf(utils.getByTestId('flip-page-counter'))).toBeCloseTo(0.5, 3);
    at(clock, 590);
    expect(transformOf(surface(), 'scale')).toBeCloseTo(1, 3);

    finish(1);
    expect(utils.queryByTestId('gallery-grid-pane')).toBeNull();
    expect(flat(utils.getByTestId('flip-page-surface-s4'))).not.toHaveProperty('transform');
  });

  describe('動いている間の操作（AC-37）', () => {
    const expectIgnored = (utils: Utils, press: 'view-mode-flip' | 'view-mode-grid') => {
      const slides = slideCalls().length;
      const clocks = clockCalls().length;
      fireEvent.press(utils.getByTestId(press));
      expect(utils.getByTestId(press).props.accessibilityState.selected).toBe(false);
      expect(slideCalls()).toHaveLength(slides);
      expect(clockCalls()).toHaveLength(clocks);
    };

    it('準備の間と動いている間は、ボタンも並び替えも効かない', () => {
      const utils = pressGrid();
      expectIgnored(utils, 'view-mode-flip');

      layoutGrid(utils);
      advance(50);
      expectIgnored(utils, 'view-mode-flip');

      mockUseGalleryStamps.mockClear();
      fireEvent.press(utils.getByTestId('sort-button'));
      expect(mockUseGalleryStamps).not.toHaveBeenCalledWith('spot');
    });

    it('一覧 → めくる の動いている間も効かない', () => {
      const utils = startToGrid();
      finish(0);
      fireEvent.press(utils.getByTestId('view-mode-flip'));
      advance(50);

      expectIgnored(utils, 'view-mode-grid');
    });
  });

  describe('取りやめ（AC-38）', () => {
    it('取り直しが始まったら止め、戻ったら一覧だけにする', () => {
      const utils = startToGrid();
      const clock = clockCalls()[0];

      withStamps(STAMPS, true);
      utils.rerender(<GalleryScreen navigation={mockNavigation as never} route={mockRoute} />);
      expect(clock.anim.stop).toHaveBeenCalledTimes(1);
      expect(utils.getByTestId('loading-indicator')).toBeTruthy();

      withStamps(STAMPS);
      utils.rerender(<GalleryScreen navigation={mockNavigation as never} route={mockRoute} />);
      expect(utils.getByTestId('gallery-grid-pane')).toBeTruthy();
      expect(utils.queryByTestId('gallery-flip-pane')).toBeNull();
      expect(utils.queryAllByTestId(/^gallery-tile-back-/)).toHaveLength(0);
      for (const el of utils.getAllByTestId(/^gallery-(row-\d+|item-s\d+)$/)) {
        expect(flat(el)).not.toHaveProperty('zIndex');
      }

      fireEvent.press(utils.getByTestId('view-mode-flip'));
      expect(utils.getByTestId('gallery-flip-pane')).toBeTruthy();
    });

    it('視差効果を減らす がオンになったら、その場で終わりの形にする', () => {
      const utils = startToGrid();
      const clock = clockCalls()[0];
      const handler = (AccessibilityInfo.addEventListener as jest.Mock).mock.calls.find(
        ([event]) => event === 'reduceMotionChanged'
      )?.[1] as (enabled: boolean) => void;

      act(() => handler(true));

      expect(clock.anim.stop).toHaveBeenCalledTimes(1);
      expect(utils.queryByTestId('gallery-flip-pane')).toBeNull();
    });

    it('画面が外れたら止める', () => {
      const utils = startToGrid();
      const clock = clockCalls()[0];

      utils.unmount();

      expect(clock.anim.stop).toHaveBeenCalledTimes(1);
    });

    it('御朱印の並びが変わったら止める', () => {
      const utils = startToGrid();
      const clock = clockCalls()[0];

      withStamps(STAMPS.slice(0, 14));
      utils.rerender(<GalleryScreen navigation={mockNavigation as never} route={mockRoute} />);

      expect(clock.anim.stop).toHaveBeenCalledTimes(1);
      expect(utils.queryByTestId('gallery-flip-pane')).toBeNull();
    });
  });

  // 65枚のアカウントで、めくる表示へ戻す動きが準備の時間切れで動かなかった（S6）
  it('めくる表示へ戻す動きは、離れたページでも描き足しを待たずに準備が済む', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      makeStamp({
        id: `s${i}`,
        image_path: `user-1/stamp-${i}.jpg`,
        spots: { name: `寺${i}`, type: 'temple' },
      })
    );
    withStamps(many);
    const utils = renderGalleryScreen();
    flipTo(utils, 45);
    // 中身の大きさが届く前なので、一覧へはその場で切り替わる
    fireEvent.press(utils.getByTestId('view-mode-grid'));
    layoutContent(utils);

    fireEvent.press(utils.getByTestId('view-mode-flip'));
    advance(50);

    expect(clockCalls()).toHaveLength(1);
    expect(clockCalls()[0].config).toEqual(expect.objectContaining({ duration: 590 }));
  });

  describe('測れないとき（AC-39）', () => {
    it('300ms 以内に測り終わらなければ、動かさずに切り替える', () => {
      measureAnswers = false;
      const utils = pressGrid();
      layoutGrid(utils);

      advance(299);
      expect(utils.getByTestId('gallery-flip-pane')).toBeTruthy();
      expect(utils.getByTestId('gallery-grid-pane')).toBeTruthy();

      advance(1);
      expect(utils.queryByTestId('gallery-flip-pane')).toBeNull();
      expect(clockCalls()).toHaveLength(0);
    });

    it('一覧の見える範囲の高さが 0', () => {
      viewportRect = [0, 140, W, 0];
      const utils = startToGrid();

      expect(utils.queryByTestId('gallery-flip-pane')).toBeNull();
      expect(clockCalls()).toHaveLength(0);
    });

    it('束が一覧の見える範囲に収まらない', () => {
      viewportRect = [0, 700, W, 400];
      const utils = startToGrid();

      expect(utils.queryByTestId('gallery-flip-pane')).toBeNull();
      expect(clockCalls()).toHaveLength(0);
    });
  });

  it('詳細を開いている間はボタンが効かない（AC-40）', () => {
    withStamps(STAMPS.slice(0, 3));
    const utils = renderGalleryScreen();
    layoutContent(utils);
    fireEvent.press(utils.getByTestId('view-mode-grid'));
    finishIfRunning();

    fireEvent.press(utils.getByTestId('gallery-item-s1'));
    expect(utils.UNSAFE_getByType(ViewModeToggle).props.locked).toBe(true);
    fireEvent.press(utils.getByTestId('view-mode-flip'));
    expect(utils.getByTestId('gallery-grid-pane')).toBeTruthy();
    expect(utils.queryByTestId('gallery-flip-pane')).toBeNull();
    expect(utils.getByTestId('view-mode-flip').props.accessibilityState.selected).toBe(false);

    act(() => utils.UNSAFE_getByType(ImageGalleryModal).props.onClose());
    expect(utils.UNSAFE_getByType(ViewModeToggle).props.locked).toBe(false);
    fireEvent.press(utils.getByTestId('view-mode-flip'));
    expect(utils.getByTestId('gallery-flip-pane')).toBeTruthy();

    /** 一覧への切り替えが動いていれば、測れないまま 300ms で終わらせる */
    function finishIfRunning() {
      advance(300);
    }
  });
});
