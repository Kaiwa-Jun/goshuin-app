import { SPOT_PHOTO_ORIGIN, fetchSpotPhoto, spotPhotoUrl } from '@services/spotPhotos';

const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const KEY = 'spot-photos/' + 'a'.repeat(40) + '.jpg';

/** from → select → eq → eq → maybeSingle の鎖。最後に result を返す */
function arrangeChain(result: { data: unknown; error: unknown }) {
  const chain = { select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle };
  mockFrom.mockReturnValue(chain);
  mockSelect.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  mockMaybeSingle.mockResolvedValue(result);
}

describe('spotPhotos service（Issue #302）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('spotPhotoUrl（AC-3）', () => {
    it('R2 の独自ドメインの変換 URL（幅 1200・品質 78・webp）', () => {
      expect(SPOT_PHOTO_ORIGIN).toBe('https://img.goshuinsanpo.com');
      expect(spotPhotoUrl(KEY)).toBe(
        'https://img.goshuinsanpo.com/cdn-cgi/image/width=1200,quality=78,format=webp/' + KEY
      );
    });
  });

  describe('fetchSpotPhoto（AC-4）', () => {
    const row = {
      r2_key: KEY,
      width: 4032,
      height: 3024,
      focus_y: 0.42,
      author: 'Bachstelze',
      license: 'CC BY-SA 3.0',
      license_url: 'https://creativecommons.org/licenses/by-sa/3.0',
      source_url: 'https://commons.wikimedia.org/wiki/File:A.jpg',
      is_cropped: true,
    };

    it('spot_photos から承認済みの1行を、帯で使う形にして返す', async () => {
      arrangeChain({ data: row, error: null });

      const photo = await fetchSpotPhoto('spot-1');

      expect(mockFrom).toHaveBeenCalledWith('spot_photos');
      const columns = mockSelect.mock.calls[0][0] as string;
      for (const name of [
        'r2_key',
        'width',
        'height',
        'focus_y',
        'author',
        'license',
        'license_url',
        'source_url',
        'is_cropped',
      ]) {
        expect(columns).toContain(name);
      }
      expect(mockEq).toHaveBeenCalledWith('spot_id', 'spot-1');
      expect(mockEq).toHaveBeenCalledWith('status', 'approved');
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
      expect(photo).toEqual({
        uri: spotPhotoUrl(KEY),
        width: 4032,
        height: 3024,
        focusY: 0.42,
        author: 'Bachstelze',
        license: 'CC BY-SA 3.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
        isCropped: true,
      });
    });

    it('行が無ければ null', async () => {
      arrangeChain({ data: null, error: null });
      expect(await fetchSpotPhoto('spot-1')).toBeNull();
    });

    it('エラーなら console.warn して null（帯は写真なしのまま）', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation();
      arrangeChain({ data: null, error: { message: 'boom' } });

      expect(await fetchSpotPhoto('spot-1')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toBe('fetchSpotPhoto error:');
      expect(warn.mock.calls[0][1]).toBe('boom');
      warn.mockRestore();
    });
  });
});
