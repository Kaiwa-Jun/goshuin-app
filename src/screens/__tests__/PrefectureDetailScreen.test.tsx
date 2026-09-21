import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PrefectureDetailScreen } from '@screens/PrefectureDetailScreen';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const RN = require('react-native');
  return { SafeAreaView: RN.View, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
});

jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));

const mockFetchStamps = jest.fn();
const mockFetchSpotCount = jest.fn();
jest.mock('@services/stamps', () => ({
  fetchStampsByPrefecture: (...a: unknown[]) => mockFetchStamps(...a),
  getStampThumbUrl: (p: string) => `thumb://${p}`,
  getStampViewUrl: (p: string) => `view://${p}`,
  getStampImageUrl: (p: string) => `full://${p}`,
}));
jest.mock('@services/collection', () => ({
  fetchSpotCountByPrefecture: (...a: unknown[]) => mockFetchSpotCount(...a),
}));

const stamp = (id: string, spotId: string) => ({
  id,
  spot_id: spotId,
  image_path: `${id}.jpg`,
  visited_at: '2026-09-20',
  memo: null,
  spots: { name: '湯島天満宮', type: 'shrine' },
});

const navigation = {
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
};

const setup = (prefecture = '東京都') =>
  render(
    <PrefectureDetailScreen
      navigation={navigation as never}
      route={{ key: 'k', name: 'PrefectureDetail', params: { prefecture } } as never}
    />
  );

describe('PrefectureDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchStamps.mockResolvedValue([stamp('s1', 'a'), stamp('s2', 'a'), stamp('s3', 'b')]);
    mockFetchSpotCount.mockResolvedValue(20);
  });

  it('見出しは正式名で、戻る導線がある', async () => {
    const { getByText, getByTestId } = setup();

    expect(getByText('東京都')).toBeTruthy();
    fireEvent.press(getByTestId('prefecture-back'));
    expect(navigation.goBack).toHaveBeenCalled();
    await waitFor(() => expect(mockFetchStamps).toHaveBeenCalled());
  });

  // 一覧に出ている枚数と数字が食い違わないよう、取ってきた御朱印から数える
  it('枚数と箇所数を、一覧と同じ元から数える', async () => {
    const { getByTestId } = setup();

    await waitFor(() => expect(getByTestId('prefecture-count').props.children).toBe('3枚'));
    expect(getByTestId('prefecture-sub').props.children).toBe('2 / 20箇所');
  });

  it('その県で1回だけ取りに行く', async () => {
    setup();

    await waitFor(() => expect(mockFetchStamps).toHaveBeenCalledWith('user-1', '東京都'));
    expect(mockFetchStamps).toHaveBeenCalledTimes(1);
  });

  it('御朱印をタップすると、その1枚から全画面で開く', async () => {
    const { findByTestId, UNSAFE_getByType } = setup();

    fireEvent.press(await findByTestId('prefecture-stamp-s2'));

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { ImageGalleryModal } = require('@components/common/ImageGalleryModal');
    const gallery = UNSAFE_getByType(ImageGalleryModal);
    expect(gallery.props.visible).toBe(true);
    expect(gallery.props.initialIndex).toBe(1);
    // あゆみから編集・削除には入らせない
    expect(gallery.props.onEdit).toBeUndefined();
    expect(gallery.props.onDelete).toBeUndefined();
    // シートに入れ子にしないので、全画面のモーダルのまま出す
    expect(gallery.props.useModal).toBeUndefined();
  });

  /*
   * 縮小版は登録のあとで焼かれる。焼き上がる前に開くと404になるので、
   * 元の写真に落として表示を続ける（御朱印帳と同じ作法）
   */
  it('縮小版が無ければ、元の写真に落として出し続ける', async () => {
    const { findByTestId } = setup();
    const image = await findByTestId('prefecture-stamp-image-s1');

    expect(image.props.source.uri).toBe('thumb://s1.jpg');
    fireEvent(image, 'error');

    expect((await findByTestId('prefecture-stamp-image-s1')).props.source.uri).toBe(
      'full://s1.jpg'
    );
  });

  describe('まだ行っていない県', () => {
    beforeEach(() => mockFetchStamps.mockResolvedValue([]));

    it('行き止まりにせず、地図への導線を出す', async () => {
      const parentNavigate = jest.fn();
      (navigation.getParent as jest.Mock).mockReturnValue({ navigate: parentNavigate });
      const { findByTestId, getByText } = setup('高知県');

      expect(getByText('まだ御朱印がありません')).toBeTruthy();
      fireEvent.press(await findByTestId('prefecture-see-spots'));

      expect(parentNavigate).toHaveBeenCalledWith('MapTab', {
        screen: 'Map',
        params: { focusPrefecture: '高知県' },
      });
    });
  });
});
