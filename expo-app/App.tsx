import React, { Component, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import * as Notifications from "expo-notifications";
import { supabase } from "./src/lib/supabase";

enableScreens();

import LojasScreen from "./src/screens/cliente/LojasScreen";
import CardapioScreen from "./src/screens/cliente/CardapioScreen";
import CheckoutScreen from "./src/screens/cliente/CheckoutScreen";
import RastreioScreen from "./src/screens/cliente/RastreioScreen";
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

// Error boundary — mostra o erro na tela em vez de crashar silenciosamente
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <View style={eb.container}>
          <Text style={eb.title}>🚨 Erro de inicialização</Text>
          <Text style={eb.msg}>{err.message}</Text>
          <ScrollView style={eb.scroll}>
            <Text style={eb.stack}>{err.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}
const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: "bold", color: "#dc2626", marginBottom: 10 },
  msg: { fontSize: 14, color: "#18181b", marginBottom: 10, fontWeight: "600" },
  scroll: { flex: 1 },
  stack: { fontSize: 11, color: "#71717a", fontFamily: "monospace" },
});

function AppNavigator() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={{ marginTop: 12, color: "#71717a", fontSize: 14 }}>Carregando...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Cliente — fluxo público */}
        <Stack.Screen name="Lojas" component={LojasScreen} />
        <Stack.Screen name="Cardapio" component={CardapioScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Rastreio" component={RastreioScreen} />
        {/* Lojista */}
        {session ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
