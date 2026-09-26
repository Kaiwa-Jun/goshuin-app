// 「御朱印さんぽ プラス」（docs/product/2026-09-monetization-design.md §8）。
// 課金はまだオンにしない（記録のあるユーザー50人か月30人で有効化）。オンにするまでは全員がプラス相当
export const BILLING_ENABLED = false;
/** 無料で入れられる予定の数 */
export const FREE_PLAN_LIMIT = 1;
/** 購入の仕組みはまだ無いので、いつも false（課金オン時に購入状態から出す） */
export const IS_PLUS = false;
