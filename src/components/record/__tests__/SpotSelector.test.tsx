import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import { SpotSelector } from '../SpotSelector';
import type { Spot } from '@/types/supabase';

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

/* 見つからない寺社を調べて追加（Issue #248 / UI-1〜UI-3） */
describe('SpotSelector — 調べて追加・もしかして', () => {
  const base = {
    selectedSpot: null,
    onSearchQueryChange: jest.fn(),
    onSelectSpot: jest.fn(),
    error: null,
  };
  const open = (ui: ReturnType<typeof render>) =>
    fireEvent(ui.getByPlaceholderText('スポット名で検索'), 'focus');

  it('候補に無い名前なら「調べて追加」を出し、「候補が見つかりません」は出さない。押すと名前を渡す', () => {
    const onResearch = jest.fn();
    const ui = render(
      <SpotSelector {...base} nearbySpots={[]} searchQuery=" 鹿島台神社 " onResearch={onResearch} />
    );
    open(ui);
    expect(ui.getByText('「鹿島台神社」を調べて追加')).toBeTruthy();
    expect(ui.getByText('名前から場所と住所を調べます')).toBeTruthy();
    expect(ui.queryByText('候補が見つかりません')).toBeNull();
    fireEvent.press(ui.getByTestId('spot-research'));
    expect(onResearch).toHaveBeenCalledWith('鹿島台神社');
  });

  it('1文字、または同じ名前の候補があるときは出さない。部分一致の候補だけなら出す', () => {
    const onResearch = jest.fn();
    const one = render(
      <SpotSelector {...base} nearbySpots={[]} searchQuery="鹿" onResearch={onResearch} />
    );
    open(one);
    expect(one.queryByTestId('spot-research')).toBeNull();

    const same = render(
      <SpotSelector
        {...base}
        nearbySpots={[{ spot: makeSpot({ name: '鹿島台 神社' }), distanceKm: 1 }]}
        searchQuery="鹿島台神社"
        onResearch={onResearch}
      />
    );
    open(same);
    expect(same.queryByTestId('spot-research')).toBeNull();

    const partial = render(
      <SpotSelector
        {...base}
        nearbySpots={[{ spot: makeSpot({ name: '大崎八幡宮' }), distanceKm: 1 }]}
        searchQuery="八幡"
        onResearch={onResearch}
      />
    );
    open(partial);
    expect(partial.getByTestId('spot-research')).toBeTruthy();
  });

  it('「もしかして」を「調べて追加」の上に出し、押すとその寺社を選ぶ。距離は許可されたときだけ', () => {
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
