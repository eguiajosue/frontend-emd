import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { request, unwrapList, getErrorMessage } from '@emd/api-client';
import { getStatusLabel, getStatusTone } from '@emd/business';
import type { Order } from '@emd/types';

/** Mismo mapeo semántico que usa la Web (`statusColors.ts`), pero a color HEX en vez de clases Tailwind. */
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

function OrderRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const tone = getStatusTone(order.statusId, order.status?.name);
  const label = getStatusLabel(order.statusId, order.status?.name);
  const clientName =
    [order.client?.first_name, order.client?.last_name].filter(Boolean).join(' ') ||
    order.clientNameOverride ||
    'Sin cliente';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          #{order.id} · {clientName}
        </Text>
        <View style={[styles.badge, { backgroundColor: DOT_COLOR_BY_TONE[tone] }]}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      </View>
      <Text style={styles.rowDescription} numberOfLines={2}>
        {order.description}
      </Text>
    </TouchableOpacity>
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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await request<Order[] | { data: Order[] }>('orders', { token });
      setOrders(unwrapList(res));
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar los pedidos.'));
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pedidos</Text>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logout}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <OrderRow order={item} onPress={() => onOpenOrder(item.id)} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No hay pedidos.</Text>
            </View>
          }
          contentContainerStyle={orders.length === 0 && styles.emptyContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  logout: { color: '#dc2626', fontSize: 14 },
  loader: { marginTop: 40 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyContent: { flexGrow: 1 },
  error: { color: '#dc2626', fontSize: 15, textAlign: 'center' },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  rowDescription: { marginTop: 4, color: '#555', fontSize: 14 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
