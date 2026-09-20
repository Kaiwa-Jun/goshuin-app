import { resizeSpecFor, MAX_UPLOAD_EDGE } from '@utils/toUploadableJpeg';

describe('resizeSpecFor', () => {
  it('収まっていれば縮めない', () => {
    expect(resizeSpecFor(1576, 2048)).toBeNull();
  });

  // 短い方を指定すると縦長の写真が上限より大きくなる。長い方だけを指定する
  it('縦長は高さで揃える', () => {
    expect(resizeSpecFor(3024, 4032)).toEqual({ height: MAX_UPLOAD_EDGE });
  });

  it('横長は幅で揃える', () => {
    expect(resizeSpecFor(4032, 3024)).toEqual({ width: MAX_UPLOAD_EDGE });
  });

  it('正方形は幅で揃える', () => {
    expect(resizeSpecFor(4000, 4000)).toEqual({ width: MAX_UPLOAD_EDGE });
  });

  // 大きさが取れないことがある。0 で割った値を渡すと落ちる
  it('大きさが取れていなければ縮めない', () => {
    expect(resizeSpecFor(0, 0)).toBeNull();
    expect(resizeSpecFor(-1, 100)).toBeNull();
  });
});
