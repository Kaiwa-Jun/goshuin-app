#!/usr/bin/env node
/**
 * App Store Connect の「App Review 情報」を CLI から操作する。
 *
 * ブラウザの ASC 画面は添付とフォーム再取得で過去に何度も溶かしているので
 * （.claude/harness/handoff.md「ASC の画面操作」参照）、Notes 更新と
 * 添付ファイルの登録は API でやる。ブラウザが要るのは Resolution Center への
 * 返信と「審査へ提出」の2つだけ。
 *
 * 認証は ~/.appstoreconnect/AuthKey_*.p8（Git 管理外・再ダウンロード不可）。
 *
 *   node scripts/asc-review.mjs status
 *   node scripts/asc-review.mjs testflight          # 内部テストグループを作って build 14 を配布
 *   node scripts/asc-review.mjs notes --ios 26.5    # Notes を §2〜7 の英文で置き換える
 *   node scripts/asc-review.mjs attach <file.mov>   # App Review 情報に添付
 *   node scripts/asc-review.mjs rm-attachment <id>  # 添付を消す
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const KEY_ID = 'D9CP6Y4YA3';
const ISSUER_ID = '7e442eb2-fd91-4bac-af2c-1eb5ac42d4ca';
const APP_ID = '6797201465';
const P8_PATH = `${process.env.HOME}/.appstoreconnect/AuthKey_${KEY_ID}.p8`;
const DEVICE_MODEL = 'iPhone 16'; // ASC の登録デバイス（/v1/devices）から確認済み

const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

/** ASC の ES256 は DER ではなく JOSE の raw r||s を要求する */
function derToJose(der) {
  let off = 2;
  if (der[1] & 0x80) off = 2 + (der[1] & 0x7f);
  const rLen = der[off + 1];
  const r = der.subarray(off + 2, off + 2 + rLen);
  const sOff = off + 2 + rLen;
  const sLen = der[sOff + 1];
  const s = der.subarray(sOff + 2, sOff + 2 + sLen);
  const pad = b => {
    const t = b.length > 32 ? b.subarray(b.length - 32) : b;
    return Buffer.concat([Buffer.alloc(32 - t.length), t]);
  };
  return Buffer.concat([pad(r), pad(s)]);
}

