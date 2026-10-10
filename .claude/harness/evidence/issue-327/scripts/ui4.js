const { chromium, exe, EV, out, mk, openMap, cnt } = require('./ev.js');
(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const { ctx, page } = await mk(browser, { tag: 'ui4c' });
  await openMap(page);
  await page.waitForSelector('[data-testid="first-stamp-card"]');
  await page.locator('[data-testid="first-stamp-nearby"]').click();
  await page.waitForSelector('[data-testid="region-sheet"]');
  await page.waitForTimeout(600);
  const r0 = await page.locator('[data-testid="region-spot-0"]').innerText();
  await page.locator('[data-testid="region-spot-0"]').click();
  await page.waitForTimeout(1500);
  const bs = await page
    .locator('[data-testid="bottom-sheet"]')
    .first()
    .innerText()
    .catch(() => 'NONE');
  out(
    'row0',
    JSON.stringify(r0),
    'bottom-sheet',
    JSON.stringify(bs.slice(0, 120)),
    'card',
    await cnt(page, 'first-stamp-card'),
    'region-sheet',
    await cnt(page, 'region-sheet')
  );
  await ctx.close();
  await browser.close();
})();
