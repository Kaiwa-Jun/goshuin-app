/**
 * 調べた候補と同じ寺社が登録済みか（Issue #278 / AC-1〜AC-6）
 * 契約書: docs/issues/issue-278-same-name-research.md（S2）
 */
import fs from 'fs';
import path from 'path';
import { findRegisteredSpot, REGISTERED_SPOT_METERS } from '../registeredSpot';

// マスタの値（seed_kyoto_rank_spots.sql・02_kanto.sql）
const kyoto = { id: 'kyoto-yasaka', name: '八坂神社', lat: 35.0036, lng: 135.778 };
const gunma = { id: 'gunma-yasaka', name: '八坂神社', lat: 36.2679, lng: 139.2786 };

// research-spot の候補（祇園は京都から約 45m）
const gion = { name: '八坂神社', lat: 35.0036, lng: 135.7785 };
const fukuchiyama = { name: '八坂神社', lat: 35.2966, lng: 135.1264 };

describe('findRegisteredSpot', () => {
  it('同じ名前で 300m 以内の寺社を、渡したものと同じ参照で返す（AC-1）', () => {
    expect(findRegisteredSpot(gion, [gunma, kyoto])).toBe(kyoto);
  });

  it('同じ名前でも遠い寺社しか無ければ null（AC-1）', () => {
    expect(findRegisteredSpot(fukuchiyama, [gunma, kyoto])).toBeNull();
  });

  it('正規化した名前が一致すれば同じ名前とみなす（AC-2）', () => {
    const alias = { ...kyoto, name: '八坂 神社（祇園さん）' };

    expect(findRegisteredSpot(gion, [alias])).toBe(alias);
  });

  it('300m 以内なら返し、超えれば null（AC-3。緯度 0.0026 度 ≈ 289m・0.0028 度 ≈ 311m）', () => {
    const near = { name: '八坂神社', lat: 35.0036 + 0.0026, lng: 135.7785 };
    const far = { name: '八坂神社', lat: 35.0036 + 0.0028, lng: 135.7785 };

    expect(findRegisteredSpot(gion, [near])).toBe(near);
    expect(findRegisteredSpot(gion, [far])).toBeNull();
  });

  it('名前が似ているだけでは返さない（AC-4。浅草神社と浅草寺は約 156m で isSimilarName は true）', () => {
    const asakusaShrine = { name: '浅草神社', lat: 35.7148, lng: 139.7966 };
    const sensoji = { name: '浅草寺', lat: 35.7134, lng: 139.7967 };

    expect(findRegisteredSpot(asakusaShrine, [sensoji])).toBeNull();
  });

  it('同じ場所でも名前が違えば返さない（AC-4）', () => {
    const hachiman = { name: '八幡神社', lat: 38.2682, lng: 140.8694 };
    const osaki = { name: '大崎八幡宮', lat: 38.2682, lng: 140.8694 };

    expect(findRegisteredSpot(hachiman, [osaki])).toBeNull();
  });

  it('当たる寺社が2つあれば近いほうを返す（AC-5。約 100m と約 50m）', () => {
    const at100 = { id: 'a', name: '八坂神社', lat: 35.0036 + 0.0009, lng: 135.7785 };
    const at50 = { id: 'b', name: '八坂神社', lat: 35.0036 + 0.00045, lng: 135.7785 };

    expect(findRegisteredSpot(gion, [at100, at50])).toBe(at50);
  });

  it('寺社が無ければ null（AC-5）', () => {
    expect(findRegisteredSpot(gion, [])).toBeNull();
  });
});

describe('REGISTERED_SPOT_METERS', () => {
  it('300m で、add-spot の重複の判定（spotRules.ts の NEARBY_METERS）と同じ（AC-6）', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../../supabase/functions/_shared/spotRules.ts'),
      'utf8'
    );
    const nearby = src.match(/export const NEARBY_METERS = (\d+);/);

    expect(REGISTERED_SPOT_METERS).toBe(300);
    expect(nearby).not.toBeNull();
    expect(REGISTERED_SPOT_METERS).toBe(Number(nearby?.[1]));
  });
});
