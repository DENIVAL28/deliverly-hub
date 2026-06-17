import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { supabase } from "./src/lib/supabase";

// Telas compartilhadas
import LoginScreen from "./src/screens/LoginScreen";

// Telas do lojista
import HomeScreen from "./src/screens/HomeScreen";

// Telas do cliente
import LojasScreen from "./src/screens/cliente/LojasScreen";
import CardapioScreen from "./src/screens/cliente/CardapioScreen";
import CheckoutScreen from "./src/screens/cliente/CheckoutScreen";
import RastreioScreen from "./src/screens/cliente/RastreioScreen";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const Stack = createNativeStackNavigator();

type Perfil = "lojista" | "cliente" | null;

export default function App() {
  const [session, setSession]   = useState<any>(null);
  const [perfil, setPerfil]     = useState<Perfil>(null);
  const [loading, setLoading]   = useState(true);

  async function detectarPerfil(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("empresa_id, role")
      .eq("id", userId)
      .single();

    // Se tiver empresa_id ou role = owner/admin → lojista; senão → cliente
    const isLojista = !!data?.empresa_id || data?.role === "owner" || data?.role === "admin";
    setPerfil(isLojista ? "lojista" : "cliente");
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await detectarPerfil(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await detectarPerfil(session.user.id);
      } else {
        setPerfil(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Não logado — mostra login
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : perfil === "lojista" ? (
          // Lojista — painel de pedidos
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          // Cliente — fluxo de pedido
          <>
            <Stack.Screen name="Lojas" component={LojasScreen} />
            <Stack.Screen name="Cardapio" component={CardapioScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="Rastreio" component={RastreioScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
