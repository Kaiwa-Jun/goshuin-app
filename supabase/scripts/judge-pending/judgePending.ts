// 既存の pending の寺社に、add-spot と同じ公開の基準（§5）を当てる（Issue #248 S6）。
// 判定は judgePublish、候補は research-spot と同じ researchCandidates で調べる。
// 既存の lat / lng は書き換えない（2026-09-24 に手で直した値を使う）
import {
  judgePublish,
  type NamedPoint,
  type PublishFailure,
} from '../../functions/_shared/spotRules.ts';
import { normalizeSpotName } from '../../functions/_shared/spotName.ts';
import type { StoredCandidate } from '../../functions/_shared/spotResearch.ts';

export interface PendingRow {
  id: string;
  name: string;
  type: 'shrine' | 'temple';
  address: string | null;
  prefecture: string | null;
  lat: number;
  lng: number;
}

export interface JudgeDeps {
  listPending(ids: string[]): Promise<PendingRow[]>;
  nearbyActives(lat: number, lng: number): Promise<NamedPoint[]>;
  /** 見つからない・失敗は null */
  research(
    name: string,
    hint: { prefecture: string | null; city: string | null }
  ): Promise<StoredCandidate[] | null>;
  activate(id: string): Promise<void>;
  log(line: string): void;
}

export interface JudgeResult {
  id: string;
  name: string;
  status: 'active' | 'pending';
  failed: (PublishFailure | 'no-candidate')[];
}

/** 住所から市区町村（src/utils/frequentArea.ts の cityNameOf と同じ規則。郡は飛ばす） */
function cityOf(address: string | null): string | null {
  if (!address) return null;
  const rest = address
    .replace(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/, '')
    .replace(/^.+?郡/, '');
  return rest.match(/^(.+?[市区町村])/)?.[1] ?? null;
}

export async function judgePending(
  deps: JudgeDeps,
  ids: string[],
  apply: boolean
): Promise<JudgeResult[]> {
  const results: JudgeResult[] = [];
  for (const row of await deps.listPending(ids)) {
    const candidates = await deps.research(row.name, {
      prefecture: row.prefecture,
      city: cityOf(row.address),
    });
    const match = candidates?.find(
      c =>
        normalizeSpotName(c.name) === normalizeSpotName(row.name) && c.prefecture === row.prefecture
    );
    let result: JudgeResult;
    if (!match) {
      result = { id: row.id, name: row.name, status: 'pending', failed: ['no-candidate'] };
    } else {
      const judged = judgePublish({
        name: row.name,
        type: row.type,
        prefecture: row.prefecture,
        lat: row.lat,
        lng: row.lng,
        sourceUrls: match.sources.map(s => s.url),
        nearbyActives: await deps.nearbyActives(row.lat, row.lng),
      });
      result = { id: row.id, name: row.name, ...judged };
    }
    deps.log(`${result.id}\t${result.name}\t${result.status}\t${result.failed.join(',') || '-'}`);
    if (apply && result.status === 'active') await deps.activate(row.id);
    results.push(result);
  }
  return results;
}
