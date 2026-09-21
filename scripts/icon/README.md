# アイコンと起動画面の焼き直し

`assets/` の PNG は **手で描いたものではなく `render.html` から焼いている**。
図形は `src/components/common/Seal.tsx` と同じ彫り（12ヶ月の環と、真ん中のひとつ）。

色を変えたいときや彫りを直したいときは、PNG を直接いじらずここから焼き直す。

## 手順

1. `python3 -m http.server 8779 --directory scripts/icon` で開く
2. ブラウザで `http://localhost:8779/render.html`
3. 各 SVG を**実寸のまま**保存する（拡大縮小しない）

| id          | 書き出し先                 | 寸法      | 備考                                |
| ----------- | -------------------------- | --------- | ----------------------------------- |
| `#icon`     | `assets/icon.png`          | 1024×1024 | iOS。透明を含めない                 |
| `#adaptive` | `assets/adaptive-icon.png` | 1024×1024 | Android。丸マスク前提で枠を入れない |
| `#splash`   | `assets/splash.png`        | 1284×2778 | 紙の地に印ひとつ                    |
| `#favicon`  | `assets/favicon.png`       | 196×196   | Web                                 |

## 決めたこと

- **iOS の印は 0.82 に縮めてある。** 角丸マスク（半径 22.37%）で縁いっぱいの
  角印は四隅が落ちる。たわみと欠けを入れた意味がそこで消えるので内側に置く
- **Android は枠を入れない。** 角印の四隅は丸マスクで必ず消える。紋だけを
  安全域（中央 66%）に収め、地を朱で塗る。`app.json` の
  `adaptiveIcon.backgroundColor` を同じ朱（`#C2342B`）にして継ぎ目を消す
- **起動画面の地は紙色（`#F7F3EA`）。** 以前は `#f27f0d` だったが、
  splash.png が画面いっぱいの白だったので**一度も表示されていなかった**

## 反映には再ビルドが要る

アイコンと起動画面はネイティブの資産。OTA では届かない。
`eas build --profile production --platform ios` などで焼き直すこと。
