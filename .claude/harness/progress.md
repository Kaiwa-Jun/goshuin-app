# 進捗ログ

セッションをまたぐ引き継ぎメモ。機能完了ごとに「日付 / 何をしたか / 契約書パス / PR 番号」を1〜3行で追記する。詳細を書きすぎない（詳細は契約書と git log にある）。

---

- 2026-08-02: ハーネス刷新（CLAUDE.md 全面改訂、agents を planner/evaluator の2体に整理、/build-feature スキル新設、Maestro E2E スキャフォールド追加）。プロダクト方針は docs/product/direction.md に確定。
- 2026-08-02: マスタデータ整備。宮城 seeds を DB 同期(rank付き90件)、東京増強分99件(rank4×13+rank3×86)を seed_tokyo_rank3_4_spots.sql に作成。DB適用は未実施。地図の1,000行フェッチ上限バグ等を発見(direction.md Phase 0 参照)。
- 2026-08-02: Issue #93 地図即修正を /build-feature フローで実装(フェッチのページネーション/visited・wishlist の rank フィルタ免除/デフォルトズーム0.015)。契約書 docs/issues/issue-093-map-spot-display-fixes.md、Evaluator PASS 12/12、実機確認済み。後続の本格再設計は P1-05。
- 2026-08-02(夜間自律): Issue #96 P1-05 ビューポート×rank優先 top-N を /build-feature で実装。契約書 docs/issues/issue-096-map-viewport-topn.md、Evaluator PASS 27/27。実機確認(UI-1〜5)とマージは朝のゲート待ち。
- 2026-08-02: PR #97(P1-05)・#98 マージ。実機確認でズームアウト時クラッシュ発覚 → Issue #99(P1-06 クラスタリング)起票。セッション引き継ぎは .claude/harness/handoff.md 参照。
- 2026-08-02: Issue #99 P1-06 クラスタリング導入を /build-feature で実装。契約書 docs/issues/issue-099-map-clustering.md（追補1〜4）、Evaluator PASS 53/53。実機の全国スケールクラッシュは4イテレーション（churn削減→バブル画像化→現在地ピン無限アニメ廃止→minZoomLevel=8 封じ込め）で対処し、封じ込めをユーザー承認・実機確認済み。全国表示の恒久解禁は P1-07 に分離。
- 2026-08-02: Phase 0 前進。Xcode/シミュレータ/Maestro 導入、ストアスクショ2枚を自動撮影。**本番ビルドが起動時クラッシュする重大バグを発見・修正**（EXPO*PUBLIC*\* をブラケット記法で読んでおり babel のインライン化が効いていなかった。再発防止テスト付き）。アプリ名を「御朱印さんぽ」に確定し、v1.0.0/buildNumber 11 を App Store Connect へ提出完了（ascAppId 6797201465）。
- 2026-08-02: Issue #102 P1-08 初回体験の改善を /build-feature で実装（PR #103 マージ済み）。契約書 docs/issues/issue-102-first-run-experience.md、Evaluator PASS 47/47、実機確認済み。タブ遷移ブロック撤廃 + ゲスト空状態 + 検索の未入力時提案。証跡 .claude/harness/evidence/issue-102/。
- 2026-08-02: Issue #104 P2-01 限定御朱印ウォッチャー MVP のコード実装を /build-feature で完了（PR #105 マージ済み）。契約書 docs/issues/issue-104-limited-goshuin-watcher.md、Evaluator PASS 93/93。残タスクは feature-list P2-01 の note 参照（seed 作成・ユーザーの DB/デプロイ作業・実機確認）。
- 2026-08-02: P2-01 限定御朱印ウォッチャー MVP を運用投入して完了(passes: true)。デプロイ・cron・seed 投入・実クロール検証・実機確認まで完了。品質対応3件(授与品ガード PR #108 / 鮮度フィルタ PR #109 / 新APIキー体系対応 PR #107)。フィードバック起点の v2 を P2-02 として登録。
