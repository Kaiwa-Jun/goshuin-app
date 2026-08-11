// Deno ユニットテスト（Jest からは *_test.ts 命名により不可視）
// 実行: deno test supabase/functions/delete-account/deleteAccount_test.ts
//
// 契約書: docs/issues/issue-134-account-deletion.md の A 群 / B 群
import { assertEquals } from 'jsr:@std/assert@1';
import {
  extractBearerToken,
  deleteAccountForUser,
  type DeleteAccountDeps,
} from './deleteAccount.ts';

const USER_ID = '11111111-2222-3333-4444-555555555555';

/** 呼び出し順を記録するスパイ付きの deps を作る */
function makeDeps(
  overrides: Partial<{
    names: string[];
    listError: string | null;
    removeError: string | null;
    detachError: string | null;
    deleteError: string | null;
  }> = {}
) {
  const calls: string[] = [];
  const removedPaths: string[][] = [];
  const deletedIds: string[] = [];
  const detachedIds: string[] = [];

  const deps: DeleteAccountDeps = {
    listImages: async userId => {
      calls.push(`list:${userId}`);
      return { names: overrides.names ?? [], error: overrides.listError ?? null };
    },
    removeImages: async paths => {
      calls.push('remove');
      removedPaths.push(paths);
      return { error: overrides.removeError ?? null };
    },
    detachCreatedSpots: async userId => {
      calls.push('detach');
      detachedIds.push(userId);
      return { error: overrides.detachError ?? null };
    },
    deleteAuthUser: async userId => {
      calls.push('deleteUser');
      deletedIds.push(userId);
      return { error: overrides.deleteError ?? null };
    },
  };

  return { deps, calls, removedPaths, deletedIds, detachedIds };
}

// --- extractBearerToken（A-1 / A-2 の入口） ---

