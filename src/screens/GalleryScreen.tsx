import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
  type FlatListProps,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';
import { useAuth } from '@hooks/useAuth';
import { useGalleryStamps } from '@hooks/useGalleryStamps';
import { useGalleryViewMode, type GalleryViewMode } from '@hooks/useGalleryViewMode';
import { useStampDetail } from '@hooks/useStampDetail';
import { getStampImageUrl, getStampThumbUrl, getStampViewUrl } from '@services/stamps';
import { Button } from '@components/common/Button';
import { ImageGalleryModal, GalleryImage } from '@components/common/ImageGalleryModal';
import { GoshuinchoFlipView, computePageLayout } from '@components/gallery/GoshuinchoFlipView';
import { GalleryGridTile } from '@components/gallery/GalleryGridTile';
import { HeroFlyer } from '@components/gallery/HeroFlyer';
import { useHeroTransition } from '@hooks/useHeroTransition';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { useViewModeTransition } from '@hooks/useViewModeTransition';
import { ViewModeToggle } from '@components/gallery/ViewModeToggle';
import { getWebPreviewStamps, previewImageUrl } from '@components/gallery/webPreview';
import { EditStampModal } from '@components/stamp-detail/EditStampModal';
import { DeleteConfirmModal } from '@components/stamp-detail/DeleteConfirmModal';
import type { StampWithSpot } from '@/types/supabase';
import type { GalleryStackScreenProps } from '@/navigation/types';

type SortOrder = 'date' | 'spot';
type Props = GalleryStackScreenProps<'Gallery'>;
/** 一覧の行のセル（numColumns のとき index は行の番号） */
type GridRowCellProps = React.ComponentProps<
  NonNullable<FlatListProps<StampWithSpot>['CellRendererComponent']>
>;

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_MARGIN = spacing.xs;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - ITEM_MARGIN * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

/** 詳細から「写真が出せる」合図が来なかったときに、飛ぶ1枚を諦めて引っ込めるまで */
const HANDOVER_FALLBACK_MS = 800;

/** タイルの下の名前と日付の1行の高さ（文字の大きさの設定で倍になる） */
const CAPTION_LINE_HEIGHT = typography.caption.lineHeight as number;

/**
 * 一覧の行の高さの見込み。タイル・名前（と日付）の行・下の余白で決まり、どの行も同じ。
 * 描いた行の高さが届いたらそちらに直す
 */
function gridRowHeightOf(sortOrder: SortOrder, fontScale: number) {
  const lines = sortOrder === 'date' ? 2 : 1;
  return ITEM_SIZE + spacing.xs + CAPTION_LINE_HEIGHT * fontScale * lines + spacing.lg;
}

/**
 * ボタンで一覧にしたとき、見ていた1枚の行より何行上から描き始めるか。見える範囲の上半分を
 * 埋める分（Issue #276。描き始めが遠いと、見ていた1枚が描かれるまで切り替わりの動きを待てない）
 */
const ROWS_ABOVE_ON_OPEN = 3;

/**
 * 一覧を、index の1枚の行が見える範囲の縦の真ん中に来る位置で開くときの offset
 * （Issue #276 D-8）。行の高さはどの行も同じ（並び替えごとに文字の行数がそろう）
 */
function gridOffsetOf(index: number, count: number, viewportHeight: number, contentHeight: number) {
  const rows = Math.ceil(count / NUM_COLUMNS);
  const rowHeight = (contentHeight - spacing['3xl']) / rows;
  const row = Math.floor(index / NUM_COLUMNS);
  const bottom = Math.max(0, contentHeight - viewportHeight);
  return Math.min(Math.max(row * rowHeight + rowHeight / 2 - viewportHeight / 2, 0), bottom);
}

const GUEST_PREVIEW_ITEMS = [
  { icon: 'photo-camera', label: '写真で御朱印を残す' },
  { icon: 'sort', label: '日付順・スポット順で並べ替え' },
  { icon: 'fullscreen', label: 'タップで大きく表示' },
] as const;

