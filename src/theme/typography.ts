import { TextStyle } from 'react-native';

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  } as TextStyle,

  h2: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  } as TextStyle,

  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,

  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  } as TextStyle,

  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  } as TextStyle,

  label: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  } as TextStyle,

  button: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,

  buttonSmall: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  } as TextStyle,

  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  } as TextStyle,
} as const;

/**
 * 単一行の TextInput 用。要点は **lineHeight を渡さないこと**。
 *
 * `typography.body` をそのまま広げると lineHeight が付いてくる。iOS はこれを
 * NSParagraphStyle として解釈するので、余った行間が文字の上に入り、文字が
 * 入力欄の下端に寄る（スポット追加モーダルで実測 4.7pt 下・Issue #182）。
 * しかもプレースホルダは UITextField 側が描いてこの影響を受けないため、
 * 入力の有無で文字の高さが変わってしまう。
 *
 * 縦の中央寄せは OS に任せる。高さは呼び出し側で決めること。TextInput の
 * height は border-box なので、枠と padding を持つ入力欄に lineHeight を
 * そのまま height として置くと中身が潰れる
 */
export const singleLineInput: TextStyle = {
  fontSize: typography.body.fontSize,
  fontWeight: typography.body.fontWeight,
  // Android は TextInput の既定が top 寄せの端末があるので明示する。iOS は無視される
  textAlignVertical: 'center',
};

export type Typography = typeof typography;
