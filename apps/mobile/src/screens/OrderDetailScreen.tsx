import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getErrorMessage } from '@emd/api-client';
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
  statusIdsForRoles,
} from '@emd/business';

/** Mismo mapeo semántico que usa la Web y `OrdersScreen`, a color HEX. */
const DOT_COLOR_BY_TONE: Record<string, string> = {
  neutral: '#94a3b8',
  info: '#0ea5e9',
  warning: '#f59e0b',
  progress: '#8b5cf6',
  success: '#10b981',
  done: '#6366f1',
  danger: '#f97316',
  critical: '#ef4444',
};

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
}: {
  orderId: number;
  onBack: () => void;
}) {
  const { data: order, isPending, isError, refetch } = useOrder(orderId);
  const { roles, canManageOperations } = usePermissionsFromSession();
  const { histories } = useOrderHistoryForOrder(orderId);
  const { updateOrder, isUpdating } = useUpdateOrder();
  const { changeStatus, isChangingStatus } = useChangeOrderStatusSimple();

  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order) setDescription(order.description ?? '');
  }, [order]);

  const canEdit = canManageOperations;
  const myStageIds = statusIdsForRoles(roles);
  const canChangeStatus = canEdit || (!!order && myStageIds.includes(order.statusId));

  const handleSave = async () => {
    if (!order) return;
    setError(null);
    try {
      await updateOrder({ id: order.id, payload: { description } });
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo guardar el cambio.'));
    }
  };

  const handleStatusChange = async (newStatusId: number) => {
    if (!order || newStatusId === order.statusId) return;
    setError(null);
    try {
      await changeStatus(order, newStatusId);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cambiar el estado.'));
    }
  };

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>No se pudo cargar el pedido.</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retry}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tone = getStatusTone(order.statusId, order.status?.name);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Pedidos</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pedido #{order.id}</Text>
      </View>

      <View style={styles.card}>
        <Row label="Cliente" value={getOrderClientName(order)} />
        <Row label="Creado por" value={getUserName(order.user)} />
        <Row label="Fecha de creación" value={formatDateTime(order.creationDate)} />
        <Row
          label="Asignado a"
          value={getAssignedUserName(order.assignedUser) ?? 'sin asignar'}
        />
        <View style={styles.row}>
          <Text style={styles.label}>Estado actual</Text>
          <View style={[styles.badge, { backgroundColor: DOT_COLOR_BY_TONE[tone] }]}>
            <Text style={styles.badgeText}>
              {getStatusLabel(order.statusId, order.status?.name)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Descripción</Text>
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          editable={canEdit}
          multiline
        />
        {canEdit && (
          <TouchableOpacity
            style={[styles.button, isUpdating && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isUpdating}
          >
            <Text style={styles.buttonText}>
              {isUpdating ? 'Guardando...' : 'Guardar cambios'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cambiar estado</Text>
        <View style={styles.statusRow}>
          {STATUS_FLOW.map((s) => (
            <TouchableOpacity
              key={s.id}
              disabled={!canChangeStatus || isChangingStatus}
              onPress={() => handleStatusChange(s.id)}
              style={[
                styles.statusChip,
                s.id === order.statusId && styles.statusChipActive,
                (!canChangeStatus || isChangingStatus) && styles.statusChipDisabled,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  s.id === order.statusId && styles.statusChipTextActive,
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {histories.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Historial</Text>
            {histories.slice(0, 5).map((h) => (
              <Text key={h.id} style={styles.historyItem}>
                {getStatusLabel(h.previousStatusId)} → {getStatusLabel(h.newStatusId)} ·{' '}
                {formatDateTime(h.changeDate)}
              </Text>
            ))}
          </View>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
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
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 60, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { gap: 4, marginBottom: 4 },
  back: { color: '#2563eb', fontSize: 15, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  label: { color: '#666', fontSize: 13 },
  value: { fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  textarea: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  statusChipDisabled: { opacity: 0.4 },
  statusChipText: { fontSize: 13 },
  statusChipTextActive: { color: '#fff', fontWeight: '600' },
  historySection: { marginTop: 12, gap: 4 },
  historyItem: { fontSize: 12, color: '#555' },
  error: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  retry: { color: '#2563eb', fontSize: 14 },
});
