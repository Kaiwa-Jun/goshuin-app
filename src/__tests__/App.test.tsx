import { render, screen } from '@testing-library/react-native';

import App from '../../App';

describe('App', () => {
  it('renders the app name', () => {
    render(<App />);
    expect(screen.getByText('御朱印コレクション')).toBeTruthy();
  });

  it('renders the setup message', () => {
    render(<App />);
    expect(screen.getByText('セットアップ完了')).toBeTruthy();
  });
});
