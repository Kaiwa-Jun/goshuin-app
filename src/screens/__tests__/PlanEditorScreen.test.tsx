import React from 'react';
import { AccessibilityInfo, Alert, Dimensions, Linking, StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';

import { PlanEditorScreen } from '@screens/PlanEditorScreen';
import { DRAWER_LOW } from '@components/plan/PlanDrawer';
import type { Spot } from '@/types/supabase';
import type { VisitPlan } from '@/types/visitPlan';
import { colors } from '@theme/colors';
import { Line } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

/* 契約書: docs/issues/issue-258-visit-plan.md（S4〜S6 / AC-31〜46・UI-7） */

const mockAuth = { isAuthenticated: true, user: { id: 'me' } };
jest.mock('@hooks/useAuth', () => ({ useAuth: () => mockAuth }));
const mockLocation: { location: { latitude: number; longitude: number } | null } & Record<
  string,
  unknown
> = {
  location: null,
  permissionStatus: 'granted',
  refreshLocation: jest.fn(),
};
jest.mock('@hooks/useLocation', () => ({ useLocation: () => mockLocation }));
const mockStamps = { visitedSpotIds: new Set<string>() };
jest.mock('@hooks/useUserStamps', () => ({ useUserStamps: () => mockStamps }));
let mockWishlist = { wishlistSpotIds: new Set<string>(), toggleWishlist: jest.fn() };
jest.mock('@hooks/useWishlist', () => ({ useWishlist: () => mockWishlist }));
let mockSpots: { spots: Spot[]; allSpots: Spot[]; isLoading: boolean; error: null };
jest.mock('@hooks/useSpots', () => ({ useSpots: () => mockSpots }));

const mockFetchPlans = jest.fn();
const mockSave = jest.fn();
const mockDelete = jest.fn();
const mockFetchVisited = jest.fn();
jest.mock('@services/visitPlans', () => {
  class VisitPlanDateTakenError extends Error {}
  return {
    VisitPlanDateTakenError,
    fetchVisitPlans: () => mockFetchPlans(),
    saveVisitPlan: (...a: unknown[]) => mockSave(...a),
    deleteVisitPlan: (...a: unknown[]) => mockDelete(...a),
    fetchVisitedSpotIdsByDate: (...a: unknown[]) => mockFetchVisited(...a),
  };
});
const mockReception = jest.fn();
jest.mock('@services/spotInfo', () => ({
  fetchReceptionHours: (...a: unknown[]) => mockReception(...a),
}));

const spot = (id: string, name: string, lat: number, lng: number, type = 'shrine'): Spot =>
  ({
    id,
    name,
    lat,
    lng,
    type,
    status: 'active',
    rank: 3,
    address: null,
    created_by_user_id: null,
    merged_into_spot_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  }) as Spot;

// 試作 v3 の京都5社（契約書の固定データ）
const KYOTO = [
  spot('kiyomizu', '清水寺', 34.995, 135.7843, 'temple'),
  spot('yasaka', '八坂神社', 35.0036, 135.778),
  spot('fushimi', '伏見稲荷大社', 34.9672, 135.7732),
  spot('kennin', '建仁寺', 34.9996, 135.7742, 'temple'),
  spot('sanju', '三十三間堂', 34.9897, 135.7727, 'temple'),
];
const CLOSE = new Map([
  ['yasaka', '17:00'],
  ['kennin', '16:30'],
  ['kiyomizu', '18:00'],
  ['sanju', '16:00'],
  ['fushimi', '16:30'],
]);
const SUGGESTED = ['八坂神社', '建仁寺', '清水寺', '三十三間堂', '伏見稲荷大社'];

const planOf = (id: string, plannedOn: string, name: string, ids: string[]): VisitPlan => ({
  id,
  plannedOn,
  name,
  stops: ids.map((sid, i) => {
    const s = KYOTO.find(k => k.id === sid)!;
    return {
      spotId: sid,
      position: i,
      spot: { id: s.id, name: s.name, type: s.type, lat: s.lat, lng: s.lng },
    };
  }),
});

const nav = () => ({ navigate: jest.fn(), setParams: jest.fn(), goBack: jest.fn() });
const renderScreen = (
  params: { planId?: string; date?: string; purchased?: boolean },
  n = nav()
) => {
  const r = render(
    <PlanEditorScreen
      navigation={n as never}
      route={{ key: 'k', name: 'PlanEditor', params } as never}
    />
  );
  return { ...r, nav: n };
};

const features = (r: ReturnType<typeof render>, id: string) =>
  r.getByTestId(id).props.data.features as { properties: Record<string, unknown> }[];

const pressPin = (r: ReturnType<typeof render>, spotId: string) =>
  fireEvent(r.getByTestId('goshuin-spots'), 'onPress', {
    nativeEvent: { lngLat: [135.77, 35], features: [{ properties: { spotId } }] },
  });

/** 行きたいの「＋」で京都5社を選ぶ */
const addAllFromWishlist = (r: ReturnType<typeof render>) => {
  for (const s of KYOTO) fireEvent.press(r.getByTestId(`plan-wish-add-${s.id}`));
};

const stopNames = (r: ReturnType<typeof render>) =>
  r
    .getAllByTestId(/^plan-stop-\d+$/)
    .map(el => (el.props.accessibilityLabel as string).replace(/^\d+番目 /, ''));

let reduceMotion = false;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 26, 10, 0));
  reduceMotion = false;
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => Promise.resolve(reduceMotion));
  mockSpots = { spots: KYOTO, allSpots: KYOTO, isLoading: false, error: null };
  mockWishlist = { wishlistSpotIds: new Set(KYOTO.map(s => s.id)), toggleWishlist: jest.fn() };
  mockStamps.visitedSpotIds = new Set();
  mockLocation.location = null;
  mockLocation.permissionStatus = 'granted';
  mockReception.mockResolvedValue(CLOSE);
  mockFetchPlans.mockResolvedValue([]);
  mockSave.mockResolvedValue('new-id');
  mockDelete.mockResolvedValue(undefined);
  mockFetchVisited.mockResolvedValue(new Map());
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
});

