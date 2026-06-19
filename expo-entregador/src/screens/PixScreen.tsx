import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Clipboard,
} from "react-native";
import { supabase } from "@/lib/supabase";

interface Entregador {
  nome: string;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
}

const TIPOS_PIX = [
  { value: "aleatoria", label: "Chave aleatória", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
  { value: "cpf",       label: "CPF",             placeholder: "000.000.000-00" },
  { value: "telefone",  label: "Telefone",         placeholder: "(66) 99999-9999" },
  { value: "email",     label: "E-mail",           placeholder: "seu@email.com" },
];

export default function PixScreen({ token }: { token: string }) {
  const [entregador, setEntregador] = useState<Entregador | null>(null);
  const [loading, setLoading]       = useState(true);
  const [salvando, setSalvando]     = useState(false);
  const [copiado, setCopiado]       = useState(false);

  const [chave, setChave]     = useState("");
  const [tipo, setTipo]       = useState("aleatoria");

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("entregadores")
      .select("nome, chave_pix, tipo_chave_pix")
      .eq("public_token" as never, token)
      .maybeSingle();
    if (data) {
      setEntregador(data as any);
      setChave((data as any).chave_pix ?? "");
      setTipo((data as any).tipo_chave_pix ?? "aleatoria");
    }
  }, [token]);

  useEffect(() => {
    carregar().finally(() => setLoading(false));
  }, [carregar]);

  async function salvar() {
    if (!chave.trim()) {
      Alert.alert("Campo vazio", "Digite sua chave PIX antes de salvar.");
      return;
    }
    setSalvando(true);
    const { error } = await (supabase as any).rpc("entregador_atualizar_pix", {
      p_token: token,
      p_chave_pix: chave.trim(),
      p_tipo_chave_pix: tipo,
    });
    setSalvando(false);
    if (error) {
      Alert.alert("Erro", "Não foi possível salvar sua chave PIX.");
      return;
    }
    setEntregador((prev) => prev ? { ...prev, chave_pix: chave.trim(), tipo_chave_pix: tipo } : prev);
    Alert.alert("Salvo!", "Sua chave PIX foi atualizada.");
  }

  function copiar() {
    if (entregador?.chave_pix) {
      Clipboard.setString(entregador.chave_pix);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  if (loading) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const tipoAtual = TIPOS_PIX.find((t) => t.value === tipo);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitulo}>💰 Receba suas entregas</Text>
        <Text style={styles.infoTexto}>
          Cadastre sua chave PIX para facilitar o pagamento pelo restaurante.
          O valor é combinado diretamente entre você e o estabelecimento.
        </Text>
      </View>

      {entregador?.chave_pix && (
        <View style={styles.chaveAtualCard}>
          <Text style={styles.chaveAtualLabel}>Chave PIX atual</Text>
          <View style={styles.chaveAtualRow}>
            <Text style={styles.chaveAtualValor} numberOfLines={1} ellipsizeMode="middle">
              {entregador.chave_pix}
            </Text>
            <TouchableOpacity style={styles.btnCopiar} onPress={copiar}>
              <Text style={styles.btnCopiarText}>{copiado ? "Copiado!" : "Copiar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Atualizar chave PIX</Text>

        <Text style={styles.label}>Tipo de chave</Text>
        <View style={styles.tiposGrid}>
          {TIPOS_PIX.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.tipoBtn, tipo === t.value && styles.tipoBtnAtivo]}
              onPress={() => setTipo(t.value)}
            >
              <Text style={[styles.tipoBtnText, tipo === t.value && styles.tipoBtnTextAtivo]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>Chave</Text>
        <TextInput
          style={styles.input}
          placeholder={tipoAtual?.placeholder}
          placeholderTextColor="#aaa"
          value={chave}
          onChangeText={setChave}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={tipo === "telefone" ? "phone-pad" : tipo === "email" ? "email-address" : "default"}
        />

        <TouchableOpacity
          style={[styles.btnSalvar, salvando && styles.btnDisabled]}
          onPress={salvar}
          disabled={salvando}
        >
          {salvando
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnSalvarText}>Salvar chave PIX</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f4f4f5" },
  content: { padding: 16 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },

  infoCard: {
    backgroundColor: "#fff7ed", borderWidth: 1.5, borderColor: "#fed7aa",
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  infoTitulo: { fontSize: 15, fontWeight: "700", color: "#9a3412", marginBottom: 6 },
  infoTexto: { fontSize: 13, color: "#7c2d12", lineHeight: 18 },

  chaveAtualCard: {
    backgroundColor: "#f0fdf4", borderWidth: 1.5, borderColor: "#bbf7d0",
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  chaveAtualLabel: { fontSize: 12, fontWeight: "600", color: "#166534", marginBottom: 8 },
  chaveAtualRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  chaveAtualValor: { flex: 1, fontSize: 13, fontWeight: "600", color: "#111" },
  btnCopiar: {
    backgroundColor: "#16a34a", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  btnCopiarText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTitulo: { fontSize: 15, fontWeight: "700", color: "#111", marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },

  tiposGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tipoBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#e5e7eb", backgroundColor: "#fff",
  },
  tipoBtnAtivo: { borderColor: "#f97316", backgroundColor: "#fff7ed" },
  tipoBtnText: { fontSize: 13, fontWeight: "600", color: "#666" },
  tipoBtnTextAtivo: { color: "#f97316" },

  input: {
    borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12,
    padding: 14, fontSize: 14, color: "#111", marginBottom: 16,
  },
  btnSalvar: {
    backgroundColor: "#f97316", borderRadius: 12,
    height: 52, alignItems: "center", justifyContent: "center",
  },
  btnSalvarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
});
