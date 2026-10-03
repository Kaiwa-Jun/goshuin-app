import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors } from '@theme/colors';
import { sceneCopy, type AnnualReport } from '@utils/annualReport';

import { fade, tween, tweenText, type Clock } from '../motion';
import { ReportPhoto } from '../ReportPhoto';
import { sceneStyles } from '../sceneStyles';

interface Props {
  report: AnnualReport;
  clock: Clock;
}

const PHOTO_W = 66;
const PHOTO_H = 88;
const GAP = 10;
const COLUMNS = 4;
/** 写真ごとの傾き（並んだあとも少し傾いたまま。試作の rots） */
const TILTS = [-3, 2, -1, 3, -2, 1];
/** 「ほか」: 16枚が落ちきったあと（250 + 16 × 150 + 200） */
const MORE_DELAY = 2850;

/** シーン5 御朱印の写真（5400ms・3枚以上）。1枚ずつ落ちてきてコラージュになる */
export function PhotosScene({ report, clock }: Props) {
  const { total, shown } = report.photos;
  const copy = sceneCopy(report.year, report.isCurrentYear);
  const rest = total - shown.length;

  return (
    <View>
      <Text style={sceneStyles.kick}>{copy.photosKick}</Text>
      <Text style={[sceneStyles.big, styles.total]}>{`${total} 枚`}</Text>

      <View style={styles.grid}>
        {shown.map((photo, i) => {
          const start = 250 + i * 150;
          const from = (i % 2 === 1 ? 1 : -1) * (6 + (i % 4));
          return (
            <Animated.View
              key={photo.id}
              testID={`annual-photo-${i}`}
              style={[
                styles.photo,
                {
                  opacity: tween(clock, start, 520, 0, 1),
                  transform: [
                    { translateY: tween(clock, start, 520, -60, 0) },
                    { rotate: tweenText(clock, start, 520, `${from}deg`, '0deg') },
                    { scale: tween(clock, start, 520, 1.15, 1) },
                  ],
                },
              ]}
            >
              <View
                style={[styles.fill, { transform: [{ rotate: `${TILTS[i % TILTS.length]}deg` }] }]}
              >
                <ReportPhoto imagePath={photo.imagePath} variant="thumb" style={styles.fill} />
              </View>
            </Animated.View>
          );
        })}
      </View>

      {rest > 0 && (
        <Animated.Text
          testID="annual-photos-more"
          style={[styles.more, fade(clock, MORE_DELAY, 500)]}
        >
          {`ほか ${rest} 枚`}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  total: { marginTop: 6 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    width: COLUMNS * PHOTO_W + (COLUMNS - 1) * GAP,
    alignSelf: 'center',
    marginTop: 18,
  },
  photo: { width: PHOTO_W, height: PHOTO_H },
  fill: { width: '100%', height: '100%' },
  more: {
    fontSize: 13,
    color: colors.washiSub,
    textAlign: 'center',
    marginTop: 14,
  },
});