it('ドロワーは低い段で画面の 36%（地図を広く見せる）', () => {
  expect(DRAWER_LOW).toBe(0.36);
});

describe('最初のカメラ', () => {
  const { __cameraMocks: cameraMocks } = jest.requireMock('@maplibre/maplibre-react-native') as {
    __cameraMocks: Record<string, jest.Mock>;
  };

  it('現在地が後から取れたら、そこへ寄せる（開いた瞬間は仙台の既定のまま）', async () => {
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    expect(cameraMocks.flyTo).not.toHaveBeenCalled();
    mockLocation.location = { latitude: 35.65, longitude: 139.54 };
    r.rerender(
      <PlanEditorScreen
        navigation={r.nav as never}
        route={{ key: 'k', name: 'PlanEditor', params: { date: '2026-10-03' } } as never}
      />
    );
    expect(cameraMocks.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [139.54, 35.65], zoom: 13 })
    );
    // 上のバーと下のドロワーを除いた、見えている地図の真ん中に出す
    const { padding } = cameraMocks.flyTo.mock.calls.at(-1)[0];
    expect(padding.top).toBeGreaterThan(0);
    expect(padding.bottom).toBeCloseTo(Dimensions.get('window').height * DRAWER_LOW);
  });

  it('保存済みの予定を開いたときは、現在地ではなく予定の寺社に寄せる', async () => {
    mockFetchPlans.mockResolvedValue([
      planOf('plan-1', '2026-10-03', '東山', ['yasaka', 'kennin']),
    ]);
    mockLocation.location = { latitude: 35.65, longitude: 139.54 };
    renderScreen({ planId: 'plan-1' });
    await act(async () => {});
    expect(cameraMocks.flyTo).not.toHaveBeenCalled();
    expect(cameraMocks.fitBounds).toHaveBeenCalled();
  });
});

