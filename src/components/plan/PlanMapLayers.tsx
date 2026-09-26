import React from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

import {
  ROUTE_LINE_PAINT,
  STOP_CIRCLE_PAINT,
  STOP_NUMBER_LAYOUT,
  STOP_NUMBER_PAINT,
  chosenPinLayouts,
} from '@components/plan/planMapStyle';
import type { SpotFeatureCollection } from '@utils/spotGeoJson';
import type { buildPlanRouteSources } from '@utils/planRoute';

/** 予定を組む（②）で選んだ寺社。いつものピンの上に、大きいピンと印を重ねる */
export function PlanChosenPins({ data }: { data: SpotFeatureCollection }) {
  const layouts = chosenPinLayouts();
  return (
    <GeoJSONSource id="plan-chosen" data={data}>
      <Layer id="plan-chosen-pin" type="symbol" layout={layouts.pin} />
      <Layer id="plan-chosen-mark" type="symbol" layout={layouts.mark} />
    </GeoJSONSource>
  );
}

/** 順番（③）の点線と番号のピン。1番から順に描くときは features が増えていく */
export function PlanRouteLayers({
  sources,
}: {
  sources: ReturnType<typeof buildPlanRouteSources>;
}) {
  return (
    <>
      <GeoJSONSource id="plan-route" data={sources.route}>
        <Layer id="plan-route-line" type="line" paint={ROUTE_LINE_PAINT} />
      </GeoJSONSource>
      <GeoJSONSource id="plan-stops" data={sources.stops}>
        <Layer id="plan-stops-circle" type="circle" paint={STOP_CIRCLE_PAINT} />
        <Layer
          id="plan-stops-number"
          type="symbol"
          layout={STOP_NUMBER_LAYOUT}
          paint={STOP_NUMBER_PAINT}
        />
      </GeoJSONSource>
    </>
  );
}
