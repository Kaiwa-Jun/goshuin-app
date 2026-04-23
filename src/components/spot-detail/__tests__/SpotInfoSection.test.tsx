import React from 'react';
import { render } from '@testing-library/react-native';
import { SpotInfoSection } from '../SpotInfoSection';
import type { ParsedSpotInfo } from '@hooks/useSpotInfo';

describe('SpotInfoSection', () => {
  it('renders parking info', () => {
    const spotInfo: ParsedSpotInfo = {
      parking: { available: true, capacity: 20, location: '境内南側' },
    };
    const { getByTestId, getByText } = render(<SpotInfoSection spotInfo={spotInfo} />);
    expect(getByTestId('spot-info-section')).toBeTruthy();
    expect(getByTestId('spot-info-item-0')).toBeTruthy();
    expect(getByText(/駐車場 あり/)).toBeTruthy();
    expect(getByText(/20台/)).toBeTruthy();
    expect(getByText(/境内南側/)).toBeTruthy();
  });

  it('renders parking unavailable', () => {
    const spotInfo: ParsedSpotInfo = {
      parking: { available: false },
    };
    const { getByText } = render(<SpotInfoSection spotInfo={spotInfo} />);
    expect(getByText(/駐車場 なし/)).toBeTruthy();
  });

  it('renders reception hours', () => {
    const spotInfo: ParsedSpotInfo = {
      receptionHours: { open: '9:00', close: '16:00', notes: '年末年始は休み' },
    };
    const { getByText } = render(<SpotInfoSection spotInfo={spotInfo} />);
    expect(getByText(/9:00〜16:00/)).toBeTruthy();
    expect(getByText(/年末年始は休み/)).toBeTruthy();
  });

  it('renders reception hours without open/close', () => {
    const spotInfo: ParsedSpotInfo = {
      receptionHours: { notes: '要確認' },
    };
    const { getByText } = render(<SpotInfoSection spotInfo={spotInfo} />);
    expect(getByText(/時間情報あり/)).toBeTruthy();
  });

  it('renders affiliated shrines', () => {
    const spotInfo: ParsedSpotInfo = {
      affiliatedShrines: [{ name: '末社A', details: '境内東' }, { name: '末社B' }],
    };
    const { getByText } = render(<SpotInfoSection spotInfo={spotInfo} />);
    expect(getByText(/兼務社 末社A、末社B/)).toBeTruthy();
  });

  it('does not render access notes', () => {
    const spotInfo: ParsedSpotInfo = {
      accessNotes: [{ type: 'walking', text: '駅から徒歩10分' }],
    };
    const { queryByTestId } = render(<SpotInfoSection spotInfo={spotInfo} />);
    expect(queryByTestId('spot-info-section')).toBeNull();
  });

  it('renders multiple info types compactly', () => {
    const spotInfo: ParsedSpotInfo = {
      parking: { available: true },
      receptionHours: { open: '9:00', close: '17:00' },
      affiliatedShrines: [{ name: '稲荷社' }],
    };
    const { getByTestId } = render(<SpotInfoSection spotInfo={spotInfo} />);
    expect(getByTestId('spot-info-item-0')).toBeTruthy();
    expect(getByTestId('spot-info-item-1')).toBeTruthy();
    expect(getByTestId('spot-info-item-2')).toBeTruthy();
  });

  it('returns null when all fields are empty', () => {
    const spotInfo: ParsedSpotInfo = {};
    const { queryByTestId } = render(<SpotInfoSection spotInfo={spotInfo} />);
    expect(queryByTestId('spot-info-section')).toBeNull();
  });

  it('returns null when only access notes exist', () => {
    const spotInfo: ParsedSpotInfo = {
      accessNotes: [{ type: 'car', text: 'ICから5分' }],
    };
    const { queryByTestId } = render(<SpotInfoSection spotInfo={spotInfo} />);
    expect(queryByTestId('spot-info-section')).toBeNull();
  });
});
