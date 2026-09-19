import { AccessibilityInfo } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useMountTransition } from '@hooks/useMountTransition';

const OPEN_MS = 180;
const CLOSE_MS = 130;
const options = { openMs: OPEN_MS, closeMs: CLOSE_MS };

describe('useMountTransition', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('閉じているうちは描かない', () => {
    const { result } = renderHook(() => useMountTransition(false, options));

    expect(result.current.mounted).toBe(false);
  });

  it('開くと即座に描き始める。出るところを見せるため', () => {
    const { result, rerender } = renderHook(({ open }) => useMountTransition(open, options), {
      initialProps: { open: false },
    });

    rerender({ open: true });

    expect(result.current.mounted).toBe(true);
  });

  it('閉じてもモーションの間は描き続け、終わってから外す', () => {
    jest.useFakeTimers();
    try {
      const { result, rerender } = renderHook(({ open }) => useMountTransition(open, options), {
        initialProps: { open: true },
      });
      expect(result.current.mounted).toBe(true);

      rerender({ open: false });
      expect(result.current.mounted).toBe(true);

      act(() => {
        jest.advanceTimersByTime(CLOSE_MS + 100);
      });

      expect(result.current.mounted).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('「視差効果を減らす」がオンなら待たずに外す', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { result, rerender } = renderHook(({ open }) => useMountTransition(open, options), {
      initialProps: { open: true },
    });
    // isReduceMotionEnabled() の解決を待つ
    await act(async () => {});

    rerender({ open: false });

    expect(result.current.mounted).toBe(false);
  });
});
