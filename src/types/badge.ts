import type { SealMark } from '@components/common/Seal';

/** バッジの軸。獲得画面のグループ分けにも使う */
export type BadgeAxis = 'practice' | 'journey' | 'count';

/**
 * バッジの条件。
 *
 * もとは `visit_count` の1種類しかなく、6個すべてがしきい値違いの同じ軸だった。
 * 月参りの満願を入れるにあたって広げた（docs/design/2026-09-tsukimairi-spec.md §5-2）。
 */
export type BadgeCondition =
  /** 訪れた寺社の数 */
  | { type: 'visit_count'; threshold: number }
  /** どれか1つの寺社で、連続する暦月に threshold ヶ月 */
  | { type: 'tsukimairi'; threshold: number }
  /** 春夏秋冬それぞれに1回以上 */
  | { type: 'four_seasons' }
  /** 同じ日に、異なる寺社を threshold 箇所 */
  | { type: 'same_day_visits'; threshold: number };

export interface Badge {
  id: string;
  name: string;
  description: string;
  /** 彫られた印。もとは絵文字1文字だった（@components/common/Seal） */
  mark: SealMark;
  axis: BadgeAxis;
  condition: BadgeCondition;
}

/** 条件までの道のり。「あと16箇所」を出すのに要る */
export interface BadgeDistance {
  current: number;
  target: number;
  /** 数えているものの単位。「あと2ヶ月」「あと1つ」 */
  unit: string;
}

export interface EarnedBadge {
  badge: Badge;
  earnedAt: string;
}

/** バッジを判定するのに要る、その人の記録のまとめ */
export interface BadgeProgress {
  /** 訪れた寺社の数 */
  visitCount: number;
  /** どれか1つの寺社での、月参りの最長月数 */
  longestTsukimairi: number;
  /** 参拝した季節（春夏秋冬のうちいくつ） */
  seasonCount: number;
  /** 同じ日に回った寺社の最大数 */
  maxSameDayVisits: number;
}
