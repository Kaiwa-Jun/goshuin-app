import { stampThumbPath, THUMB_DIR } from '@utils/stampThumb';

describe('stampThumbPath', () => {
  it('持ち主フォルダの下に掘る', () => {
    expect(stampThumbPath('38ba47c2/1789833118004-7nac4q.jpg')).toBe(
      `38ba47c2/${THUMB_DIR}/1789833118004-7nac4q.jpg`
    );
  });

  // 深い階層でも、ファイル名の1つ上に入れる
  it('階層が深くてもファイルの1つ上に入れる', () => {
    expect(stampThumbPath('a/b/c/x.jpg')).toBe(`a/b/c/${THUMB_DIR}/x.jpg`);
  });

  it('フォルダが無ければ先頭に付ける', () => {
    expect(stampThumbPath('x.jpg')).toBe(`${THUMB_DIR}/x.jpg`);
  });
});
