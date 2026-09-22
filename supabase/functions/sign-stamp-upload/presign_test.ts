// 署名付き URL が「形式と大きさ」を縛っていることを固定する（Issue #227 / AC-3b）。
// 実行: deno test supabase/functions/sign-stamp-upload/
import { assertEquals } from 'jsr:@std/assert@1';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

import { presignPutUrl } from './presign.ts';

const client = new AwsClient({
  accessKeyId: 'AK',
  secretAccessKey: 'SK',
  service: 's3',
  region: 'auto',
});

Deno.test(
  '署名に Content-Type と Content-Length が含まれる（別の形式・大きさでは PUT できない）',
  async () => {
    const url = new URL(
      await presignPutUrl(client, 'https://acct.r2.example/goshuin-images', 'u/a.jpg', 1234)
    );

    assertEquals(url.searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host');
  }
);

Deno.test('有効期限は 300 秒で、キーはそのままパスになる', async () => {
  const url = new URL(
    await presignPutUrl(client, 'https://acct.r2.example/goshuin-images', 'u/a.jpg', 1234)
  );

  assertEquals(url.searchParams.get('X-Amz-Expires'), '300');
  assertEquals(url.pathname, '/goshuin-images/u/a.jpg');
});
