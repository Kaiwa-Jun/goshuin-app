import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, within } from '@testing-library/react-native';
import { SpotSelector } from '../SpotSelector';
import type { Spot } from '@/types/supabase';
import { colors } from '@theme/colors';

const makeSpot = (overrides: Partial<Spot> = {}): Spot => ({
  id: 'spot-1',
  name: '仙台東照宮',
  lat: 38.2682,
  lng: 140.8694,
  type: 'shrine',
  address: '仙台市青葉区',
  prefecture: null,
  status: 'active',
  rank: 3,
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
});

const nearbySpots = [
  { spot: makeSpot(), distanceKm: 0.5 },
  { spot: makeSpot({ id: 'spot-2', name: '大崎八幡宮', type: 'shrine' }), distanceKm: 1.2 },
  { spot: makeSpot({ id: 'spot-3', name: '瑞鳳殿', type: 'temple' }), distanceKm: 2.0 },
];

describe('SpotSelector', () => {
  const mockOnSelectSpot = jest.fn();
  const mockOnSearchQueryChange = jest.fn();
  const defaultProps = {
    selectedSpot: null,
    nearbySpots,
    searchQuery: '',
    onSearchQueryChange: mockOnSearchQueryChange,
    onSelectSpot: mockOnSelectSpot,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('未選択時に検索バーが表示される', () => {
    const { getByPlaceholderText } = render(<SpotSelector {...defaultProps} />);

    expect(getByPlaceholderText('スポット名で検索')).toBeTruthy();
  });

  it('選択済みスポット名表示', () => {
    const { getByText } = render(<SpotSelector {...defaultProps} selectedSpot={makeSpot()} />);

    expect(getByText('仙台東照宮')).toBeTruthy();
  });

  it('検索バーフォーカスで候補ドロップダウンが開く', () => {
    const { getByPlaceholderText, getByText } = render(<SpotSelector {...defaultProps} />);

    fireEvent(getByPlaceholderText('スポット名で検索'), 'focus');

    expect(getByText('仙台東照宮')).toBeTruthy();
    expect(getByText('大崎八幡宮')).toBeTruthy();
  });

  it('スポットをタップすると onSelectSpot 呼出', () => {
    const { getByPlaceholderText, getByText } = render(<SpotSelector {...defaultProps} />);

    fireEvent(getByPlaceholderText('スポット名で検索'), 'focus');
    fireEvent.press(getByText('仙台東照宮'));

    expect(mockOnSelectSpot).toHaveBeenCalledWith(nearbySpots[0].spot);
  });

  // 追加すると status: 'pending' で入り、RLS の SELECT は active しか返さないので
  // 作った本人にも二度と出てこない。設計をやり直すまで動線を出さない（Issue #184）
  it('スポットを追加する導線を出さない', () => {
    const { getByPlaceholderText, queryByText } = render(<SpotSelector {...defaultProps} />);

    fireEvent(getByPlaceholderText('スポット名で検索'), 'focus');

    expect(queryByText('スポットが見つからない場合は追加')).toBeNull();
  });

  it('候補が無いときは「候補が見つかりません」だけを出す', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <SpotSelector {...defaultProps} nearbySpots={[]} />
    );

    fireEvent(getByPlaceholderText('スポット名で検索'), 'focus');

    expect(getByText('候補が見つかりません')).toBeTruthy();
    expect(queryByText('スポットが見つからない場合は追加')).toBeNull();
  });
});

describe('都道府県の表示', () => {
  // 白山神社が4件、日枝神社が3件など、同名のスポットが 27 種 60 件ある。
  // 名前と距離だけでは、どの県のものか判別できない
  const props = {
    selectedSpot: null,
    nearbySpots,
    searchQuery: '',
    onSearchQueryChange: jest.fn(),
    onSelectSpot: jest.fn(),
    error: null,
  };

  const openDropdown = (spots: typeof nearbySpots) => {
    const r = render(<SpotSelector {...props} nearbySpots={spots} />);
    fireEvent(r.getByPlaceholderText('スポット名で検索'), 'focus');
    return r;
  };

  it('候補に都道府県を出す', () => {
    const r = openDropdown([
      { spot: makeSpot({ name: '白山神社', prefecture: '岩手県' }), distanceKm: 0.5 },
    ]);

    expect(r.getByText('岩手県')).toBeTruthy();
  });

  it('同名でも県で見分けられる。県が正しい行に付く', () => {
    const r = openDropdown([
      { spot: makeSpot({ id: 'a', name: '白山神社', prefecture: '岩手県' }), distanceKm: 0.5 },
      { spot: makeSpot({ id: 'b', name: '白山神社', prefecture: '新潟県' }), distanceKm: 1.2 },
    ]);

    expect(r.getAllByText('白山神社')).toHaveLength(2);
    // 行ごとに見る。両方出ているだけでは、入れ違っていても通ってしまう
    expect(within(r.getByTestId('spot-option-a')).getByText('岩手県')).toBeTruthy();
    expect(within(r.getByTestId('spot-option-b')).getByText('新潟県')).toBeTruthy();
    expect(within(r.getByTestId('spot-option-a')).queryByText('新潟県')).toBeNull();
  });

  it('都道府県が無いスポットでも落ちない', () => {
    const r = openDropdown([
      { spot: makeSpot({ name: '名無し神社', prefecture: null }), distanceKm: 0.5 },
    ]);

    expect(r.getByText('名無し神社')).toBeTruthy();
  });
});

