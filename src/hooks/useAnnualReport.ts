import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';

import { useAuth } from '@hooks/useAuth';
import { fetchAnnualReportSource } from '@services/annualReport';
import { getStampThumbUrl, getStampViewUrl } from '@services/stamps';
import { buildAnnualReport, type AnnualReport } from '@utils/annualReport';
import { annualReportNow } from '@utils/annualReportNow';
import { ANNUAL_REPORT_SAMPLES } from '@utils/annualReportSample';
import { jstYearMonth } from '@utils/jstDate';

export type AnnualReportStatus = 'loading' | 'ready' | 'empty' | 'error';

interface State {
  status: AnnualReportStatus;
  report: AnnualReport | null;
}

const LOADING: State = { status: 'loading', report: null };
const EMPTY: State = { status: 'empty', report: null };

const currentYear = () => jstYearMonth(annualReportNow()).year;

/** 読めなくても表示は続ける（写真の部品が元の写真・枠に落とす） */
function prefetch(url: string) {
  Promise.resolve()
    .then(() => Image.prefetch(url))
    .catch(() => {});
}

/** 表紙・いちばん多く参った は view、コラージュは thumb（D-14）。待たない */
function prefetchPhotos(report: AnnualReport) {
  if (report.cover.imagePath) prefetch(getStampViewUrl(report.cover.imagePath));
  if (report.memory.top?.imagePath) prefetch(getStampViewUrl(report.memory.top.imagePath));
  for (const photo of report.photos.shown) {
    if (photo.imagePath) prefetch(getStampThumbUrl(photo.imagePath));
  }
}

/**
 * 年報のデータ（Issue #274 D-14）。
 *
 * `sample` があれば見本から同期で作り、Supabase を呼ばない（開発用・Web の確認）。
 * 無ければ `useAuth` の読み込みが終わるのを待ってから読む。useAuth は画面ごとに
 * user=null から始まるので、待たないとログイン済みの人が一瞬ゲスト扱いになる（#270 b2cb961）
 */
export function useAnnualReport({
  year,
  sample,
}: {
  year: number;
  sample?: 'full' | 'few';
}): State {
  const { user, isLoading } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>(LOADING);

  const sampleState = useMemo<State | null>(() => {
    if (!sample) return null;
    const report = buildAnnualReport({
      year,
      currentYear: currentYear(),
      ...ANNUAL_REPORT_SAMPLES[sample],
    });
    return report ? { status: 'ready', report } : EMPTY;
  }, [year, sample]);

  useEffect(() => {
    if (sample || isLoading) return;
    if (userId === null) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    setState(LOADING);
    fetchAnnualReportSource(userId)
      .then(source => {
        if (cancelled) return;
        const report = buildAnnualReport({ year, currentYear: currentYear(), ...source });
        if (!report) {
          setState(EMPTY);
          return;
        }
        setState({ status: 'ready', report });
        prefetchPhotos(report);
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', report: null });
      });

    return () => {
      cancelled = true;
    };
  }, [sample, isLoading, userId, year]);

  return sampleState ?? state;
}
