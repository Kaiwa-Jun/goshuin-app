import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { LoginPromptModal } from '../common/LoginPromptModal';

const mockSignInWithGoogle = jest.fn();

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
    isSigningIn: false,
    signInWithGoogle: mockSignInWithGoogle,
    signOut: jest.fn(),
  }),
}));

describe('LoginPromptModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onLoginSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with login prompt text', () => {
    const { getByText } = render(<LoginPromptModal {...defaultProps} />);
    expect(getByText('ログインが必要です')).toBeTruthy();
    expect(getByText('御朱印を記録するにはログインしてください')).toBeTruthy();
  });

  it('renders Google login button', () => {
    const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
    expect(getByTestId('modal-google-login-button')).toBeTruthy();
  });

  it('renders later button', () => {
    const { getByText } = render(<LoginPromptModal {...defaultProps} />);
    expect(getByText('あとにする')).toBeTruthy();
  });

  it('calls onClose when later button is pressed', () => {
    const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
    fireEvent.press(getByTestId('modal-later-button'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls signInWithGoogle on Google button press and onLoginSuccess on success', async () => {
    mockSignInWithGoogle.mockResolvedValue({ success: true });

    const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
    fireEvent.press(getByTestId('modal-google-login-button'));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
      expect(defaultProps.onLoginSuccess).toHaveBeenCalled();
    });
  });

  it('does not call onLoginSuccess on cancelled sign-in', async () => {
    mockSignInWithGoogle.mockResolvedValue({
      success: false,
      error: { code: 'CANCELLED', message: 'cancelled' },
    });

    const { getByTestId } = render(<LoginPromptModal {...defaultProps} />);
    fireEvent.press(getByTestId('modal-google-login-button'));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
    expect(defaultProps.onLoginSuccess).not.toHaveBeenCalled();
  });

  it('does not render when visible is false', () => {
    const { queryByText } = render(<LoginPromptModal {...defaultProps} visible={false} />);
    expect(queryByText('ログインが必要です')).toBeNull();
  });
});
