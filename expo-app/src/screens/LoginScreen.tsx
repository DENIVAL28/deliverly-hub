import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [senha, setSenha]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function entrar() {
    if (!email.trim() || !senha.trim()) {
      Alert.alert("Preencha email e senha.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    setLoading(false);
    if (error) Alert.alert("Erro ao entrar", error.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>🛵</Text>
        <Text style={styles.titulo}>Deliverly Hub</Text>
        <Text style={styles.subtitulo}>Painel do Lojista</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#a1a1aa"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#a1a1aa"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          onSubmitEditing={entrar}
        />

        <TouchableOpacity style={styles.botao} onPress={entrar} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.botaoTexto}>Entrar</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff7ed",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  logo: { fontSize: 48, textAlign: "center", marginBottom: 8 },
  titulo: {
    fontSize: 24, fontWeight: "800", textAlign: "center",
    color: "#18181b", marginBottom: 4,
  },
  subtitulo: {
    fontSize: 14, textAlign: "center", color: "#71717a", marginBottom: 28,
  },
  input: {
    height: 50, borderWidth: 1, borderColor: "#e4e4e7",
    borderRadius: 12, paddingHorizontal: 16, fontSize: 16,
    color: "#18181b", marginBottom: 12, backgroundColor: "#fafafa",
  },
  botao: {
    height: 50, backgroundColor: "#f97316", borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginTop: 4,
  },
  botaoTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
