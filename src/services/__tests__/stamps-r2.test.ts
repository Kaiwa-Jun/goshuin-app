/**
 * 御朱印の写真を Supabase Storage と R2 の両方に書く（Issue #227 S3）。
 *
 * S3 のあいだ **Supabase が正**。R2 は後から読み取りを切り替えるための写しで、
 * R2 側の失敗で記録を止めてはいけない（AC-8）。キーは両方で同じにするため、
 * 先に sign-stamp-upload からキーと署名付き URL をもらい、そのキーで Supabase にも上げる
 */
import { deleteStampImage, uploadStampImage } from '@services/stamps';

const mockInvoke = jest.fn();
const mockUpload = jest.fn();
const mockRemove = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        remove: (...args: unknown[]) => mockRemove(...args),
      }),
    },
  },
}));

const USER = 'user-1';
const SIGNED_PATH = 'user-1/1790101744171-au09co.jpg';
const SIGNED_URL =
  'https://r2.example/goshuin-images/user-1/1790101744171-au09co.jpg?X-Amz-Signature=s';

const fetchMock = jest.fn();
const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockInvoke.mockResolvedValue({
    data: { success: true, path: SIGNED_PATH, url: SIGNED_URL },
    error: null,
  });
  mockUpload.mockImplementation(async (path: string) => ({ data: { path }, error: null }));
  mockRemove.mockResolvedValue({ error: null });
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
});

describe('uploadStampImage（Supabase と R2 に二重に書く）', () => {
  it('署名でもらったキーで Supabase に上げ、同じバイト列を R2 に PUT する', async () => {
    const path = await uploadStampImage(USER, 'file:///photo.jpg');

    expect(path).toBe(SIGNED_PATH);
    // jest.setup.js の File モックは 4 バイトを返す
    expect(mockInvoke).toHaveBeenCalledWith('sign-stamp-upload', {
      body: { action: 'upload', size: 4 },
    });
    expect(mockUpload).toHaveBeenCalledWith(SIGNED_PATH, expect.any(Uint8Array), {
      contentType: 'image/jpeg',
    });
    expect(fetchMock).toHaveBeenCalledWith(SIGNED_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: mockUpload.mock.calls[0][1],
    });
  });

  it('R2 への PUT が失敗しても、記録は続けられる（AC-8）', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    await expect(uploadStampImage(USER, 'file:///photo.jpg')).resolves.toBe(SIGNED_PATH);
  });

  it('R2 への PUT が例外を投げても、記録は続けられる', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(uploadStampImage(USER, 'file:///photo.jpg')).resolves.toBe(SIGNED_PATH);
  });

  it('署名が取れなければ、自分でキーを作って Supabase にだけ上げる', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('function down') });

    const path = await uploadStampImage(USER, 'file:///photo.jpg');

    expect(path).toMatch(/^user-1\/\d+-[a-z0-9]+\.jpg$/);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('署名の呼び出し自体が例外でも、Supabase にだけ上げる', async () => {
    mockInvoke.mockRejectedValue(new Error('boom'));

    await expect(uploadStampImage(USER, 'file:///photo.jpg')).resolves.toMatch(/^user-1\//);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('署名のキーが別のユーザーのフォルダなら使わない', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, path: 'user-2/1-a.jpg', url: 'https://r2.example/x' },
      error: null,
    });

    const path = await uploadStampImage(USER, 'file:///photo.jpg');

    expect(path).toMatch(/^user-1\//);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Supabase への保存に失敗したら、R2 には書かずにエラーにする', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Upload failed' } });

    await expect(uploadStampImage(USER, 'file:///photo.jpg')).rejects.toThrow('Upload failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('deleteStampImage（Supabase と R2 の両方から消す）', () => {
  it('Supabase の原本と縮小版を消し、R2 の原本も消す', async () => {
    await deleteStampImage(SIGNED_PATH);

    expect(mockRemove).toHaveBeenCalledWith([
      SIGNED_PATH,
      'user-1/thumb-400/1790101744171-au09co.jpg',
      'user-1/view-1200/1790101744171-au09co.jpg',
    ]);
    expect(mockInvoke).toHaveBeenCalledWith('sign-stamp-upload', {
      body: { action: 'delete', paths: [SIGNED_PATH] },
    });
  });

  it('R2 の削除に失敗しても、エラーにしない（Supabase からは消えている）', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('function down') });

    await expect(deleteStampImage(SIGNED_PATH)).resolves.toBeUndefined();
  });

  it('Supabase の削除に失敗したらエラーにし、R2 は触らない', async () => {
    mockRemove.mockResolvedValue({ error: { message: 'storage error' } });

    await expect(deleteStampImage(SIGNED_PATH)).rejects.toThrow('storage error');
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
