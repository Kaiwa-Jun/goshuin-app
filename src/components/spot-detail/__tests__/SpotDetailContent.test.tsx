import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Image } from 'react-native';
import { SpotDetailContent } from '../SpotDetailContent';
import type { Spot, PublicStampWithUser } from '@/types/supabase';

jest
  .spyOn(Image, 'getSize')
  .mockImplementation((_uri: string, success: (width: number, height: number) => void) => {
    success(800, 1200);
  });

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://example.com/${path}`,
}));

const mockSpot: Spot = {
  id: 'spot-1',
  name: '大崎八幡宮',
  lat: 38.2744,
  lng: 140.8577,
  type: 'shrine',
  address: '宮城県仙台市青葉区八幡4-6-1',
  prefecture: null,
  status: 'active',
  rank: 3,
  created_by_user_id: null,
  merged_into_spot_id: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const mockPublicStamps: PublicStampWithUser[] = [
  {
    id: 'ps-1',
    user_id: 'other-user-1',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-05-01',
    image_path: 'other-user-1/stamp1.jpg',
    memo: '天気がよかった',
    is_public: true,
    extracted_info: null,
    created_at: '2024-05-01T00:00:00Z',
    updated_at: '2024-05-01T00:00:00Z',
    profiles: {
      display_name: 'ユーザーA',
      avatar_url: null,
    },
  },
  {
    id: 'ps-2',
    user_id: 'other-user-2',
    spot_id: 'spot-1',
    goshuincho_id: null,
    visited_at: '2024-06-01',
    image_path: 'other-user-2/stamp2.jpg',
    memo: null,
    is_public: true,
    extracted_info: null,
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    profiles: {
      display_name: 'ユーザーB',
      avatar_url: null,
    },
  },
];

const defaultProps = {
  spot: mockSpot,
  stamps: [],
  visitCount: 0,
  latestVisitDate: null,
  isAuthenticated: true,
  onRecord: jest.fn(),
  showMiniMap: false,
};

describe('SpotDetailContent - みんなの御朱印', () => {
  it('publicStamps がある場合グリッドに表示されること', () => {
    const { getByTestId } = render(
      <SpotDetailContent {...defaultProps} publicStamps={mockPublicStamps} />
    );
    expect(getByTestId('public-stamp-image-ps-1')).toBeTruthy();
    expect(getByTestId('public-stamp-image-ps-2')).toBeTruthy();
  });

  it('publicStamps が空の場合、自分のstampsもなければグリッド非表示', () => {
    const { queryByTestId } = render(
      <SpotDetailContent {...defaultProps} stamps={[]} publicStamps={[]} />
    );
    expect(queryByTestId('stamp-grid')).toBeNull();
  });

  it('画像タップでギャラリーモーダルが開くこと', () => {
    const { getByTestId } = render(
      <SpotDetailContent {...defaultProps} publicStamps={mockPublicStamps} />
    );
    fireEvent.press(getByTestId('public-stamp-image-ps-1'));
    expect(getByTestId('gallery-image')).toBeTruthy();
  });
});

describe('SpotDetailContent - 限定御朱印', () => {
  const limitedGoshuin = {
    items: [
      {
        name: '夏詣限定御朱印',
        period: '7月1日〜8月31日',
        period_start: null,
        period_end: null,
        description: null,
        source_url: 'https://example.jp/goshuin',
        fetched_at: '2026-08-01T00:00:00Z',
      },
    ],
    fetched_at: '2026-08-01T00:00:00Z',
  };

  it('limitedGoshuin があるとき限定御朱印セクションが表示される', () => {
    const { getByTestId } = render(
      <SpotDetailContent {...defaultProps} spotInfo={{ limitedGoshuin }} />
    );
    expect(getByTestId('limited-goshuin-section')).toBeTruthy();
  });

  it('snsLinks があるとき SNS リンクが表示される', () => {
    const { getByTestId } = render(
      <SpotDetailContent
        {...defaultProps}
        spotInfo={{ snsLinks: [{ id: 'src-1', url: 'https://x.com/example' }] }}
      />
    );
    expect(getByTestId('limited-goshuin-sns-0')).toBeTruthy();
  });

  it('spotInfo が無いとき限定御朱印セクションを表示しない', () => {
    const { queryByTestId } = render(<SpotDetailContent {...defaultProps} />);
    expect(queryByTestId('limited-goshuin-section')).toBeNull();
  });

  it('駐車場情報のみのとき spot-info-section は出るが限定御朱印セクションは出ない', () => {
    const { getByTestId, queryByTestId } = render(
      <SpotDetailContent {...defaultProps} spotInfo={{ parking: { available: true } }} />
    );
    expect(getByTestId('spot-info-section')).toBeTruthy();
    expect(queryByTestId('limited-goshuin-section')).toBeNull();
  });
});

/* Issue #253 AC-12: スポット詳細（standalone）の並びは変えない */
describe('SpotDetailContent - 並び（Issue #253 で変えない）', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-09-25T12:00:00+09:00')));
  afterEach(() => jest.useRealTimers());

  it('名前 → 限定御朱印 → ボタン → 月参り → 御朱印のグリッド → アクセス', () => {
    type Node = { props: { testID?: string }; children: (Node | string)[] };
    const ORDER = [
      'spot-sheet-header',
      'limited-goshuin-section',
      'spot-sheet-actions',
      'tsukimairi',
      'stamp-grid',
      'mini-map',
    ];
    // 2ヶ月続いていると月参りのカードが出る
    const stamp = { ...mockPublicStamps[0], id: 'mine', visited_at: '2026-09-01' };
    const lastMonth = { ...mockPublicStamps[0], id: 'mine-8', visited_at: '2026-08-01' };
    const ui = render(
      <SpotDetailContent
        {...defaultProps}
        showMiniMap
        stamps={[stamp, lastMonth] as never}
        spotInfo={{
          limitedGoshuin: {
            items: [
              {
                name: '限定',
                period: null,
                period_start: null,
                period_end: null,
                description: null,
                source_url: 'https://example.jp/x',
                fetched_at: '2026-09-01T00:00:00Z',
              },
            ],
            fetched_at: '2026-09-01T00:00:00Z',
          },
        }}
      />
    );
    const seen: string[] = [];
    const walk = (node: Node) => {
      const id = node.props?.testID?.startsWith('tsukimairi-') ? 'tsukimairi' : node.props?.testID;
      if (id && ORDER.includes(id) && !seen.includes(id)) seen.push(id);
      node.children.forEach(c => typeof c !== 'string' && walk(c));
    };
    walk(ui.getByTestId('spot-detail-content') as unknown as Node);
    expect(seen).toEqual(ORDER);
  });
});
