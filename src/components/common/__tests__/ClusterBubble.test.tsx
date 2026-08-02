import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ClusterBubble } from '../ClusterBubble';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';

function getFlattenedStyles(count: number) {
  const { getByTestId } = render(<ClusterBubble count={count} />);
  return {
    bubble: StyleSheet.flatten(getByTestId('cluster-bubble').props.style),
    text: StyleSheet.flatten(getByTestId('cluster-bubble-count').props.style),
    textContent: getByTestId('cluster-bubble-count').props.children,
  };
}

describe('ClusterBubble', () => {
  it('AC-25: count < 10 では 36×36 / borderRadius 18 の正円', () => {
    const { bubble } = getFlattenedStyles(5);
    expect(bubble.width).toBe(36);
    expect(bubble.height).toBe(36);
    expect(bubble.borderRadius).toBe(18);
  });

  it('AC-26: 10 <= count < 100 では 44×44 / 22、100 <= count では 52×52 / 26', () => {
    const medium = getFlattenedStyles(42).bubble;
    expect(medium.width).toBe(44);
    expect(medium.height).toBe(44);
    expect(medium.borderRadius).toBe(22);

    const large = getFlattenedStyles(150).bubble;
    expect(large.width).toBe(52);
    expect(large.height).toBe(52);
    expect(large.borderRadius).toBe(26);
  });

  it('AC-27: 背景 colors.primary[500] / 枠線 colors.white 2.5px', () => {
    const { bubble } = getFlattenedStyles(5);
    expect(bubble.backgroundColor).toBe(colors.primary[500]);
    expect(bubble.borderColor).toBe(colors.white);
    expect(bubble.borderWidth).toBe(2.5);
  });

  it('AC-28: 件数テキストが白・typography.label サイズ・fontWeight 700', () => {
    const { text, textContent } = getFlattenedStyles(42);
    expect(textContent).toBe('42');
    expect(text.color).toBe(colors.white);
    expect(text.fontSize).toBe(typography.label.fontSize);
    expect(text.fontWeight).toBe('700');
  });
});
