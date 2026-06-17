import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import * as Notifications from "expo-notifications";
import { supabase } from "./src/lib/supabase";

enableScreens();

// Telas do cliente (sem login)
import LojasScreen from "./src/screens/cliente/LojasScreen";
import CardapioScreen from "./src/screens/cliente/CardapioScreen";
import CheckoutScreen from "./src/screens/cliente/CheckoutScreen";
import RastreioScreen from "./src/screens/cliente/RastreioScreen";

// Telas do lojista (com login)
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <SafeAreaProvider>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Cliente — fluxo público, sem login */}
        <Stack.Screen name="Lojas" component={LojasScreen} />
        <Stack.Screen name="Cardapio" component={CardapioScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Rastreio" component={RastreioScreen} />

        {/* Lojista — acessado pelo botão "Área do lojista" na tela de lojas */}
        {session ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
