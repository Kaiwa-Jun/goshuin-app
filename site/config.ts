// ホームページ goshuinsanpo.com（Issue #324）の定数。
// 契約書: docs/issues/issue-324-homepage.md（「定数（site/config.ts）」・D-12・D-15・D-16）

export const SITE_ORIGIN = 'https://goshuinsanpo.com';
export const SITE_NAME = '御朱印さんぽ';
export const APP_STORE_ID = '6797201465';
/** App Store Connect のキャンペーンリンクの pt（公開の値）。H-0 でオーナーが取った数字の文字に置き換える */
export const APP_STORE_PT: string | null = null;
/** Cloudflare Web Analytics のサイトの token（公開の値）。H-0 でオーナーが作った値に置き換える */
export const CF_BEACON_TOKEN: string | null = null;
/** 帯の写真と同じ変換（#227 D-6「幅は 400 / 1200 だけ」） */
export const SPOT_PHOTO_TRANSFORM =
  'https://img.goshuinsanpo.com/cdn-cgi/image/width=1200,quality=78,format=webp/';
export const NEARBY_RADIUS_M = 30000;
export const NEARBY_LIMIT = 5;
export const OUT_DIR = 'site/dist';
export const DEFAULT_PORT = 8324;

/** このサイトのプライバシーの説明に書く連絡先（アプリのプライバシーポリシーと同じ。テストで照らす） */
export const CONTACT_EMAIL = 'kj.11235813213455@gmail.com';
export const ISSUES_URL = 'https://github.com/Kaiwa-Jun/goshuin-app/issues';

/** 生成と検査が受け取る設定（テストは値を渡す。CLI は上の既定の値を渡す） */
export interface SiteConfig {
  APP_STORE_PT: string | null;
  CF_BEACON_TOKEN: string | null;
}

export const DEFAULT_CONFIG: SiteConfig = { APP_STORE_PT, CF_BEACON_TOKEN };
