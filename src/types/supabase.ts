// Supabase 型定義（プレースホルダー）
// TODO: Supabase CLI の `supabase gen types typescript` で自動生成に置き換え

export type SpotType = 'shrine' | 'temple';
export type SpotStatus = 'active' | 'pending' | 'merged';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  default_stamp_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: SpotType;
  address: string | null;
  prefecture: string | null;
  status: SpotStatus;
  rank: number;
  created_by_user_id: string | null;
  merged_into_spot_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractedInfo {
  parking?: { available: boolean; capacity?: number; location?: string };
  affiliated_shrines?: { name: string; details?: string }[];
  reception_hours?: { open?: string; close?: string; notes?: string };
  access_notes?: { type: string; text: string }[];
}

export interface SpotAggregatedInfo {
  id: string;
  spot_id: string;
  info_type: 'parking' | 'affiliated_shrines' | 'reception_hours' | 'access_notes';
  info_data: Record<string, unknown>;
  source_stamp_ids: string[];
  confidence_score: number;
  last_reported_at: string;
  created_at: string;
  updated_at: string;
}

export interface Stamp {
  id: string;
  user_id: string;
  spot_id: string;
  goshuincho_id: string | null;
  visited_at: string;
  image_path: string;
  memo: string | null;
  is_public: boolean;
  extracted_info: ExtractedInfo | null;
  created_at: string;
  updated_at: string;
}

export interface StampWithSpot extends Stamp {
  spots: {
    name: string;
    type: SpotType;
  };
}

export interface Wishlist {
  id: string;
  user_id: string;
  spot_id: string;
  created_at: string;
}

export interface WishlistWithSpot extends Wishlist {
  spots: {
    name: string;
    type: SpotType;
    address: string | null;
  };
}

export interface PublicStampWithUser extends Stamp {
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface Pilgrimage {
  id: string;
  name: string;
  description: string | null;
  region: string | null;
  category: string | null;
  total_spots: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PilgrimageSpot {
  id: string;
  pilgrimage_id: string;
  spot_id: string;
  sort_order: number | null;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface Goshuincho {
  id: string;
  user_id: string;
  name: string;
  cover_image_path: string | null;
  started_at: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
