import { useState, useCallback } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/theme';
import { Text } from './text';

type InputProps = Omit<TextInputProps, 'style'> & {
  readonly label?: string;
  readonly error?: string;
};

export function Input({
  label,
  error,
  onFocus,
  onBlur,
  ...props
}: InputProps): React.ReactNode {
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  const hasError = error != null && error.length > 0;

  return (
    <View style={styles.wrapper}>
      {label != null && (
        <Text variant="bodyBold" style={styles.label}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          hasError && styles.inputError,
        ]}
        placeholderTextColor={colors.neutral.textTertiary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      {hasError && (
        <Text variant="caption" color={colors.error.dark} style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body.fontSize,
    color: colors.neutral.textPrimary,
    backgroundColor: colors.neutral.background,
  },
  inputFocused: {
    borderColor: colors.primary.base,
  },
  inputError: {
    borderColor: colors.error.base,
  },
  errorText: {
    marginTop: spacing.xs,
  },
});
