# japan-paths.json — 県境の出どころ

- **データ**: [Natural Earth](https://www.naturalearthdata.com/) `ne_10m_admin_1_states_provinces`（**パブリックドメイン**。Open Data Commons PDDL。帰属表示の義務なし）
- **取得元**: https://github.com/martynafford/natural-earth-geojson（Natural Earth を GeoJSON に変換したもの）
- **変換**: `build-japan-paths.py`（メルカトル投影 → Douglas-Peucker で間引き → SVG パス）

アプリに同梱するデータなので、ライセンスがパブリックドメインであることを理由にこれを選んだ。
Wikimedia の県地図は CC BY-SA が多く、組み込みには向かない。

## 中身

- `viewBox`: `0 0 1000 1132`
- `paths`: 県の正式名（`regionBlocks.ts` と同じ表記）→ SVG の `d`
- 47県ぶんで **43KB**、総点数 3704

## 決めごと

- **沖縄は左下の海へ別枠で置いてある**（本島まわりのみ・2.2倍）。与那国から南大東まで入れると横に1000km以上広がって枠に収まらないため。日本の地図の慣習どおり
- 本島の2%より小さい島は落としてある（点数の大半がそこに消えるため）
