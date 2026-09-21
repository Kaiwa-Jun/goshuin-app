#!/usr/bin/env python3
"""地図のスポットピン画像を焼き直す。

ピンは MapLibre のスタイルアイコン（事前レンダリング画像）なので、
src/theme/colors.ts の pin トークンを変えたらこれを走らせて
assets/map-pins/*.png を作り直す。形は旧 SpotMarker を踏襲している
（丸頭 + 白フチ + 尾 + 影）。

    pip install Pillow
    npm run gen:map-pins
"""

import json
import pathlib
import re
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:  # pragma: no cover - 実行環境の案内
    sys.exit("Pillow が要る: pip install Pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent
THEME = ROOT / "src/theme/colors.ts"
OUT = ROOT / "assets/map-pins"

# 4倍でスーパーサンプリングしてから縮小する（PIL に AA が無いため）
S = 4
W, H = 84, 120
CX, CY, R = 42, 44, 34
RING = 7.5
TAIL_HALF = 19  # 尾の付け根の半幅。円の内側に収める
TAIL_TIP = 112

# colors.ts の pin トークン名 → 出力ファイル名
TOKENS = {
    "unvisited": "unvisited",
    "wishlisted": "wishlist",
    "shrineVisited": "visited-shrine",
    "templeVisited": "visited-temple",
}


def read_pin_colors() -> dict[str, tuple[int, int, int]]:
    """colors.ts の pin ブロックから色を読む（唯一のソースにする）"""
    block = re.search(r"pin:\s*\{(.*?)\n  \}", THEME.read_text(), re.S)
    if not block:
        sys.exit(f"{THEME} に pin ブロックが見つからない")

    found = dict(re.findall(r"(\w+):\s*'#([0-9A-Fa-f]{6})'", block.group(1)))
    missing = set(TOKENS) - set(found)
    if missing:
        sys.exit(f"colors.ts の pin に {sorted(missing)} が無い")

    return {
        name: tuple(int(found[token][i : i + 2], 16) for i in (0, 2, 4))
        for token, name in TOKENS.items()
    }


def _silhouette(draw, cx, cy, r, half, tip, top, pad, fill):
    """ピンの外形（尾の三角 + 丸頭）。pad を足すと白フチ・影になる"""
    draw.polygon(
        [(cx - half - pad, top), (cx + half + pad, top), (cx, tip + pad * 1.6)], fill=fill
    )
    draw.ellipse([cx - r - pad, cy - r - pad, cx + r + pad, cy + r + pad], fill=fill)


def render(rgb: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    cx, cy, r = CX * S, CY * S, R * S
    half, tip, top = TAIL_HALF * S, TAIL_TIP * S, (CY + 10) * S

    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    _silhouette(ImageDraw.Draw(shadow), cx, cy + 3 * S, r, half, tip, top, RING * S, (0, 0, 0, 70))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(3 * S)))

    draw = ImageDraw.Draw(img)
    _silhouette(draw, cx, cy, r, half, tip, top, RING * S, (255, 255, 255, 255))
    _silhouette(draw, cx, cy, r, half, tip, top, 0, rgb + (255,))
    return img.resize((W, H), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    colors = read_pin_colors()
    for name, rgb in colors.items():
        path = OUT / f"pin-{name}.png"
        render(rgb).save(path)
        print(f"{path.relative_to(ROOT)}  #{''.join(f'{c:02X}' for c in rgb)}")

    # どの色で焼いたかを残す。PNG は中身を読まないと色が分からないので、
    # colors.ts を変えて焼き直しを忘れた状態をテストで検出できるようにする
    baked = {
        token: "#" + "".join(f"{c:02X}" for c in colors[name]) for token, name in TOKENS.items()
    }
    (OUT / "baked-colors.json").write_text(
        json.dumps(baked, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"{(OUT / 'baked-colors.json').relative_to(ROOT)}  {len(baked)} 色")


if __name__ == "__main__":
    main()
