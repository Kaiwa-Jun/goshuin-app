// 御朱印の写真を R2 に置くための認可（Issue #227 / D-1）。
//
// R2 には RLS が無いので、「ログイン中の本人が、自分のフォルダの下にだけ書ける・消せる」
// をここで担う。Supabase のクライアントや R2 の署名を直接触らず依存を注入し、
// 判定だけを Deno テストで固定する（delete-account と同じ形）。
//
// - アップロード: キーは**この関数が決める**。アプリに決めさせると他人のパスを指定できる。
//   署名付き URL には Content-Type と Content-Length を含め、別の形式・大きさでは PUT できない
// - 削除: 本人のフォルダの下のキーだけを受け付け、1つでも外れていれば何も消さない

/** Supabase Storage のバケットと同じ上限（20260809000000 の file_size_limit） */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** 署名付き URL の有効期限。撮ってすぐ上げるので短くてよい */
export const UPLOAD_EXPIRES_SECONDS = 300;
export const CONTENT_TYPE = 'image/jpeg';
/** 1回の削除で受け付ける数。写真の差し替えでも1〜2件 */
const MAX_DELETE_PATHS = 100;

export interface SignDeps {
  /** トークンから本人の id を得る。無効なら null */
  getUserId(token: string): Promise<string | null>;
  /** key に size バイトの JPEG を PUT できる署名付き URL */
  presignPut(key: string, size: number): Promise<string>;
  deleteObjects(keys: string[]): Promise<{ error: string | null }>;
  now(): number;
  randomSuffix(): string;
}

export type SignOutcome = { status: number; body: Record<string, unknown> };

const fail = (status: number, error: string): SignOutcome => ({
  status,
  body: { success: false, error },
});

/** src/services/stamps.ts uploadStampImage と同じ形のキー */
export function newStampKey(userId: string, now: number, suffix: string): string {
  return `${userId}/${now}-${suffix}.jpg`;
}

/** 本人のフォルダの下か。`..` や先頭の `/` で抜け出すものは認めない */
export function isOwnKey(key: string, userId: string): boolean {
  if (!key.startsWith(`${userId}/`) || key.length <= userId.length + 1) return false;
  return !key.split('/').some(part => part === '..' || part === '.' || part === '');
}

export async function handleSignRequest(
  deps: SignDeps,
  token: string | null,
  body: Record<string, unknown>
): Promise<SignOutcome> {
  if (!token) return fail(401, 'ログインが必要です');
  const userId = await deps.getUserId(token);
  if (!userId) return fail(401, 'ログインが必要です');

  if (body.action === 'upload') {
    const size = body.size;
    if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
      return fail(400, 'size が必要です');
    }
    if (size > MAX_UPLOAD_BYTES) return fail(400, '画像が大きすぎます');

    const path = newStampKey(userId, deps.now(), deps.randomSuffix());
    const url = await deps.presignPut(path, size);
    return {
      status: 200,
      body: {
        success: true,
        path,
        url,
        headers: { 'Content-Type': CONTENT_TYPE, 'Content-Length': String(size) },
        expiresIn: UPLOAD_EXPIRES_SECONDS,
      },
    };
  }

  if (body.action === 'delete') {
    const paths = body.paths;
    if (
      !Array.isArray(paths) ||
      paths.length === 0 ||
      paths.length > MAX_DELETE_PATHS ||
      !paths.every(p => typeof p === 'string')
    ) {
      return fail(400, 'paths が必要です');
    }
    if (!paths.every(p => isOwnKey(p, userId)))
      return fail(403, '削除できない画像が含まれています');

    const { error } = await deps.deleteObjects(paths);
    if (error) return fail(500, `画像の削除に失敗しました: ${error}`);
    return { status: 200, body: { success: true } };
  }

  return fail(400, 'action が不明です');
}
