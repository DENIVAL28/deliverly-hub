import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/lib/supabase";
import { C, R, shadow } from "@/theme";

const TIPOS_PIX = [
  { value: "aleatoria", label: "Aleatória",  placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
  { value: "cpf",       label: "CPF",         placeholder: "000.000.000-00" },
  { value: "telefone",  label: "Telefone",    placeholder: "(66) 99999-9999" },
  { value: "email",     label: "E-mail",      placeholder: "seu@email.com" },
];

interface EntregadorInfo {
  nome: string;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  status_cadastro: string | null;
}

export default function PixScreen() {
  const [entregador, setEntregador] = useState<EntregadorInfo | null>(null);
  const [loading, setLoading]       = useState(true);
  const [salvando, setSalvando]     = useState(false);
  const [copiado, setCopiado]       = useState(false);
  const [saindo, setSaindo]         = useState(false);

  const [chave, setChave] = useState("");
  const [tipo, setTipo]   = useState("aleatoria");

  const carregar = useCallback(async () => {
    const { data } = await (supabase as any).rpc("entregador_me");
    if (data) {
      setEntregador(data as EntregadorInfo);
      setChave((data as any).chave_pix ?? "");
      setTipo((data as any).tipo_chave_pix ?? "aleatoria");
    }
  }, []);

  useEffect(() => {
    carregar().finally(() => setLoading(false));
  }, [carregar]);

  function validarChave(): string | null {
    const v = chave.trim();
    if (!v) return "Digite sua chave PIX antes de salvar.";
    if (tipo === "cpf") {
      const digits = v.replace(/\D/g, "");
      if (digits.length !== 11) return "CPF deve ter 11 dígitos.";
      let soma = 0;
      for (let i = 0; i < 9; i++) soma += parseInt(digits[i]) * (10 - i);
      let r = (soma * 10) % 11;
      if (r === 10 || r === 11) r = 0;
      if (r !== parseInt(digits[9])) return "CPF inválido. Verifique os números digitados.";
      soma = 0;
      for (let i = 0; i < 10; i++) soma += parseInt(digits[i]) * (11 - i);
      r = (soma * 10) % 11;
      if (r === 10 || r === 11) r = 0;
      if (r !== parseInt(digits[10])) return "CPF inválido. Verifique os números digitados.";
    }
    if (tipo === "telefone") {
      const digits = v.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 11) return "Telefone inválido. Use DDD + número.";
    }
    if (tipo === "email") {
      if (!v.includes("@") || !v.includes(".")) return "E-mail inválido.";
    }
    return null;
  }

  async function salvar() {
    const erro = validarChave();
    if (erro) { Alert.alert("Chave inválida", erro); return; }
    const chaveFormatada = tipo === "cpf" || tipo === "telefone"
      ? chave.trim().replace(/\D/g, "")
      : chave.trim();
    setSalvando(true);
    const { data } = await (supabase as any).rpc("entregador_atualizar_pix_auth", {
      p_chave: chaveFormatada,
      p_tipo: tipo,
    });
    setSalvando(false);
    if (!data?.ok) {
      Alert.alert("Erro", data?.erro ?? "Não foi possível salvar sua chave PIX.");
      return;
    }
    setEntregador((prev) => prev ? { ...prev, chave_pix: chaveFormatada, tipo_chave_pix: tipo } : prev);
    Alert.alert("✅ Salvo!", "Sua chave PIX foi atualizada com sucesso.");
  }

  async function copiar() {
    if (entregador?.chave_pix) {
      await Clipboard.setStringAsync(entregador.chave_pix);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  async function sair() {
    Alert.alert(
      "Sair da conta",
      "Tem certeza que deseja sair?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            setSaindo(true);
            await supabase.auth.signOut();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  const tipoAtual = TIPOS_PIX.find((t) => t.value === tipo);
  const aprovado = entregador?.status_cadastro === "aprovado";

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Card do perfil */}
      {entregador && (
        <View style={styles.perfilCard}>
          <View style={styles.perfilAvatar}>
            <Text style={styles.perfilAvatarText}>
              {(entregador.nome ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.perfilNome}>{entregador.nome}</Text>
          <View style={[styles.perfilStatusTag, aprovado ? styles.statusAprovado : styles.statusPendente]}>
            <Text style={[styles.perfilStatusText, aprovado ? styles.statusAprovadoText : styles.statusPendenteText]}>
              {aprovado ? "✅ Aprovado" : "⏳ " + (entregador.status_cadastro ?? "aguardando_analise").replace("_", " ")}
            </Text>
          </View>
        </View>
      )}

      {/* Card chave PIX atual */}
      {entregador?.chave_pix ? (
        <View style={styles.chaveCard}>
          <View style={styles.chaveCardHeader}>
            <Text style={styles.chaveCardLabel}>💳 Chave PIX cadastrada</Text>
            <TouchableOpacity
              style={[styles.btnCopiar, copiado && styles.btnCopiado]}
              onPress={copiar}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnCopiarText, copiado && styles.btnCopiadoText]}>
                {copiado ? "✓ Copiado!" : "Copiar"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.chaveValor} numberOfLines={1} ellipsizeMode="middle">
            {entregador.chave_pix}
          </Text>
          <Text style={styles.chaveTipo}>
            Tipo: {TIPOS_PIX.find((t) => t.value === entregador.tipo_chave_pix)?.label ?? entregador.tipo_chave_pix}
          </Text>
        </View>
      ) : (
        <View style={styles.semChaveCard}>
          <Text style={styles.semChaveText}>⚠️  Nenhuma chave PIX cadastrada ainda</Text>
          <Text style={styles.semChaveSub}>Cadastre sua chave abaixo para receber por suas entregas.</Text>
        </View>
      )}

      {/* Card para atualizar chave */}
      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Atualizar chave PIX</Text>

        <Text style={styles.label}>Tipo de chave</Text>
        <View style={styles.tiposGrid}>
          {TIPOS_PIX.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.tipoBtn, tipo === t.value && styles.tipoBtnAtivo]}
              onPress={() => setTipo(t.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tipoBtnText, tipo === t.value && styles.tipoBtnTextAtivo]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 18 }]}>Chave</Text>
        <TextInput
          style={styles.input}
          placeholder={tipoAtual?.placeholder}
          placeholderTextColor={C.textLight}
          value={chave}
          onChangeText={setChave}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={
            tipo === "telefone" ? "phone-pad"
            : tipo === "cpf" ? "numeric"
            : tipo === "email" ? "email-address"
            : "default"
          }
        />

        <TouchableOpacity
          style={[styles.btnSalvar, salvando && styles.btnDisabled]}
          onPress={salvar}
          disabled={salvando}
          activeOpacity={0.85}
        >
          {salvando
            ? <ActivityIndicator color={C.white} />
            : <Text style={styles.btnSalvarText}>Salvar chave PIX</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Separador */}
      <View style={styles.separador}>
        <View style={styles.separadorLinha} />
        <Text style={styles.separadorLabel}>conta</Text>
        <View style={styles.separadorLinha} />
      </View>

      {/* Botão sair */}
      <TouchableOpacity
        style={[styles.btnSair, saindo && styles.btnDisabled]}
        onPress={sair}
        disabled={saindo}
        activeOpacity={0.8}
      >
        {saindo
          ? <ActivityIndicator color={C.red} />
          : <Text style={styles.btnSairText}>Sair da conta</Text>
        }
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },

  perfilCard: {
    backgroundColor: C.white,
    borderRadius: R.xl,
    padding: 24,
    alignItems: "center",
    marginBottom: 14,
    ...shadow.md,
  },
  perfilAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  perfilAvatarText: { color: C.white, fontWeight: "900", fontSize: 30 },
  perfilNome: { fontSize: 18, fontWeight: "800", color: C.text, marginBottom: 8 },
  perfilStatusTag: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  statusAprovado: { backgroundColor: C.greenLight },
  statusPendente: { backgroundColor: C.amberLight },
  perfilStatusText: { fontSize: 13, fontWeight: "700" },
  statusAprovadoText: { color: C.green },
  statusPendenteText: { color: C.amber },

  chaveCard: {
    backgroundColor: C.greenLight,
    borderWidth: 1.5,
    borderColor: C.greenBorder,
    borderRadius: R.xl,
    padding: 16,
    marginBottom: 14,
  },
  chaveCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  chaveCardLabel: { fontSize: 13, fontWeight: "700", color: C.green },
  btnCopiar: {
    backgroundColor: C.green,
    borderRadius: R.sm,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  btnCopiado: { backgroundColor: "#14532d" },
  btnCopiarText: { color: C.white, fontWeight: "700", fontSize: 12 },
  btnCopiadoText: { color: C.white },
  chaveValor: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 4 },
  chaveTipo: { fontSize: 12, color: C.green },

  semChaveCard: {
    backgroundColor: C.amberLight,
    borderWidth: 1.5,
    borderColor: "#fde68a",
    borderRadius: R.xl,
    padding: 16,
    marginBottom: 14,
  },
  semChaveText: { fontSize: 14, fontWeight: "700", color: C.amber, marginBottom: 4 },
  semChaveSub: { fontSize: 12, color: "#92400e", lineHeight: 17 },

  card: {
    backgroundColor: C.white,
    borderRadius: R.xl,
    padding: 18,
    marginBottom: 14,
    ...shadow.sm,
  },
  cardTitulo: { fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: C.textMid, marginBottom: 10 },

  tiposGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tipoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  tipoBtnAtivo: { borderColor: C.brand, backgroundColor: C.brandLight },
  tipoBtnText: { fontSize: 13, fontWeight: "600", color: C.textMuted },
  tipoBtnTextAtivo: { color: C.brand, fontWeight: "700" },

  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.bg,
    marginBottom: 18,
  },
  btnSalvar: {
    backgroundColor: C.brand,
    borderRadius: R.lg,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  btnSalvarText: { color: C.white, fontWeight: "800", fontSize: 15 },
  btnDisabled: { opacity: 0.55 },

  separador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 8,
  },
  separadorLinha: { flex: 1, height: 1, backgroundColor: C.border },
  separadorLabel: { fontSize: 11, color: C.textLight, textTransform: "uppercase", letterSpacing: 1 },

  btnSair: {
    borderWidth: 1.5,
    borderColor: C.redBorder,
    borderRadius: R.lg,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.redLight,
  },
  btnSairText: { color: C.red, fontWeight: "800", fontSize: 15 },
});
