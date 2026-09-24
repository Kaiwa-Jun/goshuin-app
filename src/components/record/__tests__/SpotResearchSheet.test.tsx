import { fireEvent, render, within } from '@testing-library/react-native';

import { SpotResearchSheet } from '@components/record/SpotResearchSheet';
import type { SpotAddState } from '@hooks/useSpotAdd';
import type { SpotResearchCandidate } from '@/types/supabase';

/* 契約書: docs/issues/issue-248-spot-add-research.md（S4 / UI-4〜UI-8・UI-10） */
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
  ...over,
});

const handlers = () => ({
  onClose: jest.fn(),
  onChangeHint: jest.fn(),
  onRetry: jest.fn(),
  onChoose: jest.fn(),
  onOpenManual: jest.fn(),
});

describe('SpotResearchSheet', () => {
  it('調べている間: 名前・手がかり・「変える」・「調べずに、地図で場所を決める」', () => {
    const h = handlers();
    const ui = render(<SpotResearchSheet state={state({})} userLocation={null} {...h} />);
    expect(ui.getByText('「鹿島台神社」を調べています')).toBeTruthy();
    expect(ui.getByText('宮城県 大崎市 を優先して探しています')).toBeTruthy();
    expect(ui.getByText('変える')).toBeTruthy();
    fireEvent.press(ui.getByText('調べずに、地図で場所を決める'));
    expect(h.onOpenManual).toHaveBeenCalled();
  });

  it('手がかりが無ければ「全国から探しています」と「地域を絞る」', () => {
    const ui = render(
      <SpotResearchSheet state={state({ hint: null })} userLocation={null} {...handlers()} />
    );
    expect(ui.getByText('全国から探しています')).toBeTruthy();
    expect(ui.getByText('地域を絞る')).toBeTruthy();
  });

  it('「変える」で直した手がかりで調べ直す。空なら null', () => {
    const h = handlers();
    const ui = render(<SpotResearchSheet state={state({})} userLocation={null} {...h} />);
    fireEvent.press(ui.getByTestId('hint-change'));
    fireEvent.changeText(ui.getByTestId('hint-input'), '宮城県 仙台市');
    fireEvent.press(ui.getByTestId('hint-submit'));
    expect(h.onChangeHint).toHaveBeenLastCalledWith({ prefecture: '宮城県', city: '仙台市' });
    fireEvent.press(ui.getByTestId('hint-change'));
    fireEvent.changeText(ui.getByTestId('hint-input'), '');
    fireEvent.press(ui.getByTestId('hint-submit'));
    expect(h.onChangeHint).toHaveBeenLastCalledWith(null);
  });

  it.each([
    ['notFound', '見つかりませんでした'],
    ['error', '調べられませんでした。通信を確かめてください'],
    ['limit', '今日調べられる回数（10回）を使い切りました'],
  ] as const)('%s: 文言と、地図で決める', (status, text) => {
    const h = handlers();
    const ui = render(<SpotResearchSheet state={state({ status })} userLocation={null} {...h} />);
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
    const without = render(<SpotResearchSheet state={s} userLocation={null} {...handlers()} />);
    expect(without.queryByTestId('candidate-0-km')).toBeNull();
    const withLoc = render(
      <SpotResearchSheet
        state={s}
        userLocation={{ latitude: 38.4803, longitude: 141.0924 }}
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
        {...handlers()}
      />
    );
    for (const w of [/確認待ち/, /公開/]) expect(ui.queryByText(w)).toBeNull();
  });
});
