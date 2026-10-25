import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  useOrder,
  useOrderHistoryForOrder,
  useUpdateOrder,
  useChangeOrderStatusSimple,
  usePermissionsFromSession,
  getOrderClientName,
  getAssignedUserName,
  getUserName,
  formatDateTime,
  getStatusLabel,
  getStatusTone,
  statusIdsFor,
} from '@emd/business';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { FadeInView, PressableScale } from '../theme/motion';
import { statusBarPad } from '../theme/layout';
import {
  Button,
  ErrorBanner,
  ErrorState,
  LoadingState,
  StatusChip,
  describeError,
  type FriendlyError,
} from '../components/ui';

/** Estados a los que se puede pasar desde el detalle (mismo circuito base que la Web). */
const STATUS_FLOW: { id: number; label: string }[] = [
  { id: 1, label: 'Pendiente' },
  { id: 2, label: 'En pruebas' },
  { id: 3, label: 'En proceso' },
  { id: 4, label: 'Terminado' },
  { id: 5, label: 'Entregado' },
];

export function OrderDetailScreen({
  orderId,
  onBack,
  onSessionExpired,
}: {
  orderId: number;
  onBack: () => void;
  onSessionExpired?: () => void;
}) {
  const { data: order, isPending, isError, error: queryError, refetch } = useOrder(orderId);
  const { roles, areas, canManageOperations } = usePermissionsFromSession();
  const { histories } = useOrderHistoryForOrder(orderId);
  const { updateOrder, isUpdating } = useUpdateOrder();
  const { changeStatus, isChangingStatus } = useChangeOrderStatusSimple();

  const [description, setDescription] = useState('');
  const [error, setError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    if (order) setDescription(order.description ?? '');
  }, [order]);

  const canEdit = canManageOperations;
  const myStageIds = statusIdsFor({ roles, areas });
  const canChangeStatus = canEdit || (!!order && myStageIds.includes(order.statusId));

  const handleSave = async () => {
    if (!order) return;
    setError(null);
    try {
      await updateOrder({ id: order.id, payload: { description } });
    } catch (err) {
      setError(describeError(err, 'No se pudo guardar el cambio.'));
    }
  };

  const handleStatusChange = async (newStatusId: number) => {
    if (!order || newStatusId === order.statusId) return;
    setError(null);
    try {
      await changeStatus(order, newStatusId);
    } catch (err) {
      setError(describeError(err, 'No se pudo cambiar el estado.'));
    }
  };

  if (isPending) {
    return (
      <View style={styles.container}>
        <TopBar title={`Pedido #${orderId}`} onBack={onBack} />
        <LoadingState label="Cargando pedido…" />
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View style={styles.container}>
        <TopBar title={`Pedido #${orderId}`} onBack={onBack} />
        <ErrorState
          error={describeError(queryError, 'No se pudo cargar el pedido.')}
          onRetry={() => refetch()}
          onSessionExpired={onSessionExpired}
        />
      </View>
    );
  }

  const tone = getStatusTone(order.statusId, order.status?.name);

  return (
    <View style={styles.container}>
      <TopBar title={`Pedido #${order.id}`} onBack={onBack}>
        <StatusChip tone={tone} label={getStatusLabel(order.statusId, order.status?.name)} />
      </TopBar>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FadeInView style={styles.card}>
          <Text style={styles.sectionTitle}>Información</Text>
          <Row label="Cliente" value={getOrderClientName(order)} />
          <Row label="Creado por" value={getUserName(order.user)} />
          <Row label="Fecha de creación" value={formatDateTime(order.creationDate)} />
          <Row
            label="Asignado a"
            value={getAssignedUserName(order.assignedUser) ?? 'sin asignar'}
          />
        </FadeInView>

        <FadeInView index={1} style={styles.card}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <TextInput
            style={[styles.textarea, !canEdit && styles.textareaReadonly]}
            value={description}
            onChangeText={setDescription}
            editable={canEdit}
            multiline
            placeholder="Sin descripción"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Descripción del pedido"
          />
          {canEdit && (
            <Button
              label={isUpdating ? 'Guardando...' : 'Guardar cambios'}
              onPress={handleSave}
              loading={isUpdating}
            />
          )}
        </FadeInView>

        <FadeInView index={2} style={styles.card}>
          <Text style={styles.sectionTitle}>Cambiar estado</Text>
          <View style={styles.statusRow}>
            {STATUS_FLOW.map((s) => {
              const active = s.id === order.statusId;
              const off = !canChangeStatus || isChangingStatus;
              return (
                <PressableScale
                  key={s.id}
                  disabled={off}
                  onPress={() => handleStatusChange(s.id)}
                  accessibilityLabel={s.label}
                  accessibilityState={{ selected: active, disabled: off }}
                  style={[
                    styles.statusChip,
                    active && styles.statusChipActive,
                    off && !active && styles.statusChipDisabled,
                  ]}
                >
                  <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                    {s.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {histories.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Historial</Text>
              {histories.slice(0, 5).map((h) => (
                <View key={h.id} style={styles.historyItem}>
                  <View style={styles.historyDot} />
                  <Text style={styles.historyText}>
                    {getStatusLabel(h.previousStatusId)} → {getStatusLabel(h.newStatusId)} ·{' '}
                    {formatDateTime(h.changeDate)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </FadeInView>

        {error &&
          (error.kind === 'session' && onSessionExpired ? (
            <ErrorState error={error} onSessionExpired={onSessionExpired} />
          ) : (
            <ErrorBanner error={error} />
          ))}
      </ScrollView>
    </View>
  );
}

function TopBar({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      <PressableScale onPress={onBack} style={styles.back} accessibilityLabel="Volver a pedidos">
        <Text style={styles.backText}>‹ Pedidos</Text>
      </PressableScale>
      <View style={styles.topBarRow}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    backgroundColor: colors.navy,
    paddingTop: statusBarPad - 12,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 4,
    borderBottomColor: colors.magenta,
  },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { ...typography.bodyStrong, color: colors.cyan },
  topBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { ...typography.title, color: colors.textOnNavy, flexShrink: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  sectionTitle: { ...typography.heading, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  label: { ...typography.caption, color: colors.textMuted },
  value: { ...typography.bodyStrong, color: colors.text, flexShrink: 1, textAlign: 'right' },
  textarea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 96,
    textAlignVertical: 'top',
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textareaReadonly: { backgroundColor: colors.bg },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  statusChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  statusChipDisabled: { opacity: 0.45 },
  statusChipText: { ...typography.caption, color: colors.text },
  statusChipTextActive: { color: '#fff', fontWeight: '700' },
  historySection: { marginTop: spacing.sm, gap: spacing.sm },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cyan },
  historyText: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
});
