// 「御朱印さんぽ プラス」（docs/product/2026-09-monetization-design.md §8）。
// 課金はまだオンにしない（記録のあるユーザー50人か月30人で有効化）。オンにするまでは全員がプラス相当。
// 購入の状態は src/hooks/ の購入の hook から出す
export const BILLING_ENABLED = false;
/** 無料で入れられる「これからの予定」の数（過ぎた予定は数えない） */
export const FREE_PLAN_LIMIT = 1;
/** RevenueCat の entitlement（Issue #270 D-1） */
export const PLUS_ENTITLEMENT = 'plus';
