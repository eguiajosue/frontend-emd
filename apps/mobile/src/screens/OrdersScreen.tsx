import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { request, unwrapList } from '@emd/api-client';
import { getStatusLabel, getStatusTone } from '@emd/business';
import type { Order } from '@emd/types';
import { colors, radii, shadows, spacing, typography } from '../theme';
import { FadeInView, PressableScale } from '../theme/motion';
import { statusBarPad } from '../theme/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusChip,
  describeError,
  type FriendlyError,
} from '../components/ui';

function OrderRow({ order, index, onPress }: { order: Order; index: number; onPress: () => void }) {
  const tone = getStatusTone(order.statusId, order.status?.name);
  const label = getStatusLabel(order.statusId, order.status?.name);
  const clientName =
    [order.client?.first_name, order.client?.last_name].filter(Boolean).join(' ') ||
    order.clientNameOverride ||
    'Sin cliente';

  return (
    <FadeInView index={index}>
      <PressableScale
        onPress={onPress}
        style={styles.row}
        accessibilityLabel={`Pedido ${order.id}, ${clientName}, ${label}`}
        accessibilityHint="Abre el detalle del pedido"
      >
        <View style={styles.rowHeader}>
          <Text style={styles.rowId}>#{order.id}</Text>
          <StatusChip tone={tone} label={label} />
        </View>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {clientName}
        </Text>
        {!!order.description && (
          <Text style={styles.rowDescription} numberOfLines={2}>
            {order.description}
          </Text>
        )}
      </PressableScale>
    </FadeInView>
  );
}

export function OrdersScreen({
  token,
  onLogout,
  onOpenOrder,
}: {
  token: string;
  onLogout: () => void;
  onOpenOrder: (orderId: number) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await request<Order[] | { data: Order[] }>('orders', { token });
      setOrders(unwrapList(res));
    } catch (err) {
      setError(describeError(err, 'No se pudieron cargar los pedidos.'));
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleRetry = () => {
    setLoading(true);
    load().finally(() => setLoading(false));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerOverline}>EMD BORDADOS</Text>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Pedidos
          </Text>
        </View>
        <PressableScale onPress={onLogout} style={styles.logout} accessibilityLabel="Cerrar sesión">
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </PressableScale>
      </View>
      <View style={styles.accentBar}>
        <View style={{ flex: 3, backgroundColor: colors.magenta }} />
        <View style={{ flex: 2, backgroundColor: colors.cyan }} />
        <View style={{ flex: 1, backgroundColor: colors.lime }} />
      </View>

      {loading ? (
        <LoadingState label="Cargando pedidos…" />
      ) : error ? (
        <ErrorState error={error} onRetry={handleRetry} onSessionExpired={onLogout} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <OrderRow order={item} index={index} onPress={() => onOpenOrder(item.id)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.magenta}
              colors={[colors.magenta]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Aún no hay pedidos"
              message="Cuando se registren pedidos aparecerán aquí. Desliza hacia abajo para actualizar."
            />
          }
          contentContainerStyle={[styles.list, orders.length === 0 && styles.emptyContent]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingTop: statusBarPad,
    paddingBottom: spacing.lg,
    backgroundColor: colors.navy,
  },
  headerOverline: { ...typography.overline, color: colors.cyan },
  headerTitle: { ...typography.display, color: colors.textOnNavy },
  logout: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.textOnNavyMuted,
  },
  logoutText: { ...typography.caption, color: colors.textOnNavy },
  accentBar: { flexDirection: 'row', height: 4 },
  list: { padding: spacing.lg, gap: spacing.md },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: 6,
    ...shadows.card,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowId: { ...typography.caption, color: colors.textMuted },
  rowTitle: { ...typography.heading, color: colors.text },
  rowDescription: { ...typography.body, color: colors.textMuted },
});
