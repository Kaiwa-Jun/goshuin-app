import {
  VisitPlanDateTakenError,
  deleteVisitPlan,
  fetchVisitPlans,
  fetchVisitedSpotIdsByDate,
  saveVisitPlan,
} from '@services/visitPlans';

/* 契約書: docs/issues/issue-258-visit-plan.md（S2 / AC-20・AC-21・AC-23） */
const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

/** from().select().eq().in().order() のどの並びでも、最後に await すると result を返す鎖 */
function chain(result: unknown) {
  const calls: { method: string; args: unknown[] }[] = [];
  const self: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'delete']) {
    self[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return self;
    };
  }
  self.then = (resolve: (v: unknown) => void) => resolve(result);
  return { self, calls };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

const spot = (id: string) => ({ id, name: id, type: 'shrine', lat: 35, lng: 135 });

describe('fetchVisitPlans', () => {
  it('日付の昇順で取り、寺社が見えない stop を落とし、残りを position 昇順にする', async () => {
    const { self, calls } = chain({
      data: [
        {
          id: 'p1',
          planned_on: '2026-10-03',
          name: '東山めぐり',
          visit_plan_stops: [
            { position: 2, spot_id: 'c', spots: spot('c') },
            { position: 0, spot_id: 'a', spots: spot('a') },
            { position: 1, spot_id: 'gone', spots: null },
          ],
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(self);

    const plans = await fetchVisitPlans();

    expect(mockFrom).toHaveBeenCalledWith('visit_plans');
    expect(calls.find(c => c.method === 'order')?.args).toEqual([
      'planned_on',
      { ascending: true },
    ]);
    expect(plans).toEqual([
      {
        id: 'p1',
        plannedOn: '2026-10-03',
        name: '東山めぐり',
        stops: [
          { spotId: 'a', position: 0, spot: spot('a') },
          { spotId: 'c', position: 2, spot: spot('c') },
        ],
      },
    ]);
  });

  it('失敗は投げる（空のカレンダーと区別する / D-25）', async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'down' } }).self);
    await expect(fetchVisitPlans()).rejects.toThrow('down');
  });
});

describe('saveVisitPlan', () => {
  it('新規は p_plan_id: null で save_visit_plan を1回呼び、id を返す', async () => {
    mockRpc.mockResolvedValue({ data: 'new-id', error: null });
    const id = await saveVisitPlan({
      plannedOn: '2026-10-03',
      name: '東山めぐり',
      spotIds: ['a', 'b'],
    });
    expect(mockRpc).toHaveBeenCalledWith('save_visit_plan', {
      p_plan_id: null,
      p_planned_on: '2026-10-03',
      p_name: '東山めぐり',
      p_spot_ids: ['a', 'b'],
    });
    expect(id).toBe('new-id');
  });

  it('既存は planId を渡す', async () => {
    mockRpc.mockResolvedValue({ data: 'p1', error: null });
    await saveVisitPlan({ planId: 'p1', plannedOn: '2026-10-04', name: 'x', spotIds: ['a'] });
    expect(mockRpc.mock.calls[0][1].p_plan_id).toBe('p1');
  });

  it('同じ日の予定（一意制約違反 23505）は VisitPlanDateTakenError、ほかの失敗は Error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'dup' } });
    await expect(
      saveVisitPlan({ plannedOn: '2026-10-03', name: 'x', spotIds: ['a'] })
    ).rejects.toBeInstanceOf(VisitPlanDateTakenError);
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } });
    const err = await saveVisitPlan({ plannedOn: '2026-10-03', name: 'x', spotIds: ['a'] }).catch(
      e => e
    );
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(VisitPlanDateTakenError);
  });
});

describe('deleteVisitPlan', () => {
  it('visit_plans を id で消す（stops は CASCADE）。失敗は投げる', async () => {
    const ok = chain({ error: null });
    mockFrom.mockReturnValueOnce(ok.self);
    await deleteVisitPlan('p1');
    expect(mockFrom).toHaveBeenCalledWith('visit_plans');
    expect(ok.calls.map(c => c.method)).toEqual(['delete', 'eq']);
    expect(ok.calls[1].args).toEqual(['id', 'p1']);

    mockFrom.mockReturnValueOnce(chain({ error: { message: 'x' } }).self);
    await expect(deleteVisitPlan('p1')).rejects.toThrow('x');
  });
});

describe('fetchVisitedSpotIdsByDate', () => {
  it('本人の stamps を visited_at in (日付) で1回だけ取り、日付ごとの Set にする', async () => {
    const { self, calls } = chain({
      data: [
        { spot_id: 'a', visited_at: '2026-09-20' },
        { spot_id: 'b', visited_at: '2026-09-20' },
        { spot_id: 'a', visited_at: '2026-09-13' },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(self);

    const map = await fetchVisitedSpotIdsByDate('user-1', ['2026-09-20', '2026-09-13']);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('stamps');
    expect(calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['user_id', 'user-1'] },
        { method: 'in', args: ['visited_at', ['2026-09-20', '2026-09-13']] },
      ])
    );
    expect(map.get('2026-09-20')).toEqual(new Set(['a', 'b']));
    expect(map.get('2026-09-13')).toEqual(new Set(['a']));
  });

  it('日付が無ければ問い合わせない。失敗は空（✓ を出さないだけ / D-25）', async () => {
    expect(await fetchVisitedSpotIdsByDate('user-1', [])).toEqual(new Map());
    expect(mockFrom).not.toHaveBeenCalled();
    mockFrom.mockReturnValue(chain({ data: null, error: { message: 'x' } }).self);
    expect(await fetchVisitedSpotIdsByDate('user-1', ['2026-09-20'])).toEqual(new Map());
  });
});
