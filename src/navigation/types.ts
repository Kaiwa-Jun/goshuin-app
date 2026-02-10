import type { NavigatorScreenParams, CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// --- Param Lists ---

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Record: { spotId?: string } | undefined;
  RecordComplete: { stampImageUrl?: string; spotName?: string; visitCount?: number } | undefined;
  Login: undefined;
  Error: { type: 'network' | 'location' | 'upload' };
};

export type MainTabParamList = {
  MapTab: NavigatorScreenParams<MapStackParamList>;
  GalleryTab: NavigatorScreenParams<GalleryStackParamList>;
  Collection: undefined;
  Settings: undefined;
};

export type MapStackParamList = {
  Map: undefined;
  SpotDetail: { spotId: string };
};

export type GalleryStackParamList = {
  Gallery: undefined;
  StampDetail: { stampId: string };
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

// --- Global type augmentation ---

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
