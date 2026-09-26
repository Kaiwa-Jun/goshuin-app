import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearAutoPlayShown,
  countStampsInYear,
  fetchAnnualReportSource,
  markAutoPlayShown,
  readAutoPlayShown,
} from '@services/annualReport';

const mockFrom = jest.fn();

jest.mock('@services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

/** 呼んだメソッドを覚えて、最後に await すると result を返す問い合わせ */
function query(result: unknown) {
  const q: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const m of ['select', 'eq', 'gte', 'lte']) q[m] = jest.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return q;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('countStampsInYear', () => {
  it('AC-20: その年の本人の記録の数を数える', async () => {
    const q = query({ count: 3, error: null });
    mockFrom.mockReturnValue(q);

    await expect(countStampsInYear('u1', 2026)).resolves.toBe(3);

    expect(mockFrom).toHaveBeenCalledWith('stamps');
    expect(q.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(q.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(q.gte).toHaveBeenCalledWith('visited_at', '2026-01-01');
    expect(q.lte).toHaveBeenCalledWith('visited_at', '2026-12-31');
  });

  it('AC-20: count が null なら 0', async () => {
    mockFrom.mockReturnValue(query({ count: null, error: null }));
    await expect(countStampsInYear('u1', 2026)).resolves.toBe(0);
  });

  it('AC-20: 失敗したら reject（0 件と区別する）', async () => {
    mockFrom.mockReturnValue(query({ count: null, error: { message: 'boom' } }));
    await expect(countStampsInYear('u1', 2026)).rejects.toThrow('boom');
  });
});

describe('fetchAnnualReportSource', () => {
  const stampRows = [
    {
      id: 'a1',
      spot_id: 's1',
      visited_at: '2026-01-03',
      created_at: '2026-01-03T01:00:00Z',
      image_path: 'u/a1.jpg',
      spots: { name: '大崎八幡宮', type: 'shrine', prefecture: '宮城県' },
    },
  ];
  const pilgrimageRows = [
    { id: 'p1', name: '仙台六芒星巡り', pilgrimage_spots: [{ spot_id: 's1' }, { spot_id: 's2' }] },
  ];

  const route = (stamps: unknown, pilgrimages: unknown) => {
    const qs = { stamps: query(stamps), pilgrimages: query(pilgrimages) };
    mockFrom.mockImplementation((table: 'stamps' | 'pilgrimages') => qs[table]);
    return qs;
  };

  it('AC-21: 記録と巡礼を年報の形にして返す', async () => {
    const qs = route({ data: stampRows, error: null }, { data: pilgrimageRows, error: null });

    await expect(fetchAnnualReportSource('u1')).resolves.toEqual({
      visits: [
        {
          id: 'a1',
          spotId: 's1',
          visitedAt: '2026-01-03',
          createdAt: '2026-01-03T01:00:00Z',
          imagePath: 'u/a1.jpg',
          spotName: '大崎八幡宮',
          spotType: 'shrine',
          prefecture: '宮城県',
        },
      ],
      pilgrimages: [{ id: 'p1', name: '仙台六芒星巡り', spotIds: ['s1', 's2'] }],
    });

    expect(qs.stamps.select).toHaveBeenCalledWith(
      'id, spot_id, visited_at, created_at, image_path, spots!inner(name, type, prefecture)'
    );
    expect(qs.stamps.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(qs.pilgrimages.select).toHaveBeenCalledWith('id, name, pilgrimage_spots(spot_id)');
    expect(qs.pilgrimages.eq).toHaveBeenCalledWith('is_active', true);
  });

  it('AC-21: 記録の取得に失敗したら reject', async () => {
    route({ data: null, error: { message: 'stamps down' } }, { data: [], error: null });
    await expect(fetchAnnualReportSource('u1')).rejects.toThrow('stamps down');
  });

  it('AC-21: 巡礼の取得に失敗したら reject', async () => {
    route({ data: [], error: null }, { data: null, error: { message: 'pilgrimages down' } });
    await expect(fetchAnnualReportSource('u1')).rejects.toThrow('pilgrimages down');
  });
});

describe('自動再生の印', () => {
  it('AC-21: 出したら年とアカウントごとに印を書く', async () => {
    await markAutoPlayShown(2026, 'u1');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('annual_report_autoplayed:2026:u1', 'true');
  });

  it('AC-21: 印が true なら出した', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('true');
    await expect(readAutoPlayShown(2026, 'u1')).resolves.toBe(true);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('annual_report_autoplayed:2026:u1');
  });

  it('AC-21: 印が無ければまだ', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);
    await expect(readAutoPlayShown(2026, 'u1')).resolves.toBe(false);
  });

  it('AC-21: 消すときは removeItem', async () => {
    await clearAutoPlayShown(2026, 'u1');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('annual_report_autoplayed:2026:u1');
  });
});
