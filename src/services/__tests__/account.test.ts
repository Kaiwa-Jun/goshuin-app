import { deleteAccount } from '@services/account';

const mockInvoke = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('deleteAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // C-1 / C-2
  it('delete-account 関数をボディ無しで呼ぶ', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, warnings: [] }, error: null });

    await deleteAccount();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    // 削除対象は関数側が JWT から決める。ボディで user_id を渡してはいけない
    expect(mockInvoke).toHaveBeenCalledWith('delete-account');
  });

  // C-5
  it('成功したら success: true を返す', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, warnings: [] }, error: null });

    const result = await deleteAccount();

    expect(result).toEqual({ success: true });
  });

  // C-3
  it('関数がエラーを返したら success: false とメッセージを返す', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code' },
    });

    const result = await deleteAccount();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Edge Function returned a non-2xx status code');
    }
  });

  // C-3（関数が 200 で success: false を返すケース）
  it('レスポンスの success が false なら失敗として扱う', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'アカウントの削除に失敗しました: boom' },
      error: null,
    });

    const result = await deleteAccount();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('boom');
    }
  });

  // C-4
  it('例外が投げられても throw せず success: false に畳む', async () => {
    mockInvoke.mockRejectedValue(new Error('Network request failed'));

    const result = await deleteAccount();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Network request failed');
    }
  });

  it('data も error も無い異常なレスポンスでも throw しない', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    const result = await deleteAccount();

    expect(result.success).toBe(false);
  });
});
