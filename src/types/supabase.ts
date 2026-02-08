// Supabase 型定義（プレースホルダー）
// TODO: Supabase CLI の `supabase gen types typescript` で自動生成に置き換え

export type SpotType = 'shrine' | 'temple';
export type SpotStatus = 'active' | 'pending' | 'merged';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
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
  status: SpotStatus;
  created_by_user_id: string | null;
  merged_into_spot_id: string | null;
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
