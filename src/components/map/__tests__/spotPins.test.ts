import { VISIBLE_SPOT_FILTER } from '@components/map/spotPins';

/**
 * 式を目で追っても、どのズームで何が出るかは分からない。
 * テスト側で評価して確かめる
 */
/** 式の中から ['step', ['zoom'], ...] を探す。'all' の中の並び順に依存しない */
function findZoomStep(node: unknown): unknown[] | null {
  if (!Array.isArray(node)) return null;
  if (node[0] === 'step' && JSON.stringify(node[1]) === JSON.stringify(['zoom'])) return node;
  for (const child of node) {
    const found = findZoomStep(child);
    if (found) return found;
  }
  return null;
}

function minRankAt(zoom: number): number {
  const step = findZoomStep(VISIBLE_SPOT_FILTER);
  if (!step) throw new Error('ズーム段階の式が見つからない');
  let value = step[2] as number;
  for (let i = 3; i < step.length; i += 2) {
    if (zoom >= (step[i] as number)) value = step[i + 1] as number;
  }
  return value;
}

describe('VISIBLE_SPOT_FILTER', () => {
  it('団子にまとまっている点は出さない', () => {
    expect(JSON.stringify(VISIBLE_SPOT_FILTER)).toContain('point_count');
  });

  it('引いているときは主要なスポットだけ出す', () => {
    expect(minRankAt(9)).toBe(5);
    expect(minRankAt(10.9)).toBe(5);
  });

  it('寄るほど下のランクまで出す', () => {
    expect(minRankAt(11)).toBe(4);
    expect(minRankAt(12.4)).toBe(4);
    expect(minRankAt(12.5)).toBe(3);
    expect(minRankAt(13.9)).toBe(3);
  });

  it('十分寄ったら全部出す', () => {
    expect(minRankAt(14)).toBe(1);
    expect(minRankAt(18)).toBe(1);
  });

  it('段階は単調に緩くなる。寄って消えるスポットがあってはいけない', () => {
    let previous = Infinity;
    for (let z = 8; z <= 20; z += 0.5) {
      const current = minRankAt(z);
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });
});
