import cases from '../../../supabase/functions/_shared/spot_name_cases.json';
import { didYouMean, guessTypeFromName, isSimilarName, typeConflicts } from '@utils/spotName';

/* 契約書: docs/issues/issue-248-spot-add-research.md（S1 / AC-1・AC-8） */
describe('isSimilarName', () => {
  it.each(cases)('$a / $b → $similar（Deno と共用の表）', ({ a, b, similar }) => {
    expect(isSimilarName(a, b)).toBe(similar);
  });
});

describe('typeConflicts / guessTypeFromName', () => {
  it('名前と種別の矛盾', () => {
    expect(typeConflicts('東福寺', 'shrine')).toBe(true);
    expect(typeConflicts('鹿島台神社', 'temple')).toBe(true);
    expect(typeConflicts('宮城野八幡寺', 'temple')).toBe(false);
  });
  it('「寺」「院」「堂」なら寺院、それ以外は神社', () => {
    expect(guessTypeFromName('天龍寺')).toBe('temple');
    expect(guessTypeFromName('鹿島台神社')).toBe('shrine');
    expect(guessTypeFromName('瑞鳳殿')).toBe('shrine');
  });
});

describe('didYouMean', () => {
  const item = (id: string, name: string, distanceKm: number) => ({
    spot: { id, name },
    distanceKm,
  });
  it('似た名前を、並び順（近い順）のまま最大3件。除く id と検索語と同じ名前は出さない', () => {
    const items = [
      item('a', '鹿島神社', 1),
      item('b', '瑞鳳殿', 2),
      item('c', '鹿島神宮', 228),
      item('d', '鹿島台神社', 3),
      item('e', '鹿島神社', 5),
      item('f', '鹿島台稲荷神社', 9),
      item('g', '鹿島社', 12),
    ];
    expect(didYouMean('鹿島台神社', items, new Set(['a'])).map(i => i.spot.id)).toEqual([
      'c',
      'e',
      'f',
    ]);
  });
});
