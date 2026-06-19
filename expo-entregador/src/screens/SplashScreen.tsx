import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { getToken, clearToken } from "@/lib/storage";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    async function verificar() {
      const token = await getToken();
      if (!token) {
        navigation.replace("Token");
        return;
      }

      const { data } = await supabase
        .from("entregadores")
        .select("id, nome")
        .eq("public_token" as never, token)
        .maybeSingle();

      if (!data) {
        await clearToken();
        navigation.replace("Token");
      } else {
        navigation.replace("Main", { token });
      }
    }
    verificar();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🛵</Text>
      <Text style={styles.title}>Entregador DH</Text>
      <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { fontSize: 64 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginTop: 12 },
});
