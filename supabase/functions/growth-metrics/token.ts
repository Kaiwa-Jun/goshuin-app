// 合言葉（GROWTH_METRICS_TOKEN）の取り出しと比べ方（Issue #285 / D-12・D-13）
//
// config.toml で verify_jwt = false なので、ここの比べが growth-metrics の唯一の防衛線。
// 両方を SHA-256 で 32 バイトにしてから、全バイトの XOR を OR で集め、最後に 0 かどうかを見る。
// 途中で抜けないので、長さの違いも、何文字目で違うかも、時間に出ない。
// 合言葉の値はログにも戻り値にも出さない

/** これより短い合言葉が設定されていたら、どんなリクエストも通さない（閉じる側に倒す） */
export const MIN_TOKEN_LENGTH = 32;

/** `Authorization: Bearer <値>` の値（前後の空白を除く）。無い・形が違う・空なら null */
export function extractBearerToken(header: string | null): string | null {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return token ? token : null;
}

/** 関数側の合言葉が使える長さで設定されているか */
export function isTokenConfigured(expected: string | undefined): expected is string {
  return typeof expected === 'string' && expected.length >= MIN_TOKEN_LENGTH;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/** 送られてきた合言葉が、関数側の合言葉と同じか（定数時間） */
export async function tokenMatches(
  provided: string | null | undefined,
  expected: string | undefined
): Promise<boolean> {
  if (!provided || !isTokenConfigured(expected)) return false;
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
