# site/ — ホームページ goshuinsanpo.com

御朱印さんぽの紹介と、寺社ごとのページ（検索と AI の回答から人を呼ぶ）を作る静的サイトの生成器。Deno の TypeScript で、テンプレートは文字列を返す関数。外部のフレームワーク・テンプレートエンジン・CSS フレームワーク・Web フォントは使わない。

- 契約書: [`docs/issues/issue-324-homepage.md`](../docs/issues/issue-324-homepage.md)（Issue #324）
- 置き場所: このリポジトリの GitHub Pages を GitHub Actions（[`.github/workflows/site.yml`](../.github/workflows/site.yml)）で出し、独自ドメイン `goshuinsanpo.com` にする
- アプリのコード（`src/` など）は変えない。色と余白だけ `src/theme/colors.ts`・`src/theme/spacing.ts` を読み込む

## コマンド

リポジトリの直下で打つ。`--node-modules-dir=none` が要る（無いとルートの `package.json` 経由で `npm:` の解決に失敗する）。止めるときは標準エラーに理由（寺社なら `名前（都道府県）`、ファイルならパス）を出して終了コード 1。

```sh
# 作る（→ site/dist/。中を消してから作る）。--production は site/config.ts の APP_STORE_PT と CF_BEACON_TOKEN が要る
deno run -A --node-modules-dir=none site/main.ts build [--production]
# 生成物を検査する。--production は beacon と App Store の印（pt=・ct=web）も見る
deno run -A --node-modules-dir=none site/main.ts check [--production]
# ローカルで配信する（127.0.0.1 だけ。既定のポート 8324）
deno run -A --node-modules-dir=none site/main.ts serve [--port 8324]
# slug の台帳に無い寺社を足す（既存の行は変えない）。--check は書かずに比べ、足りなければ終了コード 1
deno run -A --node-modules-dir=none site/main.ts slugs [--check]
# テスト（ネットに出ない）
deno test -A --node-modules-dir=none site/
```

`serve` は GitHub Pages と同じに、`/<dir>/` は `<dir>/index.html`、`/<dir>` は `/<dir>/` へ 301、無いパスは `404.html` を状態 404 で返す。

## 入力

| ファイル                                                               | 使い方                                                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| seed 10 本（`supabase/scripts/spot-coords/coords.ts` の `SEED_FILES`） | 寺社の一覧（1,109）。`supabase/scripts/spot-wikidata/match.ts` の `readSeedRows` で読む。座標の文字は seed の行のまま |
| `supabase/data/spot-photos-302.json`                                   | 帯の写真の台帳。`status: approved` の寺社にページを作る（写真・撮影者・ライセンス・元のページ）                       |
| `supabase/seeds/seed_reception_hours_2026-08.sql`                      | 受付時間（本番に流していなくてよい）。表示するのは `explicit` の区切りの 8 寺社だけ（proxy は出さない）               |
| `supabase/data/spot-coords-292.json`                                   | 座標を確かめた寺社。この寺社だけ OpenStreetMap のリンクと JSON-LD の `geo` を出す                                     |
| `site/data/spot-slugs.json`                                            | slug の台帳（下）                                                                                                     |
| `docs/legal/privacy.html`・`docs/legal/terms.html`                     | アプリの法務ページ。**正はこちらのまま**。生成器が `</head>` の前に canonical と description の2行を足して写す        |
| `site/static/`                                                         | そのまま `site/dist/` に写す素材（下）                                                                                |
| `site/config.ts`                                                       | 定数。`APP_STORE_PT`・`CF_BEACON_TOKEN` は本番の前に入れる公開の値                                                    |

ページを作る寺社は「写真の台帳に承認の行がある」か「表示する受付時間がある」寺社（いま 777）。ほかの寺社（332）は都道府県の一覧の1行（名前・神社 / お寺・住所・Google マップ）だけ。

## 生成物（`site/dist/`。Git に入れない）

HTML 829（トップ 1・都道府県 47・寺社 777・法務 2・このサイトのプライバシー 1・404 1）と `sitemap.xml`（404 を除く 828）・`robots.txt`・`llms.txt`、`site/static/` の写し。同じ入力からは1バイトも同じものができる（日時・環境の値・乱数を入れない）。`CNAME` は置かない（GitHub Actions で出すときは設定で決める）。

## slug の台帳（`site/data/spot-slugs.json`）

寺社のページの URL `/spots/<slug>/` を決める。`slug` は `<都道府県のローマ字>-<3桁>`。

- **一度決めた slug は変えない・使い回さない**（URL を守るため。seed の `idx` は行が入ると動くので使わない）
- 写真の無い寺社も含めて seed の全部の寺社を入れる（あとで写真が付いたら同じ slug でページになる）
- 新しい寺社が seed に入ったら `site/main.ts slugs` を打つ。その都道府県のいちばん大きい番号の次を振って末尾に足す（既存の行は変えない）
- seed で寺社の名前が変わったら、台帳のその行の `name` を手で直す（slug は変えない）
- 台帳と seed が合わない（台帳に無い寺社・台帳だけの行・重なる slug）と `build` は止まる

