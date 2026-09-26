import { StyleSheet, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { fireEvent, render, within } from '@testing-library/react-native';

import { SpotResearchSheet } from '@components/record/SpotResearchSheet';
import type { SpotAddState } from '@hooks/useSpotAdd';
import type { SpotResearchCandidate } from '@/types/supabase';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { borderRadius } from '@theme/spacing';

/* 契約書: docs/issues/issue-248-spot-add-research.md（S4 / UI-4〜UI-8・UI-10）
 *        docs/issues/issue-277-spot-research-region.md（S2・S3 / UI-1〜UI-12） */
const cand = (index: number, over: Partial<SpotResearchCandidate> = {}): SpotResearchCandidate => ({
  index,
  name: '鹿島台神社',
  type: 'shrine',
  address: '宮城県大崎市鹿島台平渡',
  prefecture: '宮城県',
  lat: 38.4803,
  lng: 141.0894,
  sourceCount: 3,
  sourceLabels: ['公式サイト', '宮城県神社庁'],
  ...over,
});

const state = (over: Partial<SpotAddState>): SpotAddState => ({
  status: 'researching',
  name: '鹿島台神社',
  hint: { prefecture: '宮城県', city: '大崎市' },
  researchId: null,
  candidates: [],
  saveFailed: false,
  placing: false,
  redo: false,
  ...over,
});

const handlers = () => ({
  onClose: jest.fn(),
  onPick: jest.fn(),
  onChangeRegion: jest.fn(),
  onRetry: jest.fn(),
  onChoose: jest.fn(),
  onOpenManual: jest.fn(),
});

describe('SpotResearchSheet', () => {
  it('調べている間: 名前・「{地域} で探しています」・「調べずに、地図で場所を決める」。地域を変えるボタン・入力欄は無い', () => {
    const h = handlers();
    const ui = render(
      <SpotResearchSheet state={state({})} userLocation={null} recentPrefectures={[]} {...h} />
    );
    expect(ui.getByText('「鹿島台神社」を調べています')).toBeTruthy();
    expect(
      within(ui.getByTestId('hint-line')).getByText('宮城県 大崎市 で探しています')
    ).toBeTruthy();
    expect(ui.queryByTestId('hint-change')).toBeNull();
    expect(ui.queryByText('変える')).toBeNull();
    expect(ui.queryByText('地域を絞る')).toBeNull();
    expect(ui.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    fireEvent.press(ui.getByText('調べずに、地図で場所を決める'));
    expect(h.onOpenManual).toHaveBeenCalled();
  });

  it('手がかりが無ければ「全国から探しています」。「地域を絞る」は無い', () => {
    const ui = render(
      <SpotResearchSheet
        state={state({ hint: null })}
        userLocation={null}
        recentPrefectures={[]}
        {...handlers()}
      />
    );
    expect(within(ui.getByTestId('hint-line')).getByText('全国から探しています')).toBeTruthy();
    expect(ui.queryByText('地域を絞る')).toBeNull();
    expect(ui.queryByTestId('hint-change')).toBeNull();
    expect(ui.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  });

  it.each([
    ['notFound', '見つかりませんでした'],
    ['error', '調べられませんでした。通信を確かめてください'],
    ['limit', '今日調べられる回数（10回）を使い切りました'],
  ] as const)('%s: 文言と、地図で決める', (status, text) => {
    const h = handlers();
    const ui = render(
      <SpotResearchSheet
        state={state({ status })}
        userLocation={null}
        recentPrefectures={[]}
        {...h}
      />
    );
    expect(ui.getByText(text)).toBeTruthy();
    fireEvent.press(ui.getByTestId('research-open-manual'));
    expect(h.onOpenManual).toHaveBeenCalled();
    if (status === 'error') {
      fireEvent.press(ui.getByText('もう一度調べる'));
      expect(h.onRetry).toHaveBeenCalled();
    }
  });

  it('候補: これですか？・住所・情報源・ここです・どれでもない・注記。「ここです」で選んだ番号を渡す', () => {
    const h = handlers();
    const ui = render(
      <SpotResearchSheet
        state={state({
          status: 'candidates',
          researchId: 'r1',
          candidates: [cand(0), cand(1, { name: '鹿島神社' })],
        })}
        userLocation={null}
        recentPrefectures={[]}
        {...h}
      />
    );
    expect(ui.getByText('これですか？')).toBeTruthy();
    const card = within(ui.getByTestId('candidate-0'));
    expect(card.getByText('鹿島台神社')).toBeTruthy();
    expect(card.getByText('宮城県大崎市鹿島台平渡')).toBeTruthy();
    expect(card.getByText('住所の情報源 3件（公式サイト・宮城県神社庁 ほか）')).toBeTruthy();
    expect(ui.getByText('どれでもない（地図で決める）')).toBeTruthy();
    expect(ui.getByText('確かめられたら、みんなの地図にも載ります')).toBeTruthy();
    // ほかの候補は畳んである
    expect(ui.queryByTestId('candidate-1')).toBeNull();
    fireEvent.press(ui.getByText('ほかの候補を見る（1件）'));
    fireEvent.press(ui.getByTestId('candidate-1'));
    fireEvent.press(ui.getByText('ここです'));
    expect(h.onChoose).toHaveBeenCalledWith(1);
  });

  it('距離は端末の位置を渡されたときだけ、端末上で計算して出す', () => {
    const s = state({ status: 'candidates', researchId: 'r1', candidates: [cand(0)] });
    const without = render(
      <SpotResearchSheet state={s} userLocation={null} recentPrefectures={[]} {...handlers()} />
    );
    expect(without.queryByTestId('candidate-0-km')).toBeNull();
    const withLoc = render(
      <SpotResearchSheet
        state={s}
        userLocation={{ latitude: 38.4803, longitude: 141.0924 }}
        recentPrefectures={[]}
        {...handlers()}
      />
    );
    expect(withLoc.getByTestId('candidate-0-km').props.children).toBe('0.3km');
  });

  it('「追加」「確認待ち」「公開」とは言わない', () => {
    const ui = render(
      <SpotResearchSheet
        state={state({ status: 'candidates', researchId: 'r1', candidates: [cand(0)] })}
        userLocation={null}
        recentPrefectures={[]}
        {...handlers()}
      />
    );
    for (const w of [/確認待ち/, /公開/]) expect(ui.queryByText(w)).toBeNull();
  });
});

/* 契約書: docs/issues/issue-277-spot-research-region.md（S2） */
describe('SpotResearchSheet — 調べる前に地域を聞く（⓪）', () => {
  const asking = (over: Partial<SpotAddState> = {}) =>
    state({ status: 'asking', name: '八幡神社', hint: null, ...over });
  const RECENT = ['宮城県', '京都府', '東京都'];

  it('見出し・説明・あなたの記録から・ほかの地域を入れる・地図で。県（新しい順）→「全国から」の順', () => {
    const ui = render(
      <SpotResearchSheet
        state={asking()}
        userLocation={null}
        recentPrefectures={RECENT}
        {...handlers()}
      />
    );
    for (const t of [
      '「八幡神社」を調べます',
      'どのあたりの寺社ですか？ 選ぶとすぐ調べ始めます。',
      'あなたの記録から',
      'ほかの地域を入れる',
      '調べずに、地図で場所を決める',
    ]) {
      expect(ui.getByText(t)).toBeTruthy();
    }
    const chips = ui.getAllByTestId(/^region-(recent-\d|all)$/);
    expect(chips.map(c => c.props.testID)).toEqual([
      'region-recent-0',
      'region-recent-1',
      'region-recent-2',
      'region-all',
    ]);
    expect(within(chips[0]).getByText('宮城県')).toBeTruthy();
    expect(within(chips[1]).getByText('京都府')).toBeTruthy();
    expect(within(chips[2]).getByText('東京都')).toBeTruthy();
    expect(within(chips[3]).getByText('全国から')).toBeTruthy();
    expect(ui.queryByTestId('region-quota')).toBeNull();
    expect(ui.queryByText('調べ直すと、今日の回数（10回）を1回使います')).toBeNull();
    expect(ui.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  });

  it('県のチップは place、「全国から」は public のアイコン。「全国から」だけ灰色の地', () => {
    const ui = render(
      <SpotResearchSheet
        state={asking()}
        userLocation={null}
        recentPrefectures={RECENT}
        {...handlers()}
      />
    );
    const pref = ui.getByTestId('region-recent-0');
    const all = ui.getByTestId('region-all');
    expect(within(pref).UNSAFE_getByType(MaterialIcons).props).toMatchObject({
      name: 'place',
      size: 16,
      color: colors.gray[500],
    });
    expect(within(all).UNSAFE_getByType(MaterialIcons).props).toMatchObject({
      name: 'public',
      size: 16,
      color: colors.gray[500],
    });
    expect(StyleSheet.flatten(pref.props.style)).toMatchObject({
      backgroundColor: colors.white,
      borderColor: colors.gray[200],
      borderRadius: borderRadius.full,
    });
    expect(StyleSheet.flatten(all.props.style)).toMatchObject({
      backgroundColor: colors.gray[100],
      borderColor: colors.gray[100],
      borderRadius: borderRadius.full,
    });
  });

  it('県のチップを押すとその県で、「全国から」を押すと null で onPick', () => {
    const h = handlers();
    const ui = render(
      <SpotResearchSheet state={asking()} userLocation={null} recentPrefectures={RECENT} {...h} />
    );
    fireEvent.press(ui.getByTestId('region-recent-0'));
    expect(h.onPick).toHaveBeenCalledTimes(1);
    expect(h.onPick).toHaveBeenLastCalledWith({ prefecture: '宮城県', city: null });
    fireEvent.press(ui.getByTestId('region-all'));
    expect(h.onPick).toHaveBeenCalledTimes(2);
    expect(h.onPick).toHaveBeenLastCalledWith(null);
  });

  it('記録の県が無ければ「全国から」と「ほかの地域を入れる」だけ', () => {
    const ui = render(
      <SpotResearchSheet
        state={asking()}
        userLocation={null}
        recentPrefectures={[]}
        {...handlers()}
      />
    );
    expect(ui.queryByText('あなたの記録から')).toBeNull();
    expect(ui.queryByTestId('region-recent-0')).toBeNull();
    expect(within(ui.getByTestId('region-all')).getByText('全国から')).toBeTruthy();
    expect(within(ui.getByTestId('region-other')).getByText('ほかの地域を入れる')).toBeTruthy();
  });

  it('「ほかの地域を入れる」で入力欄と「この地域で調べる」。入れた地域で onPick、空なら null、確定キーでも調べる', () => {
    const h = handlers();
    const ui = render(
      <SpotResearchSheet state={asking()} userLocation={null} recentPrefectures={[]} {...h} />
    );
    fireEvent.press(ui.getByTestId('region-other'));
    expect(ui.getByTestId('region-input').props.placeholder).toBe('例: 宮城県 仙台市');
    expect(within(ui.getByTestId('region-submit')).getByText('この地域で調べる')).toBeTruthy();
    expect(ui.queryByTestId('region-other')).toBeNull();

    fireEvent.changeText(ui.getByTestId('region-input'), '宮城県 仙台市');
    fireEvent.press(ui.getByTestId('region-submit'));
    expect(h.onPick).toHaveBeenLastCalledWith({ prefecture: '宮城県', city: '仙台市' });

    fireEvent.changeText(ui.getByTestId('region-input'), '');
    fireEvent.press(ui.getByTestId('region-submit'));
    expect(h.onPick).toHaveBeenLastCalledWith(null);

    fireEvent.changeText(ui.getByTestId('region-input'), '宮城県');
    fireEvent(ui.getByTestId('region-input'), 'submitEditing');
    expect(h.onPick).toHaveBeenLastCalledWith({ prefecture: '宮城県', city: null });
    expect(h.onPick).toHaveBeenCalledTimes(3);
  });

  it('「調べずに、地図で場所を決める」は onOpenManual だけ（調べない）', () => {
    const h = handlers();
    const ui = render(
      <SpotResearchSheet state={asking()} userLocation={null} recentPrefectures={RECENT} {...h} />
    );
    fireEvent.press(ui.getByTestId('research-open-manual'));
    expect(h.onOpenManual).toHaveBeenCalledTimes(1);
    expect(h.onPick).not.toHaveBeenCalled();
  });

  it('開いている間に県が届いたら、「全国から」の前に加わる（調べない）', () => {
    const h = handlers();
    const ui = render(
      <SpotResearchSheet state={asking()} userLocation={null} recentPrefectures={[]} {...h} />
    );
    expect(ui.queryByText('あなたの記録から')).toBeNull();
    ui.rerender(
      <SpotResearchSheet
        state={asking()}
        userLocation={null}
        recentPrefectures={['宮城県']}
        {...h}
      />
    );
    expect(ui.getByText('あなたの記録から')).toBeTruthy();
    expect(ui.getAllByTestId(/^region-(recent-\d|all)$/).map(c => c.props.testID)).toEqual([
      'region-recent-0',
      'region-all',
    ]);
    expect(within(ui.getByTestId('region-recent-0')).getByText('宮城県')).toBeTruthy();
    expect(h.onPick).not.toHaveBeenCalled();
  });
});

describe('SpotResearchSheet — 調べたあとの地域の行', () => {
  it('候補: 説明文と候補カードの間に「{地域} で探しました」', () => {
    const ui = render(
      <SpotResearchSheet
        state={state({
          status: 'candidates',
          hint: { prefecture: '宮城県', city: null },
          researchId: 'r1',
          candidates: [cand(0), cand(1)],
        })}
        userLocation={null}
        recentPrefectures={[]}
        {...handlers()}
      />
    );
    expect(within(ui.getByTestId('hint-line')).getByText('宮城県 で探しました')).toBeTruthy();
    const tree = JSON.stringify(ui.toJSON());
    const why = tree.indexOf('見つかった寺社です。');
    const line = tree.indexOf('"testID":"hint-line"');
    const first = tree.indexOf('"testID":"candidate-0"');
    expect(why).toBeGreaterThan(-1);
    expect(why).toBeLessThan(line);
    expect(line).toBeLessThan(first);
  });

  it('見つからない: 見出しの下に「全国から探しました」', () => {
    const ui = render(
      <SpotResearchSheet
        state={state({ status: 'notFound', hint: null })}
        userLocation={null}
        recentPrefectures={[]}
        {...handlers()}
      />
    );
    expect(ui.getByText('見つかりませんでした')).toBeTruthy();
    expect(within(ui.getByTestId('hint-line')).getByText('全国から探しました')).toBeTruthy();
  });

  it.each(['error', 'limit'] as const)('%s: 「変える」は無い', status => {
    const ui = render(
      <SpotResearchSheet
        state={state({ status })}
        userLocation={null}
        recentPrefectures={[]}
        {...handlers()}
      />
    );
    expect(ui.queryByTestId('hint-change')).toBeNull();
    expect(ui.queryByText('変える')).toBeNull();
    expect(ui.getAllByText(/地図で場所を決める/).length).toBeGreaterThan(0);
  });
});

/* 契約書: docs/issues/issue-277-spot-research-region.md（S3） */
describe('SpotResearchSheet — 「変える」で地域を選び直す', () => {
  const found = (over: Partial<SpotAddState> = {}) =>
    state({
      status: 'candidates',
      hint: { prefecture: '宮城県', city: null },
      researchId: 'r1',
      candidates: [cand(0), cand(1)],
      ...over,
    });

  it('候補: 「宮城県 で探しました」と「変える」。押すと onChangeRegion', () => {
    const h = handlers();
    const ui = render(
      <SpotResearchSheet state={found()} userLocation={null} recentPrefectures={[]} {...h} />
    );
    const line = within(ui.getByTestId('hint-line'));
    expect(line.getByText('宮城県 で探しました')).toBeTruthy();
    expect(within(ui.getByTestId('hint-change')).getByText('変える')).toBeTruthy();
    fireEvent.press(ui.getByTestId('hint-change'));
    expect(h.onChangeRegion).toHaveBeenCalledTimes(1);
  });

  it('保存中は「変える」を押せない', () => {
    const h = handlers();
    const ui = render(
      <SpotResearchSheet
        state={found({ status: 'saving' })}
        userLocation={null}
        recentPrefectures={[]}
        {...h}
      />
    );
    fireEvent.press(ui.getByTestId('hint-change'));
    expect(h.onChangeRegion).not.toHaveBeenCalled();
  });

  it('見つからない: 「全国から探しました」「変える」「地図で場所を決める」。「変える」で onChangeRegion', () => {
    const h = handlers();
    const ui = render(
      <SpotResearchSheet
        state={state({ status: 'notFound', hint: null })}
        userLocation={null}
        recentPrefectures={[]}
        {...h}
      />
    );
    expect(ui.getByText('見つかりませんでした')).toBeTruthy();
    expect(ui.getByText('全国から探しました')).toBeTruthy();
    expect(ui.getByText('地図で場所を決める')).toBeTruthy();
    fireEvent.press(ui.getByText('変える'));
    expect(h.onChangeRegion).toHaveBeenCalledTimes(1);
  });

  it('調べ直し（redo）: 見出し・説明が変わり、回数の知らせが「ほかの地域を入れる」と地図のボタンの間に出る', () => {
    const ui = render(
      <SpotResearchSheet
        state={state({ status: 'asking', redo: true, name: '八幡神社', hint: null })}
        userLocation={null}
        recentPrefectures={['宮城県']}
        {...handlers()}
      />
    );
    expect(ui.getByText('地域を決めて調べ直す')).toBeTruthy();
    expect(ui.getByText('選ぶとすぐ調べ直します。')).toBeTruthy();
    expect(ui.queryByText('「八幡神社」を調べます')).toBeNull();
    const quota = ui.getByTestId('region-quota');
    expect(quota.props.children).toBe('調べ直すと、今日の回数（10回）を1回使います');
    expect(StyleSheet.flatten(quota.props.style)).toMatchObject({
      color: colors.gray[500],
      fontSize: typography.caption.fontSize,
    });
    for (const id of ['region-recent-0', 'region-all', 'region-other', 'research-open-manual']) {
      expect(ui.getByTestId(id)).toBeTruthy();
    }
    expect(ui.getByText('調べずに、地図で場所を決める')).toBeTruthy();
    const tree = JSON.stringify(ui.toJSON());
    expect(tree.indexOf('"testID":"region-other"')).toBeLessThan(
      tree.indexOf('"testID":"region-quota"')
    );
    expect(tree.indexOf('"testID":"region-quota"')).toBeLessThan(
      tree.indexOf('"testID":"research-open-manual"')
    );
  });
});
