#!/usr/bin/env node
/**
 * react-native-maps の AIRMap.m にクラッシュ止めを当てる（postinstall で自動実行）。
 *
 * 症状: 地図をパン／ピンチしている最中にアプリが落ちる（build 14 / 2026-09-19 の実機録画 0:49）。
 *   NSRangeException *** -[__NSArrayM insertObject:atIndex:]: index 3 beyond bounds [0 .. 1]
 *   -[RCTLegacyViewManagerInteropComponentView finalizeUpdates:] → AIRMap insertReactSubview
 *
 * 原因: react-native-maps 1.20.1 は iOS が全部 legacy view manager（codegenConfig なし）なので、
 *   New Architecture では RCTLegacyViewManagerInteropComponentView 経由でマウントされる。
 *   この interop は insert を finalizeUpdates まで遅延させるため、1トランザクションに
 *   「複数のマーカー削除 + 挿入」が入ると atIndex が現在の要素数を超えて渡ってくる。
 *   クラスタの再計算（onRegionChangeComplete → useSpotClusters）がまさにその形。
 *   upstream 未修正（1.29.2 でも同じ行のまま）: react-native-maps#5345 / #5080 / expo#34614
 *
 * 対処: 範囲に丸めて nil を弾く。マーカーの表示位置は addAnnotation 側で決まるので、
 *   _reactSubviews の並び順が変わっても見た目には影響しない。
 */
import fs from 'node:fs';

const FILE = 'node_modules/react-native-maps/ios/AirMaps/AIRMap.m';
const TARGET = '    [_reactSubviews insertObject:(UIView *)subview atIndex:(NSUInteger) atIndex];';
const PATCHED = `    // goshuin patch (scripts/patch-airmap.mjs): interop が範囲外の atIndex を渡してくると
    // NSRangeException でアプリごと落ちるため、範囲に丸める。詳細はスクリプトの先頭コメント。
    if (subview != nil) {
        [_reactSubviews insertObject:(UIView *)subview
                             atIndex:MIN((NSUInteger) atIndex, _reactSubviews.count)];
    }`;

// react-native-maps を入れていない環境（依存を外した／install 前）では何もしない。
// 入っているのに当てられない場合だけ落とす（黙って通すとクラッシュするビルドが出るため）。
if (!fs.existsSync('node_modules/react-native-maps')) {
  console.log('patch-airmap: react-native-maps が無いのでスキップ');
  process.exit(0);
}

if (!fs.existsSync(FILE)) {
  console.error(`patch-airmap: ${FILE} が無い。react-native-maps の構成が変わった可能性がある`);
  process.exit(1);
}

const source = fs.readFileSync(FILE, 'utf8');

if (source.includes('goshuin patch')) {
  console.log('patch-airmap: 適用済み');
  process.exit(0);
}

if (!source.includes(TARGET)) {
  console.error(
    `patch-airmap: 当てる行が見つからない（${FILE}）。\n` +
      'react-native-maps を上げたなら、クラッシュが直っているか確認してこのスクリプトを更新する。'
  );
  process.exit(1);
}

fs.writeFileSync(FILE, source.replace(TARGET, PATCHED));
console.log('patch-airmap: AIRMap.m にクラッシュ止めを適用した');
