import React from 'react';
import { render, fireEvent, within, act } from '@testing-library/react-native';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ViewModeToggle } from '@components/gallery/ViewModeToggle';
import { colors } from '@theme/colors';
import { borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

const flatten = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;

/** 描いた値を読む。ノードならその値、値そのものならそれ。回転は数にする */
const read = (value: unknown): number => {
  const v =
    value && typeof value === 'object' && '__getValue' in value
      ? (value as { __getValue: () => unknown }).__getValue()
      : value;
  return typeof v === 'string' ? parseFloat(v) : (v as number);
};

type TransformEntry = Record<string, unknown>;
const transformOf = (node: { props: { style?: unknown } }) =>
  (flatten(node).transform ?? []) as TransformEntry[];
const transformValue = (node: { props: { style?: unknown } }, key: string) =>
  read(transformOf(node).find(t => key in t)?.[key]);

const TILE_IDS = [0, 1, 2, 3].map(i => `view-mode-grid-icon-tile-${i}`);
const BOOK_IDS = [
  'view-mode-flip-icon-spine',
  'view-mode-flip-icon-page-right',
  'view-mode-flip-icon-page-left',
];

describe('ViewModeToggle', () => {
  it('2つのボタンを描画する', () => {
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    expect(getByTestId('view-mode-toggle')).toBeTruthy();
    expect(getByTestId('view-mode-flip')).toBeTruthy();
    expect(getByTestId('view-mode-grid')).toBeTruthy();
  });

  it('グリッドを押すと onChange が grid で呼ばれる', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={onChange} />);
    fireEvent.press(getByTestId('view-mode-grid'));
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('めくりを押すと onChange が flip で呼ばれる', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<ViewModeToggle mode="grid" onChange={onChange} />);
    fireEvent.press(getByTestId('view-mode-flip'));
    expect(onChange).toHaveBeenCalledWith('flip');
  });

  // 組み立てたアイコンの色は backgroundColor で持つ（Issue #276 AC-4）
  it('選択中のアイコンが primary[500]、未選択が gray[400] である（flip 選択時）', () => {
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    for (const id of BOOK_IDS) {
      expect(flatten(getByTestId(id)).backgroundColor).toBe(colors.primary[500]);
    }
    for (const id of TILE_IDS) {
      expect(flatten(getByTestId(id)).backgroundColor).toBe(colors.gray[400]);
    }
  });

  it('選択中のアイコンが primary[500]、未選択が gray[400] である（grid 選択時）', () => {
    const { getByTestId } = render(<ViewModeToggle mode="grid" onChange={jest.fn()} />);
    for (const id of TILE_IDS) {
      expect(flatten(getByTestId(id)).backgroundColor).toBe(colors.primary[500]);
    }
    for (const id of BOOK_IDS) {
      expect(flatten(getByTestId(id)).backgroundColor).toBe(colors.gray[400]);
    }
  });

  // 押す所は 44 × 38 で、上下 3 の hitSlop を足して 44 × 44（Issue #276 AC-2）
  it('各ボタンのタップ領域が 44pt 以上である', () => {
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    for (const id of ['view-mode-flip', 'view-mode-grid']) {
      const node = getByTestId(id);
      const style = flatten(node);
      expect(style.width).toBe(44);
      expect(style.height).toBe(38);
      expect(node.props.hitSlop).toEqual(expect.objectContaining({ top: 3, bottom: 3 }));
    }
  });

  it('選択中のボタンに accessibilityState.selected が立つ', () => {
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    expect(getByTestId('view-mode-flip').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('view-mode-grid').props.accessibilityState.selected).toBe(false);
  });
});

