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

/**
 * 御朱印らしい墨線 + 朱印だけの軽い代替画像。外部ネットワークに出ない。
 *
 * SVG に日本語を入れない（スポット名はフッターに出る）。RN Web は data URI の
 * プリロードに失敗すると背景を当てないだけで無言なので、確実に読める形に寄せる。
 * メディアタイプのパラメータも付けない（`;utf8,` は不正で読めなくなる）。
 */
function placeholderImage(background: string, seal: string): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">',
    `<rect width="200" height="300" fill="${background}"/>`,
    `<rect x="72" y="42" width="7" height="132" rx="3" fill="${colors.gray[800]}"/>`,
    `<rect x="108" y="72" width="7" height="96" rx="3" fill="${colors.gray[800]}"/>`,
    `<rect x="52" y="210" width="62" height="7" rx="3" fill="${colors.gray[800]}"/>`,
    `<rect x="66" y="234" width="40" height="6" rx="3" fill="${colors.gray[800]}"/>`,
    `<rect x="136" y="240" width="46" height="46" rx="4" fill="none" stroke="${seal}" stroke-width="5"/>`,
    `<rect x="24" y="24" width="30" height="30" rx="3" fill="none" stroke="${seal}" stroke-width="4"/>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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

// useGalleryStamps と同じ visited_at 昇順（古い順）で並べる。
// 訪問日は元号の境界（平成元年 / 令和元年 / 令和）を目視で確認できるものにした。
const PREVIEW_STAMPS: StampWithSpot[] = [
  makePreviewStamp('preview-3', '明治神宮', '1989-01-08', 'shrine'),
  makePreviewStamp('preview-2', '神田明神', '2019-05-01', 'shrine'),
  makePreviewStamp('preview-1', '浅草寺', '2026-05-03', 'temple'),
];

const PREVIEW_IMAGES: Record<string, string> = {
  'preview-1': placeholderImage(colors.primary[50], colors.temple[600]),
  'preview-2': placeholderImage(colors.shrine[50], colors.shrine[600]),
  'preview-3': placeholderImage(colors.gray[50], colors.shrine[600]),
};

export function getWebPreviewStamps(): StampWithSpot[] | null {
  if (typeof window === 'undefined' || !window.location) return null;
  if (!window.location.search.includes(WEB_PREVIEW_QUERY)) return null;
  return PREVIEW_STAMPS;
}

export function previewImageUrl(stamp: StampWithSpot): string {
  return PREVIEW_IMAGES[stamp.id] ?? placeholderImage(colors.surface, colors.shrine[600]);
}
