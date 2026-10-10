const { chromium, exe, EV, out, consoleLines, mk, openMap, rect, cnt, fs } = require('./ev.js');
(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  // UI-4 tail
  let { ctx, page } = await mk(browser, { tag: 'ui4b' });
  await openMap(page);
  await page.waitForSelector('[data-testid="first-stamp-card"]');
  await page.locator('[data-testid="first-stamp-nearby"]').click();
  await page.waitForSelector('[data-testid="region-sheet"]');
  await page.waitForTimeout(600);
  const name0 = (await page.locator('[data-testid="region-spot-0"]').innerText())
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)[0];
  await page.locator('[data-testid="region-spot-0"]').click();
  await page.waitForTimeout(1200);
  const bs = await page
    .locator('[data-testid="bottom-sheet"]')
    .first()
    .innerText()
    .catch(() => 'NONE');
  out(
    'UI-4 name0',
    name0,
    'in bottom-sheet',
    bs.includes(name0),
    'card',
    await cnt(page, 'first-stamp-card')
  );
  await ctx.close();
  // UI-8
  ({ ctx, page } = await mk(browser, { tag: 'ui8', reduce: true, video: 'reduce' }));
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 120000 });
  for (const t of ['スキップ', '続ける']) {
    const b = page.getByText(t, { exact: true });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(800);
    }
  }
  await page.evaluate(() => {
    window.__ap = [];
    const t0 = performance.now();
    const f = () => {
      const c = document.querySelector('[data-testid="first-stamp-card"]');
      const e = document.querySelector('[data-testid="first-stamp-card-emboss"]');
      if (c)
        window.__ap.push([
          Math.round(performance.now() - t0),
          getComputedStyle(c).opacity,
          c.getBoundingClientRect().top,
          e ? getComputedStyle(e).opacity : null,
        ]);
      requestAnimationFrame(f);
    };
    f();
  });
  await page.waitForSelector('[data-testid="first-stamp-card"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const ap = await page.evaluate(() => window.__ap);
  const op = [...new Set(ap.map(x => x[1]))],
    tp = [...new Set(ap.map(x => Math.round(x[2] * 10) / 10))],
    ep = [...new Set(ap.map(x => x[3]))];
  out(
    'UI-8 card opacities seen',
    JSON.stringify(op),
    'tops seen',
    JSON.stringify(tp),
    'emboss opacities seen',
    JSON.stringify(ep),
    'frames',
    ap.length
  );
  await page.screenshot({ path: EV + '/reduce-card.png' });
  await page.evaluate(() => {
    window.__s = [];
    const t0 = performance.now();
    const f = () => {
      const c = document.querySelector('[data-testid="first-stamp-card"]');
      if (c) {
        const r = c.getBoundingClientRect();
        window.__s.push([
          Math.round(performance.now() - t0),
          +r.width.toFixed(1),
          getComputedStyle(c).opacity,
        ]);
      } else window.__s.push([Math.round(performance.now() - t0), 'gone']);
      if (performance.now() - t0 < 800) requestAnimationFrame(f);
    };
    window.__go = () => f();
  });
  await page.evaluate(() => window.__go());
  await page.locator('[data-testid="first-stamp-close"]').click();
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => window.__s);
  out(
    'UI-8 close samples',
    JSON.stringify(s.slice(0, 6)),
    '... widths seen',
    JSON.stringify([...new Set(s.filter(x => x[1] !== 'gone').map(x => x[1]))]),
    'card count',
    await cnt(page, 'first-stamp-card'),
    'fab',
    await cnt(page, 'fab-button')
  );
  out('UI-8 frames', await page.__finishVideo());
  await ctx.close();
  // UI-7
  ({ ctx, page } = await mk(browser, { tag: 'ui7' }));
  await page.goto('http://localhost:8081/?preview=goshuincho', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  for (const t of ['スキップ', '続ける']) {
    const b = page.getByText(t, { exact: true });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(800);
    }
  }
  await page.waitForTimeout(2500);
  const tab = page.getByText('御朱印帳', { exact: true });
  out('UI-7 tab count', await tab.count());
  if (await tab.count()) await tab.last().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: EV + '/goshuincho-1.png' });
  out(
    'UI-7 次の1枚を撮る',
    await page.getByText('次の1枚を撮る').count(),
    '最初の1枚を撮る',
    await page.getByText('最初の1枚を撮る').count(),
    '旧',
    await page.getByText('ここに御朱印を追加する').count()
  );
  fs.writeFileSync(EV + '/ui7-body.txt', await page.evaluate(() => document.body.innerText));
  await ctx.close();
  fs.writeFileSync(EV + '/console-ui7-8.txt', consoleLines.join('\n'));
  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