describe('地図の現在地と「行きたい」', () => {
  const { __cameraMocks: cameraMocks } = jest.requireMock('@maplibre/maplibre-react-native') as {
    __cameraMocks: Record<string, jest.Mock>;
  };
  const coordsOf = (r: ReturnType<typeof render>) =>
    (
      r.getByTestId('goshuin-current-location').props.data.features as {
        geometry: { coordinates: number[] };
      }[]
    ).map(f => f.geometry.coordinates);

  it('現在地の点を出す。位置情報が許可されていなければ出さない（仙台の既定を点にしない）', async () => {
    mockLocation.location = { latitude: 35.65, longitude: 139.54 };
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    expect(coordsOf(r)).toEqual([[139.54, 35.65]]);

    mockLocation.permissionStatus = 'denied';
    const d = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    expect(coordsOf(d)).toEqual([]);
  });

  it('「行きたい」で行きたいの寺社が全部入るように寄せる', async () => {
    mockWishlist = { wishlistSpotIds: new Set(['yasaka', 'fushimi']), toggleWishlist: jest.fn() };
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    fireEvent.press(r.getByTestId('plan-map-wishlist'));
    expect(cameraMocks.fitBounds).toHaveBeenLastCalledWith(
      [135.7732, 34.9672, 135.778, 35.0036],
      expect.any(Object)
    );
  });

  it('行きたいが1社なら、その寺社へ寄せる。0社ならボタンを出さない', async () => {
    mockWishlist = { wishlistSpotIds: new Set(['yasaka']), toggleWishlist: jest.fn() };
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    fireEvent.press(r.getByTestId('plan-map-wishlist'));
    expect(cameraMocks.flyTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ center: [135.778, 35.0036] })
    );

    mockWishlist = { wishlistSpotIds: new Set(), toggleWishlist: jest.fn() };
    const e = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    expect(e.queryByTestId('plan-map-wishlist')).toBeNull();
  });

  it('「現在地」で現在地へ戻る', async () => {
    mockLocation.location = { latitude: 35.65, longitude: 139.54 };
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    fireEvent.press(r.getByTestId('plan-map-locate'));
    expect(cameraMocks.flyTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        center: [139.54, 35.65],
        padding: expect.objectContaining({ bottom: expect.any(Number) }),
      })
    );
  });
});

describe('プラスを買った直後（#270 / AC-34・UI-4）', () => {
  it('purchased で一言を出し、3.2秒で消える。params から消す', async () => {
    const r = renderScreen({ date: '2026-10-10', purchased: true });
    await act(async () => {});
    expect(r.getByText('プラスになりました。ありがとうございます')).toBeTruthy();
    expect(r.nav.setParams).toHaveBeenCalledWith({ purchased: undefined });
    const toast = r.getByTestId('plus-thanks-toast');
    expect(StyleSheet.flatten(toast.props.style).backgroundColor).toBe(colors.gray[900]);
    const icon = within(toast).UNSAFE_getByType(MaterialIcons);
    expect(icon.props).toMatchObject({ name: 'auto-awesome', color: colors.primary[300] });
    act(() => {
      jest.advanceTimersByTime(3200);
    });
    expect(r.queryByText('プラスになりました。ありがとうございます')).toBeNull();
  });

  it('purchased が無ければ出さない', async () => {
    const r = renderScreen({ date: '2026-10-10' });
    await act(async () => {});
    expect(r.queryByTestId('plus-thanks-toast')).toBeNull();
  });
});