describe('ViewModeToggle の形（Issue #276）', () => {
  it('台の中に白い台と2つの押す所があり、アイコンは組み立てた部品（AC-1）', () => {
    const utils = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    const toggle = within(utils.getByTestId('view-mode-toggle'));
    expect(toggle.getByTestId('view-mode-thumb')).toBeTruthy();
    expect(toggle.getByTestId('view-mode-flip')).toBeTruthy();
    expect(toggle.getByTestId('view-mode-grid')).toBeTruthy();

    const flipIcon = within(utils.getByTestId('view-mode-flip')).getByTestId('view-mode-flip-icon');
    expect(
      within(flipIcon)
        .getAllByTestId(/^view-mode-flip-icon-/)
        .map(el => el.props.testID)
    ).toEqual(BOOK_IDS);

    const gridIcon = within(utils.getByTestId('view-mode-grid')).getByTestId('view-mode-grid-icon');
    expect(
      within(gridIcon)
        .getAllByTestId(/^view-mode-grid-icon-/)
        .map(el => el.props.testID)
    ).toEqual(TILE_IDS);

    expect(utils.UNSAFE_queryAllByType(MaterialIcons)).toHaveLength(0);
  });

  it('台・白い台・押す所の寸法と色（AC-2）', () => {
    const utils = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    expect(flatten(utils.getByTestId('view-mode-toggle'))).toEqual(
      expect.objectContaining({
        flexDirection: 'row',
        padding: 3,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.gray[100],
      })
    );

    const thumb = flatten(utils.getByTestId('view-mode-thumb'));
    expect(thumb).toEqual(
      expect.objectContaining({
        position: 'absolute',
        top: 3,
        left: 3,
        width: 44,
        height: 38,
        borderRadius: 9,
        backgroundColor: colors.white,
      })
    );
    for (const [key, value] of Object.entries(shadows.toggleThumb)) {
      expect(thumb[key]).toEqual(value);
    }

    for (const id of ['view-mode-flip', 'view-mode-grid']) {
      const node = utils.getByTestId(id);
      expect(flatten(node)).toEqual(expect.objectContaining({ width: 44, height: 38 }));
      expect(node.props.hitSlop.top).toBe(3);
      expect(node.props.hitSlop.bottom).toBe(3);
    }
    const touchables = utils.UNSAFE_getAllByType(TouchableOpacity);
    expect(touchables).toHaveLength(2);
    touchables.forEach(t => expect(t.props.activeOpacity).toBe(1));
  });

  it('本と4枚のタイルの形（AC-3）', () => {
    const { getByTestId } = render(<ViewModeToggle mode="flip" onChange={jest.fn()} />);
    for (const id of ['view-mode-flip-icon', 'view-mode-grid-icon']) {
      expect(flatten(getByTestId(id))).toEqual(expect.objectContaining({ width: 24, height: 24 }));
    }

    const page = { position: 'absolute', top: 5, width: 10, height: 14, borderRadius: 1.5 };
    const left = getByTestId('view-mode-flip-icon-page-left');
    expect(flatten(left)).toEqual(expect.objectContaining({ ...page, left: 1.5 }));
    expect(flatten(getByTestId('view-mode-flip-icon-page-right'))).toEqual(
      expect.objectContaining({ ...page, left: 12.5 })
    );
    expect(flatten(getByTestId('view-mode-flip-icon-spine'))).toEqual(
      expect.objectContaining({
        position: 'absolute',
        left: 11.5,
        top: 4,
        width: 1,
        height: 16,
        opacity: 0.5,
      })
    );

    const transform = transformOf(left);
    expect(transform.map(t => Object.keys(t)[0])).toEqual([
      'perspective',
      'translateX',
      'rotateY',
      'translateX',
    ]);
    expect(transform[0].perspective).toBe(120);
    expect(transform[1].translateX).toBe(5);
    expect(read(transform[2].rotateY)).toBe(0);
    expect(transform[3].translateX).toBe(-5);

    const positions = [
      [2.5, 2.5],
      [12.5, 2.5],
      [2.5, 12.5],
      [12.5, 12.5],
    ];
    TILE_IDS.forEach((id, i) => {
      const tile = getByTestId(id);
      expect(flatten(tile)).toEqual(
        expect.objectContaining({
          width: 9,
          height: 9,
          borderRadius: 2,
          left: positions[i][0],
          top: positions[i][1],
        })
      );
      expect(transformValue(tile, 'scale')).toBe(1);
    });
  });
});

