import React from 'react';
import { render } from '@testing-library/react-native';
import { FABButton } from '@components/animated/FABButton';
import { CheckmarkAnimation } from '@components/animated/CheckmarkAnimation';
import { BadgeAnimation } from '@components/animated/BadgeAnimation';
import { OnboardingIcon } from '@components/animated/OnboardingIcon';
import { ErrorIcon } from '@components/animated/ErrorIcon';

describe('Animated Components', () => {
  describe('FABButton', () => {
    it('renders', () => {
      const { getByTestId } = render(<FABButton onPress={() => {}} />);
      expect(getByTestId('fab-button')).toBeTruthy();
    });
  });

  describe('CheckmarkAnimation', () => {
    it('renders', () => {
      const { getByTestId } = render(<CheckmarkAnimation />);
      expect(getByTestId('checkmark-animation')).toBeTruthy();
    });

    it('renders with custom size', () => {
      const { getByTestId } = render(<CheckmarkAnimation size={120} />);
      expect(getByTestId('checkmark-animation')).toBeTruthy();
    });
  });

  describe('BadgeAnimation', () => {
    it('renders with badge name', () => {
      const { getByTestId, getByText } = render(<BadgeAnimation badgeName="初めての参拝" />);
      expect(getByTestId('badge-animation')).toBeTruthy();
      expect(getByText('初めての参拝')).toBeTruthy();
    });

    it('renders with description', () => {
      const { getByText } = render(
        <BadgeAnimation badgeName="初めての参拝" description="最初の御朱印を記録しました" />
      );
      expect(getByText('最初の御朱印を記録しました')).toBeTruthy();
    });
  });

  describe('OnboardingIcon', () => {
    it('renders', () => {
      const { getByTestId } = render(<OnboardingIcon name="map" backgroundColor="#F97316" />);
      expect(getByTestId('onboarding-icon')).toBeTruthy();
    });
  });

  describe('ErrorIcon', () => {
    it('renders network error icon', () => {
      const { getByTestId } = render(<ErrorIcon type="network" />);
      expect(getByTestId('error-icon-network')).toBeTruthy();
    });

    it('renders location error icon', () => {
      const { getByTestId } = render(<ErrorIcon type="location" />);
      expect(getByTestId('error-icon-location')).toBeTruthy();
    });

    it('renders upload error icon', () => {
      const { getByTestId } = render(<ErrorIcon type="upload" />);
      expect(getByTestId('error-icon-upload')).toBeTruthy();
    });
  });
});
