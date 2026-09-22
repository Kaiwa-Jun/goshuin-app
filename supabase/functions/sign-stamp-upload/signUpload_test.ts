// Deno ユニットテスト（Jest からは *_test.ts 命名により不可視）
// 実行: deno test supabase/functions/sign-stamp-upload/
//
// 契約書: docs/issues/issue-227-r2-image-migration.md（S1 / D-1）
import { assertEquals } from 'jsr:@std/assert@1';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_EXPIRES_SECONDS,
  handleSignRequest,
  type SignDeps,
} from './signUpload.ts';

const ME = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-8888-7777-6666-555555555555';
const TOKEN = 'valid-token';

function makeDeps(overrides: Partial<{ deleteError: string | null }> = {}) {
  const presigned: { key: string; size: number }[] = [];
  const deleted: string[][] = [];

  const deps: SignDeps = {
    getUserId: async token => (token === TOKEN ? ME : null),
    presignPut: async (key, size) => {
      presigned.push({ key, size });
      return `https://r2.example/${key}?X-Amz-Signature=sig`;
    },
    deleteObjects: async keys => {
      deleted.push(keys);
      return { error: overrides.deleteError ?? null };
    },
    now: () => 1790101744171,
    randomSuffix: () => 'au09co',
  };
  return { deps, presigned, deleted };
}

// --- 本人確認 ---

Deno.test('トークンが無いと 401 で、署名もしない', async () => {
  const { deps, presigned } = makeDeps();
  const result = await handleSignRequest(deps, null, { action: 'upload', size: 1000 });
  assertEquals(result.status, 401);
  assertEquals(presigned.length, 0);
});

Deno.test('無効なトークンは 401 で、署名もしない', async () => {
  const { deps, presigned } = makeDeps();
  const result = await handleSignRequest(deps, 'garbage', { action: 'upload', size: 1000 });
  assertEquals(result.status, 401);
  assertEquals(presigned.length, 0);
});

// --- アップロード ---

Deno.test('アップロード: キーは関数が決め、本人のフォルダの下になる', async () => {
  const { deps, presigned } = makeDeps();

  const result = await handleSignRequest(deps, TOKEN, { action: 'upload', size: 1234 });

  assertEquals(result.status, 200);
  const path = `${ME}/1790101744171-au09co.jpg`;
  assertEquals(presigned, [{ key: path, size: 1234 }]);
  assertEquals(result.body, {
    success: true,
    path,
    url: `https://r2.example/${path}?X-Amz-Signature=sig`,
    headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1234' },
    expiresIn: UPLOAD_EXPIRES_SECONDS,
  });
});

Deno.test(
  'アップロード: リクエストでパスを指定しても無視する（他人のフォルダを選ばせない）',
  async () => {
    const { deps, presigned } = makeDeps();

    await handleSignRequest(deps, TOKEN, {
      action: 'upload',
      size: 1000,
      path: `${OTHER}/evil.jpg`,
    });

    assertEquals(presigned[0].key.startsWith(`${ME}/`), true);
  }
);

Deno.test('アップロード: 5MB を超える大きさは 400 で、署名しない', async () => {
  const { deps, presigned } = makeDeps();
  const result = await handleSignRequest(deps, TOKEN, {
    action: 'upload',
    size: MAX_UPLOAD_BYTES + 1,
  });
  assertEquals(result.status, 400);
  assertEquals(presigned.length, 0);
});

Deno.test('アップロード: ちょうど 5MB は通る', async () => {
  const { deps } = makeDeps();
  const result = await handleSignRequest(deps, TOKEN, { action: 'upload', size: MAX_UPLOAD_BYTES });
  assertEquals(result.status, 200);
});

Deno.test('アップロード: 大きさが正の整数でなければ 400', async () => {
  for (const size of [0, -1, 1.5, '100', null, undefined]) {
    const { deps, presigned } = makeDeps();
    const result = await handleSignRequest(deps, TOKEN, { action: 'upload', size });
    assertEquals(result.status, 400, `size=${String(size)}`);
    assertEquals(presigned.length, 0);
  }
});

// --- 削除 ---

Deno.test('削除: 本人のフォルダの下なら消す', async () => {
  const { deps, deleted } = makeDeps();
  const paths = [`${ME}/1790101744171-au09co.jpg`, `${ME}/1790101744999-x1y2z3.jpg`];

  const result = await handleSignRequest(deps, TOKEN, { action: 'delete', paths });

  assertEquals(result.status, 200);
  assertEquals(deleted, [paths]);
});

Deno.test('削除: 1つでも他人のフォルダが混ざっていたら 403 で、何も消さない', async () => {
  const { deps, deleted } = makeDeps();

  const result = await handleSignRequest(deps, TOKEN, {
    action: 'delete',
    paths: [`${ME}/1790101744171-au09co.jpg`, `${OTHER}/1790101744171-au09co.jpg`],
  });

  assertEquals(result.status, 403);
  assertEquals(deleted.length, 0);
});

Deno.test('削除: フォルダ名で始まるだけの他人のパスや、.. を含むパスは 403', async () => {
  for (const path of [
    `${ME}x/1790101744171-au09co.jpg`,
    `${ME}/../${OTHER}/1790101744171-au09co.jpg`,
    `${ME}`,
    `/${ME}/1790101744171-au09co.jpg`,
    // URL にすると .. に正規化されて他人のキーに届く（Evaluator が再現）
    `${ME}/%2e%2e/${OTHER}/1790101744171-au09co.jpg`,
    `${ME}/.%2e/${OTHER}/1790101744171-au09co.jpg`,
    `${ME}/%2E%2E/${OTHER}/1790101744171-au09co.jpg`,
    `${ME}\\..\\${OTHER}\\1790101744171-au09co.jpg`,
    // 形の違うキー（縮小版のフォルダ、別の拡張子、クエリ付き）
    `${ME}/thumb-400/1790101744171-au09co.jpg`,
    `${ME}/1790101744171-au09co.png`,
    `${ME}/1790101744171-au09co.jpg?x-id=DeleteObject`,
  ]) {
    const { deps, deleted } = makeDeps();
    const result = await handleSignRequest(deps, TOKEN, { action: 'delete', paths: [path] });
    assertEquals(result.status, 403, path);
    assertEquals(deleted.length, 0);
  }
});

Deno.test('削除: paths が空・配列でない・文字列でない要素を含むときは 400', async () => {
  for (const paths of [[], 'a.jpg', [1], undefined]) {
    const { deps, deleted } = makeDeps();
    const result = await handleSignRequest(deps, TOKEN, { action: 'delete', paths });
    assertEquals(result.status, 400, JSON.stringify(paths));
    assertEquals(deleted.length, 0);
  }
});

Deno.test('削除: R2 の削除に失敗したら 500', async () => {
  const { deps } = makeDeps({ deleteError: 'boom' });
  const result = await handleSignRequest(deps, TOKEN, {
    action: 'delete',
    paths: [`${ME}/1790101744171-au09co.jpg`],
  });
  assertEquals(result.status, 500);
});

// --- その他 ---

Deno.test('action が不明なら 400', async () => {
  const { deps } = makeDeps();
  const result = await handleSignRequest(deps, TOKEN, { action: 'list' });
  assertEquals(result.status, 400);
});
