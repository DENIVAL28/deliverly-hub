import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { supabase } from "@/lib/supabase";
import { C, R, shadow } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail]               = useState("");
  const [senha, setSenha]               = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [erro, setErro]                 = useState<string | null>(null);

  async function entrar() {
    setErro(null);
    if (!email.trim() || !senha) {
      setErro("Preencha o e-mail e a senha.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    setLoading(false);
    if (error) {
      setErro("E-mail ou senha incorretos. Verifique e tente novamente.");
      return;
    }
    navigation.replace("Main");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header laranja */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🛵</Text>
          </View>
          <Text style={styles.titulo}>Delivery Hub</Text>
          <Text style={styles.sub}>Bem-vindo de volta, entregador!</Text>
        </View>

        {/* Card do formulário */}
        <View style={styles.card}>
          {erro && (
            <View style={styles.erroBox}>
              <Text style={styles.erroText}>⚠️  {erro}</Text>
            </View>
          )}

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor={C.textLight}
            value={email}
            onChangeText={(v) => { setEmail(v); setErro(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Senha</Text>
          <View style={styles.senhaRow}>
            <TextInput
              style={[styles.input, styles.senhaInput]}
              placeholder="••••••••"
              placeholderTextColor={C.textLight}
              value={senha}
              onChangeText={(v) => { setSenha(v); setErro(null); }}
              secureTextEntry={!mostrarSenha}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.olhoBotao} onPress={() => setMostrarSenha((v) => !v)}>
              <Text style={styles.olhoEmoji}>{mostrarSenha ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={entrar}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Entrar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkCadastro}
            onPress={() => navigation.navigate("Cadastro")}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Ainda não tem conta?{"  "}
              <Text style={styles.linkDestaque}>Criar cadastro</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.brand },
  content: { flexGrow: 1 },

  header: {
    alignItems: "center",
    paddingTop: 72,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoEmoji: { fontSize: 42 },
  titulo: {
    fontSize: 26,
    fontWeight: "900",
    color: C.white,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    marginTop: 6,
  },

  card: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    flex: 1,
    minHeight: 380,
    ...shadow.md,
  },

  erroBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: R.md,
    padding: 12,
    marginBottom: 16,
  },
  erroText: { fontSize: 13, color: C.red, lineHeight: 18 },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textMid,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.bg,
  },
  senhaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  senhaInput: { flex: 1 },
  olhoBotao: {
    width: 48,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    backgroundColor: C.bg,
  },
  olhoEmoji: { fontSize: 20 },

  btn: {
    backgroundColor: C.brand,
    borderRadius: R.lg,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    ...shadow.md,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: C.white, fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },

  linkCadastro: { alignItems: "center", marginTop: 20 },
  linkText: { color: C.textMuted, fontSize: 14 },
  linkDestaque: { color: C.brand, fontWeight: "700" },
});
