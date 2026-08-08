import { getWebPreviewStamps, previewImageUrl } from '@components/gallery/webPreview';

// この suite が検証するのは native / Jest で解決される既定実装のほう。
// web ビルドでは webPreview.web.ts が優先され、?preview=goshuincho のときだけ
// fixture を返す（そちらは W 群で Expo Web 上から検証する）。
describe('webPreview（native / 既定の実装）', () => {
  it('常に null を返す（プレビュー経路はネイティブに存在しない）', () => {
    expect(getWebPreviewStamps()).toBeNull();
  });

  it('window があっても null を返す', () => {
    // jsdom 環境でも native 実装が選ばれる限りプレビューは有効にならない
    expect(typeof window).toBe('object');
    expect(getWebPreviewStamps()).toBeNull();
  });

  it('previewImageUrl は空文字を返す', () => {
    expect(previewImageUrl({} as never)).toBe('');
  });
});
