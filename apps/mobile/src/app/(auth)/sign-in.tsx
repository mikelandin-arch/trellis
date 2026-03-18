import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSignIn, useSSO, isClerkRuntimeError } from '../../lib/clerk';
import { colors, spacing } from '../../lib/theme';
import { Text, Input, Button } from '../../components/ui';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen(): React.ReactNode {
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMagicLink = useCallback(async () => {
    if (!isSignInLoaded || !signIn) return;
    setError('');
    setLoading(true);

    try {
      const { supportedFirstFactors } = await signIn.create({
        identifier: email,
      });

      const emailCodeFactor = supportedFirstFactors?.find(
        (factor) => factor.strategy === 'email_code',
      );

      if (emailCodeFactor) {
        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: emailCodeFactor.emailAddressId,
        });
        router.push('/(auth)/verify');
      }
    } catch (err) {
      if (isClerkRuntimeError(err) && err.code === 'network_error') {
        setError('No internet connection. Please try again when online.');
      } else {
        const clerkErrors = (err as { errors?: Array<{ longMessage?: string }> })
          .errors;
        setError(clerkErrors?.[0]?.longMessage ?? 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  }, [isSignInLoaded, signIn, email, router]);

  const handleGoogleSSO = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: 'trellis://oauth-callback',
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      if (isClerkRuntimeError(err) && err.code === 'network_error') {
        setError('No internet connection. Please try again when online.');
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [startSSOFlow]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandSection}>
          <View style={styles.logoCircle}>
            <Text variant="heading1" color="#ffffff" style={styles.logoLetter}>
              T
            </Text>
          </View>
          <Text variant="heading1" align="center" style={styles.appName}>
            Trellis
          </Text>
          <Text variant="body" align="center" color={colors.neutral.textSecondary}>
            Community management, simplified
          </Text>
        </View>

        <View style={styles.formSection}>
          <Input
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            editable={!loading}
            error={error || undefined}
            accessibilityLabel="Email address"
          />

          <Button
            label={loading ? 'Sending...' : 'Send Magic Link'}
            onPress={handleMagicLink}
            variant="primary"
            loading={loading}
            disabled={!email.trim()}
            icon="mail-outline"
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text variant="caption" style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            label="Sign in with Google"
            onPress={handleGoogleSSO}
            variant="outline"
            loading={loading}
            icon="logo-google"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  brandSection: {
    alignItems: 'center',
    paddingTop: 120,
    paddingBottom: spacing.xxxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary.base,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoLetter: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 42,
  },
  appName: {
    marginBottom: spacing.sm,
  },
  formSection: {
    flex: 1,
    paddingTop: spacing.xxl,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral.border,
  },
  dividerText: {
    marginHorizontal: spacing.lg,
  },
});
