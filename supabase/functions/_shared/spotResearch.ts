// research-spot が保存し、add-spot が読む候補の形（Issue #248 / D-1）。
// 候補はサーバーだけが作る。add-spot はクライアントから researchId と候補番号しか受け取らない

export interface StoredCandidate {
  /** 1〜50 文字 */
  name: string;
  type: 'shrine' | 'temple';
  /** 47 都道府県名のどれかで始まる、5〜100 文字 */
  address: string;
  /** address の先頭 */
  prefecture: string;
  /** 国土地理院の住所検索 API の座標（モデルの出力は使わない） */
  lat: number;
  lng: number;
  /** ウェブ検索の結果に実在した URL だけ。最大 5 */
  sources: { url: string; title: string }[];
  officialUrl: string | null;
}

export const SPOT_NAME_MAX = 50;

/** NFKC・制御文字除去・前後の空白除去のあと 1〜50 文字なら、その文字列。外れたら null */
export function cleanSpotName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // deno-lint-ignore no-control-regex
  const s = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
  return s.length >= 1 && s.length <= SPOT_NAME_MAX ? s : null;
}