describe('② 寺社を選ぶ', () => {
  it('UI-3: 見出しに日付と件数、下に「順番を決める」', async () => {
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    expect(r.getByText('10月3日（土）の予定 ▾')).toBeTruthy();
    expect(r.getByText('社・ピンを押して足す')).toBeTruthy();
    expect(r.getByTestId('plan-count')).toHaveTextContent('0');
    expect(r.getByText('順番を決める')).toBeTruthy();
    expect(r.getByTestId('plan-title')).toHaveTextContent('予定を組む');
  });

  it('AC-31: ピンを押すとカード。「＋ 予定に入れる」は 400ms 後に行が足され、同じピンは「予定から外す」', async () => {
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    await act(async () => {
      pressPin(r, 'yasaka');
    });
    const card = r.getByTestId('plan-spot-card');
    expect(within(card).getByText('八坂神社')).toBeTruthy();
    fireEvent.press(within(card).getByText('＋ 予定に入れる'));
    expect(r.queryByTestId('plan-chosen-row-yasaka')).toBeNull();
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(r.getByTestId('plan-chosen-row-yasaka')).toBeTruthy();
    expect(r.getByTestId('plan-count')).toHaveTextContent('1');
    await act(async () => {
      pressPin(r, 'yasaka');
    });
    expect(within(r.getByTestId('plan-spot-card')).getByText('予定から外す')).toBeTruthy();
  });

  it('ピンのカードに受付時間と「行きたい」を出す', async () => {
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    await act(async () => {
      await act(async () => {
        pressPin(r, 'yasaka');
      });
    });
    expect(
      within(r.getByTestId('plan-spot-card')).getByText('受付 〜17:00・行きたい')
    ).toBeTruthy();
    expect(mockReception).toHaveBeenCalledWith(['yasaka']);
  });

  it('AC-31: Reduce Motion オンなら即座に足される', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    await act(async () => {
      pressPin(r, 'yasaka');
    });
    fireEvent.press(r.getByText('＋ 予定に入れる'));
    expect(r.getByTestId('plan-chosen-row-yasaka')).toBeTruthy();
    expect(r.getByTestId('plan-count')).toHaveTextContent('1');
  });

  it('AC-32: 0社の案内と「行きたいから選ぶ」。＋で選んだ行へ移り、✕ で戻る', async () => {
    mockWishlist = { wishlistSpotIds: new Set(['yasaka', 'kennin']), toggleWishlist: jest.fn() };
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    expect(
      r.getByText('まだありません。地図のピンを押すか、下の「行きたい」から足してください。')
    ).toBeTruthy();
    expect(r.getByText('行きたいから選ぶ')).toBeTruthy();
    // 行きたいの寺社だけ
    expect(r.getByTestId('plan-wish-yasaka')).toBeTruthy();
    expect(r.getByTestId('plan-wish-kennin')).toBeTruthy();
    expect(r.queryByTestId('plan-wish-kiyomizu')).toBeNull();
    fireEvent.press(r.getByTestId('plan-wish-add-yasaka'));
    expect(r.queryByTestId('plan-wish-yasaka')).toBeNull();
    expect(r.getByTestId('plan-chosen-row-yasaka')).toBeTruthy();
    fireEvent.press(r.getByTestId('plan-chosen-remove-yasaka'));
    expect(r.getByTestId('plan-wish-yasaka')).toBeTruthy();
    expect(r.queryByTestId('plan-chosen-row-yasaka')).toBeNull();
  });

  it('AC-33: 1社では「順番を決める」が disabled、2社で押せる', async () => {
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    fireEvent.press(r.getByTestId('plan-wish-add-yasaka'));
    expect(r.getByTestId('plan-decide')).toBeDisabled();
    fireEvent.press(r.getByTestId('plan-wish-add-kennin'));
    expect(r.getByTestId('plan-decide')).toBeEnabled();
  });

  it('UI-6: 選んだ寺社は plan-chosen に入る', async () => {
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    fireEvent.press(r.getByTestId('plan-wish-add-yasaka'));
    expect(features(r, 'plan-chosen').map(f => f.properties.spotId)).toEqual(['yasaka']);
  });
});

