import React from 'react';
import { render } from '@testing-library/react-native';

import { PlanChosenPins, PlanRouteLayers } from '@components/plan/PlanMapLayers';
import {
  CHOSEN_PIN_SCALE,
  CHOSEN_PIN_STYLE,
  chosenPinLayouts,
} from '@components/plan/planMapStyle';
import { pinIconSize } from '@components/map/spotPins';
import { buildPlanRouteSources } from '@utils/planRoute';
import { colors } from '@theme/colors';

/* 契約書: docs/issues/issue-258-visit-plan.md（UI-5・UI-6） */
const EMPTY = { type: 'FeatureCollection' as const, features: [] };

describe('PlanRouteLayers', () => {
  it('UI-5: 点線は朱・太さ3・[2,2]、番号の丸は朱・半径13', () => {
    const r = render(
      <PlanRouteLayers
        sources={buildPlanRouteSources(
          [
            { spotId: 'a', lat: 35, lng: 135 },
            { spotId: 'b', lat: 35.01, lng: 135.01 },
          ],
          2
        )}
      />
    );
    expect(r.getByTestId('plan-route-line').props.paint).toEqual(
      expect.objectContaining({
        'line-color': colors.seal,
        'line-width': 3,
        'line-dasharray': [2, 2],
      })
    );
    expect(r.getByTestId('plan-stops-circle').props.paint).toEqual(
      expect.objectContaining({ 'circle-color': colors.seal, 'circle-radius': 13 })
    );
    expect(r.getByTestId('plan-route').props.data.features).toHaveLength(1);
  });
});

describe('PlanChosenPins', () => {
  it("UI-6: 既定は 'big-check'。1.45倍の大きさと ✓ の画像", () => {
    expect(CHOSEN_PIN_STYLE).toBe('big-check');
    const r = render(<PlanChosenPins data={EMPTY} />);
    const pin = r.getByTestId('plan-chosen-pin').props.layout;
    const mark = r.getByTestId('plan-chosen-mark').props.layout;
    expect(pin['icon-size']).toEqual(pinIconSize(CHOSEN_PIN_SCALE));
    expect(pin['icon-size']).not.toEqual(pinIconSize(1));
    expect(mark['icon-image']).toBe('spot-pin-chosen-check');
  });

  it("UI-6: 'ring' は通常の大きさと輪の画像", () => {
    const { pin, mark } = chosenPinLayouts('ring');
    expect(pin?.['icon-size']).toEqual(pinIconSize(1));
    expect(mark?.['icon-image']).toBe('spot-pin-chosen-ring');
  });
});
