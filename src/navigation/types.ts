import type { NavigatorScreenParams, CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// --- Param Lists ---

/** 記録フローの入口。完了画面の出口の行き先になる */
export type RecordOrigin = 'map' | 'gallery';

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  /** origin は完了画面が「来た場所」に返すために使う。記録画面は地図と御朱印帳の両方から開ける */
  Record: { spotId?: string; origin?: RecordOrigin } | undefined;
  RecordComplete:
    | {
        stampImageUrl?: string;
        /** まとめて登録した枚数。表示できるのは先頭の1枚だけなので数だけ添える */
        stampCount?: number;
        spotName?: string;
        badge?: { name: string; description: string } | null;
        /** 訪問済みスポットの取得に失敗し、件数とバッジを算出できなかった（Issue #133） */
        countUnavailable?: boolean;
        /** 記録を始めた画面。終わったらここへ返す */
        origin?: RecordOrigin;
        /** 参拝日。YYYY-MM-DD（DATE 型のまま渡す。new Date() を挟まない） */
        visitedAt?: string;
        /** 記録した寺社の種別。ピンの色に使う */
        spotType?: 'shrine' | 'temple';
        /** 記録した寺社の県。完了画面の地図が寄る先 */
        prefecture?: string;
        /** その県が初めてか。チップを出すかどうか */
        isFirstInPrefecture?: boolean;
        /** 県ごとの枚数（いま記録したぶんを足した状態）。完了画面の地図の塗り */
        stampCountByPrefecture?: Record<string, number>;
        /** 通算の枚数（いま記録したぶんを含む） */
        totalStampCount?: number;
      }
    | undefined;
  Login: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  // Settings はスタックを持たないタブ画面なので、そこから開く画面は RootStack に置く
  AccountDeletion: undefined;
  Error: {
    type: 'network' | 'location' | 'upload';
    origin?: 'record';
    /** 失敗した処理。'upload' と 'create' で画面の見出しが変わる */
    stage?: 'upload' | 'create';
    /** 例外の原文。切り分けのため画面にそのまま出す */
    message?: string;
  };
};

export type CollectionStackParamList = {
  CollectionList: undefined;
  PilgrimageDetail: { pilgrimageId: string; pilgrimageName: string };
  /** 地図で県をタップした先。シートにしない理由は issue-209 の注意事項を見ること */
  PrefectureDetail: { prefecture: string };
};

export type MainTabParamList = {
  MapTab: NavigatorScreenParams<MapStackParamList>;
  GalleryTab: NavigatorScreenParams<GalleryStackParamList>;
  CollectionTab: NavigatorScreenParams<CollectionStackParamList>;
  Settings: undefined;
};

export type MapStackParamList = {
  Map: { focusSpotId?: string; focusPrefecture?: string } | undefined;
  SpotDetail: { spotId: string };
  Search: undefined;
};

export type GalleryStackParamList = {
  Gallery: undefined;
};

// --- Screen Props helpers ---

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

export type MapStackScreenProps<T extends keyof MapStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<MapStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

export type GalleryStackScreenProps<T extends keyof GalleryStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<GalleryStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

export type CollectionStackScreenProps<T extends keyof CollectionStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<CollectionStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

// --- Global type augmentation ---

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
