import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ReportPhoto } from '@components/annual-report/ReportPhoto';
import { colors } from '@theme/colors';

jest.mock('@services/stamps', () => ({
  getStampImageUrl: (path: string) => `https://img/${path}`,
  getStampThumbUrl: (path: string) => `https://img/thumb/${path}`,
  getStampViewUrl: (path: string) => `https://img/view/${path}`,
}));

const uriOf = (el: { props: { source?: { uri?: string } } }) => el.props.source?.uri;

describe('ReportPhoto（AC-46）', () => {
  it('表紙など（view）は view の写真から', () => {
    const { getByTestId } = render(<ReportPhoto imagePath="u/a.jpg" variant="view" />);
    expect(uriOf(getByTestId('annual-photo-image'))).toBe('https://img/view/u/a.jpg');
  });

  it('コラージュ（thumb）は thumb の写真から', () => {
    const { getByTestId } = render(<ReportPhoto imagePath="u/a.jpg" variant="thumb" />);
    expect(uriOf(getByTestId('annual-photo-image'))).toBe('https://img/thumb/u/a.jpg');
  });

  it('読めなければ元の写真、それも読めなければ写真の枠', () => {
    const { getByTestId, queryByTestId } = render(
      <ReportPhoto imagePath="u/a.jpg" variant="view" />
    );

    fireEvent(getByTestId('annual-photo-image'), 'error');
    expect(uriOf(getByTestId('annual-photo-image'))).toBe('https://img/u/a.jpg');

    fireEvent(getByTestId('annual-photo-image'), 'error');
    expect(queryByTestId('annual-photo-image')).toBeNull();
    expect(getByTestId('annual-photo-placeholder')).toBeTruthy();
  });

  it('写真が無ければ（見本）最初から写真の枠。地は washiShade、印は photo', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <ReportPhoto imagePath={null} variant="thumb" />
    );
    expect(queryByTestId('annual-photo-image')).toBeNull();
    expect(
      StyleSheet.flatten(getByTestId('annual-photo-placeholder').props.style).backgroundColor
    ).toBe(colors.washiShade);
    expect(getByText('photo').props.color).toBe(colors.washiSub);
  });
});
