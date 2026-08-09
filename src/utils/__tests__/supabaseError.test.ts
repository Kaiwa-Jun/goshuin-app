import { describeSupabaseError } from '@/utils/supabaseError';

describe('describeSupabaseError', () => {
  it('message だけならそのまま返す', () => {
    expect(describeSupabaseError({ message: 'Bucket not found' })).toBe('Bucket not found');
  });

  it('Storage の statusCode を併記する', () => {
    expect(describeSupabaseError({ message: 'new row violates RLS', statusCode: '403' })).toBe(
      'new row violates RLS (status=403)'
    );
  });

  it('status しか無い場合も拾う', () => {
    expect(describeSupabaseError({ message: 'Payload too large', status: 413 })).toBe(
      'Payload too large (status=413)'
    );
  });

  it('PostgREST の code / details / hint を併記する', () => {
    expect(
      describeSupabaseError({
        message: 'insert failed',
        code: '42501',
        details: 'Key (spot_id) is not present',
      })
    ).toBe('insert failed (code=42501, Key (spot_id) is not present)');
  });

  it('文字列はそのまま返す', () => {
    expect(describeSupabaseError('Network request failed')).toBe('Network request failed');
  });

  it('message を持たない値は fallback を返す', () => {
    expect(describeSupabaseError(undefined, '保存に失敗しました')).toBe('保存に失敗しました');
    expect(describeSupabaseError({}, '保存に失敗しました')).toBe('保存に失敗しました');
  });

  it('ネットワークエラーの判定に使う文言を壊さない', () => {
    // RecordScreen が isNetworkError() で 'network' / 'upload' を出し分けている
    const message = describeSupabaseError({ message: 'Network request failed' });
    expect(message.toLowerCase()).toContain('network request failed');
  });
});
