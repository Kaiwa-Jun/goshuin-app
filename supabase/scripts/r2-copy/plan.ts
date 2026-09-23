/**
 * 御朱印の原本のキー。sign-stamp-upload の isOwnKey と同じ形
 * （縮小版の thumb-400/ view-1200/ はこの形にならないので自然に除かれる）
 */
const STAMP_KEY = /^[0-9a-f-]{36}\/\d{1,16}-[a-z0-9]{1,16}\.jpg$/;

/** DB の stamps.image_path を正として、R2 に無いものだけをコピー対象にする */
export function planCopy(
  imagePaths: string[],
  inR2: Set<string>
): { copy: string[]; present: number; invalid: string[] } {
  const copy: string[] = [];
  const invalid: string[] = [];
  let present = 0;

  for (const path of new Set(imagePaths.map(p => p.trim()))) {
    if (!STAMP_KEY.test(path)) invalid.push(path);
    else if (inR2.has(path)) present++;
    else copy.push(path);
  }
  return { copy, present, invalid };
}
