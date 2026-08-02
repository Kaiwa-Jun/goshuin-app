import { useState, useEffect } from 'react';
import { fetchSpotAggregatedInfo, fetchSpotSnsLinks } from '@services/spotInfo';
import type { LimitedGoshuinInfo, SpotAggregatedInfo, SpotSnsLink } from '@/types/supabase';

export interface ParsedSpotInfo {
  parking?: { available: boolean; capacity?: number; location?: string };
  affiliatedShrines?: { name: string; details?: string }[];
  receptionHours?: { open?: string; close?: string; notes?: string };
  accessNotes?: { type: string; text: string }[];
  limitedGoshuin?: LimitedGoshuinInfo;
  snsLinks?: SpotSnsLink[];
}

export function parseAggregatedInfo(items: SpotAggregatedInfo[]): ParsedSpotInfo | null {
  if (items.length === 0) return null;

  const result: ParsedSpotInfo = {};

  for (const item of items) {
    switch (item.info_type) {
      case 'parking':
        result.parking = item.info_data as ParsedSpotInfo['parking'];
        break;
      case 'affiliated_shrines':
        result.affiliatedShrines = item.info_data as unknown as ParsedSpotInfo['affiliatedShrines'];
        break;
      case 'reception_hours':
        result.receptionHours = item.info_data as ParsedSpotInfo['receptionHours'];
        break;
      case 'access_notes': {
        const data = item.info_data;
        if (Array.isArray(data)) {
          result.accessNotes = data as ParsedSpotInfo['accessNotes'];
        } else if (typeof data === 'object' && data !== null && 'value' in data) {
          // Legacy format: { value: string } → convert to array
          result.accessNotes = [{ type: 'note', text: String((data as { value: string }).value) }];
        }
        break;
      }
      case 'limited_goshuin': {
        const data = item.info_data;
        if (typeof data === 'object' && data !== null && Array.isArray(data.items)) {
          const items = data.items as LimitedGoshuinInfo['items'];
          if (items.length > 0) {
            const fetchedAt =
              typeof data.fetched_at === 'string' ? data.fetched_at : item.last_reported_at;
            result.limitedGoshuin = { items, fetched_at: fetchedAt };
          }
        }
        break;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function useSpotInfo(spotId: string): {
  spotInfo: ParsedSpotInfo | null;
  isLoading: boolean;
} {
  const [spotInfo, setSpotInfo] = useState<ParsedSpotInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!spotId) {
      setSpotInfo(null);
      return;
    }

    setIsLoading(true);
    Promise.all([fetchSpotAggregatedInfo(spotId), fetchSpotSnsLinks(spotId)])
      .then(([items, snsLinks]) => {
        const parsed = parseAggregatedInfo(items) ?? {};
        const merged: ParsedSpotInfo = snsLinks.length > 0 ? { ...parsed, snsLinks } : parsed;
        setSpotInfo(Object.keys(merged).length > 0 ? merged : null);
      })
      .catch(() => {
        setSpotInfo(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [spotId]);

  return { spotInfo, isLoading };
}
