# 進捗ログ

セッションをまたぐ引き継ぎメモ。機能完了ごとに「日付 / 何をしたか / 契約書パス / PR 番号」を1〜3行で追記する。詳細を書きすぎない（詳細は契約書と git log にある）。

---

- 2026-08-02: ハーネス刷新（CLAUDE.md 全面改訂、agents を planner/evaluator の2体に整理、/build-feature スキル新設、Maestro E2E スキャフォールド追加）。プロダクト方針は docs/product/direction.md に確定。
- 2026-08-02: マスタデータ整備。宮城 seeds を DB 同期(rank付き90件)、東京増強分99件(rank4×13+rank3×86)を seed_tokyo_rank3_4_spots.sql に作成。DB適用は未実施。地図の1,000行フェッチ上限バグ等を発見(direction.md Phase 0 参照)。
- 2026-08-02: Issue #93 地図即修正を /build-feature フローで実装(フェッチのページネーション/visited・wishlist の rank フィルタ免除/デフォルトズーム0.015)。契約書 docs/issues/issue-093-map-spot-display-fixes.md、Evaluator PASS 12/12、実機確認済み。後続の本格再設計は P1-05。
- 2026-08-02(夜間自律): Issue #96 P1-05 ビューポート×rank優先 top-N を /build-feature で実装。契約書 docs/issues/issue-096-map-viewport-topn.md、Evaluator PASS 27/27。実機確認(UI-1〜5)とマージは朝のゲート待ち。
