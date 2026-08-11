// アカウント削除の中身。Supabase クライアントを直接触らず依存を注入する形にして、
// 「どの順で何を消すか」だけを Deno テストで固定できるようにしている。
// 契約書: docs/issues/issue-134-account-deletion.md

export interface DeleteAccountDeps {
  /**
   * goshuin-images/<userId>/ 配下のファイル名一覧。
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
    if (names.length > 0) {
      const { error: removeError } = await deps.removeImages(
        names.map(name => `${userId}/${name}`)
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