describe('ViewModeToggle の動き（Issue #276）', () => {
  type Stub = { start: jest.Mock; stop: jest.Mock; reset: jest.Mock };
  let timingSpy: jest.SpyInstance;
  let calls: { value: unknown; config: Animated.TimingAnimationConfig; anim: Stub }[];

  beforeEach(() => {
    calls = [];
    timingSpy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      const anim: Stub = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
      calls.push({ value, config, anim });
      return anim as unknown as Animated.CompositeAnimation;
    });
  });

  afterEach(() => {
    timingSpy.mockRestore();
  });

  const thumbX = (utils: ReturnType<typeof render>) =>
    transformValue(utils.getByTestId('view-mode-thumb'), 'translateX');
  const tileScales = (utils: ReturnType<typeof render>) =>
    TILE_IDS.map(id => transformValue(utils.getByTestId(id), 'scale'));
  const pageLeftRotate = (utils: ReturnType<typeof render>) =>
    transformValue(utils.getByTestId('view-mode-flip-icon-page-left'), 'rotateY');
  /** timing に渡された値を動かすと、その部品の描いた値が変わる（= その部品の値） */
  const drive = (value: unknown, to: number) => act(() => (value as Animated.Value).setValue(to));

  it('外から mode が変わったら、白い台をその場に置くだけで動かさない（AC-5）', () => {
    const onChange = jest.fn();
    const utils = render(<ViewModeToggle mode="flip" onChange={onChange} />);
    expect(thumbX(utils)).toBe(0);

    utils.rerender(<ViewModeToggle mode="grid" onChange={onChange} />);
    expect(thumbX(utils)).toBe(44);
    expect(timingSpy).not.toHaveBeenCalled();
    expect(tileScales(utils)).toEqual([1, 1, 1, 1]);

    utils.rerender(<ViewModeToggle mode="flip" onChange={onChange} />);
    expect(thumbX(utils)).toBe(0);
  });

  it('一覧を押すと、白い台がばねで移り、タイルが1枚ずつ飛び出す（AC-6）', () => {
    const onChange = jest.fn();
    const utils = render(<ViewModeToggle mode="flip" onChange={onChange} />);

    fireEvent.press(utils.getByTestId('view-mode-grid'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('grid');

    const slides = calls.filter(c => c.config.duration === 520);
    expect(slides).toHaveLength(1);
    expect(slides[0].config).toEqual(
      expect.objectContaining({ toValue: 44, duration: 520, useNativeDriver: true })
    );
    expect(slides[0].config.easing?.(0.25)).toBeCloseTo(1.141831, 6);
    expect(slides[0].config.easing?.(1)).toBe(1);
    expect(slides[0].anim.start).toHaveBeenCalledTimes(1);

    const pops = calls.filter(c => c.config.duration === 260);
    expect(pops).toHaveLength(4);
    expect(pops.map(c => c.config.delay)).toEqual([0, 70, 140, 210]);
    pops.forEach(c => {
      expect(c.config).toEqual(expect.objectContaining({ toValue: 1, useNativeDriver: true }));
      expect(c.config.easing?.(0)).toBeCloseTo(0.1, 6);
      expect(c.config.easing?.(0.5)).toBeCloseTo(1.093633, 6);
      expect(c.config.easing?.(1)).toBeCloseTo(1, 6);
      expect(c.anim.start).toHaveBeenCalledTimes(1);
    });
    // 押した直後（スタブは動かない）はどのタイルも 0
    expect(tileScales(utils)).toEqual([0, 0, 0, 0]);
    expect(calls.filter(c => c.config.duration === 600)).toHaveLength(0);
    expect(calls).toHaveLength(5);

    // 第1引数は、白い台の translateX と、4枚のタイルそれぞれの scale の値
    drive(slides[0].value, 22);
    expect(thumbX(utils)).toBe(22);
    pops.forEach((c, i) => drive(c.value, 0.5 + i / 10));
    expect(tileScales(utils)).toEqual([0.5, 0.6, 0.7, 0.8]);
  });

  it('めくるを押すと、白い台が戻り、本が開く（AC-7）', () => {
    const onChange = jest.fn();
    const utils = render(<ViewModeToggle mode="grid" onChange={onChange} />);

    fireEvent.press(utils.getByTestId('view-mode-flip'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('flip');

    const slides = calls.filter(c => c.config.duration === 520);
    expect(slides).toHaveLength(1);
    expect(slides[0].config).toEqual(
      expect.objectContaining({ toValue: 0, duration: 520, useNativeDriver: true })
    );
    expect(slides[0].config.easing?.(0.25)).toBeCloseTo(1.141831, 6);

    const books = calls.filter(c => c.config.duration === 600);
    expect(books).toHaveLength(1);
    expect(books[0].config).toEqual(
      expect.objectContaining({ toValue: 1, duration: 600, useNativeDriver: true })
    );
    expect(books[0].config.easing?.(0.5)).toBeCloseTo(0.875, 6);
    expect(books[0].anim.start).toHaveBeenCalledTimes(1);

    expect(pageLeftRotate(utils)).toBeCloseTo(179.9, 3);
    expect(calls.filter(c => c.config.duration === 260)).toHaveLength(0);
  });

  it('選んでいる方を押しても、locked のときも、何もしない（AC-8）', () => {
    const onChange = jest.fn();
    const utils = render(<ViewModeToggle mode="flip" onChange={onChange} />);
    fireEvent.press(utils.getByTestId('view-mode-flip'));

    utils.rerender(<ViewModeToggle mode="flip" onChange={onChange} locked />);
    fireEvent.press(utils.getByTestId('view-mode-grid'));

    expect(onChange).not.toHaveBeenCalled();
    expect(timingSpy).not.toHaveBeenCalled();
    expect(thumbX(utils)).toBe(0);
  });

  it('視差効果を減らす がオンなら、白い台はその場で移り、アイコンは動かない（AC-9）', () => {
    const onChange = jest.fn();
    const utils = render(<ViewModeToggle mode="flip" onChange={onChange} reduceMotion />);

    fireEvent.press(utils.getByTestId('view-mode-grid'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('grid');
    expect(timingSpy).not.toHaveBeenCalled();

    utils.rerender(<ViewModeToggle mode="grid" onChange={onChange} reduceMotion />);
    expect(thumbX(utils)).toBe(44);
    expect(tileScales(utils)).toEqual([1, 1, 1, 1]);

    fireEvent.press(utils.getByTestId('view-mode-flip'));
    expect(pageLeftRotate(utils)).toBe(0);
    expect(timingSpy).not.toHaveBeenCalled();
  });

  it('動いている途中で押し直すと、選ばれなくなったアイコンを静止の形に戻す（AC-10）', () => {
    const onChange = jest.fn();
    const utils = render(<ViewModeToggle mode="flip" onChange={onChange} />);
    fireEvent.press(utils.getByTestId('view-mode-grid'));
    utils.rerender(<ViewModeToggle mode="grid" onChange={onChange} />);
    const pops = calls.filter(c => c.config.duration === 260);
    expect(pops).toHaveLength(4);

    fireEvent.press(utils.getByTestId('view-mode-flip'));

    pops.forEach(c => expect(c.anim.stop.mock.calls.length).toBeGreaterThanOrEqual(1));
    expect(tileScales(utils)).toEqual([1, 1, 1, 1]);
    expect(calls.filter(c => c.config.duration === 600)).toHaveLength(1);
  });
});
