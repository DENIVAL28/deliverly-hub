import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    async function verificar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigation.replace("Main");
      } else {
        navigation.replace("Login");
      }
    }
    verificar();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Text style={styles.logoEmoji}>🛵</Text>
      </View>
      <Text style={styles.appName}>Delivery Hub</Text>
      <Text style={styles.appRole}>Entregador</Text>
      <Text style={styles.tagline}>Suas entregas em um só lugar</Text>
      <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoEmoji: { fontSize: 52 },
  appName: {
    fontSize: 30,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.5,
  },
  appRole: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 2,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    marginTop: 10,
  },
  loader: {
    marginTop: 48,
  },
});
