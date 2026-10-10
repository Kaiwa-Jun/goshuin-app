const { chromium } = require('/private/tmp/claude-501/pw/node_modules/playwright-core');
const fs = require('fs');
const EV =
  '/Users/kaiwajun/orca/workspaces/goshuin-app/first-stamp-327/.claude/harness/evidence/issue-327';
const exe =
  process.env.HOME +
  '/Library/Caches/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const log = [];
const out = (...a) => {
  const s = a.join(' ');
  console.log(s);
  log.push(s);
};
const consoleLines = [];
async function mk(browser, o = {}) {
  const vp = o.vp || { width: 393, height: 852 };
  const opts = {
    viewport: vp,
    deviceScaleFactor: o.dsf || 2,
    locale: 'ja-JP',
    geolocation: { latitude: 35.0037, longitude: 135.7788 },
    permissions: ['geolocation'],
  };
  if (o.reduce) opts.reducedMotion = 'reduce';
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', m => consoleLines.push(`[${o.tag || ''}][${m.type()}] ${m.text()}`));
  page.on('pageerror', e => consoleLines.push(`[${o.tag || ''}][pageerror] ${e.message}`));
  if (o.video) {
    const cdp = await ctx.newCDPSession(page);
    const dir = EV + '/frames-' + o.video;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const frames = [];
    let n = 0;
    cdp.on('Page.screencastFrame', async f => {
      const fn = `${dir}/f${String(n++).padStart(5, '0')}.jpg`;
      fs.writeFileSync(fn, Buffer.from(f.data, 'base64'));
      frames.push([fn, f.metadata.timestamp]);
      try {
        await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId });
      } catch (e) {}
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 });
    page.__finishVideo = async () => {
      await cdp.send('Page.stopScreencast').catch(() => {});
      let txt = '';
      for (let i = 0; i < frames.length; i++) {
        const d = i + 1 < frames.length ? Math.max(0.001, frames[i + 1][1] - frames[i][1]) : 0.1;
        txt += `file '${frames[i][0]}'\nduration ${d}\n`;
      }
      txt += `file '${frames[frames.length - 1][0]}'\n`;
      fs.writeFileSync(dir + '/list.txt', txt);
      require('child_process').execSync(
        `/usr/local/bin/ffmpeg -y -loglevel error -f concat -safe 0 -i ${dir}/list.txt -vf "scale=iw/2:-2" -c:v libvpx-vp9 -b:v 1M ${EV}/${o.video}.webm`
      );
      fs.writeFileSync(
        `${EV}/${o.video}-frames.json`,
        JSON.stringify(frames.map(f => [f[0].split('/').pop(), +(f[1] - frames[0][1]).toFixed(3)]))
      );
      fs.rmSync(dir, { recursive: true, force: true });
      return frames.length;
    };
  }
  return { ctx, page };
}
async function openMap(page, url = 'http://localhost:8081') {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  for (const t of ['スキップ', '続ける']) {
    const b = page.getByText(t, { exact: true });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(800);
    }
  }
  await page.waitForTimeout(3500);
}
const rect = (page, sel) =>
  page
    .locator(`[data-testid="${sel}"]`)
    .first()
    .evaluate(e => {
      const r = e.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        w: r.width,
        h: r.height,
      };
    });
const cnt = (page, sel) => page.locator(`[data-testid="${sel}"]`).count();
module.exports = { chromium, exe, EV, out, log, consoleLines, mk, openMap, rect, cnt, fs };
