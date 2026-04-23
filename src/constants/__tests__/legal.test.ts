import { TERMS_OF_SERVICE, PRIVACY_POLICY, LegalSection } from '@/constants/legal';

describe('legal constants', () => {
  describe('型構造の検証', () => {
    it('TERMS_OF_SERVICE が lastUpdated と sections を持つ', () => {
      expect(TERMS_OF_SERVICE).toHaveProperty('lastUpdated');
      expect(TERMS_OF_SERVICE).toHaveProperty('sections');
    });

    it('PRIVACY_POLICY が lastUpdated と sections を持つ', () => {
      expect(PRIVACY_POLICY).toHaveProperty('lastUpdated');
      expect(PRIVACY_POLICY).toHaveProperty('sections');
    });

    it('TERMS_OF_SERVICE の sections が配列である', () => {
      expect(Array.isArray(TERMS_OF_SERVICE.sections)).toBe(true);
    });

    it('PRIVACY_POLICY の sections が配列である', () => {
      expect(Array.isArray(PRIVACY_POLICY.sections)).toBe(true);
    });

    it('TERMS_OF_SERVICE の各 section が title と body を持つ', () => {
      TERMS_OF_SERVICE.sections.forEach((section: LegalSection) => {
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('body');
        expect(typeof section.title).toBe('string');
        expect(typeof section.body).toBe('string');
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.body.length).toBeGreaterThan(0);
      });
    });

    it('PRIVACY_POLICY の各 section が title と body を持つ', () => {
      PRIVACY_POLICY.sections.forEach((section: LegalSection) => {
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('body');
        expect(typeof section.title).toBe('string');
        expect(typeof section.body).toBe('string');
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.body.length).toBeGreaterThan(0);
      });
    });
  });

  describe('lastUpdated の検証', () => {
    it('TERMS_OF_SERVICE の lastUpdated が有効な日付文字列である', () => {
      const date = new Date(TERMS_OF_SERVICE.lastUpdated);
      expect(isNaN(date.getTime())).toBe(false);
    });

    it('PRIVACY_POLICY の lastUpdated が有効な日付文字列である', () => {
      const date = new Date(PRIVACY_POLICY.lastUpdated);
      expect(isNaN(date.getTime())).toBe(false);
    });
  });

  describe('TERMS_OF_SERVICE のセクション構成', () => {
    const requiredTitles = [
      'はじめに',
      '定義',
      'アカウント',
      'サービス内容',
      'ユーザーコンテンツ',
      '禁止事項',
      '知的財産権',
      '免責事項',
      'サービスの変更・中断',
      'アカウント削除',
      '準拠法・管轄',
    ];

    requiredTitles.forEach(title => {
      it(`"${title}" セクションが含まれる`, () => {
        const titles = TERMS_OF_SERVICE.sections.map((s: LegalSection) => s.title);
        expect(titles).toContain(title);
      });
    });

    it('セクション数が11個である', () => {
      expect(TERMS_OF_SERVICE.sections).toHaveLength(11);
    });
  });

  describe('PRIVACY_POLICY のセクション構成', () => {
    const requiredTitles = [
      'はじめに',
      '収集する情報',
      '情報の利用目的',
      '情報の保存場所',
      '第三者提供',
      'データセキュリティ',
      'データの保持と削除',
      'ユーザーの権利',
      'Cookieおよびトラッキング',
      '子どものプライバシー',
      'ポリシーの変更',
      'お問い合わせ',
    ];

    requiredTitles.forEach(title => {
      it(`"${title}" セクションが含まれる`, () => {
        const titles = PRIVACY_POLICY.sections.map((s: LegalSection) => s.title);
        expect(titles).toContain(title);
      });
    });

    it('セクション数が12個である', () => {
      expect(PRIVACY_POLICY.sections).toHaveLength(12);
    });
  });

  describe('プライバシーポリシーの重要事項', () => {
    it('位置情報はサーバーに保存しない旨が記載されている', () => {
      const locationSection = PRIVACY_POLICY.sections.find(
        (s: LegalSection) => s.title === '収集する情報'
      );
      expect(locationSection).toBeDefined();
      expect(locationSection!.body).toContain('サーバーに保存しません');
    });

    it('AI情報抽出（Claude API）の利用が記載されている', () => {
      const purposeSection = PRIVACY_POLICY.sections.find(
        (s: LegalSection) => s.title === '情報の利用目的'
      );
      expect(purposeSection).toBeDefined();
      expect(purposeSection!.body).toContain('Claude');
    });

    it('第三者提供にAnthropicが含まれている', () => {
      const thirdPartySection = PRIVACY_POLICY.sections.find(
        (s: LegalSection) => s.title === '第三者提供'
      );
      expect(thirdPartySection).toBeDefined();
      expect(thirdPartySection!.body).toContain('Anthropic');
    });

    it('お問い合わせにメールアドレスが含まれている', () => {
      const contactSection = PRIVACY_POLICY.sections.find(
        (s: LegalSection) => s.title === 'お問い合わせ'
      );
      expect(contactSection).toBeDefined();
      expect(contactSection!.body).toContain('kj.11235813213455@gmail.com');
    });

    it('データ保存場所にSupabaseとAWS東京リージョンが記載されている', () => {
      const storageSection = PRIVACY_POLICY.sections.find(
        (s: LegalSection) => s.title === '情報の保存場所'
      );
      expect(storageSection).toBeDefined();
      expect(storageSection!.body).toContain('Supabase');
      expect(storageSection!.body).toContain('ap-northeast-1');
    });
  });
});
