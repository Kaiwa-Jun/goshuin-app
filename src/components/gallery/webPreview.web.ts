import { colors } from '@theme/colors';
import type { StampWithSpot } from '@/types/supabase';

/**
 * Expo Web での検証イネーブラ（Issue #116 の S-7）。web ビルドでのみ解決される。
 *
 * `http://localhost:8081/?preview=goshuincho` でアクセスしたときだけ fixture を返し、
 * ログイン不要でめくり表示に到達できるようにする。クエリが無い通常のアクセスは
 * 従来どおりゲスト空状態のまま。ナビゲーションには一切載せない。
 */
export const WEB_PREVIEW_QUERY = 'preview=goshuincho';

/** 一色ベタ + 文字だけの軽い代替画像。外部ネットワークに出ない */
function placeholderImage(label: string, background: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300">
<rect width="200" height="300" fill="${background}"/>
<text x="100" y="160" font-size="20" text-anchor="middle" fill="${colors.gray[700]}">${label}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makePreviewStamp(
  id: string,
  spotName: string,
  visitedAt: string,
  type: 'shrine' | 'temple'
): StampWithSpot {
  return {
    id,
    user_id: 'preview-user',
    spot_id: `preview-spot-${id}`,
    goshuincho_id: null,
    visited_at: visitedAt,
    image_path: `preview/${id}.svg`,
    memo: null,
    is_public: false,
    extracted_info: null,
    created_at: `${visitedAt}T00:00:00Z`,
    updated_at: `${visitedAt}T00:00:00Z`,
    spots: { name: spotName, type },
  };
}

// useGalleryStamps と同じ visited_at 降順で並べる。
// 訪問日は元号の境界（令和 / 令和元年 / 平成元年）を目視で確認できるものにした。
const PREVIEW_STAMPS: StampWithSpot[] = [
  makePreviewStamp('preview-1', '浅草寺', '2026-05-03', 'temple'),
  makePreviewStamp('preview-2', '神田明神', '2019-05-01', 'shrine'),
  makePreviewStamp('preview-3', '明治神宮', '1989-01-08', 'shrine'),
];

const PREVIEW_IMAGES: Record<string, string> = {
  'preview-1': placeholderImage('浅草寺', colors.primary[50]),
  'preview-2': placeholderImage('神田明神', colors.shrine[50]),
  'preview-3': placeholderImage('明治神宮', colors.temple[100]),
};

export function getWebPreviewStamps(): StampWithSpot[] | null {
  if (typeof window === 'undefined' || !window.location) return null;
  if (!window.location.search.includes(WEB_PREVIEW_QUERY)) return null;
  return PREVIEW_STAMPS;
}

export function previewImageUrl(stamp: StampWithSpot): string {
  return PREVIEW_IMAGES[stamp.id] ?? placeholderImage(stamp.spots.name, colors.surface);
}
