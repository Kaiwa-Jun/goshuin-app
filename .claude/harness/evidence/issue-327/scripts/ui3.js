const { chromium, exe, EV, out, consoleLines, mk, openMap, rect, cnt, fs } = require('./ev.js');
(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  // UI-3 fold
  let { ctx, page } = await mk(browser, { tag: 'ui3', video: 'fold' });
  await openMap(page);
  await page.waitForSelector('[data-testid="first-stamp-card"]');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.__s = [];
    const card = document.querySelector('[data-testid="first-stamp-card"]');
    const t0 = performance.now();
    window.__t0 = t0;
    const f = () => {
      const c = document.querySelector('[data-testid="first-stamp-card"]');
      if (c) {
        const r = c.getBoundingClientRect();
        window.__s.push([
          Math.round(performance.now() - t0),
          +r.width.toFixed(1),
          +r.height.toFixed(1),
          +r.right.toFixed(1),
          +r.bottom.toFixed(1),
          getComputedStyle(c).opacity,
        ]);
      } else window.__s.push([Math.round(performance.now() - t0), 'gone']);
      if (performance.now() - t0 < 1000) requestAnimationFrame(f);
    };
    window.__start = () => {
      window.__t0 = performance.now();
      f();
    };
  });
  await page.evaluate(() => window.__start());
  await page.locator('[data-testid="first-stamp-close"]').click();
  await page.waitForTimeout(1100);
  const s = await page.evaluate(() => window.__s);
  fs.writeFileSync(EV + '/fold-samples.json', JSON.stringify(s));
  const pre400 = s.filter(x => x[0] <= 400 && x[1] !== 'gone');
  let grows = 0;
  for (let i = 1; i < pre400.length; i++) if (pre400[i][1] > pre400[i - 1][1] + 0.5) grows++;
  out(
    'UI-3 samples<=400ms',
    pre400.length,
    'growth frames',
    grows,
    'first',
    JSON.stringify(pre400[0]),
    'mid',
    JSON.stringify(pre400[Math.floor(pre400.length / 2)]),
    'last',
    JSON.stringify(pre400[pre400.length - 1])
  );
  out('UI-3 gone at', JSON.stringify(s.find(x => x[1] === 'gone')));
  await page.waitForTimeout(500);
  out('UI-3 card count after', await cnt(page, 'first-stamp-card'));
  const fab = await rect(page, 'fab-button');
  const ms = await rect(page, 'map-screen');
  out('UI-3 fab right', fab.right, 'bottomGap', ms.bottom - fab.bottom);
  await page.locator('[data-testid="fab-button"]').click();
  const t = Date.now();
  await page.waitForSelector('[data-testid="first-stamp-card"]', { timeout: 2000 });
  out('UI-3 card back after ms', Date.now() - t);
  out(
    'UI-3 login prompt visible',
    await page.getByText('ログインが必要です').count(),
    'modal later',
    await cnt(page, 'modal-later-button')
  );
  await page.reload({ waitUntil: 'networkidle' });
  for (const tx of ['スキップ', '続ける']) {
    const b = page.getByText(tx, { exact: true });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(800);
    }
  }
  await page.waitForTimeout(3500);
  out('UI-3 after reload card count', await cnt(page, 'first-stamp-card'));
  out('UI-3 video frames', await page.__finishVideo());
  await ctx.close();

  // UI-4/5/6
  ({ ctx, page } = await mk(browser, { tag: 'ui4' }));
  await openMap(page);
  await page.waitForSelector('[data-testid="first-stamp-card"]');
  await page.waitForTimeout(800);
  // UI-6 first
  await page.locator('[data-testid="first-stamp-shoot"]').click();
  await page.waitForTimeout(800);
  out('UI-6 login prompt', await page.getByText('ログインが必要です').count());
  await page.screenshot({ path: EV + '/ui6-login.png' });
  await page.locator('[data-testid="modal-later-button"]').click();
  await page.waitForTimeout(800);
  out(
    'UI-6 card after later',
    await cnt(page, 'first-stamp-card'),
    'modal later',
    await cnt(page, 'modal-later-button')
  );
  // UI-4
  const nearBtn = page.locator('[data-testid="first-stamp-nearby"]');
  out('UI-4 nearby btn', await nearBtn.count());
  await nearBtn.click();
  await page.waitForSelector('[data-testid="region-sheet"]');
  await page.waitForTimeout(800);
  const sheetText = await page.locator('[data-testid="region-sheet"]').innerText();
  out('UI-4 sheet text', JSON.stringify(sheetText));
  const rows = await page.evaluate(() => {
    const res = [];
    for (let i = 0; i < 10; i++) {
      const r = document.querySelector(`[data-testid="region-spot-${i}"]`);
      if (!r) break;
      const d = document.querySelector(`[data-testid="region-spot-${i}-distance"]`);
      res.push({ txt: r.innerText, dist: d && d.innerText });
    }
    return res;
  });
  out('UI-4 rows', JSON.stringify(rows));
  const km = rows.map(r => (/km$/.test(r.dist) ? parseFloat(r.dist) : parseFloat(r.dist) / 1000));
  out(
    'UI-4 km',
    JSON.stringify(km),
    'sorted',
    km.every((v, i) => i === 0 || v >= km[i - 1]),
    'all<=50',
    km.every(v => v <= 50),
    'fmt ok',
    rows.every(r => /^(\d+m|\d+\.\dkm)$/.test(r.dist))
  );
  out('UI-4 card', await cnt(page, 'first-stamp-card'), 'fab', await cnt(page, 'fab-button'));
  await page.screenshot({ path: EV + '/nearby.png' });
  await page.locator('[data-testid="region-spot-0"]').click();
  await page
    .waitForSelector('[data-testid="bottom-sheet"]', { timeout: 5000 })
    .catch(() => out('UI-4 no bottom-sheet'));
  await page.waitForTimeout(800);
  const bs = await page.locator('[data-testid="bottom-sheet"]').first().innerText();
  const name0 = rows[0].txt.split('\n')[0];
  out(
    'UI-4 bottom-sheet contains row0 name',
    bs.includes(name0),
    JSON.stringify(name0),
    'card',
    await cnt(page, 'first-stamp-card'),
    'region-sheet',
    await cnt(page, 'region-sheet')
  );
  await page.screenshot({ path: EV + '/spot-sheet.png' });
  // UI-5
  const wish = page.getByText('行きたい', { exact: false }).first();
  out('UI-5 wish count', await page.getByText('行きたい').count());
  await wish.click();
  await page.waitForTimeout(800);
  out('UI-5 login prompt', await page.getByText('ログインが必要です').count());
  await page.screenshot({ path: EV + '/ui5-login.png' });
  await page.locator('[data-testid="modal-later-button"]').click();
  await page.waitForTimeout(800);
  out(
    'UI-5 bottom-sheet still',
    await cnt(page, 'bottom-sheet'),
    'record confirm text',
    await page.getByText('この内容で記録する').count(),
    'modal later',
    await cnt(page, 'modal-later-button')
  );
  await ctx.close();
  fs.writeFileSync(EV + '/console-ui3-6.txt', consoleLines.join('\n'));
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
