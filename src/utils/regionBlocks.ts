/**
 * 47都道府県の正式名の出どころ。DB の `spots.prefecture` と同じ表記で、
 * `src/constants/japanMap.ts` の県名とも一致する（テストで固定）。
 *
 * ブロックごとの集計（groupByRegionBlock）は、あゆみが地図になったときに
 * 役目を終えて消した（Issue #209）。地図が同じことを県単位で見せている。
 */
export const REGION_BLOCKS: { key: string; label: string; prefectures: string[] }[] = [
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
