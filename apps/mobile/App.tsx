import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { initApiClient, getToken, setToken, clearToken } from './src/lib/session';
import { LoginScreen } from './src/screens/LoginScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';

initApiClient();

export default function App() {
  const [token, setTokenState] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getToken().then(setTokenState);
  }, []);

  const handleLoggedIn = async (newToken: string) => {
    await setToken(newToken);
    setTokenState(newToken);
  };

  const handleLogout = async () => {
    await clearToken();
    setTokenState(null);
  };

  if (token === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      {token ? (
        <OrdersScreen token={token} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoggedIn={handleLoggedIn} />
      )}
      <StatusBar style="auto" />
    </>
  );
}