describe('③ 順番', () => {
  const decide = async (r: ReturnType<typeof render>) => {
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-decide'));
    });
  };

  it('AC-34: 京都5社の提案の順・時刻・区間・バナー', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    addAllFromWishlist(r);
    await decide(r);
    expect(stopNames(r)).toEqual(SUGGESTED);
    for (const t of ['9:00', '9:39', '10:26', '11:12', '12:05'])
      expect(r.getByText(t)).toBeTruthy();
    for (const l of [
      '徒歩 約9分',
      '徒歩 約17分',
      '電車などで移動・約1.6km',
      '電車などで移動・約3.3km',
    ])
      expect(r.getByText(l)).toBeTruthy();
    expect(
      r.getByText('✦ 近い順・受付の早い順に並べました。長押しで入れ替えられます')
    ).toBeTruthy();
    expect(r.getByText('長押しで並べ替え')).toBeTruthy();
  });

  it('UI-4: 番号の丸は朱、「この予定を保存」は primary[500]', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    addAllFromWishlist(r);
    await decide(r);
    const num = within(r.getByTestId('plan-stop-0')).getByText('1').parent?.parent;
    expect(StyleSheet.flatten(num?.props.style).backgroundColor).toBe(colors.seal);
    expect(StyleSheet.flatten(r.getByTestId('plan-save').props.style).backgroundColor).toBe(
      colors.primary[500]
    );
  });

  it('AC-35: 200ms ごとに1つずつ描き、1000ms で 5 / 4', async () => {
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    addAllFromWishlist(r);
    await decide(r);
    expect(features(r, 'plan-stops')).toHaveLength(0);
    for (let i = 1; i <= 5; i++) {
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(features(r, 'plan-stops')).toHaveLength(i);
      expect(features(r, 'plan-route')).toHaveLength(Math.max(0, i - 1));
    }
    expect(features(r, 'plan-stops').map(f => f.properties.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('AC-35: Reduce Motion オンなら直後から 5 / 4', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    addAllFromWishlist(r);
    await decide(r);
    expect(features(r, 'plan-stops')).toHaveLength(5);
    expect(features(r, 'plan-route')).toHaveLength(4);
  });

  it('AC-36: 間に合わない寺社に「間に合わないかも」を朱で', async () => {
    reduceMotion = true;
    mockReception.mockResolvedValue(new Map([['yasaka', '9:00']]));
    mockWishlist = { wishlistSpotIds: new Set(['yasaka', 'kennin']), toggleWishlist: jest.fn() };
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    fireEvent.press(r.getByTestId('plan-wish-add-kennin'));
    fireEvent.press(r.getByTestId('plan-wish-add-yasaka'));
    await decide(r);
    const late = r.getByText(/間に合わないかも/);
    expect(late).toHaveTextContent('受付 〜9:00　間に合わないかも');
    expect(StyleSheet.flatten(late.props.style).color).toBe(colors.seal);
  });

  it('AC-37: 受付時間が無い寺社の行に「受付 〜」が出ない', async () => {
    reduceMotion = true;
    mockReception.mockResolvedValue(new Map([['yasaka', '17:00']]));
    mockWishlist = { wishlistSpotIds: new Set(['yasaka', 'kennin']), toggleWishlist: jest.fn() };
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    fireEvent.press(r.getByTestId('plan-wish-add-yasaka'));
    fireEvent.press(r.getByTestId('plan-wish-add-kennin'));
    await decide(r);
    expect(r.getAllByText(/^受付 〜/)).toHaveLength(1);
    expect(within(r.getByTestId('plan-stop-1')).queryByText(/受付/)).toBeNull();
  });

  it('AC-38: moveUp で入れ替わり、時刻を計算し直し、バナーが消える', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    addAllFromWishlist(r);
    await decide(r);
    fireEvent(r.getByTestId('plan-stop-1'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveUp' },
    });
    expect(stopNames(r).slice(0, 2)).toEqual(['建仁寺', '八坂神社']);
    // 建仁寺 → 八坂神社も徒歩 約9分。2番目の着く時刻は 9:00 + 30 + 9 = 9:39 のまま、3番目以降が変わる
    expect(r.getByText('徒歩 約9分')).toBeTruthy();
    expect(r.queryByText('9:39')).toBeTruthy();
    expect(r.queryByText('10:26')).toBeNull();
    expect(r.queryByText(/近い順・受付の早い順/)).toBeNull();
  });

  it('動かない並べ替え（1番目に moveUp）ではバナーを消さない', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    addAllFromWishlist(r);
    await decide(r);
    fireEvent(r.getByTestId('plan-stop-0'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveUp' },
    });
    expect(stopNames(r)).toEqual(SUGGESTED);
    expect(r.getByTestId('plan-suggest-banner')).toBeTruthy();
  });

  it('番号の丸を朱の点線でつなぐ（地図の点線と同じステップ感）', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    addAllFromWishlist(r);
    await decide(r);
    // 1番目の上と5番目の下には線が無い。あいだは丸の上下と区間の行でつながる
    expect(r.queryByTestId('plan-rail-top-0')).toBeNull();
    expect(r.getByTestId('plan-rail-bottom-0')).toBeTruthy();
    expect(r.getByTestId('plan-rail-leg-0')).toBeTruthy();
    expect(r.getByTestId('plan-rail-top-1')).toBeTruthy();
    expect(r.queryByTestId('plan-rail-bottom-4')).toBeNull();
    expect(r.getAllByTestId(/^plan-rail-leg-\d+$/)).toHaveLength(4);
    // 描かれた後の props は SVG が色を数値に変えるので、渡した側（Line）で見る
    const line = within(r.getByTestId('plan-rail-leg-0')).UNSAFE_getByType(Line);
    expect(line.props.stroke).toBe(colors.seal);
    expect(line.props.strokeDasharray).toBeTruthy();
  });

  it('AC-39: 「Google マップで」で1区間の URL を開き、失敗したら Alert', async () => {
    reduceMotion = true;
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('x'));
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    addAllFromWishlist(r);
    await decide(r);
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-leg-open-0'));
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&origin=35.0036,135.778&destination=34.9996,135.7742&travelmode=transit'
    );
    expect(Alert.alert).toHaveBeenCalledWith('Google マップを開けませんでした');
  });

  it('UI-7: 順番の表示でピンのレイヤが薄くなり、②では薄くない', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    expect(r.getByTestId('goshuin-pinned-pin').props.paint['icon-opacity']).toBeUndefined();
    addAllFromWishlist(r);
    await decide(r);
    expect(r.getByTestId('goshuin-pinned-pin').props.paint['icon-opacity']).toBe(0.45);
  });

  it('「選び直す」で②へ。選んだ寺社は今の順番のまま', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    addAllFromWishlist(r);
    await decide(r);
    fireEvent.press(r.getByTestId('plan-reselect'));
    const rows = r.getAllByTestId(/^plan-chosen-row-/).map(el => el.props.testID);
    expect(rows).toEqual([
      'plan-chosen-row-yasaka',
      'plan-chosen-row-kennin',
      'plan-chosen-row-kiyomizu',
      'plan-chosen-row-sanju',
      'plan-chosen-row-fushimi',
    ]);
  });
});

