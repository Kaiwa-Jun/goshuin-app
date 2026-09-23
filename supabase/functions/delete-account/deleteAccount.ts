// アカウント削除の中身。Supabase クライアントを直接触らず依存を注入する形にして、
// 「どの順で何を消すか」だけを Deno テストで固定できるようにしている。
// 契約書: docs/issues/issue-134-account-deletion.md

export interface DeleteAccountDeps {
  /**
   * goshuin-images/<userId>/ 配下のファイル名一覧（サブフォルダ内は `thumb-400/a.jpg` の形）。
   * 途中で失敗した場合も、そこまでに集まった names と error の両方を返す
   */
  listImages(userId: string): Promise<{ names: string[]; error: string | null }>;
  /** バケット内のフルパスを渡して削除する */
  removeImages(paths: string[]): Promise<{ error: string | null }>;
  /** spots.created_by_user_id を NULL に落とす */
  detachCreatedSpots(userId: string): Promise<{ error: string | null }>;
  /** auth.users の行を消す。profiles / stamps / goshuincho / wishlists は cascade */
  deleteAuthUser(userId: string): Promise<{ error: string | null }>;
}

export type DeleteAccountOutcome =
  | { status: 200; body: { success: true; warnings: string[] } }
  | { status: 500; body: { success: false; error: string } };

/** `Authorization: Bearer <token>` からトークン部分だけを取り出す */
export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token ? token : null;
}

/** Storage の list() が返す1件。サブフォルダは id が null で、中身は含まない */
export interface StorageEntry {
  name: string;
  id: string | null;
}

export type ListPage = (
  prefix: string,
  offset: number,
  limit: number
) => Promise<{ entries: StorageEntry[]; error: string | null }>;

/**
 * `<userId>/` 配下の全ファイルを、userId から見た相対パスで集める（Issue #226）。
 *
 * list() は prefix の直下しか返さない。縮小版は `thumb-400/` `view-1200/` の
 * サブフォルダにあり、直下だけを見るとフォルダ名しか取れず、中の JPEG が
 * 公開 URL のまま消え残っていた。フォルダ（id: null）は中へ降りて読む。
 *
 * 途中で失敗しても、そこまでに集めた names と error の両方を返す
 */
export async function collectImageNames(
  listPage: ListPage,
  userId: string,
  pageSize = 1000
): Promise<{ names: string[]; error: string | null }> {
  const names: string[] = [];
  const folders = [''];

  while (folders.length > 0) {
    const folder = folders.shift()!;
    const prefix = folder ? `${userId}/${folder}` : userId;

    for (let offset = 0; ; offset += pageSize) {
      const { entries, error } = await listPage(prefix, offset, pageSize);
      if (error) return { names, error };

      for (const entry of entries) {
        const path = folder ? `${folder}/${entry.name}` : entry.name;
        if (entry.id === null) folders.push(path);
        else names.push(path);
      }
      if (entries.length < pageSize) break;
    }
  }

  return { names, error: null };
}

/** Storage の remove() が1回で受け付ける件数の上限 */
const REMOVE_BATCH = 1000;

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * 画像 → spots の作成者 → auth ユーザー の順で消す。
 *
 * 順序に意味がある:
 * - 画像が先。auth ユーザーを先に消すと storage.objects.owner が NULL になり、
 *   どのユーザーの画像だったかを引く手がかりが消えて誰も消せなくなる
 * - spots が先。ON DELETE SET NULL の migration が本番に未適用でも
 *   FK 違反で削除が失敗しないようにするための保険（契約書 S-6）
 *
 * 画像の削除は失敗しても続行する。消し残しより「アカウントが消えない」ほうが
 * Guideline 5.1.1(v) 違反として重いため。
 */
export async function deleteAccountForUser(
  deps: DeleteAccountDeps,
  userId: string
): Promise<DeleteAccountOutcome> {
  const warnings: string[] = [];

  try {
    const { names, error } = await deps.listImages(userId);
    // 一覧が途中で失敗しても、取れている分は消す。ここで諦めると
    // 「一部の消し残し」が「全件の消し残し」に悪化してしまう
    if (error) {
      warnings.push(`画像の一覧取得に失敗: ${error}`);
    }
    // remove() は1回あたり1000件まで。縮小版を含めると御朱印1枚で3ファイルになる。
    // 0件なら呼ばない（空配列を渡すと API がエラーを返す）
    for (let i = 0; i < names.length; i += REMOVE_BATCH) {
      const { error: removeError } = await deps.removeImages(
        names.slice(i, i + REMOVE_BATCH).map(name => `${userId}/${name}`)
      );
      if (removeError) {
        warnings.push(`画像の削除に失敗: ${removeError}`);
      }
    }
  } catch (e) {
    warnings.push(`画像の削除に失敗: ${describe(e)}`);
  }

  const { error: detachError } = await deps.detachCreatedSpots(userId);
  if (detachError) {
    return {
      status: 500,
      body: { success: false, error: `スポットの作成者情報の更新に失敗しました: ${detachError}` },
    };
  }

  const { error: deleteError } = await deps.deleteAuthUser(userId);
  if (deleteError) {
    return {
      status: 500,
      body: { success: false, error: `アカウントの削除に失敗しました: ${deleteError}` },
    };
  }

  return { status: 200, body: { success: true, warnings } };
}
