import { stampVariantPath, THUMB_DIR, VIEW_DIR } from '@utils/stampThumb';

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
