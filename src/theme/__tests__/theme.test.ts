import { colors, typography, spacing, borderRadius, shadows } from '@theme/index';
import bakedPinColors from '../../../assets/map-pins/baked-colors.json';

describe('Theme', () => {
  describe('colors', () => {
    it('should export primary color palette', () => {
      expect(colors.primary[500]).toBe('#f27f0d');
      expect(colors.primary[50]).toBeDefined();
      expect(colors.primary[900]).toBeDefined();
    });

    /*
     * 印の色。朱肉に寄せた朱と、まだ押されていない灰。
     * shrine[600] をそのまま使うと、9個並んだときに光って見えた
     */
    it('印の朱と、押されていない色を持つ', () => {
      expect(colors.seal).toBe('#C2342B');
      expect(colors.sealEmpty).toBe('#D3D6DC');
      expect(colors.seal).not.toBe(colors.shrine[600]);
    });

    it('should export shrine colors', () => {
      expect(colors.shrine[500]).toBe('#EF4444');
      expect(colors.shrine[100]).toBe('#FEE2E2');
      expect(colors.shrine[600]).toBe('#DC2626');
    });

    it('should export temple colors', () => {
      expect(colors.temple[500]).toBe('#A855F7');
      expect(colors.temple[100]).toBe('#F3E8FF');
      expect(colors.temple[600]).toBe('#9333EA');
    });

    it('should export pin colors', () => {
      expect(colors.pin.shrineVisited).toBe('#DC2626');
      expect(colors.pin.templeVisited).toBe('#9333EA');
      expect(colors.pin.unvisited).toBe('#FB923C');
      expect(colors.pin.currentLocation).toBe('#3B82F6');
    });

    // 未訪問はブランド色1色（Issue #140 D-5）。淡すぎて地図で見えなかったため
    // primary[200] から primary[400] へ濃くした
    it('should use a brand tone strong enough to read on the map', () => {
      expect(colors.pin.unvisited).toBe(colors.primary[400]);
    });

    it('should keep every pin state a distinct color', () => {
      const { currentLocation: _currentLocation, ...spotPins } = colors.pin;
      expect(new Set(Object.values(spotPins)).size).toBe(Object.keys(spotPins).length);
    });

    // 「値が違う」だけでは足りない。以前は未訪問(#FB923C)と行きたい(#D97706)が
    // 別の値でありながら地図上の実寸(21pt)で見分けられず、明度差だけに頼った
    // 設計が破綻していた。知覚上の距離で見る。
    //
    // 距離は CIE76（Lab のユークリッド距離）。ΔE2000 の方が正確だが、ここは
    // 閾値判定で、落としたいペア（旧・未訪問×行きたい = 12.1）と通したい最小の
    // ペア（未訪問×訪問済神社 = 42.5）が 3.5 倍離れているので精度は要らない
    const labOf = (hex: string) => {
      const [r, g, b] = [1, 3, 5]
        .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const fx = f((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047);
      const fy = f(r * 0.2126729 + g * 0.7151522 + b * 0.072175);
      const fz = f((r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883);
      return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    };
    const distance = (a: string, b: string) =>
      Math.hypot(...labOf(a).map((v, i) => v - labOf(b)[i]));

    /** 色覚多様性のシミュレーション（Viénot らの LMS 法） */
    const simulate = (hex: string, kind: 'deutan' | 'protan') => {
      const [r, g, b] = [1, 3, 5]
        .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      let L = 17.8824 * r + 43.5161 * g + 4.11935 * b;
      let M = 3.45565 * r + 27.1554 * g + 3.86714 * b;
      const S = 0.0299566 * r + 0.184309 * g + 1.46709 * b;
      if (kind === 'protan') L = 2.02344 * M - 2.52581 * S;
      else M = 0.494207 * L + 1.24827 * S;
      const out = [
        0.080944 * L - 0.130504 * M + 0.116721 * S,
        -0.0102485 * L + 0.0540194 * M - 0.113615 * S,
        -0.000365294 * L - 0.00412163 * M + 0.693513 * S,
      ].map(c => {
        const k = Math.min(1, Math.max(0, c));
        const e = k <= 0.0031308 ? 12.92 * k : 1.055 * k ** (1 / 2.4) - 0.055;
        return Math.round(e * 255)
          .toString(16)
          .padStart(2, '0');
      });
      return `#${out.join('')}`;
    };

    const spotPinPairs = () => {
      const { currentLocation: _currentLocation, ...spotPins } = colors.pin;
      const entries = Object.entries(spotPins);
      return entries.flatMap(([an, a], i) =>
        entries.slice(i + 1).map(([bn, b]) => ({ label: `${an} × ${bn}`, a, b }))
      );
    };

    it('should keep every pair of spot pins perceptually far apart', () => {
      const tooClose = spotPinPairs()
        .map(p => ({ ...p, d: distance(p.a, p.b) }))
        .filter(p => p.d < 30)
        .map(p => `${p.label}: ${p.d.toFixed(1)}`);

      expect(tooClose).toEqual([]);
    });

    // 赤・橙・琥珀はD型/P型で同じ帯に落ちる。以前は未訪問・行きたい・訪問済(神社)の
    // 3つが同じオリーブに潰れていた（10.7）。今の最小は未訪問×訪問済(神社)の 22.7 で、
    // ここをさらに広げるには訪問済みか未訪問の色を動かす必要がある（別件）
    it('should keep spot pins separable for common color vision deficiencies', () => {
      const tooClose = (['deutan', 'protan'] as const).flatMap(kind =>
        spotPinPairs()
          .map(p => ({ ...p, kind, d: distance(simulate(p.a, kind), simulate(p.b, kind)) }))
          .filter(p => p.d < 18)
          .map(p => `${p.kind} ${p.label}: ${p.d.toFixed(1)}`)
      );

      expect(tooClose).toEqual([]);
    });

    // ピン画像は PNG なのでテストから色を読めない。焼いたときの色を
    // generate-map-pins.py が baked-colors.json に残しているので、それと突き合わせる。
    // colors.ts だけ変えて npm run gen:map-pins を忘れた状態がこれで落ちる
    it('should keep the baked pin images in sync with the color tokens', () => {
      const baked = bakedPinColors as Record<string, string>;
      const tokens = colors.pin as Record<string, string>;

      expect(Object.keys(baked).length).toBeGreaterThan(0);
      for (const [token, hex] of Object.entries(baked)) {
        expect(`${token}=${hex}`).toBe(`${token}=${tokens[token]}`);
      }
    });

    // 未訪問の色替えで訪問済みの色分けを巻き添えにしていないこと
    it('should keep the visited pins on the shrine/temple scales', () => {
      expect(colors.pin.shrineVisited).toBe(colors.shrine[600]);
      expect(colors.pin.templeVisited).toBe(colors.temple[600]);
    });

    // pin.unvisited は gray[400] と同値だったが別トークン。
    // hex での一括置換でグレースケールを巻き添えにしていないこと
    it('should keep gray[400] unchanged when the unvisited pin moves off gray', () => {
      expect(colors.gray[400]).toBe('#9CA3AF');
      expect(colors.pin.unvisited).not.toBe(colors.gray[400]);
    });

    /*
     * 年報（Issue #274 D-21）。和紙の上の控えめな字と、「まだ」の面。
     * gray[500] は青みで和紙に合わないので、試作の色をトークンにした
     */
    it('和紙の上の控えめな字と、まだの面を持つ', () => {
      expect(colors.washiSub).toBe('#6B6356');
      expect(colors.washiShade).toBe('#D9D2C3');
    });

    it('和紙の上の控えめな字は、和紙との対比が 4.5 以上', () => {
      const luminance = (hex: string) => {
        const [r, g, b] = [1, 3, 5]
          .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
          .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [light, dark] = [luminance(colors.washi), luminance(colors.washiSub)].sort(
        (a, b) => b - a
      );
      expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(4.5);
    });

    it('should export semantic colors', () => {
      expect(colors.background).toBe('#FFFFFF');
      expect(colors.surface).toBe('#F9FAFB');
      expect(colors.success).toBeDefined();
      expect(colors.error).toBeDefined();
    });

    // カードが地から分かれていないと、そもそもカードに見えない
    const fillTiers = () => {
      const { empty, tier1, tier2, tier3 } = colors.prefectureFill;
      return { empty, tier1, tier2, tier3 };
    };
    const fillPairs = () => {
      const entries = Object.entries(fillTiers());
      return entries.flatMap(([an, a], i) =>
        entries.slice(i + 1).map(([bn, b]) => ({ label: `${an} × ${bn}`, a, b }))
      );
    };

    it('県の塗りは「まだ」の灰と、ブランドの3段から採っている', () => {
      expect(colors.prefectureFill.empty).toBe('#E3E4E8');
      expect(colors.prefectureFill.tier1).toBe(colors.primary[300]);
      expect(colors.prefectureFill.tier2).toBe(colors.primary[500]);
      expect(colors.prefectureFill.tier3).toBe(colors.primary[700]);
      expect(colors.prefectureFill.border).toBe(colors.white);
    });

    // 色に載せる意味は枚数ひとつだけ。他の意味を足すとここが増える
    it('県の塗りに、枚数以外の意味を持つ色を足していない', () => {
      expect(Object.keys(colors.prefectureFill).sort()).toEqual([
        'border',
        'empty',
        'tier1',
        'tier2',
        'tier3',
      ]);
    });

    it('4段が、どのペアも知覚上離れている', () => {
      const tooClose = fillPairs()
        .map(p => ({ ...p, d: distance(p.a, p.b) }))
        .filter(p => p.d < 20)
        .map(p => `${p.label}: ${p.d.toFixed(1)}`);

      expect(tooClose).toEqual([]);
    });

    // 実測の最小は tier2 × tier3 で 通常 27.3 / deutan 24.6 / protan 28.8
    it('4段が、色覚多様性でも分かれている', () => {
      const tooClose = (['deutan', 'protan'] as const).flatMap(kind =>
        fillPairs()
          .map(p => ({ ...p, kind, d: distance(simulate(p.a, kind), simulate(p.b, kind)) }))
          .filter(p => p.d < 18)
          .map(p => `${p.kind} ${p.label}: ${p.d.toFixed(1)}`)
      );

      expect(tooClose).toEqual([]);
    });

    it('カードを並べる地は、カード(白)と知覚上分かれている', () => {
      expect(distance(colors.backgroundGrouped, colors.white)).toBeGreaterThan(3);
    });

    /*
     * 注意: backgroundGrouped は gray[100] と ΔE 1.7 しかない。
     *
     * グレースケールの明部は互いに ΔE 2〜3 で密に並んでいるため、地をどの
     * 明るいグレーにしても必ずどれかに近づく。トークン間の距離では守れない。
     *
     * したがって「カードを並べる画面に gray[100] の塗りを置かない」は規約として
     * 守る。実際に置いていないことは、その画面のテストで個別に見る
     * （AccountDeletionScreen のエラーの囲みなど）
     */

    // ふつうの画面は白のまま。グレーにすると gray[100] の入力欄が溶ける
    it('ふつうの画面の地は白のままにする', () => {
      expect(colors.background).toBe(colors.white);
    });

    /*
     * 御朱印帳の写真の読み込み中の本と和紙の枠（Issue #275）。
     * 値は試作 docs/design/mockups/2026-09-gallery-loading-v2.html のまま。
     * 下地・表紙の上端・印は、同じ値の既存のトークンを使い回している
     */
    it('読み込み中の本の色と和紙の枠を持つ', () => {
      expect(colors.loadingBook).toEqual({
        coverEnd: '#A83A0E',
        paper: '#FBF8F1',
        paperEdge: '#EDE6D8',
        shadow: '#3C2814',
        gutter: 'rgba(90, 60, 30, 0.14)',
        gutterClear: 'rgba(90, 60, 30, 0)',
        leafShadeStart: 'rgba(90, 60, 30, 0.22)',
        leafShadeEnd: 'rgba(90, 60, 30, 0.04)',
        castStart: 'rgba(60, 40, 20, 0.28)',
        castEnd: 'rgba(60, 40, 20, 0)',
      });
      expect(colors.washiFrame).toBe('rgba(0, 0, 0, 0.06)');
    });

    it('読み込み中の本が使い回す色は、試作と同じ値のまま', () => {
      expect(colors.washi).toBe('#EFEAE0');
      expect(colors.primary[700]).toBe('#C2410C');
      expect(colors.seal).toBe('#C2342B');
    });
  });

  describe('typography', () => {
    it('should export heading styles', () => {
      expect(typography.h1.fontSize).toBe(28);
      expect(typography.h2.fontSize).toBe(22);
      expect(typography.h3.fontSize).toBe(18);
    });

    it('should export body styles', () => {
      expect(typography.body.fontSize).toBe(16);
      expect(typography.bodySmall.fontSize).toBe(14);
    });

    it('should export label and button styles', () => {
      expect(typography.label.fontSize).toBe(12);
      expect(typography.button.fontSize).toBe(16);
      expect(typography.buttonSmall.fontSize).toBe(14);
    });
  });

  describe('spacing', () => {
    it('should export spacing scale', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(12);
      expect(spacing.lg).toBe(16);
      expect(spacing.xl).toBe(20);
    });
  });

  describe('borderRadius', () => {
    it('should export border radius scale', () => {
      expect(borderRadius.sm).toBe(4);
      expect(borderRadius.md).toBe(8);
      expect(borderRadius.lg).toBe(12);
      expect(borderRadius.full).toBe(9999);
    });
  });

  describe('shadows', () => {
    it('should export shadow styles', () => {
      expect(shadows.sm.shadowOpacity).toBe(0.05);
      expect(shadows.md.shadowOpacity).toBe(0.1);
      expect(shadows.lg.shadowOpacity).toBe(0.15);
    });

    it('should include elevation for Android', () => {
      expect(shadows.sm.elevation).toBe(1);
      expect(shadows.md.elevation).toBe(3);
      expect(shadows.lg.elevation).toBe(5);
    });
  });
});
