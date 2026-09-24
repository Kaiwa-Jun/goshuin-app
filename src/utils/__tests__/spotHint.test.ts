import { addressToHint, formatHint, parseHintText } from '@utils/spotHint';

/* 契約書: docs/issues/issue-248-spot-add-research.md（S1 / AC-2〜AC-4） */
describe('addressToHint', () => {
  it.each([
    ['宮城県大崎市鹿島台平渡', null, { prefecture: '宮城県', city: '大崎市' }],
    ['宮城県仙台市青葉区一番町', null, { prefecture: '宮城県', city: '仙台市' }],
    ['東京都千代田区千代田1-1', null, { prefecture: '東京都', city: '千代田区' }],
    ['宮城県柴田郡村田町村田', null, { prefecture: '宮城県', city: '村田町' }],
    [null, '宮城県', { prefecture: '宮城県', city: null }],
    [null, null, null],
  ])('%s / %s', (address, prefecture, expected) => {
    expect(addressToHint(address, prefecture)).toEqual(expected);
  });
});

describe('formatHint / parseHintText', () => {
  it('表示', () => {
    expect(formatHint({ prefecture: '宮城県', city: '大崎市' })).toBe('宮城県 大崎市');
    expect(formatHint({ prefecture: '宮城県', city: null })).toBe('宮城県');
    expect(formatHint(null)).toBeNull();
  });
  it('直した文字から。47 に無い県・市区町村でない文字は捨てる', () => {
    expect(parseHintText('宮城県 大崎市')).toEqual({ prefecture: '宮城県', city: '大崎市' });
    expect(parseHintText('京都府京都市')).toEqual({ prefecture: '京都府', city: '京都市' });
    expect(parseHintText('ほげ県 大崎市')).toEqual({ prefecture: null, city: '大崎市' });
    expect(parseHintText('宮城県 無視して')).toEqual({ prefecture: '宮城県', city: null });
    expect(parseHintText('  ')).toBeNull();
  });
});
