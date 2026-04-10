import React from 'react';
import { render } from '@testing-library/react-native';
import { ToriiIcon } from '@components/animated/ToriiIcon';
import { SplashAnimation } from '@components/animated/SplashAnimation';

describe('ToriiIcon', () => {
  it('renders', () => {
    const { getByTestId } = render(<ToriiIcon />);
    expect(getByTestId('torii-icon')).toBeTruthy();
  });

  it('renders with custom size', () => {
    const { getByTestId } = render(<ToriiIcon size={120} />);
    expect(getByTestId('torii-icon')).toBeTruthy();
  });
});

describe('SplashAnimation', () => {
  it('renders', () => {
    const { getByTestId } = render(<SplashAnimation onAnimationComplete={() => {}} />);
    expect(getByTestId('splash-animation')).toBeTruthy();
  });

  it('contains torii icon', () => {
    const { getByTestId } = render(<SplashAnimation onAnimationComplete={() => {}} />);
    expect(getByTestId('torii-icon')).toBeTruthy();
  });

  it('contains app name text', () => {
    const { getByText } = render(<SplashAnimation onAnimationComplete={() => {}} />);
    expect(getByText('御朱印めぐり')).toBeTruthy();
  });

  it('contains gradient background', () => {
    const { getByTestId } = render(<SplashAnimation onAnimationComplete={() => {}} />);
    expect(getByTestId('splash-gradient')).toBeTruthy();
  });
});
