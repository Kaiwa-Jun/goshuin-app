// 寺社の名前の正規化と「似た名前」（Issue #248）。
// アプリ（src/utils/spotName.ts）と Edge Function が同じ規則を使うため、実装はここに1つだけ置く。
//
// ⚠ アプリからも import するので、このファイルは何も import しない
//   （Deno は `.ts` 付きの import が要り、アプリの tsc はそれを通さない）

const VARIANTS: Record<string, string> = {
  龍: '竜',
  澤: '沢',
  嶋: '島',
  嶌: '島',
  邊: '辺',
  邉: '辺',
  櫻: '桜',
  廣: '広',
  國: '国',
  瀧: '滝',
  寶: '宝',
  藏: '蔵',
  德: '徳',
};

/** 長い順。末尾から1つだけ落とす */
const SUFFIXES = ['大神宮', '神社', '神宮', '大社', '宮', '寺', '院', '堂', '社'];

/**
 * NFKC → 見えない文字を除く。表示する名前にも、判定にも、これを通してから使う。
 * 混ぜると重複・公開の判定をすり抜けられる（見た目は同じで文字列が違う）:
 * 制御文字 / ソフトハイフン / ゼロ幅・方向制御 / 異体字セレクタ（VS1〜16, IVS）/ ハングルや点字の空白
 * （\p{Cf} はアプリの Hermes で使える保証が無いので範囲で書く）
 */
const INVISIBLE =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2800\u3164\uFE00-\uFE0F\uFEFF\uFFA0]|\uDB40[\uDC00-\uDFFF]/g;

export function stripInvisible(name: string): string {
  return name.normalize('NFKC').replace(INVISIBLE, '');
}

/** 見えない文字・括弧の中身ごと・空白・「・」を除く → 異体字を寄せる */
export function normalizeSpotName(name: string): string {
  return stripInvisible(name)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s・]/g, '')
    .replace(/./g, ch => VARIANTS[ch] ?? ch);
}

/** 末尾の「神社」「寺」などを落とした芯（鹿島台神社 → 鹿島台）。落とすと空になるなら落とさない */
export function coreSpotName(name: string): string {
  const n = normalizeSpotName(name);
  const suffix = SUFFIXES.find(s => n.endsWith(s) && n.length > s.length);
  return suffix ? n.slice(0, -suffix.length) : n;
}

/** 正規化が一致 / 芯が一致 / 短い方の芯が2文字以上で、一方が他方を含む */
export function isSimilarName(a: string, b: string): boolean {
  if (normalizeSpotName(a) === normalizeSpotName(b)) return true;
  const ca = coreSpotName(a);
  const cb = coreSpotName(b);
  if (ca === cb) return true;
  const [short, long] = ca.length <= cb.length ? [ca, cb] : [cb, ca];
  return short.length >= 2 && long.includes(short);
}

/** P-4。validate_spots.sql の 5 と同じ規則（「宮城」の宮は数えない） */
export function typeConflicts(rawName: string, type: 'shrine' | 'temple'): boolean {
  // 括弧の中も見る（normalizeSpotName は括弧の中身を落とすので使わない。「東福（寺）」を神社で通さない）
  const name = stripInvisible(rawName);
  if (type === 'temple') return /神社|大社/.test(name) || /宮/.test(name.replace(/宮城/g, ''));
  return /[寺院堂]/.test(name);
}

/** 手入力の種別の初期値 */
export function guessTypeFromName(name: string): 'shrine' | 'temple' {
  return /[寺院堂]/.test(name) ? 'temple' : 'shrine';
}
