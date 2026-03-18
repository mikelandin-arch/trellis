import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';
import { colors, typography } from '../../lib/theme';

type TextVariant = 'heading1' | 'heading2' | 'heading3' | 'body' | 'bodyBold' | 'caption' | 'small';

type TextProps = RNTextProps & {
  readonly variant?: TextVariant;
  readonly color?: string;
  readonly align?: 'left' | 'center' | 'right';
};

export function Text({
  variant = 'body',
  color,
  align,
  style,
  ...props
}: TextProps): React.ReactNode {
  return (
    <RNText
      style={[
        styles.base,
        variantStyles[variant],
        color != null && { color },
        align != null && { textAlign: align },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.neutral.textPrimary,
  },
});

const variantStyles = StyleSheet.create({
  heading1: typography.heading1,
  heading2: typography.heading2,
  heading3: typography.heading3,
  body: typography.body,
  bodyBold: typography.bodyBold,
  caption: typography.caption,
  small: typography.small,
});
