---
description: Cloudflare Tunnel + Expo Dev Server を起動（既存プロセスがあれば自動で再起動）。実機 iPhone の Dev Client で動作確認するための開発環境。
---

実機 iPhone での動作確認用に、Cloudflare Tunnel と Expo Dev Server をセットで起動する。

## 手順

1. リポジトリルートで `./scripts/dev.sh` を実行する（引数なし）。
   - このスクリプトは冪等で、既存の tmux セッション（`goshuin-dev`）があれば停止してから新たに起動する。
   - cloudflared → URL 抽出 → expo の順に起動し、Metro が ready になるまで待つ。最大で 2 分程度かかることがある。
2. スクリプトの終了後、`.dev-tunnel/url.txt` を読み取り、発行された trycloudflare URL をユーザーに報告する。
3. `./scripts/dev.sh qr` を実行し、expo ウィンドウのキャプチャ（QR コードを含む）を取得する。QR コードの ASCII アート部分を抜粋してユーザーに表示する。
   - ANSI エスケープコードが混入していてコンソールで読めない場合は、`tmux attach -t goshuin-dev` で手動確認するようユーザーに案内する。
4. ユーザーに以下を案内する:
   - 発行された trycloudflare URL
   - iPhone の Dev Client アプリで QR コードを読み取るか、"Enter URL manually" で URL を直接入力して接続できること
   - Metro を操作したい場合（`r` で reload、`i` で iOS など）は `tmux attach -t goshuin-dev` でアタッチできること
   - 停止したい場合は `./scripts/dev.sh stop`

## エラー時の対応

- cloudflared の URL 抽出に失敗した場合、スクリプトが `cloudflared output` を stderr に出す。その内容を抜粋してユーザーに報告する。
- expo 起動が待機タイムアウトした場合でも Metro は起動中かもしれないので、`./scripts/dev.sh qr` を追加で実行して状況を確認する。
- tmux / cloudflared が見つからない場合はスクリプトが ERROR を出す。ユーザーにインストール方法を案内する（cloudflared は `/opt/homebrew/bin/brew install cloudflared`）。

## 注意

- プロセスは tmux セッション `goshuin-dev` 配下で動く。Claude Code のセッションを閉じてもプロセスは残り続ける（tmux サーバが独立しているため）。
- 状態ファイルは `.dev-tunnel/` に保存される（`.gitignore` 済み）。
- ネイティブモジュールの追加や `app.json` の変更など、Metro の再起動だけで済まない変更があった場合は、この `/dev` コマンドを再実行すれば全てクリーンに立ち上がる。
