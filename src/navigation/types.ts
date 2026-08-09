import type { NavigatorScreenParams, CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// --- Param Lists ---

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Record: { spotId?: string } | undefined;
  RecordComplete:
    | {
        stampImageUrl?: string;
        spotName?: string;
        visitCount?: number;
        badge?: { name: string; description: string } | null;
      }
    | undefined;
  Login: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
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
