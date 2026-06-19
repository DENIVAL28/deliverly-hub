import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { saveToken } from "@/lib/storage";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Token">;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export default function TokenScreen({ navigation }: Props) {
  const [valor, setValor] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    const match = valor.trim().match(UUID_RE);
    if (!match) {
      Alert.alert("Link inválido", "Cole o link completo que o restaurante enviou para você.");
      return;
    }
    const token = match[0];
    setCarregando(true);

    const { data } = await supabase
      .from("entregadores")
      .select("id, nome, aprovado")
      .eq("public_token" as never, token)
      .maybeSingle();

    setCarregando(false);

    if (!data) {
      Alert.alert("Token não encontrado", "Verifique se o link está correto e tente novamente.");
      return;
    }

    await saveToken(token);
    navigation.replace("Main", { token });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🛵</Text>
        <Text style={styles.title}>Entregador DH</Text>
        <Text style={styles.subtitle}>
          Cole abaixo o link de acesso que o restaurante enviou para você pelo WhatsApp.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Link ou código de acesso</Text>
          <TextInput
            style={styles.input}
            placeholder="https://...entregador/seu-codigo"
            placeholderTextColor="#aaa"
            value={valor}
            onChangeText={setValor}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <TouchableOpacity
            style={[styles.btn, carregando && styles.btnDisabled]}
            onPress={entrar}
            disabled={carregando}
          >
            {carregando
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Entrar</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.ajuda}>
          <Text style={styles.ajudaTitulo}>Não tem o link?</Text>
          <Text style={styles.ajudaTexto}>
            Peça ao responsável do restaurante para ir em{"\n"}
            <Text style={{ fontWeight: "600" }}>Painel → Entregadores → Compartilhar link</Text>
            {"\n"}e enviar para você pelo WhatsApp.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f97316",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  emoji: { fontSize: 56 },
  title: { fontSize: 26, fontWeight: "800", color: "#fff", marginTop: 8 },
  subtitle: {
    fontSize: 15, color: "rgba(255,255,255,0.85)", textAlign: "center",
    marginTop: 12, lineHeight: 22,
  },
  card: {
    width: "100%", backgroundColor: "#fff", borderRadius: 20,
    padding: 20, marginTop: 32, gap: 12,
  },
  label: { fontSize: 13, fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12,
    padding: 14, fontSize: 14, color: "#111", minHeight: 56,
  },
  btn: {
    backgroundColor: "#f97316", borderRadius: 12,
    height: 52, alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  ajuda: {
    width: "100%", backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 16,
    padding: 16, marginTop: 20,
  },
  ajudaTitulo: { color: "#fff", fontWeight: "700", fontSize: 14, marginBottom: 6 },
  ajudaTexto: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 20 },
});
