import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';
import { Linking } from 'react-native';

import {
  LimitedGoshuinSection,
  filterActiveItems,
  toJstDateString,
  formatFetchedAt,
} from '@components/spot-detail/LimitedGoshuinSection';
import { colors } from '@theme/colors';
import type { LimitedGoshuinInfo, LimitedGoshuinItem } from '@/types/supabase';

const makeItem = (overrides: Partial<LimitedGoshuinItem> = {}): LimitedGoshuinItem => ({
  name: '夏詣限定御朱印',
  period: '7月1日〜8月31日',
  period_start: '2026-07-01',
  period_end: '2026-08-31',
  description: '書き置きのみ。初穂料500円',
  source_url: 'https://example.jp/goshuin',
  fetched_at: '2026-08-01T00:00:00Z',
  ...overrides,
});

const makeInfo = (items: LimitedGoshuinItem[]): LimitedGoshuinInfo => ({
  items,
  fetched_at: '2026-08-03T17:00:00.000Z',
});

describe('LimitedGoshuinSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T12:00:00Z'));
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('純粋関数', () => {
    it('toJstDateString は UTC+9 固定で日付を返す', () => {
      expect(toJstDateString(new Date('2026-08-02T15:30:00Z'))).toBe('2026-08-03');
    });

    it('formatFetchedAt は JST の YYYY/MM/DD HH:mm を返す', () => {
      expect(formatFetchedAt('2026-08-03T17:00:00.000Z')).toBe('2026/08/04 02:00');
    });

    it('formatFetchedAt はパース不能なら空文字を返す', () => {
      expect(formatFetchedAt('not-a-date')).toBe('');
    });

    it('filterActiveItems は期限切れを除外し当日は残す', () => {
      const items = [
        makeItem({ name: '期限切れ', period_end: '2026-08-01' }),
        makeItem({ name: '当日まで', period_end: '2026-08-02' }),
      ];
      const result = filterActiveItems(items, new Date('2026-08-02T12:00:00Z'));
      expect(result.map(i => i.name)).toEqual(['当日まで']);
    });

    it('filterActiveItems は period_end が null / 不正形式の要素を残す', () => {
      const items = [
        makeItem({ name: 'null', period_end: null }),
        makeItem({ name: '不正', period_end: '令和8年8月' }),
      ];
      const result = filterActiveItems(items, new Date('2026-08-02T12:00:00Z'));
      expect(result.map(i => i.name)).toEqual(['null', '不正']);
    });

    it('filterActiveItems は入力配列を破壊しない', () => {
      const items = [
        makeItem({ name: '期限切れ', period_end: '2026-08-01' }),
        makeItem({ name: '有効', period_end: null }),
      ];
      const before = [...items];
      filterActiveItems(items, new Date('2026-08-02T12:00:00Z'));
      expect(items.length).toBe(2);
      expect(items).toEqual(before);
    });
  });

  describe('variant="full"', () => {
    it('有効2件でセクションと両項目が表示される', () => {
      const { getByTestId } = render(
        <LimitedGoshuinSection info={makeInfo([makeItem(), makeItem({ name: '秋詣' })])} />
      );
      expect(getByTestId('limited-goshuin-section')).toBeTruthy();
      expect(getByTestId('limited-goshuin-item-0')).toBeTruthy();
      expect(getByTestId('limited-goshuin-item-1')).toBeTruthy();
    });

    it('見出し「限定御朱印」が表示される', () => {
      const { getByText } = render(<LimitedGoshuinSection info={makeInfo([makeItem()])} />);
      expect(getByText('限定御朱印')).toBeTruthy();
    });

    it('出典リンクが常に描画される', () => {
      const { getByTestId, getByText } = render(
        <LimitedGoshuinSection info={makeInfo([makeItem()])} />
      );
      expect(getByTestId('limited-goshuin-source-0')).toBeTruthy();
      expect(getByText('公式サイトで確認')).toBeTruthy();
    });

    it('取得日時が JST 表記で表示される', () => {
      const { getByTestId, getByText } = render(
        <LimitedGoshuinSection info={makeInfo([makeItem()])} />
      );
      expect(getByTestId('limited-goshuin-fetched-at')).toBeTruthy();
      expect(getByText('取得 2026/08/04 02:00')).toBeTruthy();
    });

    it('出典リンク押下で Linking.openURL が source_url で呼ばれる', () => {
      const { getByTestId } = render(<LimitedGoshuinSection info={makeInfo([makeItem()])} />);
      fireEvent.press(getByTestId('limited-goshuin-source-0'));
      expect(Linking.openURL).toHaveBeenCalledTimes(1);
      expect(Linking.openURL).toHaveBeenCalledWith('https://example.jp/goshuin');
    });

    it('period があれば「期間 」付きで表示される', () => {
      const { getByTestId, getByText } = render(
        <LimitedGoshuinSection info={makeInfo([makeItem({ period: '7月1日〜8月31日' })])} />
      );
      expect(getByTestId('limited-goshuin-period-0')).toBeTruthy();
      expect(getByText('期間 7月1日〜8月31日')).toBeTruthy();
    });

    it('period が null なら期間行を描画しない', () => {
      const { getByTestId, queryByTestId } = render(
        <LimitedGoshuinSection info={makeInfo([makeItem({ period: null })])} />
      );
      expect(getByTestId('limited-goshuin-item-0')).toBeTruthy();
      expect(queryByTestId('limited-goshuin-period-0')).toBeNull();
    });

    it('description が null なら説明行を描画しない', () => {
      const { queryByTestId } = render(
        <LimitedGoshuinSection info={makeInfo([makeItem({ description: null })])} />
      );
      expect(queryByTestId('limited-goshuin-description-0')).toBeNull();
    });

    it('期限切れの項目は描画されず index が詰まる', () => {
      const { getByTestId, getByText, queryByTestId } = render(
        <LimitedGoshuinSection
          info={makeInfo([
            makeItem({ name: '終了済み', period_end: '2026-07-31' }),
            makeItem({ name: '開催中', period_end: null }),
          ])}
        />
      );
      expect(getByTestId('limited-goshuin-item-0')).toBeTruthy();
      expect(getByText('開催中')).toBeTruthy();
      expect(queryByTestId('limited-goshuin-item-1')).toBeNull();
    });

    it('全件期限切れかつ SNS 無しならセクションを描画しない', () => {
      const { queryByTestId } = render(
        <LimitedGoshuinSection
          info={makeInfo([makeItem({ period_end: '2026-08-01' })])}
          snsLinks={[]}
        />
      );
      expect(queryByTestId('limited-goshuin-section')).toBeNull();
    });

    it('info 未指定かつ SNS 無しならセクションを描画しない', () => {
      const { queryByTestId } = render(<LimitedGoshuinSection snsLinks={[]} />);
      expect(queryByTestId('limited-goshuin-section')).toBeNull();
    });

    it('SNS リンクのみでもセクションが表示されホスト名と見出しが出る', () => {
      const { getByTestId, getByText } = render(
        <LimitedGoshuinSection snsLinks={[{ id: 'src-1', url: 'https://x.com/example' }]} />
      );
      expect(getByTestId('limited-goshuin-section')).toBeTruthy();
      expect(getByTestId('limited-goshuin-sns-0')).toBeTruthy();
      expect(getByText('x.com')).toBeTruthy();
      expect(getByText('公式SNS')).toBeTruthy();
    });

    it('SNS リンクの表示テキストは www. を除去したホスト名', () => {
      const { getByText } = render(
        <LimitedGoshuinSection
          snsLinks={[{ id: 'src-1', url: 'https://www.instagram.com/example' }]}
        />
      );
      expect(getByText('instagram.com')).toBeTruthy();
    });

    it('SNS リンク押下で Linking.openURL が呼ばれる', () => {
      const { getByTestId } = render(
        <LimitedGoshuinSection snsLinks={[{ id: 'src-1', url: 'https://x.com/example' }]} />
      );
      fireEvent.press(getByTestId('limited-goshuin-sns-0'));
      expect(Linking.openURL).toHaveBeenCalledTimes(1);
      expect(Linking.openURL).toHaveBeenCalledWith('https://x.com/example');
    });

    it('全件期限切れでも SNS があれば SNS のみ表示され取得日時は出ない', () => {
      const { getByTestId, queryByTestId } = render(
        <LimitedGoshuinSection
          info={makeInfo([makeItem({ period_end: '2026-08-01' })])}
          snsLinks={[{ id: 'src-1', url: 'https://x.com/example' }]}
        />
      );
      expect(getByTestId('limited-goshuin-sns-0')).toBeTruthy();
      expect(queryByTestId('limited-goshuin-fetched-at')).toBeNull();
    });

    it('取得日時のスタイルが caption + gray[400]', () => {
      const { getByTestId } = render(<LimitedGoshuinSection info={makeInfo([makeItem()])} />);
      expect(getByTestId('limited-goshuin-fetched-at')).toHaveStyle({
        fontSize: 12,
        color: colors.gray[400],
      });
    });

    it('出典リンクテキストのスタイルが caption + primary[500]', () => {
      const { getByText } = render(<LimitedGoshuinSection info={makeInfo([makeItem()])} />);
      expect(getByText('公式サイトで確認')).toHaveStyle({
        fontSize: 12,
        color: colors.primary[500],
      });
    });
  });

  describe('variant="compact"', () => {
    it('有効3件で件数チップが表示される', () => {
      const { getByTestId, getByText } = render(
        <LimitedGoshuinSection
          info={makeInfo([makeItem(), makeItem({ name: 'b' }), makeItem({ name: 'c' })])}
          variant="compact"
        />
      );
      expect(getByTestId('limited-goshuin-compact')).toBeTruthy();
      expect(getByText('限定御朱印 3件')).toBeTruthy();
    });

    it('compact は内容（名称・期間・説明）を表示しない', () => {
      const { queryByText } = render(
        <LimitedGoshuinSection info={makeInfo([makeItem()])} variant="compact" />
      );
      expect(queryByText('夏詣限定御朱印')).toBeNull();
      expect(queryByText('7月1日〜8月31日')).toBeNull();
      expect(queryByText('書き置きのみ。初穂料500円')).toBeNull();
    });

    it('compact では full 用の要素を描画しない', () => {
      const { queryByTestId } = render(
        <LimitedGoshuinSection info={makeInfo([makeItem()])} variant="compact" />
      );
      expect(queryByTestId('limited-goshuin-section')).toBeNull();
      expect(queryByTestId('limited-goshuin-fetched-at')).toBeNull();
      expect(queryByTestId('limited-goshuin-source-0')).toBeNull();
    });

    it('有効0件（info 未指定）ならチップを描画しない', () => {
      const { queryByTestId } = render(<LimitedGoshuinSection variant="compact" />);
      expect(queryByTestId('limited-goshuin-compact')).toBeNull();
    });

    it('全件期限切れならチップを描画しない', () => {
      const { queryByTestId } = render(
        <LimitedGoshuinSection
          info={makeInfo([makeItem({ period_end: '2026-08-01' })])}
          variant="compact"
        />
      );
      expect(queryByTestId('limited-goshuin-compact')).toBeNull();
    });

    it('SNS リンクだけの場合 compact では何も表示しない', () => {
      const { queryByTestId } = render(
        <LimitedGoshuinSection
          snsLinks={[{ id: 'src-1', url: 'https://x.com/example' }]}
          variant="compact"
        />
      );
      expect(queryByTestId('limited-goshuin-compact')).toBeNull();
      expect(queryByTestId('limited-goshuin-sns-0')).toBeNull();
    });

    it('期限切れ1件を含む3件なら「限定御朱印 2件」', () => {
      const { getByText } = render(
        <LimitedGoshuinSection
          info={makeInfo([
            makeItem({ name: 'a', period_end: '2026-07-31' }),
            makeItem({ name: 'b', period_end: null }),
            makeItem({ name: 'c', period_end: '2026-12-31' }),
          ])}
          variant="compact"
        />
      );
      expect(getByText('限定御朱印 2件')).toBeTruthy();
    });
  });
});