describe('日付・保存', () => {
  const toOrder = async (r: ReturnType<typeof render>) => {
    await act(async () => {});
    addAllFromWishlist(r);
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-decide'));
    });
  };

  it('AC-40: 見出しから日付を変える。今日のとき ‹ は disabled', async () => {
    const r = renderScreen({ date: '2026-10-03' });
    await act(async () => {});
    fireEvent.press(r.getByTestId('plan-date-button'));
    expect(r.getByText('いつの予定？')).toBeTruthy();
    fireEvent.press(r.getByTestId('plan-date-next'));
    fireEvent.press(r.getByTestId('plan-date-next'));
    fireEvent.press(r.getByTestId('plan-date-done'));
    expect(r.getByText('10月5日（月）の予定 ▾')).toBeTruthy();

    const t = renderScreen({ date: '2026-09-26' });
    await act(async () => {});
    fireEvent.press(t.getByTestId('plan-date-button'));
    expect(t.getByTestId('plan-date-prev')).toBeDisabled();
  });

  it('AC-41: 名前をつけて保存し、カレンダーへ', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await toOrder(r);
    fireEvent.press(r.getByTestId('plan-save'));
    expect(r.getByText('10月3日（土）の予定の名前')).toBeTruthy();
    fireEvent.changeText(r.getByTestId('plan-name-input'), '東山めぐり');
    await act(async () => {
      fireEvent.press(r.getByText('保存してカレンダーに入れる'));
    });
    expect(mockSave).toHaveBeenCalledWith({
      planId: undefined,
      plannedOn: '2026-10-03',
      name: '東山めぐり',
      spotIds: ['yasaka', 'kennin', 'kiyomizu', 'sanju', 'fushimi'],
    });
    expect(r.nav.navigate).toHaveBeenCalledWith('PlanCalendar', { savedOn: '2026-10-03' });
  });

  it('AC-42: 名前が空なら「10月3日の予定」', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await toOrder(r);
    fireEvent.press(r.getByTestId('plan-save'));
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-save-submit'));
    });
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ name: '10月3日の予定' }));
  });

  it('AC-43: 同じ日に予定があると Alert、シートは開いたまま', async () => {
    reduceMotion = true;
    const { VisitPlanDateTakenError } = jest.requireMock('@services/visitPlans');
    mockSave.mockRejectedValue(new VisitPlanDateTakenError());
    const r = renderScreen({ date: '2026-10-03' });
    await toOrder(r);
    mockFetchPlans.mockResolvedValue([planOf('x', '2026-10-03', '嵐山', ['yasaka', 'kennin'])]);
    fireEvent.press(r.getByTestId('plan-save'));
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-save-submit'));
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      '10月3日（土）にはもう「嵐山」があります。別の日を選んでください'
    );
    expect(r.getByTestId('plan-save-sheet')).toBeTruthy();
    expect(r.nav.navigate).not.toHaveBeenCalled();
  });

  it('AC-46: 新規のシートには「この予定を消す」が無い', async () => {
    reduceMotion = true;
    const r = renderScreen({ date: '2026-10-03' });
    await toOrder(r);
    fireEvent.press(r.getByTestId('plan-save'));
    expect(r.queryByText('この予定を消す')).toBeNull();
  });
});

