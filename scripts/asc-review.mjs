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

- ${DEVICE_MODEL} running iOS ${iosVersion}  (physical device)
- iPhone 16 Plus simulator running iOS 26.5 (Xcode 26.6)

=== 3. Function, target audience, and the problem it solves ===

御朱印さんぽ (Goshuin Sampo) is a personal record-keeping app for goshuin —
the calligraphic seals visitors receive at Japanese shrines and temples.

Collectors keep goshuin in paper books and lose track of where and when they
visited. This app lets them photograph each seal, attach the shrine/temple and
the visit date, and see their visits accumulate on a map.

Target audience: people in Japan who visit shrines and temples and collect
goshuin. The app is Japanese-language only.

Core features (all free, no purchases of any kind):
1. Map of shrines and temples (about 1,100 spots nationwide, our own master data)
2. Recording a goshuin: one photo + spot + visit date + optional memo
3. A digital goshuin book that you flip through
4. Collection stats and badges
5. "Limited-edition goshuin" information gathered from each shrine's own website
   and public Instagram account

=== 4. How to set up and reach the main features ===

No account is required to browse. Launch the app, complete the 4 onboarding
screens, and allow location access when prompted — the map then shows shrines
and temples near you. Tapping a pin opens a sheet; tapping its handle expands
it to show limited-edition goshuin information.

An account is required only to record a goshuin. Tap the "+" button on the map
and sign in with Sign in with Apple or Google. Reviewers may use their own
Apple ID; the private email relay is supported, and no demo credentials are
needed. Account deletion is at "自分" (Me) tab -> "アカウントを削除".

The app is built for Japan. Outside Japan the map shows no spots, so please set
the location to Japan — for example 35.6786, 139.7442 (central Tokyo).

=== 5. External services used ===

- Supabase (supabase.com) — authentication, PostgreSQL database, file storage
  for goshuin photos, and serverless functions.
- Sign in with Apple, and Google Sign-In — authentication only.
- Anthropic Claude API (api.anthropic.com, claude-haiku-4-5) — when a user writes
  a free-text memo on a record, the memo text is sent to Claude to extract
  structured facts (parking, reception hours, access notes) shown on the spot
  page. Only the memo text is sent; photos and personal identifiers are not. The
  same API summarises limited-edition announcements found on shrine websites.
- Meta Graph API (graph.facebook.com) — server-side only, reads public posts from
  shrines' own public Instagram business accounts to surface limited-edition
  goshuin announcements. No user data is sent to Meta.
- Apple Maps (MapKit via react-native-maps) — map rendering.

There are no payment processors, no advertising SDKs, and no analytics SDKs.

=== 6. Regional differences ===

The app behaves identically in all regions; there are no region-gated features.
The content is Japan-specific: the spot database covers Japanese shrines and
temples only, and the interface is Japanese-language only. Outside Japan the app
runs normally but the map contains no spots.

=== 7. Regulated industry / third-party material ===

The app is not part of a regulated industry and contains no protected
third-party material.

- The shrine and temple master data is factual public information (name, address,
  coordinates, category) that we compiled ourselves.
- Goshuin photographs are taken and uploaded by the user and are visible only to
  the user who created them. The app does not display any other user's content.
- Limited-edition goshuin information consists of short factual summaries of
  announcements each shrine publishes on its own website or public Instagram
  account, and each item links back to the original source.
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
