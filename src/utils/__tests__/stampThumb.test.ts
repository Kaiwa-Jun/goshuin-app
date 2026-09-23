import { stampTransformUrl, stampVariantPath, THUMB_DIR, VIEW_DIR } from '@utils/stampThumb';

describe('stampVariantPath', () => {
  it('持ち主フォルダの下に掘る', () => {
    expect(stampVariantPath('38ba47c2/1789833118004-7nac4q.jpg', THUMB_DIR)).toBe(
      `38ba47c2/${THUMB_DIR}/1789833118004-7nac4q.jpg`
    );
  });

  it('大きさごとに別のフォルダになる', () => {
    expect(stampVariantPath('u/x.jpg', VIEW_DIR)).toBe(`u/${VIEW_DIR}/x.jpg`);
  });

  // 深い階層でも、ファイル名の1つ上に入れる
  it('階層が深くてもファイルの1つ上に入れる', () => {
    expect(stampVariantPath('a/b/c/x.jpg', THUMB_DIR)).toBe(`a/b/c/${THUMB_DIR}/x.jpg`);
  });

  it('フォルダが無ければ先頭に付ける', () => {
    expect(stampVariantPath('x.jpg', THUMB_DIR)).toBe(`${THUMB_DIR}/x.jpg`);
  });
});

/*
 * R2 + Cloudflare Images の変換 URL（Issue #227 S4a）。
 * 焼いて置いておくのをやめ、大きさは URL で頼む。独自ドメインのゾーンでしか変換は効かない
 */
describe('stampTransformUrl', () => {
  it('独自ドメインの /cdn-cgi/image/ に、幅・品質・webp を付けて原本のキーを続ける', () => {
    expect(stampTransformUrl('38ba47c2/1789833118004-7nac4q.jpg', 400, 70)).toBe(
      'https://img.goshuinsanpo.com/cdn-cgi/image/width=400,quality=70,format=webp/38ba47c2/1789833118004-7nac4q.jpg'
    );
  });

  it('縮小版のフォルダには掘らない（R2 には原本しか無い）', () => {
    expect(stampTransformUrl('u/x.jpg', 1200, 78)).not.toContain(VIEW_DIR);
  });
});
