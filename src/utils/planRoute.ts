// 予定の地図に描く番号ピンと点線（Issue #258 / D-22）。
// revealedCount で「1番から順に描く」途中を表す（0 なら何も描かない）

interface RoutePoint {
  spotId: string;
  lat: number;
  lng: number;
}

interface PlanRouteFeatureCollection<G> {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: G;
    properties: Record<string, string | number>;
  }[];
}

export function buildPlanRouteSources(
  ordered: RoutePoint[],
  revealedCount: number
): {
  route: PlanRouteFeatureCollection<{ type: 'LineString'; coordinates: [number, number][] }>;
  stops: PlanRouteFeatureCollection<{ type: 'Point'; coordinates: [number, number] }>;
} {
  const shown = ordered.slice(0, Math.max(0, revealedCount));
  return {
    route: {
      type: 'FeatureCollection',
      features: shown.slice(1).map((b, i) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [shown[i].lng, shown[i].lat],
            [b.lng, b.lat],
          ],
        },
        properties: { index: i },
      })),
    },
    stops: {
      type: 'FeatureCollection',
      features: shown.map((s, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: { spotId: s.spotId, number: i + 1 },
      })),
    },
  };
}
