import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, RefreshControl, Modal,
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import { getGpsAtivo, setGpsAtivo } from "@/lib/storage";
import { C, R, shadow } from "@/theme";

interface Entregador {
  id: string;
  nome: string;
  status: string;
  aprovado: boolean | null;
  status_cadastro: string | null;
}

interface Pedido {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_endereco: string | null;
  cliente_telefone: string | null;
  cliente_lat: number | null;
  cliente_lng: number | null;
  taxa_entrega: number;
  status: string;
  empresa_nome: string | null;
}

const STATUS_OPCOES = [
  { value: "disponivel",   label: "Disponível",   cor: C.green,  bg: C.greenLight },
  { value: "em_rota",      label: "Em rota",      cor: C.amber,  bg: C.amberLight },
  { value: "indisponivel", label: "Indisponível", cor: C.red,    bg: C.redLight },
];

const STATUS_PEDIDO: Record<string, { label: string; cor: string; bg: string }> = {
  aceito:  { label: "Confirmado",      cor: "#92400e", bg: C.amberLight },
  preparo: { label: "Em preparo",      cor: "#9a3412", bg: "#ffedd5" },
  entrega: { label: "Saiu p/ entrega", cor: C.purple,  bg: C.purpleLight },
};

const STATUS_CADASTRO_INFO: Record<string, { texto: string; subtexto: string; cor: string; bg: string; emoji: string }> = {
  aguardando_analise: {
    emoji: "⏳",
    texto: "Cadastro em análise",
    subtexto: "Aguarde a análise dos seus documentos. Você será notificado quando estiver aprovado para realizar entregas.",
    cor: "#92400e", bg: C.amberLight,
  },
  em_analise: {
    emoji: "🔍",
    texto: "Em análise pela plataforma",
    subtexto: "Estamos verificando seus dados. Fique de olho no app!",
    cor: C.blue, bg: C.blueLight,
  },
  recusado: {
    emoji: "❌",
    texto: "Cadastro recusado",
    subtexto: "Seu cadastro foi recusado. Entre em contato com a plataforma para mais informações.",
    cor: C.red, bg: C.redLight,
  },
  bloqueado: {
    emoji: "🔒",
    texto: "Conta bloqueada",
    subtexto: "Sua conta foi bloqueada. Entre em contato com o suporte.",
    cor: C.textMuted, bg: "#f3f4f6",
  },
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function HomeScreen() {
  const [entregador, setEntregador] = useState<Entregador | null>(null);
  const [userId, setUserId]         = useState<string | null>(null);
  const [pedidos, setPedidos]       = useState<Pedido[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refresh, setRefresh]       = useState(false);
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const [finalizando, setFinalizando]     = useState<string | null>(null);

  const [modalPedido, setModalPedido]       = useState<Pedido | null>(null);
  const [modalConfirmado, setModalConfirmado] = useState(false);

  const [gpsAtivo, setGpsAtivoState] = useState(false);
  const [gpsLoading, setGpsLoading]  = useState(false);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const gpsInterval     = useRef<ReturnType<typeof setInterval> | null>(null);
  const ultimaPosicao   = useRef<{ lat: number; lng: number } | null>(null);

  const carregarDados = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: ent } = await (supabase as any).rpc("entregador_me");
    if (ent) setEntregador(ent as Entregador);

    if ((ent as Entregador)?.aprovado) {
      const { data: peds } = await (supabase as any).rpc("entregador_meus_pedidos_ativos");
      if (peds) setPedidos(peds as Pedido[]);
    }
  }, []);

  useEffect(() => {
    carregarDados().finally(() => setLoading(false));
    const interval = setInterval(carregarDados, 10000);
    return () => clearInterval(interval);
  }, [carregarDados]);

  useEffect(() => {
    if (!userId) return;
    getGpsAtivo(userId).then((ativo) => { if (ativo) iniciarGPS(); });
    return () => pararGPS();
  }, [userId]);

  async function mudarStatus(novoStatus: string) {
    setMudandoStatus(true);
    const { data } = await (supabase as any).rpc("entregador_atualizar_status_auth", { p_status: novoStatus });
    if (data?.ok) {
      setEntregador((prev) => prev ? { ...prev, status: novoStatus } : prev);
    }
    setMudandoStatus(false);
  }

  async function enviarPosicao(lat: number, lng: number) {
    await (supabase as any).rpc("entregador_atualizar_gps_auth", { p_lat: lat, p_lng: lng });
  }

  async function iniciarGPS() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Permita o acesso à localização para o restaurante acompanhar sua posição.");
        setGpsLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      ultimaPosicao.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      await enviarPosicao(pos.coords.latitude, pos.coords.longitude);

      locationWatcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 20 },
        (loc) => { ultimaPosicao.current = { lat: loc.coords.latitude, lng: loc.coords.longitude }; }
      );
      gpsInterval.current = setInterval(async () => {
        if (ultimaPosicao.current) await enviarPosicao(ultimaPosicao.current.lat, ultimaPosicao.current.lng);
      }, 15000);

      setGpsAtivoState(true);
      if (userId) await setGpsAtivo(userId, true);
    } catch {
      Alert.alert("Erro", "Não foi possível obter sua localização.");
    }
    setGpsLoading(false);
  }

  function pararGPS() {
    locationWatcher.current?.remove();
    locationWatcher.current = null;
    if (gpsInterval.current) { clearInterval(gpsInterval.current); gpsInterval.current = null; }
    ultimaPosicao.current = null;
    setGpsAtivoState(false);
    if (userId) setGpsAtivo(userId, false);
  }

  function abrirModalEntregue(pedido: Pedido) {
    setModalPedido(pedido);
    setModalConfirmado(false);
  }

  function fecharModal() {
    setModalPedido(null);
    setModalConfirmado(false);
  }

  async function finalizarEntrega(pedidoId: string) {
    fecharModal();
    setFinalizando(pedidoId);
    const { data } = await (supabase as any).rpc("entregador_finalizar_pedido", { p_pedido_id: pedidoId });
    setFinalizando(null);
    if (!data?.ok) {
      Alert.alert("Erro", data?.erro ?? "Não foi possível finalizar.");
      return;
    }
    await carregarDados();
  }

  function navegar(pedido: Pedido) {
    const url = pedido.cliente_lat != null
      ? `https://maps.google.com/maps?daddr=${pedido.cliente_lat},${pedido.cliente_lng}`
      : `https://maps.google.com/maps?daddr=${encodeURIComponent(pedido.cliente_endereco ?? "")}`;
    Linking.openURL(url);
  }

  async function onRefresh() {
    setRefresh(true);
    await carregarDados();
    setRefresh(false);
  }

  if (loading) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={C.brand} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (!entregador) {
    return (
      <View style={styles.centro}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
        <Text style={styles.erroText}>Erro ao carregar dados.</Text>
        <Text style={styles.erroSub}>Puxe para baixo para tentar novamente.</Text>
      </View>
    );
  }

  // Cadastro ainda não aprovado
  if (!entregador.aprovado) {
    const sc = entregador.status_cadastro ?? "aguardando_analise";
    const info = STATUS_CADASTRO_INFO[sc] ?? STATUS_CADASTRO_INFO["aguardando_analise"];
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: 0 }]}
      >
        <View style={styles.greetingBanner}>
          <View style={styles.greetingAvatar}>
            <Text style={styles.greetingAvatarText}>{entregador.nome.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.greetingHello}>{saudacao()},</Text>
            <Text style={styles.greetingNome}>{entregador.nome.split(" ")[0]}!</Text>
          </View>
        </View>

        <View style={[styles.avisoCard, { borderColor: info.cor + "30", backgroundColor: info.bg }]}>
          <Text style={styles.avisoEmoji}>{info.emoji}</Text>
          <Text style={[styles.avisoTitulo, { color: info.cor }]}>{info.texto}</Text>
          <Text style={styles.avisoTexto}>{info.subtexto}</Text>
        </View>

        <View style={styles.dica}>
          <Text style={styles.dicaText}>
            💡 Assim que seu cadastro for aprovado, você verá os pedidos disponíveis aqui.
          </Text>
        </View>
      </ScrollView>
    );
  }

  const statusAtual = STATUS_OPCOES.find((s) => s.value === entregador.status) ?? STATUS_OPCOES[2];

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={C.brand} />}
      >
        {/* Banner de saudação */}
        <View style={styles.greetingBanner}>
          <View>
            <Text style={styles.greetingHello}>{saudacao()},</Text>
            <Text style={styles.greetingNome}>{entregador.nome.split(" ")[0]}! 👋</Text>
          </View>
          <View style={styles.greetingAvatar}>
            <Text style={styles.greetingAvatarText}>{entregador.nome.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        {/* Card — Meu status */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitulo}>Meu status</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusAtual.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusAtual.cor }]} />
              <Text style={[styles.statusBadgeText, { color: statusAtual.cor }]}>
                {statusAtual.label}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            {STATUS_OPCOES.map((s) => {
              const ativo = entregador.status === s.value;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.statusBtn,
                    ativo && { backgroundColor: s.bg, borderColor: s.cor },
                  ]}
                  onPress={() => !ativo && !mudandoStatus && mudarStatus(s.value)}
                  disabled={mudandoStatus}
                  activeOpacity={0.8}
                >
                  {mudandoStatus && ativo
                    ? <ActivityIndicator size="small" color={s.cor} />
                    : <Text style={[styles.statusBtnText, ativo && { color: s.cor, fontWeight: "700" }]}>
                        {s.label}
                      </Text>
                  }
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Card — GPS */}
        <View style={styles.card}>
          <View style={styles.gpsRow}>
            <View style={[styles.gpsIconWrap, gpsAtivo && styles.gpsIconWrapAtivo]}>
              <Text style={{ fontSize: 22 }}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitulo}>Localização GPS</Text>
              <Text style={styles.gpsDesc}>
                {gpsAtivo
                  ? "Sua posição está sendo enviada ao restaurante"
                  : "Ative para compartilhar sua localização"}
              </Text>
            </View>
            {gpsAtivo && (
              <View style={styles.gpsBadge}>
                <View style={styles.gpsPonto} />
                <Text style={styles.gpsBadgeText}>Ativo</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.gpsBtn, gpsAtivo && styles.gpsBtnStop]}
            onPress={gpsAtivo ? pararGPS : iniciarGPS}
            disabled={gpsLoading}
            activeOpacity={0.85}
          >
            {gpsLoading
              ? <ActivityIndicator color={C.white} />
              : <Text style={styles.gpsBtnText}>{gpsAtivo ? "⏹  Parar rastreio" : "▶  Iniciar rastreio"}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Seção — Pedidos em andamento */}
        <View style={styles.secaoHeader}>
          <Text style={styles.secaoTitulo}>Pedidos em andamento</Text>
          {pedidos.length > 0 && (
            <View style={styles.secaoBadge}>
              <Text style={styles.secaoBadgeText}>{pedidos.length}</Text>
            </View>
          )}
        </View>

        {pedidos.length === 0 ? (
          <View style={styles.vazio}>
            <Text style={styles.vazioEmoji}>📦</Text>
            <Text style={styles.vazioTitulo}>Nenhum pedido em andamento</Text>
            <Text style={styles.vazioSub}>Aceite pedidos na aba "Disponíveis"</Text>
          </View>
        ) : (
          pedidos.map((p) => {
            const st = STATUS_PEDIDO[p.status];
            return (
              <View key={p.id} style={styles.pedidoCard}>
                {/* Header do card */}
                <View style={styles.pedidoCardHeader}>
                  <View>
                    <Text style={styles.pedidoNum}>Pedido #{p.numero}</Text>
                    {p.empresa_nome && (
                      <Text style={styles.pedidoEmpresa}>{p.empresa_nome}</Text>
                    )}
                  </View>
                  {st && (
                    <View style={[styles.statusTag, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusTagText, { color: st.cor }]}>{st.label}</Text>
                    </View>
                  )}
                </View>

                {/* Taxa em destaque */}
                <View style={styles.taxaRow}>
                  <Text style={styles.taxaLabel}>Taxa de entrega</Text>
                  <Text style={styles.taxaValor}>{fmt(p.taxa_entrega)}</Text>
                </View>

                {/* Informações do cliente */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoItem}>👤  {p.cliente_nome}</Text>
                  {p.cliente_endereco && (
                    <Text style={styles.infoItem}>📍  {p.cliente_endereco}</Text>
                  )}
                </View>

                {/* Botões de ação */}
                <View style={styles.pedidoBtns}>
                  {p.cliente_telefone && (
                    <TouchableOpacity
                      style={styles.btnSecundario}
                      onPress={() => Linking.openURL(`tel:${p.cliente_telefone}`)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnSecundarioText}>📞 Ligar</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.btnNavegar}
                    onPress={() => navegar(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnNavegarText}>🗺  Navegar</Text>
                  </TouchableOpacity>
                </View>

                {p.status === "entrega" && (
                  <TouchableOpacity
                    style={[styles.btnEntregue, finalizando === p.id && styles.btnDisabled]}
                    onPress={() => abrirModalEntregue(p)}
                    disabled={finalizando === p.id}
                    activeOpacity={0.85}
                  >
                    {finalizando === p.id
                      ? <ActivityIndicator color={C.white} />
                      : <Text style={styles.btnEntregueText}>✅  Confirmar entrega</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Modal confirmação de entrega */}
      <Modal
        visible={modalPedido !== null}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Confirmar entrega</Text>
            <Text style={styles.modalSub}>Pedido #{modalPedido?.numero}</Text>

            <View style={styles.modalDetalhe}>
              <Text style={styles.modalDetalheItem}>👤  {modalPedido?.cliente_nome}</Text>
              {modalPedido?.cliente_endereco && (
                <Text style={styles.modalDetalheItem}>📍  {modalPedido.cliente_endereco}</Text>
              )}
              <Text style={[styles.modalDetalheItem, styles.modalTaxaText]}>
                💰  {modalPedido ? fmt(modalPedido.taxa_entrega) : ""}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalCheckRow}
              onPress={() => setModalConfirmado((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.modalCheckbox, modalConfirmado && styles.modalCheckboxMarcado]}>
                {modalConfirmado && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.modalCheckLabel}>
                Confirmo que este pedido foi entregue ao cliente
              </Text>
            </TouchableOpacity>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancelar} onPress={fecharModal} activeOpacity={0.8}>
                <Text style={styles.modalBtnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirmar, !modalConfirmado && styles.btnDisabled]}
                onPress={() => modalPedido && finalizarEntrega(modalPedido.id)}
                disabled={!modalConfirmado}
                activeOpacity={0.85}
              >
                <Text style={styles.modalBtnConfirmarText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 16 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14, color: C.textMuted },
  erroText: { fontSize: 16, fontWeight: "700", color: C.text, textAlign: "center" },
  erroSub: { fontSize: 13, color: C.textMuted, marginTop: 6, textAlign: "center" },

  // Greeting banner
  greetingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.brand,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  greetingHello: { fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: "500" },
  greetingNome: { fontSize: 22, fontWeight: "900", color: C.white },
  greetingAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  greetingAvatarText: { color: C.white, fontWeight: "900", fontSize: 20 },

  // Aviso card (cadastro não aprovado)
  avisoCard: {
    margin: 16,
    borderWidth: 1.5,
    borderRadius: R.xl,
    padding: 24,
    alignItems: "center",
    marginTop: -12,
    ...shadow.sm,
  },
  avisoEmoji: { fontSize: 48, marginBottom: 12 },
  avisoTitulo: { fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: 10 },
  avisoTexto: { fontSize: 13, color: C.textMuted, textAlign: "center", lineHeight: 19 },

  dica: {
    marginHorizontal: 16,
    backgroundColor: C.brandLight,
    borderRadius: R.md,
    padding: 14,
    borderWidth: 1,
    borderColor: C.brandBorder,
  },
  dicaText: { fontSize: 13, color: C.brandDark, lineHeight: 18 },

  // Cards
  card: {
    backgroundColor: C.white,
    borderRadius: R.xl,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 14,
    ...shadow.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitulo: { fontSize: 14, fontWeight: "700", color: C.text },

  // Status
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  statusRow: { flexDirection: "row", gap: 8 },
  statusBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    backgroundColor: C.bg,
  },
  statusBtnText: { fontSize: 12, fontWeight: "600", color: C.textMuted },

  // GPS
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  gpsIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsIconWrapAtivo: { backgroundColor: C.greenLight },
  gpsDesc: { fontSize: 12, color: C.textMuted, marginTop: 2, lineHeight: 16 },
  gpsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.greenLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gpsPonto: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  gpsBadgeText: { fontSize: 11, fontWeight: "700", color: C.green },
  gpsBtn: {
    backgroundColor: C.brand,
    borderRadius: R.md,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsBtnStop: { backgroundColor: "#64748b" },
  gpsBtnText: { color: C.white, fontWeight: "700", fontSize: 14 },

  // Seção
  secaoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 22,
    marginBottom: 10,
  },
  secaoTitulo: { fontSize: 16, fontWeight: "800", color: C.text },
  secaoBadge: {
    backgroundColor: C.brand,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  secaoBadgeText: { color: C.white, fontSize: 12, fontWeight: "800" },

  // Vazio
  vazio: {
    backgroundColor: C.white,
    borderRadius: R.xl,
    padding: 36,
    marginHorizontal: 16,
    alignItems: "center",
    ...shadow.sm,
  },
  vazioEmoji: { fontSize: 44 },
  vazioTitulo: { fontSize: 15, fontWeight: "700", color: C.textMid, marginTop: 12 },
  vazioSub: { fontSize: 13, color: C.textLight, marginTop: 4, textAlign: "center" },

  // Pedido card
  pedidoCard: {
    backgroundColor: C.white,
    borderRadius: R.xl,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    ...shadow.md,
  },
  pedidoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  pedidoNum: { fontSize: 16, fontWeight: "800", color: C.text },
  pedidoEmpresa: { fontSize: 12, color: C.brand, fontWeight: "600", marginTop: 2 },
  statusTag: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusTagText: { fontSize: 11, fontWeight: "700" },

  taxaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.greenLight,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  taxaLabel: { fontSize: 12, fontWeight: "600", color: C.green },
  taxaValor: { fontSize: 18, fontWeight: "900", color: C.green },

  infoBox: {
    gap: 6,
    marginBottom: 14,
  },
  infoItem: { fontSize: 13, color: C.textMid, lineHeight: 18 },

  pedidoBtns: { flexDirection: "row", gap: 8, marginBottom: 10 },
  btnSecundario: {
    flex: 1,
    height: 44,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
  },
  btnSecundarioText: { fontSize: 13, fontWeight: "600", color: C.textMid },
  btnNavegar: {
    flex: 1,
    height: 44,
    borderRadius: R.md,
    backgroundColor: C.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  btnNavegarText: { fontSize: 13, fontWeight: "700", color: C.blue },
  btnEntregue: {
    backgroundColor: C.green,
    borderRadius: R.md,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  btnEntregueText: { color: C.white, fontWeight: "800", fontSize: 15 },
  btnDisabled: { opacity: 0.55 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    ...shadow.md,
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 14,
    color: C.brand,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 18,
  },
  modalDetalhe: {
    backgroundColor: C.bg,
    borderRadius: R.lg,
    padding: 14,
    gap: 8,
    marginBottom: 18,
  },
  modalDetalheItem: { fontSize: 13, color: C.textMid, lineHeight: 18 },
  modalTaxaText: { color: C.green, fontWeight: "700" },
  modalCheckRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 22 },
  modalCheckbox: {
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
  modalCheckboxMarcado: { backgroundColor: C.green, borderColor: C.green },
  checkMark: { color: C.white, fontSize: 14, fontWeight: "800" },
  modalCheckLabel: { flex: 1, fontSize: 13, color: C.textMid, lineHeight: 19 },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtnCancelar: {
    flex: 1,
    height: 50,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnCancelarText: { fontSize: 14, fontWeight: "700", color: C.textMid },
  modalBtnConfirmar: {
    flex: 2,
    height: 50,
    borderRadius: R.md,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnConfirmarText: { color: C.white, fontWeight: "800", fontSize: 14 },
});
