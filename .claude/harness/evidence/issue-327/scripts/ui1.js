const { chromium, exe, EV, out, consoleLines, mk, openMap, rect, cnt, fs } = require('./ev.js');
(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  // UI-1
  let { ctx, page } = await mk(browser, { tag: 'ui1' });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 120000 });
  for (const t of ['スキップ', '続ける']) {
    const b = page.getByText(t, { exact: true });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(800);
    }
  }
  await page
    .waitForSelector('[data-testid="first-stamp-card"]', { timeout: 30000 })
    .catch(() => out('UI-1 card never appeared'));
  const t0 = Date.now();
  await page.waitForTimeout(1500);
  const em = await page
    .locator('[data-testid="first-stamp-card-emboss"]')
    .evaluate(e => getComputedStyle(e).opacity)
    .catch(() => 'none');
  out('UI-1 emboss opacity @1500ms after card DOM', em, 'elapsed', Date.now() - t0);
  const card = await rect(page, 'first-stamp-card');
  const ms = await rect(page, 'map-screen');
  out(
    'UI-1 card',
    JSON.stringify(card),
    'map-screen',
    JSON.stringify(ms),
    'bottomGap',
    ms.bottom - card.bottom
  );
  out(
    'UI-1 title',
    JSON.stringify(await page.locator('[data-testid="first-stamp-card-title"]').innerText())
  );
  out('UI-1 subtitle', await page.locator('[data-testid="first-stamp-card-subtitle"]').innerText());
  out('UI-1 fab count', await cnt(page, 'fab-button'));
  out(
    'UI-1 permission',
    await page.evaluate(
      async () => (await navigator.permissions.query({ name: 'geolocation' })).state
    )
  );
  await page.screenshot({ path: EV + '/card-393.png' });
  await ctx.close();
  // UI-2
  for (const [w, h] of [
    [375, 667],
    [440, 956],
  ]) {
    ({ ctx, page } = await mk(browser, { vp: { width: w, height: h }, tag: 'ui2-' + w }));
    await openMap(page);
    await page
      .waitForSelector('[data-testid="first-stamp-card"]', { timeout: 30000 })
      .catch(() => out('UI-2 no card', w));
    await page.waitForTimeout(1200);
    const c = await rect(page, 'first-stamp-card');
    const info = await page.evaluate(() => {
      const q = id => document.querySelector(`[data-testid="${id}"]`);
      const textEls = id => {
        const el = q(id);
        const res = [];
        el.querySelectorAll('*').forEach(n => {
          if (n.children.length === 0 && n.textContent.trim()) {
            const r = n.getBoundingClientRect();
            res.push({ t: n.textContent, h: r.height, w: r.width });
          }
        });
        return res;
      };
      const r = id => {
        const b = q(id).getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      };
      return {
        shootText: textEls('first-stamp-shoot'),
        nearText: textEls('first-stamp-nearby'),
        shoot: r('first-stamp-shoot'),
        near: r('first-stamp-nearby'),
        titleH: q('first-stamp-card-title').getBoundingClientRect().height,
      };
    });
    out('UI-2', w, 'card', JSON.stringify(c), JSON.stringify(info));
    const inside = b =>
      b.left >= c.left - 0.5 &&
      b.right <= c.right + 0.5 &&
      b.top >= c.top - 0.5 &&
      b.bottom <= c.bottom + 0.5;
    out('UI-2', w, 'inside', inside(info.shoot), inside(info.near));
    await page.screenshot({ path: EV + `/card-${w}.png` });
    await ctx.close();
  }
  fs.writeFileSync(EV + '/console-ui1-2.txt', consoleLines.join('\n'));
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
