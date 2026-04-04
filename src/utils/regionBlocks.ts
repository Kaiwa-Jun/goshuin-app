interface RegionBlockDef {
  key: string;
  label: string;
  prefectures: string[];
}

export const REGION_BLOCKS: RegionBlockDef[] = [
  {
    key: 'hokkaido_tohoku',
    label: '北海道・東北',
    prefectures: ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  },
  {
    key: 'kanto',
    label: '関東',
    prefectures: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
  },
  {
    key: 'chubu',
    label: '中部',
    prefectures: [
      '新潟県',
      '富山県',
      '石川県',
      '福井県',
      '山梨県',
      '長野県',
      '岐阜県',
      '静岡県',
      '愛知県',
    ],
  },
  {
    key: 'kinki',
    label: '近畿',
    prefectures: ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  },
  {
    key: 'chugoku_shikoku',
    label: '中国・四国',
    prefectures: [
      '鳥取県',
      '島根県',
      '岡山県',
      '広島県',
      '山口県',
      '徳島県',
      '香川県',
      '愛媛県',
      '高知県',
    ],
  },
  {
    key: 'kyushu_okinawa',
    label: '九州・沖縄',
    prefectures: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
  },
];

export interface PrefectureInBlock {
  prefecture: string;
  visitedCount: number;
  totalCount: number;
  hasVisited: boolean;
}

export interface GroupedRegion {
  key: string;
  label: string;
  visitedPrefCount: number;
  totalPrefCount: number;
  prefectures: PrefectureInBlock[];
}

interface RegionStat {
  prefecture: string;
  visitedCount: number;
  totalCount: number;
}

export function groupByRegionBlock(regionStats: RegionStat[]): GroupedRegion[] {
  const statMap = new Map<string, RegionStat>();
  for (const stat of regionStats) {
    statMap.set(stat.prefecture, stat);
  }

  return REGION_BLOCKS.map(block => {
    const prefectures: PrefectureInBlock[] = block.prefectures.map(pref => {
      const stat = statMap.get(pref);
      return {
        prefecture: pref,
        visitedCount: stat?.visitedCount ?? 0,
        totalCount: stat?.totalCount ?? 0,
        hasVisited: (stat?.visitedCount ?? 0) > 0,
      };
    });

    // 訪問済みを上、未訪問を下
    prefectures.sort((a, b) => {
      if (a.hasVisited && !b.hasVisited) return -1;
      if (!a.hasVisited && b.hasVisited) return 1;
      return 0;
    });

    const visitedPrefCount = prefectures.filter(p => p.hasVisited).length;

    return {
      key: block.key,
      label: block.label,
      visitedPrefCount,
      totalPrefCount: block.prefectures.length,
      prefectures,
    };
  });
}