export function GalleryScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  const [sortOrder, setSortOrder] = useState<SortOrder>('date');
  const {
    stamps,
    isLoading,
    removeStamp,
    updateStamp: updateGalleryStamp,
  } = useGalleryStamps(sortOrder);
  const { viewMode, setViewMode } = useGalleryViewMode();
  /*
   * 写真が届くまでの動き（Issue #275）。設定の購読はここで1回だけにし、
   * タイルやページごとに作らない
   */
  const reduceMotion = useReduceMotion();
  const { fontScale, width: windowWidth } = useWindowDimensions();

  /** めくる表示で今出ているページの御朱印。白紙のページなら null（Issue #276 D-8） */
  const [flipStampId, setFlipStampId] = useState<string | null>(null);
  /**
   * ボタンで 一覧 → めくる にしたとき、めくる表示を開くページ。めくる表示は最初に開くときだけ
   * 使うので、切り替えが済んだら捨てる（取り直して開き直したときは今と同じく最新で開く）
   */
  const [flipOpenRequest, setFlipOpenRequest] = useState<{ stampId: string | null } | null>(null);
  /**
   * ボタンで めくる → 一覧 にしたとき、一覧を開く位置の1枚。一覧の見える範囲と中身の高さが
   * 届いたところで使って捨てる。並び替え・取り直し・めくるへ戻したときも捨てる
   */
  const gridOpenTarget = useRef<{ stampId: string | null } | null>(null);
  /**
   * ボタンで一覧にしたとき、一覧を描き始める行（initialScrollIndex）。見ていた1枚の行を
   * 最初の描画に入れる。一覧が作り直されるとき（並び替え・取り直し）と外れたときに捨てる
   */
  const gridInitialRow = useRef<number | undefined>(undefined);
  /** 描いた一覧の行の高さ。見込み（gridRowHeightOf）と違えばこちらを使う */
  const [measuredRowHeight, setMeasuredRowHeight] = useState<{
    sortOrder: SortOrder;
    fontScale: number;
    height: number;
  } | null>(null);
  const gridViewportHeight = useRef<number | null>(null);
  /** 一覧のスクロールの位置。一覧 → めくる で開くページを決める（D-8） */
  const gridScrollY = useRef(0);
  /** 一覧のタイルから開いた詳細に今出ている御朱印。めくる表示から開いたときは null */
  const gridDetailStampId = useRef<string | null>(null);
  /**
   * 一覧で開いて閉じたときに詳細に出ていた御朱印（D-8 の ①）。
   * 一覧を取り直したとき・並び替えたとき・めくる表示へ切り替えたときに忘れる
   */
  const closedGridStampId = useRef<string | null>(null);
  /**
   * ボタンで めくる → 一覧 に来たときの「見ていた1枚」（D-8 の ⓪。オーナーの判断 2026-09-27）。
   * 指で一覧を動かした・一覧で御朱印を開いた・並び替えた・取り直した・めくるへ切り替えたら忘れる
   */
  const returnToFlipStampId = useRef<string | null>(null);
  const gridContentHeight = useRef<number | null>(null);

  // Expo Web の検証イネーブラ（Issue #116 S-7）。native では常に null
  const previewStamps = getWebPreviewStamps();
  const isPreview = previewStamps !== null;
  const displayStamps = previewStamps ?? stamps;
  const showsGallery = isAuthenticated || isPreview;

  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const hero = useHeroTransition();
  /** 今まさに飛んでいる御朱印。一覧のタイルはこれを見て隠れる */
  const [flyingStampId, setFlyingStampId] = useState<string | null>(null);
  /** 詳細を開いたまま、飛ぶ1枚を持ったままにしているか（Issue #192） */
  const [resting, setResting] = useState(false);
  /** R2 に原本が無い御朱印。元の写真に落として表示を続ける（Issue #194 / #227） */
  const [thumbMissing, setThumbMissing] = useState<ReadonlySet<string>>(() => new Set());

  /**
   * 一覧のタイルが小さい方を出せなかった。元の写真に落として表示を続ける。
   * R2 の変換は URL で頼むので焼かせる必要は無く、落ちるのは R2 に原本が無いとき
   * （旧バージョンのアプリが Supabase にだけ上げた写真と、二重書き込みで R2 の側だけ
   * 失敗した写真）（Issue #227 S4a）
   */
  const handleThumbMissing = (stamp: StampWithSpot) => {
    setThumbMissing(prev => (prev.has(stamp.id) ? prev : new Set(prev).add(stamp.id)));
  };
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const currentStamp = selectedImageIndex !== null ? displayStamps[selectedImageIndex] : null;
  // プレビューの ID は DB に無いので、そのまま渡すと 404 相当の 400 を叩き続ける。
  // 検証用の経路が本番には無いエラーを生まないよう、ここでは問い合わせない
  const { isUpdating, isDeleting, handleUpdate, handleDelete } = useStampDetail(
    isPreview ? '' : (currentStamp?.id ?? '')
  );

  const sortLabel = sortOrder === 'date' ? '日付順' : 'スポット順';

  /*
   * 表示の切り替わりの動き（Issue #276）。準備・測る・時計・後始末・取りやめ・ロックは
   * useViewModeTransition に集め、この画面は面とタイルに値を渡すだけにする
   */
  const stampIds = useMemo(() => displayStamps.map(s => s.id), [displayStamps]);
  const transition = useViewModeTransition({
    tileSize: ITEM_SIZE,
    pageWidth: computePageLayout(windowWidth).pageWidth,
    columns: NUM_COLUMNS,
    reduceMotion,
    isLoading: isLoading && !isPreview,
    stampIds,
    blocked: selectedImageIndex !== null || hero.flight !== null,
  });
  const transitionPhase = transition.phase;
  /** 測ってから決まるタイルの動き。動いている間だけ */
  const transitionTiles = transitionPhase?.stage === 'running' ? transitionPhase.motion : null;

  /*
   * 御朱印帳は古い順に綴じる。そのまま開くと「最近の参拝」から来た人が
   * **本の一番遠い端**に降ろされるので、開く位置だけ最新側にする。
   *
   * **最初の1回だけ**。この画面は戻るたびに取り直すので、毎回飛ばすと
   * 途中まで見て他のタブへ行って戻った人の位置が失われる。
   * 並べ替えを切り替えたときは、新しい並びの最新側へもう一度送る
   */
  const gridRef = useRef<FlatList<StampWithSpot> | null>(null);
  const openedAt = useRef<SortOrder | null>(null);
  const openAtLatest = () => {
    if (openedAt.current === sortOrder || displayStamps.length === 0) return;
    openedAt.current = sortOrder;
    gridRef.current?.scrollToEnd({ animated: false });
  };

  /** 一覧が作り直された。見える範囲と中身の高さは新しい一覧のものを待つ */
  const setGridRef = useCallback((node: FlatList<StampWithSpot> | null) => {
    gridRef.current = node;
    gridViewportHeight.current = null;
    gridContentHeight.current = null;
    gridScrollY.current = 0;
    if (!node) gridInitialRow.current = undefined;
  }, []);

  /*
   * 一覧の行の位置を前もって決める。描き始めを見ていた1枚の行の近くにでき、最初の中身の
   * 大きさの知らせから全体の高さになる（描いていない行も数に入る。D-8 の contentH）
   */
  const gridRowHeight =
    measuredRowHeight?.sortOrder === sortOrder && measuredRowHeight.fontScale === fontScale
      ? measuredRowHeight.height
      : gridRowHeightOf(sortOrder, fontScale);
  const getGridRowLayout = useCallback(
    (_data: ArrayLike<StampWithSpot> | null | undefined, index: number) => ({
      length: gridRowHeight,
      offset: gridRowHeight * index,
      index,
    }),
    [gridRowHeight]
  );
  /** 行のセルから届いた高さ。見込みと違えば直す（文字の大きさの設定と端数） */
  const reportRowHeight = useRef<(height: number) => void>(() => {});
  reportRowHeight.current = height => {
    if (Math.abs(height - gridRowHeight) > 0.25) {
      setMeasuredRowHeight({ sortOrder, fontScale, height });
    }
  };

  /** 御朱印の並びの中の位置。見つからない・null なら最新（いちばん最後） */
  const indexOfStamp = (stampId: string | null) => {
    const index = stampId ? displayStamps.findIndex(s => s.id === stampId) : -1;
    return index >= 0 ? index : displayStamps.length - 1;
  };

  /** ボタンで めくる → 一覧 にしたとき、見ていた1枚の行が縦の真ん中に来る位置で開く（D-8） */
  const openGridAtTarget = () => {
    const target = gridOpenTarget.current;
    const viewportHeight = gridViewportHeight.current;
    const contentHeight = gridContentHeight.current;
    if (!target || viewportHeight === null || contentHeight === null) return;
    gridOpenTarget.current = null;
    // この並びの最初の1回はこれで済ませた。あとの大きさの知らせでいちばん下へ飛ばさない
    openedAt.current = sortOrder;

    const offset = gridOffsetOf(
      indexOfStamp(target.stampId),
      displayStamps.length,
      viewportHeight,
      contentHeight
    );
    // 途中の行から描き始めた一覧は、その行へ送られている。0 でも送り直す
    if (offset > 0.5 || gridInitialRow.current !== undefined) {
      gridRef.current?.scrollToOffset({ offset, animated: false });
    }
    // 切り替わりの動きは、開く位置へ送ってから測る
    transition.gridPositioned();
  };

  const handleGridLayout = (event: LayoutChangeEvent) => {
    gridViewportHeight.current = event.nativeEvent.layout.height;
    openGridAtTarget();
  };

  const handleGridContentSizeChange = (_width: number, height: number) => {
    if (gridContentHeight.current === null) gridContentHeight.current = height;
    if (gridOpenTarget.current) {
      openGridAtTarget();
      return;
    }
    openAtLatest();
  };

  /** 一覧のスクロールの位置を控える（止まったときの位置も取りこぼさない） */
  const handleGridScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    gridScrollY.current = event.nativeEvent.contentOffset.y;
  };

  /** 指で一覧を動かし始めた。開く位置へ送った scrollToOffset はここに来ない */
  const handleGridScrollBeginDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    returnToFlipStampId.current = null;
    handleGridScroll(event);
  };

  /**
   * 一覧 → めくる で開くページ（オーナーの判断 2026-09-27。D-8）。
   * ⓪ ボタンで めくる → 一覧 に来てから、指で動かさず・何も開いていなければ、めくる表示で見ていた1枚
   * ① 一覧で開いて閉じた御朱印のタイルが今も見える範囲にあれば、その御朱印
   * ② それ以外は、見える範囲の縦の真ん中を含む行の真ん中の列（3枚に満たなければその行の最後）
   * ③ 一覧の大きさが分からないなど、どちらも取れなければ null（最新）
   */
  const flipOpenStampIdFromGrid = (): string | null => {
    const back = returnToFlipStampId.current;
    if (back && displayStamps.some(s => s.id === back)) return back;

    const viewportHeight = gridViewportHeight.current;
    const count = displayStamps.length;
    if (viewportHeight === null || viewportHeight <= 0 || count === 0) return null;
    const top = gridScrollY.current;
    const bottom = top + viewportHeight;

    const closedIndex = closedGridStampId.current
      ? displayStamps.findIndex(s => s.id === closedGridStampId.current)
      : -1;
    if (closedIndex >= 0) {
      const tileTop = Math.floor(closedIndex / NUM_COLUMNS) * gridRowHeight;
      // タイル（写真の枠）が縦に 1pt より多く見えている（D-10 の見えているタイルと同じ）
      if (Math.min(tileTop + ITEM_SIZE, bottom) - Math.max(tileTop, top) > 1) {
        return displayStamps[closedIndex].id;
      }
    }

    const rows = Math.ceil(count / NUM_COLUMNS);
    const row = Math.min(
      rows - 1,
      Math.max(0, Math.floor((top + viewportHeight / 2) / gridRowHeight))
    );
    return displayStamps[Math.min(row * NUM_COLUMNS + 1, count - 1)].id;
  };

  const handleToggleSort = () => {
    gridOpenTarget.current = null;
    gridInitialRow.current = undefined;
    closedGridStampId.current = null;
    returnToFlipStampId.current = null;
    setSortOrder(prev => (prev === 'date' ? 'spot' : 'date'));
  };

  /**
   * ボタンで表示を切り替えた（D-8）。めくる → 一覧 は、めくる表示で見ていた1枚の行で開く。
   * 一覧 → めくる は、一覧で開いて閉じた御朱印か、一覧の見える範囲の真ん中の御朱印で開く。
   * 起動時・取り直したとき・並び替えたときの開く位置は今のまま
   */
  const handleViewModeChange = (next: GalleryViewMode) => {
    // 束のいちばん上の1枚。取れなければ最新
    const stackTopId = next === 'grid' ? flipStampId : flipOpenStampIdFromGrid();
    const stackTop = displayStamps[indexOfStamp(stackTopId)];
    if (next === 'grid') {
      gridOpenTarget.current = { stampId: flipStampId };
      returnToFlipStampId.current = stackTop?.id ?? null;
      const firstRow = Math.floor(indexOfStamp(flipStampId) / NUM_COLUMNS) - ROWS_ABOVE_ON_OPEN;
      gridInitialRow.current = firstRow > 0 ? firstRow : undefined;
    } else {
      gridOpenTarget.current = null;
      closedGridStampId.current = null;
      returnToFlipStampId.current = null;
      // 最新も名指しで渡す。めくる表示が最初の描画からそのページを描く
      setFlipOpenRequest({ stampId: stackTop?.id ?? null });
    }
    // 動かせるなら、入ってくる側を見えないまま描き足して測る。動かせないならその場で切り替える
    if (stackTop) transition.begin({ from: viewMode, to: next, stampId: stackTop.id });
    setViewMode(next);
  };

  // 開くページの指定は、切り替えが済んだら（その場で切り替えたらその描画のあとで）捨てる
  const transitionActive = transition.active;
  useEffect(() => {
    if (flipOpenRequest && !transitionActive) setFlipOpenRequest(null);
  }, [flipOpenRequest, transitionActive]);

  // 取り直したら、一覧の開く位置は今のまま（ボタンで切り替えたときの位置は使わない）
  useEffect(() => {
    if (!isLoading) return;
    gridOpenTarget.current = null;
    gridInitialRow.current = undefined;
    closedGridStampId.current = null;
    returnToFlipStampId.current = null;
  }, [isLoading]);

  /*
   * 一覧の行のセル（Issue #276 D-16）。切り替わりの動きの間、束のいちばん上の1枚を含む行を
   * ほかの行より上に出す。**画面で一度だけ作る**（部品が替わると全タイルが作り直されて
   * 写真を読み直す）。持ち上げる行は ref に入れ、extraData でセルを描き直させる
   */
  const liftedRow = useRef<number | null>(null);
  const GridRowCell = useMemo(() => {
    function GalleryRowCell({
      index,
      style,
      onLayout,
      onFocusCapture,
      children,
    }: GridRowCellProps) {
      // onFocusCapture は View の型に無いが、RN の既定のセルと同じく View に渡す
      const focusProps = { onFocusCapture } as Partial<ViewProps>;
      return (
        <View
          testID={`gallery-row-${index}`}
          style={[style, liftedRow.current === index && styles.lifted]}
          onLayout={event => {
            onLayout?.(event);
            reportRowHeight.current(event.nativeEvent.layout.height);
          }}
          {...focusProps}
        >
          {children}
        </View>
      );
    }
    return GalleryRowCell;
  }, []);
  // セルは props を足せないので、持ち上げる行はここで控えて extraData で描き直させる
  liftedRow.current = transitionTiles ? transitionTiles.stackTopRow : null;

  const galleryImages: GalleryImage[] = useMemo(
    () =>
      displayStamps.map(s => ({
        id: s.id,
        // 詳細は変換した方を見る。元は HEIC で Safari 以外では表示できない。
        // R2 に原本が無ければ元に落ちる（Issue #196 / #227 S4a）
        imageUrl: isPreview ? previewImageUrl(s) : getStampViewUrl(s.image_path),
        fallbackUrl: isPreview ? undefined : getStampImageUrl(s.image_path),
        spotName: s.spots.name,
        memo: s.memo,
        visitedAt: s.visited_at,
      })),
    [displayStamps, isPreview]
  );

  const handleEdit = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setEditModalVisible(true);
  }, []);

  const handleDeletePress = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setDeleteModalVisible(true);
  }, []);

  const onSave = useCallback(
    async (params: { visited_at: string; memo: string | null; newImageUri?: string }) => {
      const updated = await handleUpdate(params);
      if (updated) {
        updateGalleryStamp(updated);
        setEditModalVisible(false);
      }
    },
    [handleUpdate, updateGalleryStamp]
  );

  const onConfirmDelete = useCallback(async () => {
    const stampId = currentStamp?.id;
    const success = await handleDelete();
    if (success) {
      setDeleteModalVisible(false);
      // 詳細は一覧から飛ばした1枚を持ったまま開いている。詳細だけ閉じて1枚を
      // 持ち続けると、次に押した御朱印の飛行がそれに引きずられて詳細が開かない
      // （1.2.0 の実機で発覚）。閉じるときの後始末と同じことをする
      setSelectedImageIndex(null);
      setFlyingStampId(null);
      setResting(false);
      hero.end();
      // 消した御朱印では開かない
      gridDetailStampId.current = null;
      closedGridStampId.current = null;
      if (stampId) {
        removeStamp(stampId);
      }
    }
  }, [handleDelete, currentStamp?.id, removeStamp, hero]);

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, '/');

  /**
   * 一覧に出す URL。小さい方を先に見に行く（Issue #194）。
   * 飛ぶ1枚もこれを使う。一覧がもう持っている画像なので待たずに飛べる
   */
  const imageUrlOf = (stamp: StampWithSpot) => {
    if (isPreview) return previewImageUrl(stamp);
    if (thumbMissing.has(stamp.id)) return getStampImageUrl(stamp.image_path);
    return getStampThumbUrl(stamp.image_path);
  };

  /** 押したタイルから詳細へ飛ばす。測れなければ演出を諦めて開く（Issue #192） */
  const openStamp = (
    index: number,
    stamp: StampWithSpot,
    fit: 'cover' | 'contain' = 'cover',
    // 飛ぶ1枚は、押した画面に出ているものと同じ URL を使う。違うものを使うと
    // 出発の瞬間に解像度が変わって見える
    imageUrl: string = imageUrlOf(stamp)
  ) => {
    hero.start(
      {
        stampId: stamp.id,
        index,
        direction: 'in',
        imageUrl,
        spotName: stamp.spots.name,
        visitedAt: formatDate(stamp.visited_at),
        memo: stamp.memo ?? null,
        fit,
      },
      // 開かないのが一番まずい。飛べないときはそのまま出す
      started => {
        if (!started) setSelectedImageIndex(index);
      }
    );
  };

  /**
   * 閉じる。行きに飛ばした1枚をそのまま持っているので、向き直すだけで帰れる。
   * 作り直すと写真の読み込みからやり直しになり、間に合わずに空の枠が飛ぶ。
   *
   * 詳細では横に移れないので、帰り先は必ず来たタイル。例外の分岐が要らない
   */
  const closeStamp = () => {
    // 一覧から開いた詳細なら、閉じたときに出ていた御朱印を控える（D-8 の ①）
    if (gridDetailStampId.current) closedGridStampId.current = gridDetailStampId.current;
    gridDetailStampId.current = null;

    if (resting && hero.flight) {
      setResting(false);
      hero.turnBack();
      return;
    }

    setSelectedImageIndex(null);
    setFlyingStampId(null);
    setResting(false);
    hero.end();
  };

  /**
   * 動き出した合図。飛ぶと決めた時ではなくここで元を隠す。
   * 写真の読み込みを待つぶん間があり、その間に隠すと穴があき、
   * 隠さないまま飛び始めると同じ御朱印が二重に見える
   */
  /**
   * 詳細側の写真が出せるようになった合図。ここで初めて飛ぶ1枚を溶かす。
   * 合図が来ないことがあるので、少し待って諦める
   */
  const handleDetailImageReady = useCallback(() => setResting(true), []);

  useEffect(() => {
    if (selectedImageIndex === null || resting) return;
    const timer = setTimeout(() => setResting(true), HANDOVER_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [selectedImageIndex, resting]);

  const handleFlightStart = () => {
    if (!hero.flight) return;
    setFlyingStampId(hero.flight.stampId);
    // 戻るときは、飛ぶ1枚が出てから詳細を外す。先に外すと地が一瞬素になる
    if (hero.flight.direction === 'out') setSelectedImageIndex(null);
  };

  const handleFlightDone = () => {
    // 行きはここで終わりにしない。同じ1枚を持ったまま詳細の裏で待たせる。
    // ⚠️ ここで引っ込めないこと。詳細の画像はまだ読み込み中で、切り替えた
    // 瞬間に写真が消えて見える。詳細から「出せる」合図が来てから溶かす
    if (hero.flight?.direction === 'in') {
      setSelectedImageIndex(hero.flight.index);
      return;
    }

    setFlyingStampId(null);
    setResting(false);
    hero.end();
  };

  /*
   * 一覧のタイルに渡す手続きは、描き直しても変わらないものにする。タイルは渡すものが
   * 変わらなければ描き直さない（Issue #276。動き出しの直前の描き直しを軽くする）
   */
  const openStampRef = useRef(openStamp);
  openStampRef.current = openStamp;
  const handlePressTile = useCallback((index: number, stamp: StampWithSpot) => {
    gridDetailStampId.current = stamp.id;
    returnToFlipStampId.current = null;
    openStampRef.current(index, stamp);
  }, []);
  const handleThumbMissingRef = useRef(handleThumbMissing);
  handleThumbMissingRef.current = handleThumbMissing;
  const handleTileThumbMissing = useCallback(
    (stamp: StampWithSpot) => handleThumbMissingRef.current(stamp),
    []
  );

  const renderItem = ({ item, index }: { item: StampWithSpot; index: number }) => (
    <GalleryGridTile
      stamp={item}
      index={index}
      imageUrl={imageUrlOf(item)}
      size={ITEM_SIZE}
      middleColumn={index % NUM_COLUMNS === 1}
      showDate={sortOrder === 'date'}
      // 飛んでいる間は隠す。出したままだと同じ御朱印が一覧と空中で二重に見える
      hidden={flyingStampId === item.id}
      reduceMotion={reduceMotion}
      // 切り替わりの動き（Issue #276）。見えているタイルだけが値を持つ
      motion={transitionTiles?.tiles.get(item.id)}
      stackTop={transitionTiles?.stackTopStampId === item.id}
      onPress={handlePressTile}
      onImageLoad={hero.rememberAspect}
      onThumbMissing={handleTileThumbMissing}
      registerHero={hero.registerTile}
      registerMotion={transition.registerTile}
    />
  );

  /*
   * めくる表示に渡す手続きも、描き直しても変わらないものにする。変わるとめくる表示が
   * 描いている全部のページを描き直す（切り替わりの準備と動き出しが重くなる）
   */
  const displayStampsRef = useRef(displayStamps);
  displayStampsRef.current = displayStamps;
  /*
   * めくる表示で元の写真に落ちたページ（Issue #227 S4a-2）。飛ぶ1枚を出ている URL に
   * 合わせるためだけに使う。state にするとめくる表示の全ページが描き直しになるので ref に控える。
   * 落ちたのが一時の失敗で、ページが外れて付け直されたら変換が読めた、もあるので、
   * 変換が読めたら控えを消す（#304 の指摘）
   */
  const flipFellBack = useRef<Set<string>>(new Set());
  const handleFlipImageFallback = useCallback((stampId: string) => {
    flipFellBack.current.add(stampId);
  }, []);
  const handleFlipPrimaryImageLoad = useCallback((stampId: string) => {
    flipFellBack.current.delete(stampId);
  }, []);
  const handlePressFlipStamp = useCallback((index: number) => {
    gridDetailStampId.current = null;
    const stamp = displayStampsRef.current[index];
    if (!stamp) return;
    // 飛ぶ1枚は、ページに出ているもの（R2 の 1200、落ちたページは元の写真）と同じ URL
    const imageUrl = flipFellBack.current.has(stamp.id)
      ? getStampImageUrl(stamp.image_path)
      : getStampViewUrl(stamp.image_path);
    // 蛇腹は contain。枠（1:1.5）と写真（3:4）がずれるので、
    // 写真が実際に占めているところから飛ばす（Issue #202）
    openStampRef.current(index, stamp, 'contain', imageUrl);
  }, []);
  const { registerTile: registerHeroNode } = hero;
  const { registerPageSurface } = transition;
  const registerFlipNode = useCallback(
    (id: string, part: 'image' | 'text', node: View | null) => {
      registerHeroNode(id, part, node);
      if (part === 'image') registerPageSurface(id, node);
    },
    [registerHeroNode, registerPageSurface]
  );
  const handlePressBlank = useCallback(
    () => navigation.navigate('Record', { origin: 'gallery' }),
    [navigation]
  );

  /** 面の見え方。切り替えの間は時計から引く（時計が 0 のうちは、入ってくる側は見えない） */
  const paneStyleOf = (pane: GalleryViewMode) => [
    StyleSheet.absoluteFill,
    transitionPhase && { opacity: transitionPhase.base.paneOpacity[pane] },
  ];

  return (
    <View style={styles.rootContainer}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>御朱印帳</Text>
          {showsGallery && (
            <ViewModeToggle
              mode={viewMode}
              onChange={handleViewModeChange}
              reduceMotion={reduceMotion}
              // 切り替わりの動きの間・詳細を開いている間は押しても何もしない
              locked={transition.locked}
            />
          )}
        </View>

        {!showsGallery ? (
          <View style={styles.centerContainer} testID="gallery-guest-empty-state">
            <MaterialIcons name="photo-library" size={48} color={colors.gray[400]} />
            <Text style={styles.emptyText}>あなたの御朱印帳</Text>
            <Text style={styles.emptySubText}>記録した御朱印がここに一覧で並びます</Text>
            <View style={styles.guestPreviewList}>
              {GUEST_PREVIEW_ITEMS.map(item => (
                <View key={item.icon} style={styles.guestPreviewRow}>
                  <MaterialIcons name={item.icon} size={20} color={colors.gray[400]} />
                  <Text style={styles.guestPreviewText}>{item.label}</Text>
                </View>
              ))}
            </View>
            <Button
              title="ログインして始める"
              variant="primary"
              testID="gallery-login-cta"
              onPress={() => navigation.navigate('Login')}
              style={styles.guestCta}
            />
          </View>
        ) : isLoading && !isPreview ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator
              size="large"
              color={colors.primary[500]}
              testID="loading-indicator"
            />
          </View>
        ) : (
          <View
            testID="gallery-content"
            style={styles.content}
            onLayout={transition.onContentLayout}
            ref={transition.registerContent}
          >
            {/*
             * 静かなときは表示している面だけを描く。準備中と動いている間だけ両方を描き、
             * 終わったら出ていく側を外す（Issue #276 D-7）
             */}
            {(viewMode === 'flip' || transitionPhase) && (
              <Animated.View
                ref={node => {
                  transition.registerPane('flip', node as View | null);
                }}
                testID="gallery-flip-pane"
                style={paneStyleOf('flip')}
                pointerEvents={transitionPhase ? 'none' : 'auto'}
              >
                <GoshuinchoFlipView
                  stamps={displayStamps}
                  resolveImageUrl={isPreview ? previewImageUrl : undefined}
                  onImageFallback={handleFlipImageFallback}
                  onPrimaryImageLoad={handleFlipPrimaryImageLoad}
                  onPressStamp={handlePressFlipStamp}
                  registerNode={registerFlipNode}
                  onImageLoad={hero.rememberAspect}
                  hiddenStampId={flyingStampId}
                  reduceMotion={reduceMotion}
                  onPressBlank={handlePressBlank}
                  initialStampId={flipOpenRequest?.stampId ?? null}
                  onCurrentStampChange={setFlipStampId}
                  motion={transitionPhase?.base.flip ?? null}
                />
              </Animated.View>
            )}
            {(viewMode === 'grid' || transitionPhase) && (
              <Animated.View
                testID="gallery-grid-pane"
                style={paneStyleOf('grid')}
                pointerEvents={transitionPhase ? 'none' : 'auto'}
              >
                <View style={styles.sortRow}>
                  <TouchableOpacity onPress={handleToggleSort} testID="sort-button">
                    <Text style={styles.sortText}>{sortLabel} ▼</Text>
                  </TouchableOpacity>
                </View>
                {displayStamps.length === 0 ? (
                  <View style={styles.centerContainer} testID="empty-state">
                    <MaterialIcons name="photo-library" size={48} color={colors.gray[400]} />
                    <Text style={styles.emptyText}>御朱印がまだありません</Text>
                    <Text style={styles.emptySubText}>
                      御朱印を記録して、コレクションを始めましょう
                    </Text>
                    {/* めくり表示は白紙ページが記録の入口になるが、グリッドには入口が無い（監査 A-10） */}
                    <Button
                      title="御朱印を記録する"
                      variant="primary"
                      testID="gallery-record-cta"
                      onPress={() => navigation.navigate('Record', { origin: 'gallery' })}
                      style={styles.emptyCta}
                    />
                  </View>
                ) : (
                  <View
                    ref={node => {
                      transition.registerPane('viewport', node);
                    }}
                    testID="gallery-list-viewport"
                    style={styles.listViewport}
                  >
                    <FlatList
                      ref={setGridRef}
                      data={displayStamps}
                      renderItem={renderItem}
                      keyExtractor={item => item.id}
                      numColumns={NUM_COLUMNS}
                      key={sortOrder}
                      contentContainerStyle={styles.listContent}
                      CellRendererComponent={GridRowCell}
                      getItemLayout={getGridRowLayout}
                      initialScrollIndex={gridInitialRow.current}
                      initialNumToRender={gridInitialRow.current === undefined ? undefined : 7}
                      windowSize={transitionPhase?.to === 'grid' ? 3 : undefined}
                      // 切り替わりの動きの間、束のいちばん上の行をセルに描き直させる
                      extraData={transitionPhase}
                      onLayout={handleGridLayout}
                      /*
                       * **いちばん下（最新）から開く**。綴じる順は変えない。
                       * 高さが出そろってからでないと端まで飛べないので、
                       * 中身の大きさが決まった合図で送る。
                       * ボタンで めくる → 一覧 にしたときは、見ていた1枚の行で開く（Issue #276）
                       */
                      onContentSizeChange={handleGridContentSizeChange}
                      onScroll={handleGridScroll}
                      onScrollBeginDrag={handleGridScrollBeginDrag}
                      onScrollEndDrag={handleGridScroll}
                      onMomentumScrollEnd={handleGridScroll}
                      testID="gallery-list"
                    />
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        )}

        {currentStamp && (
          <>
            <EditStampModal
              visible={editModalVisible}
              onClose={() => setEditModalVisible(false)}
              onSave={onSave}
              isUpdating={isUpdating}
              initialVisitedAt={currentStamp.visited_at}
              initialMemo={currentStamp.memo}
              // 全画面と同じ R2 の 1200（読み込み済み）。R2 に無ければ元の写真（Issue #227 S4a-2）
              initialImageUrl={getStampViewUrl(currentStamp.image_path)}
              initialImageFallbackUrl={getStampImageUrl(currentStamp.image_path)}
            />
            <DeleteConfirmModal
              visible={deleteModalVisible}
              onClose={() => setDeleteModalVisible(false)}
              onConfirm={onConfirmDelete}
              isDeleting={isDeleting}
              spotName={currentStamp.spots.name}
            />
          </>
        )}
      </SafeAreaView>
      <ImageGalleryModal
        visible={selectedImageIndex !== null}
        onClose={closeStamp}
        images={galleryImages}
        initialIndex={selectedImageIndex ?? 0}
        onEdit={handleEdit}
        onDelete={handleDeletePress}
        onImageReady={handleDetailImageReady}
        // 一覧のタイルと詳細を1対1で繋いでいる。途中で別の1枚に移ると
        // その結びつきが切れて元のタイルへ戻れない。順に見る動線は
        // 蛇腹めくりが持っている（Issue #192）
        swipeable={false}
        // 詳細の中で送ったら、閉じたときに出ている1枚を控える（D-8 の ①）
        onIndexChange={index => {
          if (gridDetailStampId.current) {
            gridDetailStampId.current = displayStamps[index]?.id ?? gridDetailStampId.current;
          }
        }}
        // 指で写真を下へずらしてから離すと、そこから一覧へ戻る連続的な動きが
        // 始められない。閉じる合図だけ受け取って、写真は元の位置から戻す
        dismissFollowsFinger={false}
        useModal={false}
      />

      {hero.flight && (
        <HeroFlyer
          // 向きでは作り直さない。同じ1枚を行きと帰りで使い回す
          key={hero.flight.stampId}
          imageUrl={hero.flight.imageUrl}
          imageAspect={hero.flight.imageAspect}
          sourceRect={hero.flight.sourceRect}
          sourceTextRect={hero.flight.sourceTextRect}
          spotName={hero.flight.spotName}
          visitedAt={hero.flight.visitedAt}
          memo={hero.flight.memo}
          direction={hero.flight.direction}
          resting={resting}
          onStart={handleFlightStart}
          onDone={handleFlightDone}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.gray[800],
  },
  content: {
    flex: 1,
  },
  listViewport: {
    flex: 1,
  },
  /** 束のいちばん上の1枚（を含む行）を、ほかの行・タイルより上に出す（Issue #276 D-16） */
  lifted: {
    zIndex: 1,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  sortText: {
    ...typography.bodySmall,
    color: colors.gray[600],
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.gray[600],
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubText: {
    ...typography.bodySmall,
    color: colors.gray[400],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  guestPreviewList: {
    marginTop: spacing.xl,
    alignSelf: 'center',
  },
  guestPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  guestPreviewText: {
    ...typography.bodySmall,
    color: colors.gray[500],
    marginLeft: spacing.sm,
  },
  guestCta: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  emptyCta: {
    marginTop: spacing.lg,
  },
});
