import { formatJapaneseEraDate } from '@utils/japaneseEra';

describe('formatJapaneseEraDate', () => {
  describe('令和', () => {
    it('令和の日付を元号表記にする', () => {
      expect(formatJapaneseEraDate('2026-05-03')).toBe('令和8年5月3日');
    });

    it('改元当日を元年とする', () => {
      expect(formatJapaneseEraDate('2019-05-01')).toBe('令和元年5月1日');
    });
  });

  describe('平成', () => {
    it('改元前日は平成のままである', () => {
      expect(formatJapaneseEraDate('2019-04-30')).toBe('平成31年4月30日');
    });

    it('改元当日を元年とする', () => {
      expect(formatJapaneseEraDate('1989-01-08')).toBe('平成元年1月8日');
    });
  });

  describe('昭和', () => {
    it('改元前日は昭和のままである', () => {
      expect(formatJapaneseEraDate('1989-01-07')).toBe('昭和64年1月7日');
    });

    it('改元当日を元年とする', () => {
      expect(formatJapaneseEraDate('1926-12-25')).toBe('昭和元年12月25日');
    });
  });

  describe('昭和より前', () => {
    it('西暦にフォールバックする', () => {
      expect(formatJapaneseEraDate('1926-12-24')).toBe('1926年12月24日');
    });
  });

  describe('入力の形', () => {
    it('ISO 全長の文字列を受け付ける', () => {
      expect(formatJapaneseEraDate('2026-05-03T00:00:00.000Z')).toBe('令和8年5月3日');
    });

    it('月日をゼロ埋めしない', () => {
      expect(formatJapaneseEraDate('2026-01-05')).toBe('令和8年1月5日');
    });

    it('空文字には空文字を返す', () => {
      expect(formatJapaneseEraDate('')).toBe('');
    });

    it('日付として読めない文字列には空文字を返す', () => {
      expect(formatJapaneseEraDate('not-a-date')).toBe('');
    });
  });

  describe('タイムゾーンの影響を受けない', () => {
    // new Date() を経由すると UTC 解釈で前日にずれ、改元当日が前元号に落ちる
    it('改元当日をローカルタイムゾーンに関係なく元年と判定する', () => {
      expect(formatJapaneseEraDate('2019-05-01T00:00:00.000Z')).toBe('令和元年5月1日');
      expect(formatJapaneseEraDate('1989-01-08T00:00:00.000Z')).toBe('平成元年1月8日');
    });
  });
});
