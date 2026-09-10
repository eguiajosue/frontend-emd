import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthSessionProvider } from '@emd/business';
import {
  initApiClient,
  getSession,
  setSession,
  clearSession,
  type StoredSession,
} from './src/lib/session';
import { LoginScreen } from './src/screens/LoginScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { OrderDetailScreen } from './src/screens/OrderDetailScreen';

initApiClient();

const queryClient = new QueryClient();

export default function App() {
  const [session, setSessionState] = useState<StoredSession | null | undefined>(undefined);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  useEffect(() => {
    getSession().then(setSessionState);
  }, []);

  const handleLoggedIn = async (newSession: StoredSession) => {
    await setSession(newSession);
    setSessionState(newSession);
  };

  const handleLogout = async () => {
    await clearSession();
    setSessionState(null);
    setOpenOrderId(null);
  };

  const authValue = useMemo(
    () => ({ token: session?.token, roles: session?.roles ?? [] }),
    [session]
  );

  if (session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider value={authValue}>
        {!session ? (
          <LoginScreen onLoggedIn={handleLoggedIn} />
        ) : openOrderId ? (
          <OrderDetailScreen orderId={openOrderId} onBack={() => setOpenOrderId(null)} />
        ) : (
          <OrdersScreen
            token={session.token}
            onLogout={handleLogout}
            onOpenOrder={setOpenOrderId}
          />
        )}
        <StatusBar style="auto" />
      </AuthSessionProvider>
    </QueryClientProvider>
  );
}