/* 見つからない寺社を調べて追加（Issue #248 / UI-1〜UI-3）
   同じ名前の寺社が一覧にあっても出す（Issue #278 / UI-1〜UI-5。契約書 docs/issues/issue-278-same-name-research.md）。
   言葉は「探す」にそろえ、画面に「調べ」を出さない（D-13） */
describe('SpotSelector — もっと探す・もしかして', () => {
  const base = {
    selectedSpot: null,
    onSearchQueryChange: jest.fn(),
    onSelectSpot: jest.fn(),
    error: null,
  };
  const open = (ui: ReturnType<typeof render>) =>
    fireEvent(ui.getByPlaceholderText('スポット名で検索'), 'focus');
  // 描いた順の testID。FlatList の props は React 要素を持つので JSON.stringify できない
  type Node = { props: { testID?: unknown }; children: (Node | string)[] | null };
  const testIdsInOrder = (node: Node | Node[] | string | null): string[] => {
    if (!node || typeof node === 'string') return [];
    if (Array.isArray(node)) return node.flatMap(testIdsInOrder);
    const own = typeof node.props.testID === 'string' ? [node.props.testID] : [];
    return [...own, ...(node.children ?? []).flatMap(testIdsInOrder)];
  };

  it('候補に無い名前なら「もっと探す」を出し、「候補が見つかりません」は出さない。押すと名前を渡す', () => {
    const onResearch = jest.fn();
    const ui = render(
      <SpotSelector {...base} nearbySpots={[]} searchQuery=" 鹿島台神社 " onResearch={onResearch} />
    );
    open(ui);
    expect(ui.getByText('「鹿島台神社」をもっと探す')).toBeTruthy();
    expect(ui.getByText('地図にない寺社も、名前と地域から探します')).toBeTruthy();
    expect(ui.queryByText('候補が見つかりません')).toBeNull();
    fireEvent.press(ui.getByTestId('spot-research'));
    expect(onResearch).toHaveBeenCalledWith('鹿島台神社');
  });

  it('1文字なら出さない。同じ名前の候補があれば「ほかの〇〇」、部分一致だけなら「「〇〇」をもっと探す」', () => {
    const onResearch = jest.fn();
    const one = render(
      <SpotSelector {...base} nearbySpots={[]} searchQuery="鹿" onResearch={onResearch} />
    );
    open(one);
    expect(one.queryByTestId('spot-research')).toBeNull();

    // 正規化して一致すれば同じ名前（UI-2）
    const same = render(
      <SpotSelector
        {...base}
        nearbySpots={[{ spot: makeSpot({ name: '鹿島台 神社' }), distanceKm: 1 }]}
        searchQuery="鹿島台神社"
        onResearch={onResearch}
      />
    );
    open(same);
    expect(
      within(same.getByTestId('spot-research')).getByText('ほかの鹿島台神社を探す')
    ).toBeTruthy();

    // 部分一致の候補（「八幡」で他の八幡）は同じ名前に数えない（UI-3 ②）
    const partial = render(
      <SpotSelector
        {...base}
        nearbySpots={[{ spot: makeSpot({ name: '大崎八幡宮' }), distanceKm: 1 }]}
        searchQuery="八幡"
        onResearch={onResearch}
      />
    );
    open(partial);
    expect(
      within(partial.getByTestId('spot-research')).getByText('「八幡」をもっと探す')
    ).toBeTruthy();
    expect(partial.queryAllByText(/調べ/)).toHaveLength(0);
  });

  // 同じ名前が各地にある寺社（マスタの値。seed_kyoto_rank_spots.sql・02_kanto.sql）
  const kyoto = makeSpot({
    id: 'kyoto-yasaka',
    name: '八坂神社',
    lat: 35.0036,
    lng: 135.778,
    prefecture: '京都府',
  });
  const gunma = makeSpot({
    id: 'gunma-yasaka',
    name: '八坂神社',
    lat: 36.2679,
    lng: 139.2786,
    prefecture: '群馬県',
  });
  const yasakaList = [
    { spot: kyoto, distanceKm: 612 },
    { spot: gunma, distanceKm: 305 },
  ];

  it('同じ名前の寺社が一覧にあるときは「ほかの〇〇を探す」を一覧の下に出し、押すと名前を渡す（UI-1）', () => {
    const onResearch = jest.fn();
    const ui = render(
      <SpotSelector
        {...base}
        nearbySpots={yasakaList}
        searchQuery=" 八坂神社 "
        onResearch={onResearch}
      />
    );
    open(ui);

    const row = within(ui.getByTestId('spot-research'));
    expect(row.getByText('ほかの八坂神社を探す')).toBeTruthy();
    expect(row.getByText('一覧にない場所の八坂神社を探します')).toBeTruthy();
    expect(ui.queryByText('「八坂神社」をもっと探す')).toBeNull();
    expect(ui.queryByText('地図にない寺社も、名前と地域から探します')).toBeNull();
    expect(ui.queryAllByText(/調べ/)).toHaveLength(0);

    const ids = testIdsInOrder(ui.toJSON());
    const research = ids.indexOf('spot-research');
    const kyotoAt = ids.indexOf('spot-option-kyoto-yasaka');
    const gunmaAt = ids.indexOf('spot-option-gunma-yasaka');
    expect(kyotoAt).toBeGreaterThan(-1);
    expect(gunmaAt).toBeGreaterThan(-1);
    expect(kyotoAt).toBeLessThan(research);
    expect(gunmaAt).toBeLessThan(research);

    fireEvent.press(ui.getByTestId('spot-research'));
    expect(onResearch).toHaveBeenCalledTimes(1);
    expect(onResearch).toHaveBeenCalledWith('八坂神社');
  });

  it('同じ名前が無いときは「「〇〇」をもっと探す」。「もしかして」は同じ名前に数えない。画面に「調べ」は無い（UI-3）', () => {
    const none = render(
      <SpotSelector {...base} nearbySpots={[]} searchQuery=" 鹿島台神社 " onResearch={jest.fn()} />
    );
    open(none);
    expect(none.getByText('「鹿島台神社」をもっと探す')).toBeTruthy();
    expect(none.getByText('地図にない寺社も、名前と地域から探します')).toBeTruthy();
    expect(none.queryAllByText(/^ほかの/)).toHaveLength(0);
    expect(none.queryAllByText(/調べ/)).toHaveLength(0);

    const maybe = render(
      <SpotSelector
        {...base}
        nearbySpots={[]}
        didYouMeanSpots={[
          { spot: makeSpot({ id: 'kashima', name: '鹿島神宮' }), distanceKm: 228.4 },
        ]}
        searchQuery="鹿島台神社"
        onResearch={jest.fn()}
      />
    );
    open(maybe);
    expect(
      within(maybe.getByTestId('spot-research')).getByText('「鹿島台神社」をもっと探す')
    ).toBeTruthy();
    expect(maybe.queryAllByText(/調べ/)).toHaveLength(0);
  });

  it('1文字なら同じ名前が一覧にあっても出さない。onResearch が無ければ出さない（UI-4）', () => {
    const oneSame = render(
      <SpotSelector
        {...base}
        nearbySpots={[{ spot: makeSpot({ name: '鹿' }), distanceKm: 1 }]}
        searchQuery="鹿"
        onResearch={jest.fn()}
      />
    );
    open(oneSame);
    expect(oneSame.queryByTestId('spot-research')).toBeNull();

    const noHandler = render(
      <SpotSelector
        {...base}
        nearbySpots={[{ spot: kyoto, distanceKm: 612 }]}
        searchQuery="八坂神社"
      />
    );
    open(noHandler);
    expect(noHandler.queryByTestId('spot-research')).toBeNull();
  });

  it.each([
    ['同じ名前あり', yasakaList, '八坂神社', 'ほかの八坂神社を探す'],
    ['同じ名前なし', [], '鹿島台神社', '「鹿島台神社」をもっと探す'],
  ])('%s でも行の見た目は同じ。題は1行・朱の太字、地は薄い朱（UI-5）', (_, spots, query, title) => {
    const ui = render(
      <SpotSelector {...base} nearbySpots={spots} searchQuery={query} onResearch={jest.fn()} />
    );
    open(ui);

    const titleText = within(ui.getByTestId('spot-research')).getByText(title);
    expect(titleText.props.numberOfLines).toBe(1);
    const titleStyle = StyleSheet.flatten(titleText.props.style);
    expect(titleStyle.color).toBe(colors.primary[600]);
    expect(titleStyle.fontWeight).toBe('700');
    expect(StyleSheet.flatten(ui.getByTestId('spot-research').props.style).backgroundColor).toBe(
      colors.primary[50]
    );
  });

  it('「もしかして」を「もっと探す」の上に出し、押すとその寺社を選ぶ。距離は許可されたときだけ', () => {
    const onSelectSpot = jest.fn();
    const kashima = makeSpot({ id: 'kashima', name: '鹿島神宮', prefecture: '茨城県' });
    const ui = render(
      <SpotSelector
        {...base}
        onSelectSpot={onSelectSpot}
        nearbySpots={[]}
        searchQuery="鹿島台神社"
        didYouMeanSpots={[{ spot: kashima, distanceKm: 228.4 }]}
        showDistance={false}
        onResearch={jest.fn()}
      />
    );
    open(ui);
    const maybe = within(ui.getByTestId('spot-did-you-mean'));
    expect(maybe.getByText('もしかして')).toBeTruthy();
    expect(maybe.getByText('茨城県')).toBeTruthy();
    expect(maybe.queryByText(/km/)).toBeNull();
    fireEvent.press(ui.getByTestId('spot-did-you-mean-kashima'));
    expect(onSelectSpot).toHaveBeenCalledWith(kashima);
  });
});
