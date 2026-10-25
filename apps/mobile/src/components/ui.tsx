import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ApiError, AuthFetchError, getErrorMessage } from '@emd/api-client';
import { colors, radii, spacing, toneStyle, typography } from '../theme';
import { FadeInView, PressableScale } from '../theme/motion';

export type ErrorKind = 'network' | 'session' | 'server' | 'other';

export interface FriendlyError {
  kind: ErrorKind;
  title: string;
  message: string;
}

/** Traduce cualquier error a un mensaje amable en español. */
export function describeError(err: unknown, fallback: string): FriendlyError {
  if (err instanceof AuthFetchError || (err instanceof ApiError && err.status === 401)) {
    return {
      kind: 'session',
      title: 'Tu sesión expiró',
      message: 'Por seguridad cerramos tu sesión. Vuelve a iniciar sesión para continuar.',
    };
  }
  if (err instanceof ApiError && err.status === 0) {
    return {
      kind: 'network',
      title: 'Sin conexión',
      message: 'No pudimos conectar con el servidor. Revisa tu internet e inténtalo de nuevo.',
    };
  }
  if (err instanceof ApiError && err.status >= 500) {
    return {
      kind: 'server',
      title: 'El servidor tuvo un problema',
      message: 'Estamos teniendo inconvenientes de nuestro lado. Inténtalo de nuevo en un momento.',
    };
  }
  if (err instanceof TypeError) {
    return {
      kind: 'network',
      title: 'Sin conexión',
      message: 'No pudimos conectar con el servidor. Revisa tu internet e inténtalo de nuevo.',
    };
  }
  return { kind: 'other', title: 'Algo salió mal', message: getErrorMessage(err, fallback) };
}

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const off = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[styles.button, buttonVariants[variant], off && { opacity: 0.55 }]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.navy} />
      ) : (
        <Text style={[styles.buttonText, variant !== 'primary' && { color: colors.navy }]}>
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

export function StatusChip({ tone, label }: { tone: string; label: string }) {
  const t = toneStyle(tone);
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      <View style={[styles.chipDot, { backgroundColor: t.dot }]} />
      <Text style={[styles.chipText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.magenta} />
      <Text style={[typography.body, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  error,
  onRetry,
  onSessionExpired,
}: {
  error: FriendlyError;
  onRetry?: () => void;
  onSessionExpired?: () => void;
}) {
  return (
    <FadeInView style={styles.state}>
      <View style={styles.errorIcon}>
        <Text style={styles.errorIconText}>!</Text>
      </View>
      <Text style={[typography.heading, { color: colors.text, textAlign: 'center' }]}>
        {error.title}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
        {error.message}
      </Text>
      <View style={{ alignSelf: 'stretch', marginTop: spacing.sm }}>
        {error.kind === 'session' && onSessionExpired ? (
          <Button label="Iniciar sesión" onPress={onSessionExpired} />
        ) : onRetry ? (
          <Button label="Reintentar" onPress={onRetry} />
        ) : null}
      </View>
    </FadeInView>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <FadeInView style={styles.state}>
      <View style={[styles.errorIcon, { backgroundColor: colors.cyanSoft }]}>
        <Text style={[styles.errorIconText, { color: colors.navy }]}>0</Text>
      </View>
      <Text style={[typography.heading, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
        {message}
      </Text>
    </FadeInView>
  );
}

/** Banner de error inline con reintento opcional. */
export function ErrorBanner({
  error,
  onRetry,
}: {
  error: FriendlyError;
  onRetry?: () => void;
}) {
  return (
    <FadeInView style={styles.banner}>
      <View style={{ flex: 1 }} accessibilityRole="alert">
        <Text style={[typography.bodyStrong, { color: colors.danger }]}>{error.title}</Text>
        <Text style={[typography.caption, { color: colors.danger }]}>{error.message}</Text>
      </View>
      {onRetry && (
        <PressableScale
          onPress={onRetry}
          accessibilityLabel="Reintentar"
          style={styles.bannerRetry}
        >
          <Text style={[typography.caption, { color: colors.danger, fontWeight: '700' }]}>
            Reintentar
          </Text>
        </PressableScale>
      )}
    </FadeInView>
  );
}

const buttonVariants = StyleSheet.create({
  primary: { backgroundColor: colors.magentaStrong },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.navy },
  ghost: { backgroundColor: 'transparent' },
});

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { ...typography.bodyStrong, color: '#fff' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
  state: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.magentaSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconText: { fontSize: 26, fontWeight: '800', color: colors.magentaStrong },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  bannerRetry: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
});
