import React from 'react';
import { render } from '@testing-library/react-native';
import { G, Path, Svg } from 'react-native-svg';

import { PrefectureEmboss } from '@components/common/PrefectureEmboss';
import { JAPAN_PREFECTURE_PATHS } from '@/constants/japanMap';
import { colors } from '@theme/colors';

type Found = { props: Record<string, unknown>; findAllByType: (t: unknown) => Found[] };

describe('PrefectureEmboss（県の空押し。#327）', () => {
  it('AC-16: 影（左上）→ 光（右下）→ 面の 3 枚を、その県の形で重ねる', () => {
    const r = render(
      <Svg viewBox="0 0 1000 1132">
        <PrefectureEmboss prefecture="京都府" offset={8} shadeOpacity={0.45} />
      </Svg>
    );
    // Svg は中で G を 1 つ描くので、空押しの部品の下の G だけを数える
    const groups = r.UNSAFE_getByType(PrefectureEmboss).findAllByType(G);

    expect(groups).toHaveLength(3);
    expect(groups[0].props).toEqual(
      expect.objectContaining({ fill: colors.gray[600], opacity: 0.45, x: -8, y: -8 })
    );
    expect(groups[1].props).toEqual(
      expect.objectContaining({ fill: colors.white, opacity: 0.9, x: 8, y: 8 })
    );
    expect(groups[2].props).toEqual(expect.objectContaining({ fill: colors.sealEmpty }));
    expect(groups[2].props).not.toHaveProperty('opacity');
    expect(groups[2].props).not.toHaveProperty('x');
    expect(groups[2].props).not.toHaveProperty('y');

    groups.forEach((g: Found) => {
      const paths = g.findAllByType(Path);
      expect(paths).toHaveLength(1);
      expect(paths[0].props.d).toBe(JAPAN_PREFECTURE_PATHS['京都府']);
    });
  });
});
