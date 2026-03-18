import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSignIn } from '../../lib/clerk';

export default function VerifyScreen(): React.ReactNode {
  const { signIn, setActive, isLoaded } = useSignIn();
  const params = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerification = useCallback(
    async (verificationCode: string) => {
      if (!isLoaded || !signIn || !setActive) return;
      setError('');
      setLoading(true);

      try {
        const result = await signIn.attemptFirstFactor({
          strategy: 'email_code',
          code: verificationCode,
        });

        if (result.status === 'complete' && result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }
      } catch (err) {
        const clerkErrors = (err as { errors?: Array<{ longMessage?: string }> })
          .errors;
        setError(clerkErrors?.[0]?.longMessage ?? 'Invalid code. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [isLoaded, signIn, setActive],
  );

  useEffect(() => {
    if (params.code) {
      void handleVerification(params.code);
    }
  }, [params.code, handleVerification]);

  const handleSubmit = useCallback(() => {
    if (code.length === 6) {
      void handleVerification(code);
    }
  }, [code, handleVerification]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code we sent to your email address
        </Text>

        <TextInput
          style={styles.input}
          placeholder="000000"
          placeholderTextColor="#999"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          autoFocus
          editable={!loading}
          accessibilityLabel="Verification code"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            (loading || code.length !== 6) && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading || code.length !== 6}
          accessibilityLabel="Verify code"
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {loading ? 'Verifying...' : 'Verify'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
    lineHeight: 26,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 24,
    color: '#1a1a1a',
    backgroundColor: '#f9f9f9',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 8,
  },
  error: {
    fontSize: 16,
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    minHeight: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#2563eb',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
