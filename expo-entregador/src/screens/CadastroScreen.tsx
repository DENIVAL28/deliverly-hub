import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { supabase } from "@/lib/supabase";
import { C, R, shadow } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Cadastro">;

type Modalidade = "moto" | "carro" | "bicicleta";

function validarCpf(cpf: string): boolean {
  const n = cpf.replace(/\D/g, "");
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(n[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(n[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(n[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(n[10]);
}

function mascaraCpf(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  return n
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function mascaraTelefone(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 10)
    return n.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

const TERMOS = `TERMO DE RESPONSABILIDADE — ENTREGADOR DELIVERLY HUB

Ao se cadastrar como entregador na plataforma Deliverly Hub, você declara que:

1. As informações fornecidas são verdadeiras e atualizadas.
2. Possui habilitação válida e compatível com o veículo utilizado, quando exigido por lei.
3. Seu veículo está em perfeitas condições de uso, com documentação regularizada.
4. Compromete-se a realizar as entregas com segurança e responsabilidade.
5. Está ciente de que presta serviço de forma autônoma, sem vínculo empregatício com a plataforma.
6. Autoriza o uso dos seus dados para fins operacionais da plataforma.
7. Está ciente de que o descumprimento das regras pode resultar em suspensão ou exclusão da conta.

Ao concluir o cadastro, você confirma que leu, compreendeu e concorda com todos os termos acima.`;

const PASSOS_INFO = [
  { n: 1, titulo: "Dados Pessoais",         emoji: "👤" },
  { n: 2, titulo: "Modalidade e Documentos", emoji: "🏍" },
  { n: 3, titulo: "Termos e Finalização",    emoji: "✅" },
];

export default function CadastroScreen({ navigation }: Props) {
  const [passo, setPasso] = useState(1);

  const [nome, setNome]         = useState("");
  const [cpf, setCpf]           = useState("");
  const [email, setEmail]       = useState("");
  const [senha, setSenha]       = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade]     = useState("");

  const [modalidade, setModalidade] = useState<Modalidade>("moto");
  const [cnh, setCnh]               = useState("");
  const [placa, setPlaca]           = useState("");
  const [modelo, setModelo]         = useState("");
  const [cor, setCor]               = useState("");

  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [loading, setLoading] = useState(false);

  function avancar() {
    if (passo === 1) {
      if (!nome.trim() || !cpf || !email.trim() || !senha) {
        Alert.alert("Campos obrigatórios", "Preencha nome, CPF, e-mail e senha.");
        return;
      }
      if (!validarCpf(cpf)) {
        Alert.alert("CPF inválido", "Verifique o CPF digitado.");
        return;
      }
      if (senha.length < 6) {
        Alert.alert("Senha fraca", "A senha deve ter no mínimo 6 caracteres.");
        return;
      }
    }
    if (passo === 2) {
      if ((modalidade === "moto" || modalidade === "carro") && !cnh.trim()) {
        Alert.alert("CNH obrigatória", "Informe o número da sua CNH.");
        return;
      }
      if ((modalidade === "moto" || modalidade === "carro") && !placa.trim()) {
        Alert.alert("Placa obrigatória", "Informe a placa do seu veículo.");
        return;
      }
    }
    setPasso((p) => p + 1);
  }

  function voltar() {
    setPasso((p) => p - 1);
  }

  async function finalizar() {
    if (!aceitouTermos) {
      Alert.alert("Termos não aceitos", "Você precisa aceitar os termos para continuar.");
      return;
    }
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
    });

    if (signUpError || !signUpData.user) {
      setLoading(false);
      Alert.alert(
        "Erro ao criar conta",
        signUpError?.message === "User already registered"
          ? "Este e-mail já está cadastrado. Use outro e-mail ou entre com sua conta."
          : signUpError?.message ?? "Não foi possível criar a conta."
      );
      return;
    }

    const { data: cadastroData } = await (supabase as any).rpc("entregador_cadastrar", {
      p_nome: nome.trim(),
      p_cpf: cpf.replace(/\D/g, ""),
      p_telefone: telefone.replace(/\D/g, "") || null,
      p_cidade: cidade.trim() || null,
      p_tipo: modalidade,
      p_cnh: cnh.trim() || null,
      p_placa: placa.trim().toUpperCase() || null,
      p_modelo_veiculo: modelo.trim() || null,
      p_cor_veiculo: cor.trim() || null,
    });

    setLoading(false);

    if (!cadastroData?.ok) {
      Alert.alert(
        "Erro no cadastro",
        cadastroData?.erro ?? "Não foi possível salvar os dados. Tente novamente.",
        [{ text: "OK", onPress: () => supabase.auth.signOut() }]
      );
      return;
    }

    Alert.alert(
      "Cadastro enviado! 🎉",
      "Seus dados foram recebidos. Aguarde a análise da plataforma. Você será notificado quando for aprovado.",
      [{ text: "OK", onPress: () => navigation.replace("Main") }]
    );
  }

  const info = PASSOS_INFO[passo - 1];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header de progresso */}
        <View style={styles.progressHeader}>
          <View style={styles.stepRow}>
            {PASSOS_INFO.map((p, i) => (
              <View key={p.n} style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  passo > p.n && styles.stepCircleDone,
                  passo === p.n && styles.stepCircleActive,
                ]}>
                  <Text style={[
                    styles.stepNum,
                    (passo >= p.n) && styles.stepNumActive,
                  ]}>
                    {passo > p.n ? "✓" : String(p.n)}
                  </Text>
                </View>
                {i < PASSOS_INFO.length - 1 && (
                  <View style={[styles.stepLine, passo > p.n && styles.stepLineDone]} />
                )}
              </View>
            ))}
          </View>
          <Text style={styles.passoEmoji}>{info.emoji}</Text>
          <Text style={styles.passoTitulo}>{info.titulo}</Text>
          <Text style={styles.passoSub}>Passo {passo} de 3</Text>
        </View>

        {/* ── PASSO 1: Dados pessoais ── */}
        {passo === 1 && (
          <View style={styles.secao}>
            <CampoLabel label="Nome completo *" />
            <TextInput style={styles.input} placeholder="Seu nome completo"
              placeholderTextColor={C.textLight} value={nome} onChangeText={setNome}
              autoCapitalize="words" />

            <CampoLabel label="CPF *" mt />
            <TextInput style={styles.input} placeholder="000.000.000-00"
              placeholderTextColor={C.textLight} value={cpf}
              onChangeText={(t) => setCpf(mascaraCpf(t))}
              keyboardType="numeric" maxLength={14} />

            <CampoLabel label="E-mail *" mt />
            <TextInput style={styles.input} placeholder="seu@email.com"
              placeholderTextColor={C.textLight} value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

            <CampoLabel label="Senha *" dica="mínimo 6 caracteres" mt />
            <TextInput style={styles.input} placeholder="••••••••"
              placeholderTextColor={C.textLight} value={senha} onChangeText={setSenha}
              secureTextEntry autoCapitalize="none" />

            <CampoLabel label="WhatsApp" mt />
            <TextInput style={styles.input} placeholder="(11) 99999-9999"
              placeholderTextColor={C.textLight} value={telefone}
              onChangeText={(t) => setTelefone(mascaraTelefone(t))}
              keyboardType="phone-pad" maxLength={15} />

            <CampoLabel label="Cidade" mt />
            <TextInput style={styles.input} placeholder="Sua cidade"
              placeholderTextColor={C.textLight} value={cidade} onChangeText={setCidade}
              autoCapitalize="words" />
          </View>
        )}

        {/* ── PASSO 2: Modalidade + documentos ── */}
        {passo === 2 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Como você faz suas entregas?</Text>
            <View style={styles.modalidadeGrid}>
              {(["moto", "carro", "bicicleta"] as Modalidade[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modalidadeBtn, modalidade === m && styles.modalidadeBtnAtivo]}
                  onPress={() => setModalidade(m)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalidadeEmoji}>
                    {m === "moto" ? "🏍" : m === "carro" ? "🚗" : "🚲"}
                  </Text>
                  <Text style={[styles.modalidadeLabel, modalidade === m && styles.modalidadeLabelAtivo]}>
                    {m === "moto" ? "Moto" : m === "carro" ? "Carro" : "Bicicleta"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(modalidade === "moto" || modalidade === "carro") && (
              <>
                <CampoLabel label="Número da CNH *" mt />
                <TextInput style={styles.input} placeholder="00000000000"
                  placeholderTextColor={C.textLight} value={cnh} onChangeText={setCnh}
                  keyboardType="numeric" maxLength={11} />

                <CampoLabel label="Placa do veículo *" mt />
                <TextInput style={styles.input} placeholder="ABC1D23"
                  placeholderTextColor={C.textLight} value={placa}
                  onChangeText={(t) => setPlaca(t.toUpperCase())}
                  autoCapitalize="characters" maxLength={7} />
              </>
            )}

            <CampoLabel label="Modelo do veículo" mt />
            <TextInput style={styles.input} placeholder="Ex: Honda Pop 110"
              placeholderTextColor={C.textLight} value={modelo} onChangeText={setModelo}
              autoCapitalize="words" />

            <CampoLabel label="Cor" mt />
            <TextInput style={styles.input} placeholder="Ex: Preta"
              placeholderTextColor={C.textLight} value={cor} onChangeText={setCor}
              autoCapitalize="words" />
          </View>
        )}

        {/* ── PASSO 3: Termos ── */}
        {passo === 3 && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Leia com atenção</Text>
            <View style={styles.termosBox}>
              <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
                <Text style={styles.termosTexto}>{TERMOS}</Text>
              </ScrollView>
            </View>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setAceitouTermos((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, aceitouTermos && styles.checkboxMarcado]}>
                {aceitouTermos && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>
                Li e aceito os termos de responsabilidade
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Navegação entre passos */}
        <View style={styles.botoesRow}>
          {passo > 1 && (
            <TouchableOpacity style={styles.btnVoltar} onPress={voltar} activeOpacity={0.8}>
              <Text style={styles.btnVoltarText}>← Voltar</Text>
            </TouchableOpacity>
          )}

          {passo < 3 ? (
            <TouchableOpacity style={styles.btnAvancar} onPress={avancar} activeOpacity={0.85}>
              <Text style={styles.btnAvancarText}>Próximo →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnAvancar, loading && styles.btnDisabled]}
              onPress={finalizar}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnAvancarText}>Finalizar cadastro</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {passo === 1 && (
          <TouchableOpacity
            style={styles.linkLogin}
            onPress={() => navigation.replace("Login")}
            activeOpacity={0.7}
          >
            <Text style={styles.linkLoginText}>Já tenho conta — Entrar</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CampoLabel({ label, dica, mt }: { label: string; dica?: string; mt?: boolean }) {
  return (
    <Text style={[styles.label, mt && { marginTop: 16 }]}>
      {label}
      {dica ? <Text style={styles.dica}>  ({dica})</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 24 },

  progressHeader: {
    backgroundColor: C.brand,
    paddingTop: 52,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  stepItem: { flexDirection: "row", alignItems: "center" },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: { backgroundColor: C.white },
  stepCircleDone:  { backgroundColor: "rgba(255,255,255,0.9)" },
  stepNum: { fontSize: 14, fontWeight: "800", color: "rgba(255,255,255,0.7)" },
  stepNumActive: { color: C.brand },
  stepLine: { width: 32, height: 2, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 4 },
  stepLineDone: { backgroundColor: "rgba(255,255,255,0.85)" },

  passoEmoji: { fontSize: 36, marginBottom: 6 },
  passoTitulo: { fontSize: 18, fontWeight: "800", color: C.white },
  passoSub: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 3 },

  secao: {
    backgroundColor: C.white,
    margin: 16,
    borderRadius: R.xl,
    padding: 20,
    ...shadow.sm,
  },
  secaoTitulo: { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 16 },

  label: { fontSize: 13, fontWeight: "700", color: C.textMid, marginBottom: 8 },
  dica: { fontSize: 12, fontWeight: "400", color: C.textLight },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.bg,
  },

  modalidadeGrid: { flexDirection: "row", gap: 10, marginBottom: 6 },
  modalidadeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    borderRadius: R.lg,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  modalidadeBtnAtivo: { borderColor: C.brand, backgroundColor: C.brandLight },
  modalidadeEmoji: { fontSize: 30 },
  modalidadeLabel: { fontSize: 12, fontWeight: "700", color: C.textMuted, marginTop: 6 },
  modalidadeLabelAtivo: { color: C.brand },

  termosBox: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    padding: 14,
    backgroundColor: C.bg,
    marginBottom: 18,
  },
  termosTexto: { fontSize: 12, color: C.textMid, lineHeight: 19 },

  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxMarcado: { backgroundColor: C.brand, borderColor: C.brand },
  checkMark: { color: C.white, fontSize: 14, fontWeight: "800" },
  checkLabel: { flex: 1, fontSize: 13, color: C.textMid, lineHeight: 19 },

  botoesRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 4 },
  btnVoltar: {
    flex: 1,
    height: 54,
    borderRadius: R.lg,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.white,
  },
  btnVoltarText: { fontSize: 15, fontWeight: "700", color: C.textMid },
  btnAvancar: {
    flex: 2,
    height: 54,
    borderRadius: R.lg,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.md,
  },
  btnAvancarText: { color: C.white, fontWeight: "800", fontSize: 15 },
  btnDisabled: { opacity: 0.6 },

  linkLogin: { alignItems: "center", marginTop: 18 },
  linkLoginText: { color: C.brand, fontWeight: "700", fontSize: 14 },
});