describe("③' 保存済みの予定", () => {
  const SAVED = planOf('plan-1', '2026-10-03', '東山めぐり', [
    'yasaka',
    'kennin',
    'kiyomizu',
    'sanju',
  ]);

  it('AC-44: 今日以降は名前・時刻・Google マップ、「⋮⋮」無し、下に「編集」「カレンダーへ」', async () => {
    mockFetchPlans.mockResolvedValue([SAVED]);
    const r = renderScreen({ planId: 'plan-1' });
    await act(async () => {});
    expect(r.getByTestId('plan-title')).toHaveTextContent('東山めぐり');
    expect(r.getByTestId('plan-date-label')).toHaveTextContent('10月3日（土）');
    expect(r.getByText('9:00')).toBeTruthy();
    expect(r.getAllByText('Google マップで')).toHaveLength(3);
    expect(r.queryByText('⋮⋮')).toBeNull();
    expect(r.getByText('編集')).toBeTruthy();
    expect(r.getByText('カレンダーへ')).toBeTruthy();
  });

  it('AC-45: 過ぎた予定は「3 / 4社 回れた」と ✓ 記録 / 行けなかった', async () => {
    mockFetchPlans.mockResolvedValue([{ ...SAVED, plannedOn: '2026-09-20' }]);
    mockFetchVisited.mockResolvedValue(
      new Map([['2026-09-20', new Set(['yasaka', 'kennin', 'kiyomizu'])]])
    );
    const r = renderScreen({ planId: 'plan-1' });
    await act(async () => {});
    await act(async () => {});
    expect(mockFetchVisited).toHaveBeenCalledWith('me', ['2026-09-20']);
    expect(r.getByTestId('plan-past-count')).toHaveTextContent('3 / 4社 回れた');
    expect(r.getAllByText('✓ 記録')).toHaveLength(3);
    expect(r.getAllByText('行けなかった')).toHaveLength(1);
    expect(r.queryByText('Google マップで')).toBeNull();
    expect(r.queryByText('9:00')).toBeNull();
  });

  it('AC-42b: 編集 → 入れ替え → 保存で planId つき。名前の初期値は元の名前', async () => {
    reduceMotion = true;
    mockFetchPlans.mockResolvedValue([SAVED]);
    const r = renderScreen({ planId: 'plan-1' });
    await act(async () => {});
    fireEvent.press(r.getByText('編集'));
    fireEvent(r.getByTestId('plan-stop-1'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveUp' },
    });
    fireEvent.press(r.getByTestId('plan-save'));
    expect(r.getByTestId('plan-name-input').props.value).toBe('東山めぐり');
    await act(async () => {
      fireEvent.press(r.getByTestId('plan-save-submit'));
    });
    expect(mockSave).toHaveBeenCalledWith({
      planId: 'plan-1',
      plannedOn: '2026-10-03',
      name: '東山めぐり',
      spotIds: ['kennin', 'yasaka', 'kiyomizu', 'sanju'],
    });
  });

  it('AC-42c: 見える寺社が1社の予定は「編集」で②から', async () => {
    mockFetchPlans.mockResolvedValue([planOf('plan-1', '2026-10-03', '東山めぐり', ['yasaka'])]);
    const r = renderScreen({ planId: 'plan-1' });
    await act(async () => {});
    fireEvent.press(r.getByText('編集'));
    expect(r.getByText('社・ピンを押して足す')).toBeTruthy();
    expect(r.getByTestId('plan-count')).toHaveTextContent('1');
    expect(r.getByTestId('plan-decide')).toBeDisabled();
  });

  it('AC-46: 保存済みのシートに「この予定を消す」。確認の「消す」で消してカレンダーへ', async () => {
    reduceMotion = true;
    mockFetchPlans.mockResolvedValue([SAVED]);
    const r = renderScreen({ planId: 'plan-1' });
    await act(async () => {});
    fireEvent.press(r.getByText('編集'));
    fireEvent.press(r.getByTestId('plan-save'));
    fireEvent.press(r.getByText('この予定を消す'));
    const [title, , buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1);
    expect(title).toBe('この予定を消しますか？');
    const ok = (buttons as { text: string; onPress?: () => void }[]).find(b => b.text === '消す');
    await act(async () => {
      ok?.onPress?.();
    });
    expect(mockDelete).toHaveBeenCalledWith('plan-1');
    expect(r.nav.navigate).toHaveBeenCalledWith('PlanCalendar');
  });
});
