"""Natural Earth(パブリックドメイン) の県境を、アプリに載せる SVG パスへ落とす。"""
import json, math, sys
sys.setrecursionlimit(20000)

SRC = 'japan-raw.json'

# ISO 3166-2:JP → 正式名。Natural Earth の name_local は静岡県が null なので、
# 現地名ではなくコードから引く（src/utils/regionBlocks.ts と同じ表記に揃える）
ISO_TO_NAME = {
    'JP-01': '北海道', 'JP-02': '青森県', 'JP-03': '岩手県', 'JP-04': '宮城県',
    'JP-05': '秋田県', 'JP-06': '山形県', 'JP-07': '福島県', 'JP-08': '茨城県',
    'JP-09': '栃木県', 'JP-10': '群馬県', 'JP-11': '埼玉県', 'JP-12': '千葉県',
    'JP-13': '東京都', 'JP-14': '神奈川県', 'JP-15': '新潟県', 'JP-16': '富山県',
    'JP-17': '石川県', 'JP-18': '福井県', 'JP-19': '山梨県', 'JP-20': '長野県',
    'JP-21': '岐阜県', 'JP-22': '静岡県', 'JP-23': '愛知県', 'JP-24': '三重県',
    'JP-25': '滋賀県', 'JP-26': '京都府', 'JP-27': '大阪府', 'JP-28': '兵庫県',
    'JP-29': '奈良県', 'JP-30': '和歌山県', 'JP-31': '鳥取県', 'JP-32': '島根県',
    'JP-33': '岡山県', 'JP-34': '広島県', 'JP-35': '山口県', 'JP-36': '徳島県',
    'JP-37': '香川県', 'JP-38': '愛媛県', 'JP-39': '高知県', 'JP-40': '福岡県',
    'JP-41': '佐賀県', 'JP-42': '長崎県', 'JP-43': '熊本県', 'JP-44': '大分県',
    'JP-45': '宮崎県', 'JP-46': '鹿児島県', 'JP-47': '沖縄県',
}


def mercator(lon, lat):
    x = math.radians(lon)
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y

def rdp(points, eps):
    """Douglas-Peucker。点を減らしても海岸線の形が残る範囲で間引く"""
    if len(points) < 3:
        return points
    # 閉じたリングをそのまま渡すと始点と終点が同じ点になり、基準の線分が
    # 長さ0になってすべての距離が0に潰れる（＝2点まで削られる）
    if points[0] == points[-1]:
        half = len(points) // 2
        return rdp(points[:half + 1], eps)[:-1] + rdp(points[half:], eps)
    ax, ay = points[0]; bx, by = points[-1]
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy) or 1e-12
    worst, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
        if d > worst:
            worst, idx = d, i
    if worst <= eps:
        return [points[0], points[-1]]
    return rdp(points[:idx + 1], eps)[:-1] + rdp(points[idx:], eps)

def rings_of(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates'][0]]
    return [poly[0] for poly in geom['coordinates']]

def area(ring):
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(s) / 2

feats = json.load(open(SRC))['features']
assert len({f['properties']['iso_3166_2'] for f in feats}) == 47

# 沖縄は本土から遠い。日本の地図の慣習どおり、左下へ寄せて別枠で置く
OKINAWA = '沖縄県'

prepared = []
for f in feats:
    name = ISO_TO_NAME[f['properties']['iso_3166_2']]
    rings = rings_of(f['geometry'])
    rings.sort(key=area, reverse=True)
    biggest = area(rings[0])
    # 本島に比べて極端に小さい島は落とす（点数の大半がここに消える）
    keep = [r for r in rings if area(r) > biggest * 0.02][:6]
    # 沖縄は与那国から南大東まで 1000km 以上に散らばる。全部入れると横に伸びて
    # 枠に収まらないので、本島まわりだけにする（地図の慣習どおり別枠に置く）
    if name == OKINAWA:
        keep = keep[:1]
    prepared.append((name, keep))

def project(rings):
    return [[mercator(lon, lat) for lon, lat in r] for r in rings]

def move(rings, shift, scale):
    """島の集まりを、形を保ったまままとめて動かす。
    リングごとに重心を取ると島が1点に積み重なる"""
    pts = [p for r in rings for p in r]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    return [[((x - cx) * scale + shift[0], (y - cy) * scale + shift[1]) for x, y in r] for r in rings]

projected = {}
for name, rings in prepared:
    projected[name] = project(rings)

# 本土の範囲を測ってから、沖縄を左下の空きへ置く
mainland = [p for n, rs in projected.items() if n != OKINAWA for r in rs for p in r]
minx = min(p[0] for p in mainland); maxx = max(p[0] for p in mainland)
miny = min(p[1] for p in mainland); maxy = max(p[1] for p in mainland)
w, h = maxx - minx, maxy - miny
# 沖縄は本土から遠い。日本の地図の慣習どおり左下の海へ寄せ、離れていることが
# 分かるよう少しだけ拡大する（1.4倍）
projected[OKINAWA] = move(projected[OKINAWA], shift=(minx + w * 0.20, miny + h * 0.055), scale=2.2)

allpts = [p for rs in projected.values() for r in rs for p in r]
minx = min(p[0] for p in allpts); maxx = max(p[0] for p in allpts)
miny = min(p[1] for p in allpts); maxy = max(p[1] for p in allpts)
W = 1000.0
S = W / (maxx - minx)
H = (maxy - miny) * S

EPS = 0.6  # ビューボックス座標での許容誤差
out = {}
total = 0
for name, rings in projected.items():
    d = []
    for r in rings:
        pts = [((x - minx) * S, (maxy - y) * S) for x, y in r]
        pts = rdp(pts, EPS)
        if len(pts) < 4:
            continue
        d.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z')
        total += len(pts)
    out[name] = ''.join(d)

json.dump({'viewBox': f'0 0 {W:.0f} {H:.0f}', 'paths': out},
          open('japan-paths.json', 'w'), ensure_ascii=False)
print(f'県 {len(out)} / 総点数 {total} / viewBox 0 0 {W:.0f} {H:.0f}')
print('JSON サイズ:', len(open('japan-paths.json').read()) // 1024, 'KB')
