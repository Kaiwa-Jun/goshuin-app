import { addManualSpot, addResearchedSpot, researchSpot } from '@services/spotAdd';

/* 契約書: docs/issues/issue-248-spot-add-research.md（S4 / AC-32・AC-33） */
const mockInvoke = jest.fn();
jest.mock('@services/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

/** どの深さにもそのキーが無いか */
function hasKeyDeep(value: unknown, keys: string[]): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([k, v]) => keys.includes(k) || hasKeyDeep(v, keys));
}

const httpError = (status: number) => ({ message: 'x', context: { status } });

beforeEach(() => mockInvoke.mockReset());

describe('researchSpot', () => {
  it('送るのは name と hint だけ。位置情報はどの深さにも無い', async () => {
    mockInvoke.mockResolvedValue({ data: { researchId: 'r1', candidates: [] }, error: null });
    await researchSpot('鹿島台神社', { prefecture: '宮城県', city: '大崎市' });
    const [fn, { body }] = mockInvoke.mock.calls[0];
    expect(fn).toBe('research-spot');
    expect(Object.keys(body).sort()).toEqual(['hint', 'name']);
    expect(hasKeyDeep(body, ['lat', 'lng', 'latitude', 'longitude'])).toBe(false);
  });

  it('候補を返す。429 は limit、それ以外の失敗は error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { researchId: 'r1', candidates: [] }, error: null });
    expect(await researchSpot('x', null)).toEqual({
      kind: 'ok',
      researchId: 'r1',
      candidates: [],
    });
    mockInvoke.mockResolvedValueOnce({ data: null, error: httpError(429) });
    expect(await researchSpot('x', null)).toEqual({ kind: 'limit' });
    mockInvoke.mockResolvedValueOnce({ data: null, error: httpError(504) });
    expect(await researchSpot('x', null)).toEqual({ kind: 'error' });
    mockInvoke.mockRejectedValueOnce(new Error('network'));
    expect(await researchSpot('x', null)).toEqual({ kind: 'error' });
  });
});

describe('addResearchedSpot / addManualSpot', () => {
  it('候補は researchId と candidateIndex だけを送る', async () => {
    mockInvoke.mockResolvedValue({ data: { spot: { id: 's1' } }, error: null });
    expect(await addResearchedSpot('r1', 2)).toEqual({ id: 's1' });
    expect(mockInvoke).toHaveBeenCalledWith('add-spot', {
      body: { researchId: 'r1', candidateIndex: 2 },
    });
  });

  it('地図で決めたものは manual で送る', async () => {
    mockInvoke.mockResolvedValue({ data: { spot: { id: 's2' } }, error: null });
    const manual = { name: '鹿島台神社', type: 'shrine' as const, lat: 38.48, lng: 141.09 };
    expect(await addManualSpot(manual)).toEqual({ id: 's2' });
    expect(mockInvoke).toHaveBeenCalledWith('add-spot', { body: { manual } });
  });

  it('失敗は投げる', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(500) });
    await expect(addResearchedSpot('r1', 0)).rejects.toThrow();
  });
});
