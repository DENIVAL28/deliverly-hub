import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { useEffect, useState } from "react";
import { supabase } from "./src/lib/supabase";

import SplashScreen from "./src/screens/SplashScreen";
import TokenScreen from "./src/screens/TokenScreen";
import HomeScreen from "./src/screens/HomeScreen";
import DisponiveisScreen from "./src/screens/DisponiveisScreen";
import HistoricoScreen from "./src/screens/HistoricoScreen";
import PixScreen from "./src/screens/PixScreen";

export type RootStackParamList = {
  Splash: undefined;
  Token: undefined;
  Main: { token: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{emoji}</Text>
    </View>
  );
}

function MainTabs({ route }: any) {
  const token: string = route.params?.token ?? "";
  const [isFreelancerAprovado, setIsFreelancerAprovado] = useState(false);

  useEffect(() => {
    supabase
      .from("entregadores")
      .select("tipo, aprovado")
      .eq("public_token" as never, token)
      .maybeSingle()
      .then(({ data }) => {
        if (data && (data as any).tipo === "freelancer" && (data as any).aprovado === true) {
          setIsFreelancerAprovado(true);
        }
      });
  }, [token]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#f97316" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "800" },
        tabBarActiveTintColor: "#f97316",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: { borderTopColor: "#f3f4f6", paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="Início"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          headerTitle: "Entregador DH",
        }}
      >
        {() => <HomeScreen token={token} />}
      </Tab.Screen>

      {isFreelancerAprovado && (
        <Tab.Screen
          name="Disponíveis"
          options={{
            tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} />,
            headerTitle: "Pedidos Disponíveis",
          }}
        >
          {() => <DisponiveisScreen token={token} />}
        </Tab.Screen>
      )}

      <Tab.Screen
        name="Histórico"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
          headerTitle: "Minhas Entregas",
        }}
      >
        {() => <HistoricoScreen token={token} />}
      </Tab.Screen>

      <Tab.Screen
        name="PIX"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💳" focused={focused} />,
          headerTitle: "Minha Chave PIX",
        }}
      >
        {() => <PixScreen token={token} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#f97316" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Token" component={TokenScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
