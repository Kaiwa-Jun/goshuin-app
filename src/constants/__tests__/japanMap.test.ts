import {
  JAPAN_MAP_HEIGHT,
  JAPAN_MAP_WIDTH,
  JAPAN_PREFECTURE_NAMES,
  JAPAN_PREFECTURE_BOXES,
  JAPAN_PREFECTURE_PATHS,
} from '@/constants/japanMap';
import { REGION_BLOCKS } from '@utils/regionBlocks';

describe('JAPAN_PREFECTURE_PATHS', () => {
  it('47県ある', () => {
    expect(JAPAN_PREFECTURE_NAMES).toHaveLength(47);
  });

  /*
   * 県名が regionBlocks と食い違うと、県ごとの集計が「どの県にも当たらない」まま
   * 静かに消える。「京都」と「京都府」のような表記ゆれで起きるので、過不足の
   * 両方向を見る
   */
  it('regionBlocks の47県と過不足なく一致する', () => {
    const fromBlocks = REGION_BLOCKS.flatMap(block => block.prefectures);

    expect([...JAPAN_PREFECTURE_NAMES].sort()).toEqual([...fromBlocks].sort());
  });

  it('すべての県がパスを持つ', () => {
    for (const name of JAPAN_PREFECTURE_NAMES) {
      expect(JAPAN_PREFECTURE_PATHS[name]).toMatch(/^M[\d.\s LMZ]+Z$/);
    }
  });

  it('viewBox が縦長（日本列島の向き）', () => {
    expect(JAPAN_MAP_WIDTH).toBeGreaterThan(0);
    expect(JAPAN_MAP_HEIGHT).toBeGreaterThan(JAPAN_MAP_WIDTH);
  });
});

describe('JAPAN_PREFECTURE_BOXES', () => {
  it('47県ぶんある', () => {
    expect(Object.keys(JAPAN_PREFECTURE_BOXES).sort()).toEqual([...JAPAN_PREFECTURE_NAMES].sort());
  });

  it('すべて地図の中に収まっている', () => {
    for (const [name, box] of Object.entries(JAPAN_PREFECTURE_BOXES)) {
      expect({ name, ok: box.x >= 0 && box.y >= 0 }).toEqual({ name, ok: true });
      expect({ name, ok: box.x + box.width <= JAPAN_MAP_WIDTH }).toEqual({ name, ok: true });
      expect({ name, ok: box.y + box.height <= JAPAN_MAP_HEIGHT }).toEqual({ name, ok: true });
      expect(box.width).toBeGreaterThan(0);
    }
  });

  /*
   * 離島を含めると寄り先が狂う。東京の範囲に小笠原（南へ 1000km）が入ると
   * 保存直後のカメラが太平洋の真ん中を指す
   */
  it('東京の範囲に小笠原が入っていない', () => {
    const tokyo = JAPAN_PREFECTURE_BOXES['東京都'];
    const kanagawa = JAPAN_PREFECTURE_BOXES['神奈川県'];

    expect(tokyo.height).toBeLessThan(kanagawa.height * 3);
    expect(tokyo.y).toBeLessThan(kanagawa.y + kanagawa.height);
  });

  it('北から南の並びが、地理と合っている', () => {
    const y = (n: string) => JAPAN_PREFECTURE_BOXES[n].y;

    expect(y('北海道')).toBeLessThan(y('東京都'));
    expect(y('東京都')).toBeLessThan(y('鹿児島県'));
    expect(y('鹿児島県')).toBeLessThan(y('沖縄県'));
  });
});
