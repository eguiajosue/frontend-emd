import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { normalizeSessionAccess } from '@emd/business';
import { request } from '@emd/api-client';
import type { StoredSession } from '../lib/session';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { FadeInView } from '../theme/motion';
import { statusBarPad } from '../theme/layout';
import { Button, ErrorBanner, describeError, type FriendlyError } from '../components/ui';

interface LoginResponse {
  token: string;
  refreshToken: string;
  id: number;
  username: string;
  roles: string[];
  areas?: string[];
}

export function LoginScreen({
  onLoggedIn,
}: {
  onLoggedIn: (session: StoredSession) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [focused, setFocused] = useState<'user' | 'pass' | null>(null);

  const handleSubmit = async () => {
    if (!username || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await request<LoginResponse>('auth/login', {
        method: 'POST',
        body: { username, password },
      });
      onLoggedIn({ token: res.token, ...normalizeSessionAccess(res) });
    } catch (err) {
      const friendly = describeError(err, 'No se pudo iniciar sesión.');
      // Un 401 aquí significa credenciales incorrectas, no sesión expirada.
      setError(
        friendly.kind === 'session'
          ? {
              kind: 'other',
              title: 'Credenciales incorrectas',
              message: 'Revisa tu usuario y contraseña e inténtalo de nuevo.',
            }
          : friendly
      );
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = !!username && !!password;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <FadeInView style={styles.brand}>
          <View style={styles.accentRow}>
            <View style={[styles.dot, { backgroundColor: colors.magenta }]} />
            <View style={[styles.dot, { backgroundColor: colors.cyan }]} />
            <View style={[styles.dot, { backgroundColor: colors.lime }]} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            EMD Bordados
          </Text>
          <Text style={styles.subtitle}>Gestión de pedidos</Text>
        </FadeInView>

        <FadeInView index={2} style={styles.card}>
          <Text style={styles.cardTitle}>Bienvenido</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Usuario</Text>
            <TextInput
              style={[styles.input, focused === 'user' && styles.inputFocused]}
              placeholder="Tu usuario"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              returnKeyType="next"
              value={username}
              onChangeText={setUsername}
              onFocus={() => setFocused('user')}
              onBlur={() => setFocused(null)}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={[styles.input, focused === 'pass' && styles.inputFocused]}
              placeholder="Tu contraseña"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('pass')}
              onBlur={() => setFocused(null)}
            />
          </View>

          {error && <ErrorBanner error={error} onRetry={canSubmit ? handleSubmit : undefined} />}

          <Button label="Ingresar" onPress={handleSubmit} loading={busy} disabled={!canSubmit} />
        </FadeInView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: statusBarPad,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  brand: { alignItems: 'center', gap: spacing.sm },
  accentRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { ...typography.display, color: colors.textOnNavy },
  subtitle: { ...typography.body, color: colors.textOnNavyMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card,
  },
  cardTitle: { ...typography.title, color: colors.text },
  field: { gap: 6 },
  label: { ...typography.caption, color: colors.textMuted },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  inputFocused: { borderColor: colors.magenta, backgroundColor: colors.surface },
});