Deno.test('extractBearerToken: Bearer 付きヘッダからトークンを取り出す', () => {
  assertEquals(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
});

Deno.test('extractBearerToken: 大文字小文字を問わない', () => {
  assertEquals(extractBearerToken('bearer abc'), 'abc');
});

Deno.test('extractBearerToken: ヘッダが無いとき null', () => {
  assertEquals(extractBearerToken(null), null);
});

Deno.test('extractBearerToken: Bearer が付いていないとき null', () => {
  assertEquals(extractBearerToken('abc.def.ghi'), null);
});

Deno.test('extractBearerToken: Bearer だけでトークンが空のとき null', () => {
  assertEquals(extractBearerToken('Bearer '), null);
  assertEquals(extractBearerToken('Bearer'), null);
});

// --- B-1 / B-4: 削除の順序 ---

Deno.test('deleteAccountForUser: 画像 → spots → auth ユーザーの順で消す', async () => {
  const { deps, calls } = makeDeps({ names: ['a.jpg'] });

  await deleteAccountForUser(deps, USER_ID);

  assertEquals(calls, [`list:${USER_ID}`, 'remove', 'detach', 'deleteUser']);
});

// --- B-2: 画像が 0 件なら remove を呼ばない ---

Deno.test('deleteAccountForUser: 画像が 0 件のとき remove を呼ばない', async () => {
  const { deps, calls } = makeDeps({ names: [] });

  await deleteAccountForUser(deps, USER_ID);

  assertEquals(calls.includes('remove'), false);
  assertEquals(calls, [`list:${USER_ID}`, 'detach', 'deleteUser']);
});

// --- B-3: remove に渡すパスの形 ---

Deno.test('deleteAccountForUser: remove には <userId>/<name> を渡す', async () => {
  const { deps, removedPaths } = makeDeps({ names: ['1.jpg', '2.jpg'] });

  await deleteAccountForUser(deps, USER_ID);

  assertEquals(removedPaths, [[`${USER_ID}/1.jpg`, `${USER_ID}/2.jpg`]]);
});

// --- B-5: deleteUser に渡す ID ---

Deno.test('deleteAccountForUser: deleteUser には呼び出し元の user_id を渡す', async () => {
  const { deps, deletedIds, detachedIds } = makeDeps();

  await deleteAccountForUser(deps, USER_ID);

  assertEquals(deletedIds, [USER_ID]);
  assertEquals(detachedIds, [USER_ID]);
});

// --- B-9: 成功時のレスポンス ---

Deno.test('deleteAccountForUser: 成功したら 200 と success: true', async () => {
  const { deps } = makeDeps({ names: ['a.jpg'] });

  const result = await deleteAccountForUser(deps, USER_ID);

  assertEquals(result.status, 200);
  assertEquals(result.body, { success: true, warnings: [] });
});

// --- B-6: 画像の削除に失敗しても続行する ---

Deno.test(
  'deleteAccountForUser: list に失敗しても deleteUser は実行し warnings に載せる',
  async () => {
    const { deps, calls } = makeDeps({ listError: 'list boom' });

    const result = await deleteAccountForUser(deps, USER_ID);

    assertEquals(calls.includes('deleteUser'), true);
    assertEquals(result.status, 200);
    assertEquals(result.body, { success: true, warnings: ['画像の一覧取得に失敗: list boom'] });
  }
);

// 一覧の途中で失敗しても、そこまでに集まった分は消す。
// 「全件消し残し」に悪化させないための保険（PR #136 の auto-review 指摘）
Deno.test(
  'deleteAccountForUser: list が途中で失敗しても取得済みの分は remove する',
  async () => {
    const { deps, removedPaths } = makeDeps({
      names: ['1.jpg', '2.jpg'],
      listError: 'page 2 boom',
    });

    const result = await deleteAccountForUser(deps, USER_ID);

    assertEquals(removedPaths, [[`${USER_ID}/1.jpg`, `${USER_ID}/2.jpg`]]);
    assertEquals(result.status, 200);
    assertEquals(result.body, { success: true, warnings: ['画像の一覧取得に失敗: page 2 boom'] });
  }
);

Deno.test(
  'deleteAccountForUser: remove に失敗しても deleteUser は実行し warnings に載せる',
  async () => {
    const { deps, calls } = makeDeps({ names: ['a.jpg'], removeError: 'remove boom' });

    const result = await deleteAccountForUser(deps, USER_ID);

    assertEquals(calls.includes('deleteUser'), true);
    assertEquals(result.status, 200);
    assertEquals(result.body, { success: true, warnings: ['画像の削除に失敗: remove boom'] });
  }
);

Deno.test('deleteAccountForUser: 画像の削除で例外が飛んでも deleteUser は実行する', async () => {
  const { deps, calls } = makeDeps();
  deps.listImages = () => {
    throw new Error('network down');
  };

  const result = await deleteAccountForUser(deps, USER_ID);

  assertEquals(calls.includes('deleteUser'), true);
  assertEquals(result.status, 200);
  assertEquals(result.body, { success: true, warnings: ['画像の削除に失敗: network down'] });
});

// --- B-7: spots の更新に失敗したら中断する ---

Deno.test(
  'deleteAccountForUser: spots の更新に失敗したら 500 で deleteUser を呼ばない',
  async () => {
    const { deps, calls } = makeDeps({ detachError: 'detach boom' });

    const result = await deleteAccountForUser(deps, USER_ID);

    assertEquals(calls.includes('deleteUser'), false);
    assertEquals(result.status, 500);
    assertEquals(result.body, {
      success: false,
      error: 'スポットの作成者情報の更新に失敗しました: detach boom',
    });
  }
);

// --- B-8: deleteUser の失敗 ---

Deno.test('deleteAccountForUser: deleteUser に失敗したら 500', async () => {
  const { deps } = makeDeps({ deleteError: 'delete boom' });

  const result = await deleteAccountForUser(deps, USER_ID);

  assertEquals(result.status, 500);
  assertEquals(result.body, {
    success: false,
    error: 'アカウントの削除に失敗しました: delete boom',
  });
});