## 素材（`site/static/`）

| ファイル                            | 中身                                                                                                                  | いま                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `favicon.png`                       | `assets/favicon.png` の写し                                                                                           | ある                     |
| `apple-touch-icon.png`              | `assets/icon.png` を 180×180 に縮めたもの（`sips -z 180 180 assets/icon.png --out site/static/apple-touch-icon.png`） | ある                     |
| `img/app-store-badge-ja.svg`        | Apple の公式の日本語の黒い「App Store からダウンロード」のバッジ（変えない）                                          | **まだ無い**（リーダー） |
| `img/screens/0<n>-<w>.webp`（8 枚） | スクショ（下）                                                                                                        | **まだ無い**（リーダー） |
| `img/ogp.png`                       | OGP の画像（1200×630。寺社のページは写真を使う）                                                                      | **まだ無い**（リーダー） |

### App Store のバッジ

- 取った日: 2026-10-10
- 元のページ: Apple の Marketing Tools（https://toolbox.marketingtools.apple.com/ の App Store のバッジ。日本語・黒。取ったファイルは `https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/ja-jp` の SVG をそのまま）。使い方の決まりは https://developer.apple.com/app-store/marketing/guidelines/
- 表示の高さ 48px・まわりの余白 12px 以上。SVG の `viewBox` から幅を計算して `width` を付ける
- 無い間も `build` は止まらない（ページは同じパスを指す）。`check` が「リンクの先が無い」で止まる

### スクショ

App Store の 1.2.0 の 4 枚と同じ撮り方（`docs/project/store-metadata.md` の「撮り方」。シミュレータ `shots-16promax`・1320×2868）の**素の画面**（見出し・枠を合成しない）。並びは地図 → 保存直後 → あゆみの日本地図 → 御朱印帳。

- 元の画像（1320×2868 の PNG）は `~/goshuin-work/site-324/screens/01.png`〜`04.png` に置く（リポジトリには入れない。`/tmp` は 3 日で消える）
- リポジトリに入れるのは Web 用に縮めた webp 8 枚だけ（幅 360・720、1 枚 150KB 以下）:

  ```sh
  mkdir -p site/static/img/screens
  for n in 1 2 3 4; do for w in 360 720; do
    cwebp -quiet -q 80 -resize "$w" 0 ~/goshuin-work/site-324/screens/0$n.png -o site/static/img/screens/0$n-$w.webp
  done; done
  ls -l site/static/img/screens/   # 8 つ・どれも 150KB 以下
  deno test -A --node-modules-dir=none site/static_test.ts   # AC-37 が ignored でなく ok になる
  ```

- 8 枚がそろうとトップに「できること」の節（4 枚・見出しはストアの 4 枚の見出し）が出る。0 枚の間は節を出さない。1〜7 枚だけなら `build` は足りない名前を出して止まる

## 計測と App Store のリンク

- 計測は Cloudflare Web Analytics の beacon（Cookie も localStorage も使わない）。`CF_BEACON_TOKEN` が null なら出さない。法務の2ページには入れない。説明は `/legal/site.html`
- App Store へのリンクは `appStoreUrl(APP_STORE_PT)`。`pt` があればキャンペーンリンク（`ct=web`）、null なら `https://apps.apple.com/jp/app/id6797201465`
- ワークフローの出す道は `--production` で作る（2 つの値が null なら止まる）。ローカル・PR は `--production` なし

## 本番の手順（要約）

順番と「正しい結果」「違ったら止める」は契約書の「手順」が正。

1. H-0: リーダーがスクショ・OGP の画像・バッジを入れ、オーナーに見せて承認をもらう。オーナーから `pt` と Cloudflare の token をもらい `site/config.ts` に入れ、`build --production`・`check --production` が 0
2. PR を `develop` にマージ
3. H-1: 写真 777 枚が R2 にあるかを確かめる（`supabase/scripts/spot-photos/main.ts verify`）
4. H-2〜H-4: GitHub でドメインを確認（TXT）→ Cloudflare の DNS に A 4・AAAA 4・`www` の CNAME（どれもプロキシはオフ）
5. H-5〜H-7: `github-pages` の環境に `develop` を足す → Pages の公開元を GitHub Actions に → ワークフローを手で流す
6. H-8・H-9: 独自ドメインを入れる → 証明書 → HTTPS を強制（App Store の審査中はしない）
7. H-10〜H-15: 転送と中身の確かめ・Search Console・Bing・計測・iPhone でバッジ

## 法務ページの出る時（D-2）

`docs/legal/*.html` は正のまま `develop` で直す。**`develop` に入った時点で公開される**（ワークフローが `develop` への push で作り直して出す）。今までの `release/legal-*` を `main` に出す手順は要らない。独自ドメインにすると `https://kaiwa-jun.github.io/goshuin-app/legal/…` は `https://goshuinsanpo.com/legal/…` に転送されるので、App Store とアプリに張られた URL はそのまま届く。
