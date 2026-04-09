import { isNetworkError } from '@utils/errorClassifier';

describe('isNetworkError', () => {
  it('undefined は false を返す', () => {
    expect(isNetworkError(undefined)).toBe(false);
  });

  it('"Network request failed" はネットワークエラー', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
  });

  it('"Failed to fetch" はネットワークエラー', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
  });

  it('"Network Error" はネットワークエラー（大文字小文字無視）', () => {
    expect(isNetworkError(new Error('network error'))).toBe(true);
  });

  it('一般的なエラーメッセージは false を返す', () => {
    expect(isNetworkError(new Error('保存に失敗しました'))).toBe(false);
  });

  it('文字列エラーも判定できる', () => {
    expect(isNetworkError('Network request failed')).toBe(true);
  });

  it('文字列の一般エラーは false を返す', () => {
    expect(isNetworkError('保存に失敗しました')).toBe(false);
  });

  it('returns true for "timeout"', () => {
    expect(isNetworkError(new Error('Request timeout'))).toBe(true);
  });

  it('returns false for null', () => {
    expect(isNetworkError(null)).toBe(false);
  });

  it('returns false for non-Error object', () => {
    expect(isNetworkError({ message: 'network error' })).toBe(false);
  });
});
