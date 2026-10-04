import React, { useRef, useState } from 'react';
import { Dimensions, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { colors } from '@theme/colors';
import { borderRadius, spacing } from '@theme/spacing';
import { typography } from '@theme/typography';
import type { SpotPhoto } from '@/types/supabase';

/* ── 値は試作（オーナーが実機で OK を出した preview/302-photo-band）のまま ── */

/** ⓘ の丸の大きさ・上の端からの位置・押せる範囲の広げ */
const BUTTON_SIZE = 22;
const BUTTON_TOP = 2;
const BUTTON_HIT_SLOP = 12;
const ICON_SIZE = 16;
/** 吹き出し（試作 `.pop`）の左の位置・幅・左右の余白・影 */
const POPOVER_LEFT = 10;
const POPOVER_WIDTH = 292;
const POPOVER_PADDING_X = 14;
const POPOVER_SHADOW_OFFSET_Y = 3;
const POPOVER_SHADOW_OPACITY = 0.22;
const POPOVER_SHADOW_RADIUS = 12;
const POPOVER_ELEVATION = 8;
/** 行（見出し 64 と値） */
const ROW_GAP = 10;
const ROW_MARGIN_BOTTOM = 6;
const KEY_WIDTH = 64;
const TEXT_SIZE = 13;
const TEXT_LINE_HEIGHT = 20;
/** リンクの右の open-in-new */
const LINK_ICON_SIZE = 14;
const LINK_GAP = 3;
const LINK_HIT_SLOP = 6;
const NOTE_MARGIN_TOP = 2;

interface Props {
  photo: SpotPhoto;
  /** 視差効果を減らす（シートで1回読んだ値） */
  reduceMotion: boolean;
}

/**
 * 帯の写真の撮影者とライセンス（Issue #302 D-14）。帯の左下（名前の行の上）の小さな ⓘ を押すと、
 * ⓘ の上に吹き出しで 撮影・ライセンス・元の写真・トリミングの注記 を出す。ほかの所を押すと閉じる。
 *
 * 吹き出しの位置は ⓘ の measureInWindow で決める。測れるまでは透明で描く
 * （開いたことと中身は押した描画で決まり、位置だけが後から付く）
 */
export function SpotPhotoCredit({ photo, reduceMotion }: Props) {
  const buttonRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchorY, setAnchorY] = useState<number | null>(null);

  const show = () => {
    setOpen(true);
    setAnchorY(null);
    buttonRef.current?.measureInWindow((_x, y) => setAnchorY(y));
  };
  const close = () => {
    setOpen(false);
    setAnchorY(null);
  };
  const placement =
    anchorY === null
      ? styles.unmeasured
      : { bottom: Dimensions.get('window').height - anchorY + spacing.sm };

  return (
    <>
      <Pressable
        ref={buttonRef}
        testID="spot-photo-credit"
        accessibilityRole="button"
        accessibilityLabel="写真の撮影者とライセンス"
        hitSlop={BUTTON_HIT_SLOP}
        onPress={show}
        style={[styles.button, open && styles.buttonOn]}
      >
        <MaterialIcons name="info-outline" size={ICON_SIZE} color={colors.white} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={close}
      >
        <Pressable
          testID="spot-photo-credit-backdrop"
          style={StyleSheet.absoluteFill}
          onPress={close}
        >
          {open && (
            <View testID="spot-photo-credit-popover" style={[styles.popover, placement]}>
              <Row label="撮影">
                <Text style={styles.value}>{photo.author ?? '不明'}</Text>
              </Row>
              <Row label="ライセンス">
                <Link url={photo.licenseUrl} testID="spot-photo-credit-license-link">
                  {photo.license}
                </Link>
              </Row>
              <Row label="元の写真">
                <Link url={photo.sourceUrl} testID="spot-photo-credit-source-link">
                  Wikimedia Commons
                </Link>
              </Row>
              {photo.isCropped && <Text style={styles.note}>帯に合わせてトリミングしています</Text>}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{label}</Text>
      <View style={styles.valueBox}>{children}</View>
    </View>
  );
}

/** URL があればブラウザで開くリンク。無ければ文字だけ */
function Link({
  url,
  testID,
  children,
}: {
  url: string | null;
  testID: string;
  children: React.ReactNode;
}) {
  if (!url) return <Text style={styles.value}>{children}</Text>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
      style={styles.link}
      hitSlop={LINK_HIT_SLOP}
    >
      <Text style={[styles.value, styles.linkText]}>{children}</Text>
      <MaterialIcons name="open-in-new" size={LINK_ICON_SIZE} color={colors.primary[500]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: BUTTON_TOP,
    left: spacing.md,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.spotHeroPhoto.credit,
  },
  buttonOn: {
    backgroundColor: colors.spotHeroPhoto.creditOn,
  },
  popover: {
    position: 'absolute',
    left: POPOVER_LEFT,
    width: POPOVER_WIDTH,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: POPOVER_PADDING_X,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: POPOVER_SHADOW_OFFSET_Y },
    shadowOpacity: POPOVER_SHADOW_OPACITY,
    shadowRadius: POPOVER_SHADOW_RADIUS,
    elevation: POPOVER_ELEVATION,
  },
  // 位置を測れるまで
  unmeasured: {
    opacity: 0,
  },
  row: {
    flexDirection: 'row',
    gap: ROW_GAP,
    marginBottom: ROW_MARGIN_BOTTOM,
  },
  key: {
    ...typography.caption,
    width: KEY_WIDTH,
    fontSize: TEXT_SIZE,
    lineHeight: TEXT_LINE_HEIGHT,
    color: colors.gray[500],
  },
  valueBox: {
    flex: 1,
    minWidth: 0,
  },
  value: {
    fontSize: TEXT_SIZE,
    lineHeight: TEXT_LINE_HEIGHT,
    fontWeight: '600',
    color: colors.gray[800],
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LINK_GAP,
  },
  linkText: {
    color: colors.primary[500],
  },
  note: {
    ...typography.caption,
    color: colors.gray[500],
    marginTop: NOTE_MARGIN_TOP,
  },
});
