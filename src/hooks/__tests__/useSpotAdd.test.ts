import { act, renderHook } from '@testing-library/react-native';

import { RESEARCH_TIMEOUT_MS, useSpotAdd } from '@hooks/useSpotAdd';

/* 契約書: docs/issues/issue-248-spot-add-research.md（S4 / AC-35・AC-36） */
const mockResearch = jest.fn();
const mockAddResearched = jest.fn();
const mockAddManual = jest.fn();
jest.mock('@services/spotAdd', () => ({
  researchSpot: (...a: unknown[]) => mockResearch(...a),
  addResearchedSpot: (...a: unknown[]) => mockAddResearched(...a),
  addManualSpot: (...a: unknown[]) => mockAddManual(...a),
}));

const hint = { prefecture: '宮城県', city: '大崎市' };
const candidate = {
  index: 0,
  name: '鹿島台神社',
  type: 'shrine',
  address: '宮城県大崎市鹿島台平渡',
  prefecture: '宮城県',
  lat: 38.48,
  lng: 141.09,
  sourceCount: 3,
  sourceLabels: ['公式サイト'],
};

beforeEach(() => {
  jest.useFakeTimers();
  mockResearch.mockReset();
  mockAddResearched.mockReset();
  mockAddManual.mockReset();
});
afterEach(() => jest.useRealTimers());

it('調べて、候補が返れば candidates', async () => {
  mockResearch.mockResolvedValue({ kind: 'ok', researchId: 'r1', candidates: [candidate] });
  const { result } = renderHook(() => useSpotAdd(jest.fn()));
  await act(async () => result.current.start('鹿島台神社', hint));
  expect(mockResearch).toHaveBeenCalledWith('鹿島台神社', hint);
  expect(result.current.state.status).toBe('candidates');
  expect(result.current.state.candidates).toEqual([candidate]);
});

it('0件は notFound、429 は limit、失敗は error', async () => {
  const { result } = renderHook(() => useSpotAdd(jest.fn()));
  mockResearch.mockResolvedValueOnce({ kind: 'ok', researchId: 'r1', candidates: [] });
  await act(async () => result.current.start('x', null));
  expect(result.current.state.status).toBe('notFound');
  mockResearch.mockResolvedValueOnce({ kind: 'limit' });
  await act(async () => result.current.start('x', null));
  expect(result.current.state.status).toBe('limit');
  mockResearch.mockResolvedValueOnce({ kind: 'error' });
  await act(async () => result.current.start('x', null));
  expect(result.current.state.status).toBe('error');
});

it('25 秒で返らなければ error。あとから返っても上書きしない', async () => {
  let resolve: (v: unknown) => void = () => {};
  mockResearch.mockReturnValue(new Promise(r => (resolve = r)));
  const { result } = renderHook(() => useSpotAdd(jest.fn()));
  act(() => {
    result.current.start('x', null);
  });
  expect(result.current.state.status).toBe('researching');
  await act(async () => jest.advanceTimersByTime(RESEARCH_TIMEOUT_MS));
  expect(RESEARCH_TIMEOUT_MS).toBe(25000);
  expect(result.current.state.status).toBe('error');
  await act(async () => resolve({ kind: 'ok', researchId: 'r1', candidates: [candidate] }));
  expect(result.current.state.status).toBe('error');
});

it('手がかりを変えると、その手がかりで調べ直す', async () => {
  mockResearch.mockResolvedValue({ kind: 'ok', researchId: 'r1', candidates: [] });
  const { result } = renderHook(() => useSpotAdd(jest.fn()));
  await act(async () => result.current.start('鹿島台神社', hint));
  await act(async () => result.current.changeHint(null));
  expect(mockResearch).toHaveBeenLastCalledWith('鹿島台神社', null);
});

it('「ここです」で add-spot の結果を渡して閉じる', async () => {
  const onAdded = jest.fn();
  mockResearch.mockResolvedValue({ kind: 'ok', researchId: 'r1', candidates: [candidate] });
  mockAddResearched.mockResolvedValue({ id: 'new' });
  const { result } = renderHook(() => useSpotAdd(onAdded));
  await act(async () => result.current.start('鹿島台神社', hint));
  await act(async () => result.current.choose(0));
  expect(mockAddResearched).toHaveBeenCalledWith('r1', 0);
  expect(onAdded).toHaveBeenCalledWith({ id: 'new' });
  expect(result.current.state.status).toBe('idle');
});

it('地図で決める → 保存で add-spot（manual）の結果を渡す。どの状態からでも開ける', async () => {
  const onAdded = jest.fn();
  mockResearch.mockReturnValue(new Promise(() => {}));
  mockAddManual.mockResolvedValue({ id: 'm1' });
  const { result } = renderHook(() => useSpotAdd(onAdded));
  act(() => {
    result.current.start('鹿島台神社', null);
  });
  act(() => result.current.openManual());
  expect(result.current.state.status).toBe('manual');
  expect(result.current.state.placing).toBe(true);
  const manual = { name: '鹿島台神社', type: 'shrine' as const, lat: 38.4, lng: 141.0 };
  await act(async () => result.current.saveManual(manual));
  expect(mockAddManual).toHaveBeenCalledWith(manual);
  expect(onAdded).toHaveBeenCalledWith({ id: 'm1' });
  expect(result.current.state.status).toBe('idle');
  expect(result.current.state.placing).toBe(false);
});
