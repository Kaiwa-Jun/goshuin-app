import type { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

import { CONTENT_TYPE, UPLOAD_EXPIRES_SECONDS } from './signUpload.ts';

/**
 * key に size バイトの JPEG を PUT できる署名付き URL。
 *
 * aws4fetch の既定では host しか署名されず、Content-Type も大きさも縛れない。
 * allHeaders で両方を署名に含め、違う形式・違う大きさの PUT を R2 に拒否させる
 */
export async function presignPutUrl(
  client: AwsClient,
  endpoint: string,
  key: string,
  size: number
): Promise<string> {
  const signed = await client.sign(
    new Request(`${endpoint}/${key}?X-Amz-Expires=${UPLOAD_EXPIRES_SECONDS}`, {
      method: 'PUT',
      headers: { 'Content-Type': CONTENT_TYPE, 'Content-Length': String(size) },
    }),
    { aws: { signQuery: true, allHeaders: true } }
  );
  return signed.url;
}
