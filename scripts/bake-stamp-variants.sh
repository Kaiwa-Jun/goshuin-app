#!/usr/bin/env bash
# 既存の御朱印写真から、足りない縮小版を手元で焼いて置く（Issue #194 / #196）
#
# Edge Function は 12MP の HEIC を復号するだけで CPU 予算を使い切るため、
# 大きいファイルだけ最後まで焼けない。移行期の後始末なので、macOS が標準で
# 持っている sips（HEIC を扱える）で焼いて置く。
#
# 元のファイルには一切触らない。thumb-400/ と view-1200/ にだけ書く。
#
#   SUPABASE_ACCESS_TOKEN=sbp_... scripts/bake-stamp-variants.sh
set -euo pipefail

PROJECT_REF=tvnozkpxncmnehyomoff
BUCKET=goshuin-images
HOST="https://${PROJECT_REF}.supabase.co/storage/v1"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "SUPABASE_ACCESS_TOKEN が要ります。次の形で実行してください:" >&2
  echo "  SUPABASE_ACCESS_TOKEN=sbp_... $0" >&2
  exit 1
fi

echo "サービスキーを取得中..."
KEY=$(npx --yes supabase@latest projects api-keys --project-ref "$PROJECT_REF" --reveal --output json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const k=a.find(x=>x.name==="service_role"||x.type==="secret");process.stdout.write(k?(k.api_key||""):"")})')
[ -n "$KEY" ] || { echo "サービスキーを取得できませんでした" >&2; exit 1; }

api_list() {  # $1 = prefix
  curl -s -X POST "$HOST/object/list/$BUCKET" \
    -H "Authorization: Bearer $KEY" -H "apikey: $KEY" -H "Content-Type: application/json" \
    -d "{\"prefix\":\"$1\",\"limit\":1000}"
}

echo "対象を数えています..."
USERS=$(api_list "" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);console.log(a.filter(x=>!x.name.includes(".")).map(x=>x.name).join("\n"))})')

made=0
for USER in $USERS; do
  api_list "$USER"           > "$WORK/orig.json"
  api_list "$USER/thumb-400" > "$WORK/thumb.json"
  api_list "$USER/view-1200" > "$WORK/view.json"

  # 「元のファイル名 / 欠けている大きさ」を並べる
  node -e '
    const fs=require("fs"), dir=process.argv[1];
    const names=x=>new Set(JSON.parse(fs.readFileSync(`${dir}/${x}.json`,"utf8")).map(o=>o.name));
    const orig=[...names("orig")].filter(n=>n.endsWith(".jpg"));
    const thumb=names("thumb"), view=names("view");
    for (const n of orig) {
      if (!thumb.has(n)) console.log(`${n} thumb-400 400 70`);
      if (!view.has(n))  console.log(`${n} view-1200 1200 78`);
    }
  ' "$WORK" > "$WORK/todo.txt"

  COUNT=$(wc -l < "$WORK/todo.txt" | tr -d ' ')
  echo "$USER: 焼くもの $COUNT 件"

  while read -r NAME DIR WIDTH QUALITY; do
    [ -z "${NAME:-}" ] && continue
    SRC="$WORK/src.bin"; OUT="$WORK/out.jpg"
    curl -s "$HOST/object/public/$BUCKET/$USER/$NAME" -o "$SRC"
    if ! sips -s format jpeg -s formatOptions "$QUALITY" --resampleWidth "$WIDTH" "$SRC" --out "$OUT" >/dev/null 2>&1; then
      echo "  変換できず: $NAME ($DIR)"; continue
    fi
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$HOST/object/$BUCKET/$USER/$DIR/$NAME" \
      -H "Authorization: Bearer $KEY" -H "apikey: $KEY" -H "Content-Type: image/jpeg" \
      --data-binary "@$OUT")
    if [ "$CODE" = "200" ]; then made=$((made+1)); printf "."; else echo " 置けず($CODE): $NAME ($DIR)"; fi
  done < "$WORK/todo.txt"
  echo
done

echo "焼いて置いた: $made 件"
