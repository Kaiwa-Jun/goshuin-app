import { fetchGsiPlaces, GSI_ADDRESS_SEARCH_URL, GSI_TIMEOUT_MS } from '@services/placeSearch';
import { F4 } from '@utils/__tests__/placeSearchFixtures';

// テストからネットに出ない。fetch はここで差し替える
const mockFetch = jest.fn();
const realFetch = global.fetch;

function respond(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('fetchGsiPlaces（Issue #311 の第2段。国土地理院の住所検索）', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = realFetch;
    warn.mockRestore();
    jest.useRealTimers();
  });

  it('定数', () => {
    expect(GSI_ADDRESS_SEARCH_URL).toBe('https://msearch.gsi.go.jp/address-search/AddressSearch');
    expect(GSI_TIMEOUT_MS).toBe(5000);
  });

  it('AC-32: 言葉を URL に入れて1回だけ GET し、形の合わない要素は捨てる', async () => {
    mockFetch.mockResolvedValue(
      respond([
        F4,
        { geometry: { coordinates: ['a', 'b'] }, properties: { title: 'x', addressCode: '' } },
      ])
    );

    const result = await fetchGsiPlaces('渋谷駅');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://msearch.gsi.go.jp/address-search/AddressSearch?q=%E6%B8%8B%E8%B0%B7%E9%A7%85',
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(result).toEqual([F4]);
  });

  it('前後の空白は落として送る。キー・独自のヘッダーは付けない', async () => {
    mockFetch.mockResolvedValue(respond([]));

    await fetchGsiPlaces(' 渋谷駅 ');

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${GSI_ADDRESS_SEARCH_URL}?q=${encodeURIComponent('渋谷駅')}`);
    expect(init.headers).toBeUndefined();
  });

  it('title が文字でない・座標が2つでない要素も捨てる', async () => {
    mockFetch.mockResolvedValue(
      respond([
        { geometry: { coordinates: [139.7, 35.6] }, properties: { title: 1, addressCode: '' } },
        { geometry: { coordinates: [139.7] }, properties: { title: 'y', addressCode: '' } },
        { properties: { title: 'z', addressCode: '' } },
        null,
        F4,
      ])
    );

    expect(await fetchGsiPlaces('渋谷駅')).toEqual([F4]);
  });

  it('AC-33: 通信の失敗は投げずに null。console.warn を1回', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    await expect(fetchGsiPlaces('渋谷駅')).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe('fetchGsiPlaces error:');
  });

  it('AC-33: 200 以外・配列でない答えも null', async () => {
    mockFetch.mockResolvedValueOnce(respond([], 500));
    await expect(fetchGsiPlaces('渋谷駅')).resolves.toBeNull();

    mockFetch.mockResolvedValueOnce(respond({}));
    await expect(fetchGsiPlaces('渋谷駅')).resolves.toBeNull();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    await expect(fetchGsiPlaces('渋谷駅')).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('AC-33: 5,000ms たっても返らなければ打ち切って null', async () => {
    jest.useFakeTimers();
    // signal を見ない fetch でも打ち切れること
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const pending = fetchGsiPlaces('渋谷駅');
    await jest.advanceTimersByTimeAsync(GSI_TIMEOUT_MS);

    await expect(pending).resolves.toBeNull();
    const init = mockFetch.mock.calls[0][1] as { signal: AbortSignal };
    expect(init.signal.aborted).toBe(true);
  });
});
