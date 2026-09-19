import React from 'react';
import { render } from '@testing-library/react-native';

import { SpotMapLayers } from '@components/map/SpotMapLayers';
import { VISIBLE_SPOT_FILTER } from '@components/map/spotPins';
import type { SpotFeatureCollection } from '@utils/spotGeoJson';

const empty: SpotFeatureCollection = { type: 'FeatureCollection', features: [] };

const renderLayers = () =>
  render(
    <SpotMapLayers
      clustered={empty}
      pinned={empty}
      onPressSpot={jest.fn()}
      onPressCluster={jest.fn()}
    />
  );

/** そのレイヤ id の filter を、描画ツリーから拾う */
const filterOf = (r: ReturnType<typeof render>, id: string) =>
  JSON.stringify(r.getByTestId(id).props.filter);

describe('SpotMapLayers のランク絞り込み', () => {
  it('未訪問のピンはズームに応じてランクで絞る', () => {
    const r = renderLayers();

    expect(filterOf(r, 'goshuin-spot-pin')).toBe(JSON.stringify(VISIBLE_SPOT_FILTER));
  });

  it('自分の記録（訪問済み・行きたい）には掛けない', () => {
    // #93 の除外規定。自分が印を付けたものが引いたときに消えると困る
    const r = renderLayers();

    expect(r.getByTestId('goshuin-pinned-pin').props.filter).toBeUndefined();
  });
});
