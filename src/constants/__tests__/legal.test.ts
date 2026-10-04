import fs from 'fs';
import path from 'path';
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

    // 御朱印画像を Cloudflare R2 に置く前に公開しておくこと（Issue #227 S2）
    it('御朱印画像の保存先と第三者提供に Cloudflare が載っている', () => {
      const find = (title: string) => PRIVACY_POLICY.sections.find(s => s.title === title)!;
      expect(find('情報の保存場所').body).toContain('Cloudflare R2');
      expect(find('第三者提供').body).toContain('【Cloudflare, Inc.】');
    });
  });

  // Issue #248: 見つからない寺社を調べて追加する
  describe('寺社の追加（Issue #248）', () => {
    const body = (doc: typeof PRIVACY_POLICY, title: string) =>
      doc.sections.find((s: LegalSection) => s.title === title)!.body;

    it('Anthropic に送るのは名前と、本人が絞った地域だけで、位置情報そのものは送らない', () => {
      expect(body(PRIVACY_POLICY, '第三者提供')).toContain(
        'スポットを追加するとき、調べる手がかりとして、入力したスポット名と、地域を絞ったときはその都道府県・市区町村名をAnthropicのClaude APIに送信します。位置情報そのものは送信しません。'
      );
      expect(body(PRIVACY_POLICY, '情報の利用目的')).toContain('【スポットの追加】');
    });

    it('地図で決めたピンの位置は、スポットの位置として保存する', () => {
      expect(body(PRIVACY_POLICY, '収集する情報')).toContain(
        '地図で場所を決めてスポットを追加したときは、決めたピンの位置をスポットの位置として保存します。'
      );
    });

    it('追加したスポットは他のユーザーの地図にも出ることがあり、退会後も残る', () => {
      expect(body(TERMS_OF_SERVICE, 'ユーザーコンテンツ')).toContain(
        'ユーザーが追加したスポットの情報は、他のユーザーの地図にも表示されることがあり、アカウントを削除した後も残ります。'
      );
    });

    it('利用規約の更新日は 2026-09-24', () => {
      expect(TERMS_OF_SERVICE.lastUpdated).toBe('2026-09-24');
    });
  });

  describe('参拝の予定（Issue #258）', () => {
    const body = (doc: typeof PRIVACY_POLICY, title: string) =>
      doc.sections.find((s: LegalSection) => s.title === title)!.body;

    it('ユーザー入力データに参拝の予定が入っている', () => {
      expect(body(PRIVACY_POLICY, '収集する情報')).toContain('参拝の予定（行く日と寺社の順番）');
    });

    it('アカウントを削除すると参拝の予定も消える', () => {
      expect(body(PRIVACY_POLICY, 'データの保持と削除')).toContain('・参拝の予定');
    });

    it('プライバシーポリシーの更新日は 2026-10-01 以降（#311 で更新した）', () => {
      expect(PRIVACY_POLICY.lastUpdated >= '2026-10-01').toBe(true);
    });
  });

  // Issue #311: 名前にも住所にも無い言葉は、国土地理院の地名検索に送る
  describe('地名・駅名で探す（Issue #311）', () => {
    const P1 =
      '【地名・駅名で探す】\n検索欄に入れた言葉が神社・寺院の名前や住所に見つからないとき、その言葉を国土地理院の地名検索に送信し、駅や名所などの場所を調べます。位置情報やアカウントの情報は送信しません。';
    const P2 =
      '【国土地理院】\n地名・駅名で探すとき、検索欄に入れた言葉を国土地理院の地名検索に送信します。位置情報やアカウントの情報は送信しません。';
    const body = (title: string) =>
      PRIVACY_POLICY.sections.find((s: LegalSection) => s.title === title)!.body;
    const html = fs.readFileSync(path.join(__dirname, '../../../docs/legal/privacy.html'), 'utf8');

    it('AC-39: 情報の利用目的に P-1。【スポットの追加】の後・【御朱印の公開表示】の前', () => {
      const purpose = body('情報の利用目的');
      expect(purpose).toContain(P1);
      expect(purpose.indexOf(P1)).toBeGreaterThan(purpose.indexOf('【スポットの追加】'));
      expect(purpose.indexOf(P1)).toBeLessThan(purpose.indexOf('【御朱印の公開表示】'));
    });

    it('AC-39: 第三者提供に P-2。【Anthropic】の後・【他のユーザー】の前', () => {
      const thirdParty = body('第三者提供');
      expect(thirdParty).toContain(P2);
      expect(thirdParty.indexOf(P2)).toBeGreaterThan(thirdParty.indexOf('【Anthropic】'));
      expect(thirdParty.indexOf(P2)).toBeLessThan(thirdParty.indexOf('【他のユーザー】'));
    });

    it('AC-39: 更新日は 2026-10-01 より後', () => {
      expect(PRIVACY_POLICY.lastUpdated > '2026-10-01').toBe(true);
      expect(PRIVACY_POLICY.lastUpdated).toBe('2026-10-04');
    });

    it('AC-39: 公開ページにも P-1・P-2 があり、最終更新日がアプリの中と同じ日', () => {
      expect(html).toContain(P1);
      expect(html).toContain(P2);
      const [y, m, d] = PRIVACY_POLICY.lastUpdated.split('-').map(Number);
      expect(html).toContain(`最終更新日: ${y}年${m}月${d}日`);
    });
  });
});
