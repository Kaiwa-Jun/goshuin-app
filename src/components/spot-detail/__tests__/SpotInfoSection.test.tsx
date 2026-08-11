import React from 'react';
import { StyleSheet } from 'react-native';
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

  // 長い注記を1行に切り詰めると、切れた先を見る手段が無いまま情報が消える
  // （横スクロールも詳細表示も無い）。行数を制限せず折り返す
  describe('長い情報の折り返し', () => {
    const longNotes: ParsedSpotInfo = {
      receptionHours: {
        notes:
          '最終受付 4-9月16:30／10・3月16:00／11・2月15:30／12-1月15:00・2026年8月時点／公式サイト',
      },
    };

    it('テキストの行数を制限しないこと', () => {
      const { getByText } = render(<SpotInfoSection spotInfo={longNotes} />);
      const node = getByText(/最終受付/);
      expect(node.props.numberOfLines).toBeUndefined();
    });

    it('注記を末尾まで省略せずに保持すること', () => {
      const { getByText } = render(<SpotInfoSection spotInfo={longNotes} />);
      expect(getByText(/公式サイト）$/)).toBeTruthy();
    });

    // row の中の Text は flexShrink を持たないと折り返さずにはみ出す（RN の既定は 0）
    it('テキストが縮んで折り返せること', () => {
      const { getByText } = render(<SpotInfoSection spotInfo={longNotes} />);
      const style = StyleSheet.flatten(getByText(/最終受付/).props.style);
      expect(style.flexShrink).toBe(1);
    });

    // 複数行になったときにアイコンが中央に浮かないこと
    it('チップの中身を上端で揃えること', () => {
      const { getByTestId } = render(<SpotInfoSection spotInfo={longNotes} />);
      const style = StyleSheet.flatten(getByTestId('spot-info-item-0').props.style);
      expect(style.alignItems).toBe('flex-start');
    });
  });
});
