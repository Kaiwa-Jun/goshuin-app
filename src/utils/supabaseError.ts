/**
 * Supabase のエラーを、切り分けに足りる1行の文字列にする。
 *
 * Storage は `message` + `status`/`statusCode`、PostgREST は
 * `message` + `code`/`details`/`hint` を返す。`message` だけだと
 * 「どの層で弾かれたのか」が分からないことが多いため、付随する識別子も併記する。
 * 記録フローの失敗は原文を画面に出す方針なので、人が読める形にまとめる。
 */
export function describeSupabaseError(error: unknown, fallback = '不明なエラー'): string {
  if (typeof error === 'string') {
    return error || fallback;
  }

  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const e = error as {
    message?: unknown;
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  const message = typeof e.message === 'string' && e.message ? e.message : fallback;

  const tags: string[] = [];
  const status = e.statusCode ?? e.status;
  if (typeof status === 'string' || typeof status === 'number') {
    if (String(status) !== '') tags.push(`status=${status}`);
  }
  if (typeof e.code === 'string' && e.code) tags.push(`code=${e.code}`);
  if (typeof e.details === 'string' && e.details) tags.push(e.details);
  if (typeof e.hint === 'string' && e.hint) tags.push(e.hint);

  return tags.length > 0 ? `${message} (${tags.join(', ')})` : message;
}