function token() {
  if (!fs.existsSync(P8_PATH)) {
    console.error(`API キーが見つからない: ${P8_PATH}`);
    process.exit(1);
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  const payload = b64({ iss: ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const signer = crypto.createSign('SHA256');
  signer.update(`${header}.${payload}`);
  const sig = derToJose(signer.sign(crypto.createPrivateKey(fs.readFileSync(P8_PATH, 'utf8'))));
  return `${header}.${payload}.${sig.toString('base64url')}`;
}

const JWT = token();

async function api(p, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${JWT}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ASC ${method} ${p} -> ${res.status}\n${text.slice(0, 1200)}`);
  return text ? JSON.parse(text) : {};
}

/** 対象バージョンとその App Review 情報。バージョンは1本しか無い前提を置かない */
async function currentVersion() {
  const v = await api(
    `/v1/apps/${APP_ID}/appStoreVersions?limit=1&fields[appStoreVersions]=versionString,appStoreState,appVersionState`
  );
  if (!v.data?.length) throw new Error('appStoreVersions が空');
  return v.data[0];
}

async function reviewDetail(versionId) {
  const d = await api(`/v1/appStoreVersions/${versionId}/appStoreReviewDetail`);
  return d.data;
}

// ---------------------------------------------------------------- status

async function cmdStatus() {
  const version = await currentVersion();
  const build = await api(
    `/v1/appStoreVersions/${version.id}/build?fields[builds]=version,processingState,expired`
  );
  const subs = await api(
    `/v1/reviewSubmissions?filter[app]=${APP_ID}&limit=3&fields[reviewSubmissions]=state,submittedDate`
  );
  const detail = await reviewDetail(version.id);
  const atts = await api(
    `/v1/appStoreReviewDetails/${detail.id}/appStoreReviewAttachments?limit=10`
  );
  const groups = await api(
    `/v1/apps/${APP_ID}/betaGroups?limit=10&fields[betaGroups]=name,isInternalGroup`
  );

  console.log(`version   ${version.attributes.versionString}  ${version.attributes.appStoreState}`);
  console.log(
    `build     ${build.data?.attributes?.version ?? '-'}  ${build.data?.attributes?.processingState ?? ''}`
  );
  for (const s of subs.data ?? [])
    console.log(`review    ${s.attributes.state}  ${s.attributes.submittedDate}  ${s.id}`);
  console.log(`notes     ${(detail.attributes.notes ?? '').length} chars`);
  for (const a of atts.data ?? []) {
    console.log(
      `attach    ${a.attributes.fileName}  ${a.attributes.assetDeliveryState?.state}  ${a.id}`
    );
  }
  const gs = groups.data ?? [];
  console.log(
    `testflight ${gs.length ? gs.map(g => g.attributes.name).join(', ') : '⚠ グループなし = 実機にビルドが降りてこない'}`
  );
}

// ------------------------------------------------------------ testflight

/**
 * 内部テストグループが1つも無いと TestFlight アプリにビルドが出ない。
 * build 14 を実機に入れるための最小構成を作る。
 */
async function cmdTestflight() {
  const buildRes = await api(
    `/v1/builds?filter[app]=${APP_ID}&limit=1&sort=-version&fields[builds]=version`
  );
  const build = buildRes.data?.[0];
  if (!build) throw new Error('ビルドが見つからない');

  let group = (await api(`/v1/apps/${APP_ID}/betaGroups?limit=10`)).data?.[0];
  if (group) {
    console.log(`既存グループを使う: ${group.attributes.name} (${group.id})`);
  } else {
    group = (
      await api('/v1/betaGroups', {
        method: 'POST',
        body: {
          data: {
            type: 'betaGroups',
            attributes: { name: 'Internal', isInternalGroup: true },
            relationships: { app: { data: { type: 'apps', id: APP_ID } } },
          },
        },
      })
    ).data;
    console.log(`グループを作成: ${group.id}`);
  }

  await api(`/v1/betaGroups/${group.id}/relationships/builds`, {
    method: 'POST',
    body: { data: [{ type: 'builds', id: build.id }] },
  });
  console.log(`build ${build.attributes.version} を配布対象に追加`);

  const users = await api('/v1/users?limit=10&fields[users]=username,firstName,lastName');
  for (const u of users.data ?? []) {
    try {
      await api('/v1/betaTesters', {
        method: 'POST',
        body: {
          data: {
            type: 'betaTesters',
            attributes: {
              firstName: u.attributes.firstName ?? '',
              lastName: u.attributes.lastName ?? '',
              email: u.attributes.username,
            },
            relationships: { betaGroups: { data: [{ type: 'betaGroups', id: group.id }] } },
          },
        },
      });
      console.log(`テスターに追加: ${u.attributes.username}`);
    } catch (e) {
      console.log(
        `テスター追加をスキップ (${u.attributes.username}): ${String(e.message).split('\n')[0]}`
      );
    }
  }
  console.log('\niPhone の TestFlight アプリを開いて「御朱印さんぽ」を入れる。');
}

// ----------------------------------------------------------------- notes

/**
 * ⚠️ ASC の Notes は 4000 文字が上限。ここを増やすときは必ず長さを確認する
 *    （cmdNotes が超過を弾く）。「About this app」を項目3に畳んであるのはそのため
 */
function notesText(iosVersion) {
  return `=== 2. Devices and OS tested ===

- ${DEVICE_MODEL} running iOS ${iosVersion} (physical device, TestFlight build)
- iPhone 16 simulator (Xcode 26.6)

=== 3. Function, audience, problem solved ===

御朱印さんぽ (Goshuin Sampo) is a personal record-keeping app for goshuin, the
calligraphic seals visitors receive at Japanese shrines and temples. Users
photograph each seal, attach the shrine/temple and visit date, and see their
visits fill in a map of Japan. Audience: goshuin collectors in Japan. The app is
Japanese-language only.

Features (all free; no purchases are offered):
1. Map of about 1,100 shrines and temples (our own master data)
2. Recording a goshuin: photo + spot + visit date + optional memo
3. A digital goshuin book (flip through, or a grid)
4. Stats, badges, and a map of Japan that fills in
5. Visit plans: pick spots for a date; the app suggests an order and can open
   the route in Google Maps (a plain link, no Google SDK)
6. Finding a shrine/temple missing from the database (see 5b)
7. Limited-edition goshuin info from shrines' own websites and Instagram
8. A year-in-review shown in December

After the 3rd, 10th and 30th record the app may show Apple's standard rating
prompt (SKStoreReviewController, at most 3 times a year, never from a button).
There is no custom rating screen. Settings has an "App Store でレビューを書く"
link.

=== 4. How to reach the features ===

Browsing needs no account. Finish the 4 onboarding screens and allow location;
the map shows nearby spots. Tap a pin for details.

Recording and visit plans need an account: tap "+" on the map and sign in with
Apple or Google. Reviewers may use their own Apple ID (private relay is
supported); no demo credentials are needed. Account deletion: "設定" tab ->
"アカウントを削除".

To find a missing shrine: on the record screen, type a name in the spot field,
tap the orange row at the bottom ("…をもっと探す") and choose a region. Limit:
10 searches per account per day.

Outside Japan the map has no spots; please set the location to Japan, e.g.
35.6786, 139.7442 (Tokyo). There are no region-gated features.

=== 5. External services ===

- Supabase: authentication, database, photo storage, server functions.
- Cloudflare R2 / Images: storage, resizing and delivery of photos.
- Sign in with Apple, Google Sign-In: authentication only.
- Anthropic Claude API (claude-haiku-4-5), called only from our server:
  (a) memo text is sent to extract facts (parking, hours, access) shown on the
      spot page; photos and personal identifiers are not sent.
  (b) for a missing-shrine search, the typed name and the region the user chose
      are sent, and Claude uses Anthropic's web search tool to find the address
      and location. Device location is not sent.
  (c) summarising limited-edition announcements on shrine websites.
- Meta Graph API: server-side only, reads public posts of shrines' own public
  Instagram business accounts. No user data is sent to Meta.
- Maps: MapLibre with OpenFreeMap tiles (OpenStreetMap data).
- RevenueCat SDK: included for a possible future optional purchase, but switched
  off in this version: no purchase screen, the SDK is never initialised, and no
  in-app purchase products exist.
No advertising or analytics SDKs.

=== 7. Third-party material / user content ===

Not a regulated industry; no protected third-party material.
- Spot master data is factual public information we compiled.
- Goshuin photos are visible only to the user who took them.
- A user-added missing shrine/temple stores only factual place data found in
  public web sources (name, address, coordinates, source URLs). It can appear on
  other users' maps. Users cannot post free text or photos that others see.
- Limited-edition info is short factual summaries that link to the source.
`;
}

async function cmdNotes(argv) {
  const i = argv.indexOf('--ios');
  const iosVersion = i >= 0 ? argv[i + 1] : null;
  if (!iosVersion) {
    console.error('実機の iOS バージョンが要る（設定 → 一般 → 情報 → システムバージョン）:');
    console.error('  node scripts/asc-review.mjs notes --ios 26.5');
    process.exit(1);
  }
  const text = notesText(iosVersion);
  if (text.length > 4000) {
    console.error(`Notes が ${text.length} 文字。ASC の上限 4000 を超える`);
    process.exit(1);
  }

  const version = await currentVersion();
  const detail = await reviewDetail(version.id);

  const backup = path.join(
    process.env.HOME,
    `asc-notes-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.txt`
  );
  fs.writeFileSync(backup, detail.attributes.notes ?? '');
  console.log(`いまの Notes を退避: ${backup}`);

  await api(`/v1/appStoreReviewDetails/${detail.id}`, {
    method: 'PATCH',
    body: { data: { type: 'appStoreReviewDetails', id: detail.id, attributes: { notes: text } } },
  });
  console.log(`Notes を更新した（${text.length} 文字 / 実機 ${DEVICE_MODEL} iOS ${iosVersion}）`);
}

// ------------------------------------------------------------ attachment

async function cmdAttach(file) {
  if (!file || !fs.existsSync(file)) {
    console.error(`ファイルが無い: ${file}`);
    process.exit(1);
  }
  const bytes = fs.readFileSync(file);
  const fileName = path.basename(file);
  const mb = bytes.length / 1024 / 1024;
  console.log(`${fileName}  ${mb.toFixed(1)} MB`);

  // ⚠️ iPhone の画面収録は 1080p で 3分 ≒ 100MB を超える。ASC の添付は
  //    それを通さないので、大きいときは先に H.264 で潰す
  if (mb > 45) {
    console.error(`\n⚠️ ${mb.toFixed(0)} MB は添付に大きすぎる。先に圧縮する:\n`);
    console.error(
      `  ffmpeg -i "${file}" -vcodec libx264 -crf 30 -preset veryfast -vf "scale=-2:960" \\\n` +
        `    -acodec aac -b:a 64k "${file.replace(/\.[^.]+$/, '')}-small.mp4"\n`
    );
    console.error('画質より「操作が追える」ことが優先。960p でも審査には十分。');
    process.exit(1);
  }

  const version = await currentVersion();
  const detail = await reviewDetail(version.id);

  const created = await api('/v1/appStoreReviewAttachments', {
    method: 'POST',
    body: {
      data: {
        type: 'appStoreReviewAttachments',
        attributes: { fileName, fileSize: bytes.length },
        relationships: {
          appStoreReviewDetail: { data: { type: 'appStoreReviewDetails', id: detail.id } },
        },
      },
    },
  });

  const id = created.data.id;
  const ops = created.data.attributes.uploadOperations ?? [];
  console.log(`予約: ${id}（${ops.length} チャンク）`);

  // ⚠️ 予約だけ残ると ASC 側に中身の無い添付が居座る。途中で失敗したら消す
  try {
    for (const [n, op] of ops.entries()) {
      const headers = Object.fromEntries((op.requestHeaders ?? []).map(h => [h.name, h.value]));
      const res = await fetch(op.url, {
        method: op.method,
        headers,
        body: bytes.subarray(op.offset, op.offset + op.length),
      });
      if (!res.ok)
        throw new Error(`chunk ${n + 1}/${ops.length} -> ${res.status} ${await res.text()}`);
      console.log(`  ${n + 1}/${ops.length} 送信`);
    }
  } catch (e) {
    console.error(`アップロードに失敗したので予約 ${id} を取り消す`);
    await api(`/v1/appStoreReviewAttachments/${id}`, { method: 'DELETE' }).catch(() => {
      console.error(`⚠️ 取り消しにも失敗した。ASC で ${id} を手で消すこと`);
    });
    throw e;
  }

  // ⚠️ commit しないと ASC 側は「予約だけして中身が無い」状態のまま残る
  const md5 = crypto.createHash('md5').update(bytes).digest('hex');
  await api(`/v1/appStoreReviewAttachments/${id}`, {
    method: 'PATCH',
    body: {
      data: {
        type: 'appStoreReviewAttachments',
        id,
        attributes: { uploaded: true, sourceFileChecksum: md5 },
      },
    },
  });
  console.log(`添付完了 ${id}（md5 ${md5}）`);
  console.log('ASC の App Review 情報を開いて、添付が1件見えることを確認する。');
}

async function cmdRmAttachment(id) {
  if (!id) {
    console.error('添付 ID が要る（status で表示される）');
    process.exit(1);
  }
  await api(`/v1/appStoreReviewAttachments/${id}`, { method: 'DELETE' });
  console.log(`削除した: ${id}`);
}

// ------------------------------------------------------------------ main

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'status') await cmdStatus();
  else if (cmd === 'testflight') await cmdTestflight();
  else if (cmd === 'notes') await cmdNotes(rest);
  else if (cmd === 'attach') await cmdAttach(rest[0]);
  else if (cmd === 'rm-attachment') await cmdRmAttachment(rest[0]);
  else {
    console.log(
      '使い方: node scripts/asc-review.mjs <status|testflight|notes --ios X.Y|attach FILE|rm-attachment ID>'
    );
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
