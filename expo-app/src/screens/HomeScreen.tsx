import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { registerExpoPushToken, removeExpoPushToken } from "../lib/notifications";

const STATUS: Record<string, { bg: string; text: string; label: string }> = {
  aguardando_confirmacao: { bg: "#f4f4f5", text: "#71717a", label: "Aguard. confirmação" },
  aguardando_pagamento:   { bg: "#dbeafe", text: "#1d4ed8", label: "Aguard. pagamento" },
  novo:       { bg: "#dbeafe", text: "#1d4ed8",  label: "Novo" },
  aceito:     { bg: "#fef3c7", text: "#d97706",  label: "Aceito" },
  preparo:    { bg: "#ffedd5", text: "#ea580c",  label: "Em preparo" },
  entrega:    { bg: "#ede9fe", text: "#7c3aed",  label: "Saiu p/ entrega" },
  finalizado: { bg: "#dcfce7", text: "#16a34a",  label: "Finalizado" },
  cancelado:  { bg: "#fee2e2", text: "#dc2626",  label: "Cancelado" },
};

// Fluxos de status por tipo de pedido
function getNext(pedido: any): string | null {
  const s = pedido.status;
  const tipo = pedido.tipo;

  if (s === "aguardando_confirmacao") return "aguardando_pagamento";
  if (s === "aguardando_pagamento")   return "aceito";

  if (tipo === "pdv" || tipo === "balcao") {
    const map: Record<string, string> = { novo: "aceito", aceito: "finalizado" };
    return map[s] ?? null;
  }
  if (tipo === "mesa" || tipo === "retirada") {
    const map: Record<string, string> = { novo: "aceito", aceito: "preparo", preparo: "finalizado" };
    return map[s] ?? null;
  }
  // delivery
  const map: Record<string, string> = { novo: "aceito", aceito: "preparo", preparo: "entrega", entrega: "finalizado" };
  return map[s] ?? null;
}

function getNextLabel(pedido: any): string {
  const s = pedido.status;
  const labels: Record<string, string> = {
    aguardando_confirmacao: "Confirmar pedido",
    aguardando_pagamento:   "Confirmar pagamento",
    novo: "Aceitar",
    aceito: "Iniciar preparo",
    preparo: pedido.tipo === "mesa" || pedido.tipo === "retirada" ? "Finalizar" : "Saiu p/ entrega",
    entrega: "Finalizar entrega",
  };
  return labels[s] ?? "Avançar";
}

const ATIVOS = ["aguardando_confirmacao", "aguardando_pagamento", "novo", "aceito", "preparo", "entrega"];
const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const timeAgo = (date: string) => {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  return `${Math.floor(mins / 60)}h atrás`;
};

export default function HomeScreen() {
  const [empresaId, setEmpresaId]         = useState<string | null>(null);
  const [userId, setUserId]               = useState<string | null>(null);
  const [nomeEmpresa, setNomeEmpresa]     = useState("Minha Loja");
  const [lojaAberta, setLojaAberta]       = useState(true);
  const [pedidos, setPedidos]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [abaAtiva, setAbaAtiva]           = useState<"ativos" | "hoje" | "todos">("ativos");
  const [pedidoDetalhe, setPedidoDetalhe] = useState<any | null>(null);
  const [itensPedido, setItensPedido]     = useState<any[]>([]);
  const [avancando, setAvancando]         = useState(false);
  const [togglingLoja, setTogglingLoja]   = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles").select("empresa_id").eq("id", user.id).single();
      if (!profile?.empresa_id) return;
      setEmpresaId(profile.empresa_id);
      const { data: empresa } = await supabase
        .from("empresas").select("nome_fantasia, aberto").eq("id", profile.empresa_id).single();
      if (empresa) {
        setNomeEmpresa(empresa.nome_fantasia ?? "Minha Loja");
        setLojaAberta(empresa.aberto ?? true);
      }
      await registerExpoPushToken(profile.empresa_id, user.id);
    }
    init();
  }, []);

  const buscarPedidos = useCallback(async () => {
    if (!empresaId) return;
    let query = supabase
      .from("pedidos")
      .select("id, numero, cliente_nome, cliente_telefone, total, subtotal, desconto, taxa_entrega, status, tipo, forma_pagamento, observacao, cliente_endereco, created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (abaAtiva === "ativos") {
      query = query.in("status", ATIVOS);
    } else if (abaAtiva === "hoje") {
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      query = query.gte("created_at", hoje.toISOString());
    }

    const { data } = await query;
    setPedidos(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [empresaId, abaAtiva]);

  useEffect(() => { buscarPedidos(); }, [buscarPedidos]);

  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel(`pedidos-lojista-${empresaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresaId}` },
        () => buscarPedidos())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [empresaId, buscarPedidos]);

  async function abrirDetalhe(pedido: any) {
    setPedidoDetalhe(pedido);
    setItensPedido([]);
    const { data } = await supabase
      .from("pedido_itens")
      .select("quantidade, preco_unitario, observacao, produtos(nome)")
      .eq("pedido_id", pedido.id);
    setItensPedido(data ?? []);
  }

  async function avancarStatus(pedido: any) {
    const proximo = getNext(pedido);
    if (!proximo) return;
    setAvancando(true);
    await supabase.from("pedidos").update({ status: proximo }).eq("id", pedido.id);
    const atualizado = { ...pedido, status: proximo };
    setPedidoDetalhe(atualizado);
    setAvancando(false);
    buscarPedidos();
  }

  async function cancelarPedido(pedido: any) {
    Alert.alert("Cancelar pedido", `Cancelar pedido #${pedido.numero}?`, [
      { text: "Não", style: "cancel" },
      {
        text: "Cancelar pedido", style: "destructive",
        onPress: async () => {
          await supabase.from("pedidos").update({ status: "cancelado" }).eq("id", pedido.id);
          setPedidoDetalhe(null);
          buscarPedidos();
        },
      },
    ]);
  }

  async function toggleLoja() {
    if (!empresaId) return;
    setTogglingLoja(true);
    const novoStatus = !lojaAberta;
    await supabase.from("empresas").update({ aberto: novoStatus }).eq("id", empresaId);
    setLojaAberta(novoStatus);
    setTogglingLoja(false);
  }

  async function sair() {
    Alert.alert("Sair", "Deseja sair do app?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair", style: "destructive",
        onPress: async () => {
          if (userId) await removeExpoPushToken(userId);
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  const hoje = new Date().toDateString();
  const pedidosHoje = pedidos.filter((p) => new Date(p.created_at).toDateString() === hoje);
  const faturamentoHoje = pedidosHoje.filter((p) => p.status === "finalizado").reduce((s, p) => s + Number(p.total), 0);
  const finalizadosHoje = pedidosHoje.filter((p) => p.status === "finalizado").length;
  const ativos = pedidos.filter((p) => ATIVOS.includes(p.status));

  function renderPedido({ item: p }: { item: any }) {
    const st = STATUS[p.status] ?? { bg: "#f4f4f5", text: "#71717a", label: p.status };
    const hora = new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const proximo = getNext(p);
    return (
      <TouchableOpacity style={styles.card} onPress={() => abrirDetalhe(p)} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.numero}>#{p.numero}</Text>
            <View style={styles.tipoBadge}><Text style={styles.tipoTexto}>{p.tipo?.toUpperCase()}</Text></View>
          </View>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.text }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.cliente}>{p.cliente_nome}</Text>
        {p.cliente_endereco && p.tipo === "delivery" && (
          <Text style={styles.endereco} numberOfLines={1}>📍 {p.cliente_endereco}</Text>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.total}>{fmt(p.total)}</Text>
          <Text style={styles.horario}>{hora} · {timeAgo(p.created_at)}</Text>
        </View>
        {proximo && (
          <TouchableOpacity style={styles.avancarBtn} onPress={() => avancarStatus(p)}>
            <Text style={styles.avancarTexto}>{getNextLabel(p)} →</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#f97316" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>{nomeEmpresa}</Text>
          <Text style={styles.headerSub}>{ativos.length > 0 ? `${ativos.length} ativo${ativos.length > 1 ? "s" : ""}` : "Sem pedidos ativos"}</Text>
        </View>
        <TouchableOpacity style={[styles.toggleLoja, { backgroundColor: lojaAberta ? "#dcfce7" : "#fee2e2" }]} onPress={toggleLoja} disabled={togglingLoja}>
          <Text style={[styles.toggleLojaTexto, { color: lojaAberta ? "#16a34a" : "#dc2626" }]}>
            {togglingLoja ? "..." : lojaAberta ? "🟢 Aberta" : "🔴 Fechada"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={sair} style={styles.sairBotao}>
          <Text style={styles.sairTexto}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Dashboard */}
      <View style={styles.dashboard}>
        <View style={styles.dashCard}>
          <Text style={styles.dashValor}>{ativos.length}</Text>
          <Text style={styles.dashLabel}>Em aberto</Text>
        </View>
        <View style={styles.dashDivider} />
        <View style={styles.dashCard}>
          <Text style={styles.dashValor}>{finalizadosHoje}</Text>
          <Text style={styles.dashLabel}>Finalizados hoje</Text>
        </View>
        <View style={styles.dashDivider} />
        <View style={styles.dashCard}>
          <Text style={[styles.dashValor, { fontSize: 13 }]}>{fmt(faturamentoHoje)}</Text>
          <Text style={styles.dashLabel}>Faturado hoje</Text>
        </View>
      </View>

      {/* Abas */}
      <View style={styles.abas}>
        {(["ativos", "hoje", "todos"] as const).map((aba) => (
          <TouchableOpacity key={aba} style={[styles.aba, abaAtiva === aba && styles.abaAtiva]} onPress={() => setAbaAtiva(aba)}>
            <Text style={[styles.abaTexto, abaAtiva === aba && styles.abaTextoAtivo]}>
              {aba === "ativos" ? `Ativos${ativos.length > 0 ? ` (${ativos.length})` : ""}` : aba === "hoje" ? "Hoje" : "Histórico"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={pedidos}
        keyExtractor={(p) => p.id}
        renderItem={renderPedido}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); buscarPedidos(); }} colors={["#f97316"]} />}
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={{ fontSize: 40 }}>🎉</Text>
            <Text style={styles.vazioTexto}>{abaAtiva === "ativos" ? "Nenhum pedido ativo" : "Nenhum pedido"}</Text>
          </View>
        }
      />

      {/* Modal detalhe */}
      <Modal visible={!!pedidoDetalhe} animationType="slide" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPedidoDetalhe(null)} />
        {pedidoDetalhe && (
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalNumero}>Pedido #{pedidoDetalhe.numero}</Text>
                  <Text style={styles.modalTipo}>{pedidoDetalhe.tipo?.toUpperCase()} · {new Date(pedidoDetalhe.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: STATUS[pedidoDetalhe.status]?.bg ?? "#f4f4f5" }]}>
                  <Text style={[styles.badgeText, { color: STATUS[pedidoDetalhe.status]?.text ?? "#71717a" }]}>
                    {STATUS[pedidoDetalhe.status]?.label ?? pedidoDetalhe.status}
                  </Text>
                </View>
              </View>

              <View style={styles.modalSecao}>
                <Text style={styles.modalLabel}>CLIENTE</Text>
                <Text style={styles.modalValor}>{pedidoDetalhe.cliente_nome}</Text>
                {pedidoDetalhe.cliente_telefone && <Text style={styles.modalSub}>📞 {pedidoDetalhe.cliente_telefone}</Text>}
                {pedidoDetalhe.cliente_endereco && <Text style={styles.modalSub}>📍 {pedidoDetalhe.cliente_endereco}</Text>}
              </View>

              {/* Itens */}
              {itensPedido.length > 0 && (
                <View style={styles.modalSecao}>
                  <Text style={styles.modalLabel}>ITENS</Text>
                  {itensPedido.map((item, i) => (
                    <View key={i} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{item.quantidade}×</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemNome}>{item.produtos?.nome}</Text>
                        {item.observacao && <Text style={styles.itemObs}>{item.observacao}</Text>}
                      </View>
                      <Text style={styles.itemPreco}>{fmt(Number(item.preco_unitario) * item.quantidade)}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.modalSecao}>
                <Text style={styles.modalLabel}>VALORES</Text>
                {pedidoDetalhe.subtotal > 0 && pedidoDetalhe.subtotal !== pedidoDetalhe.total && (
                  <View style={styles.valorRow}><Text style={styles.valorLabel}>Subtotal</Text><Text style={styles.valorVal}>{fmt(pedidoDetalhe.subtotal)}</Text></View>
                )}
                {pedidoDetalhe.desconto > 0 && (
                  <View style={styles.valorRow}><Text style={styles.valorLabel}>Desconto</Text><Text style={[styles.valorVal, { color: "#16a34a" }]}>-{fmt(pedidoDetalhe.desconto)}</Text></View>
                )}
                {pedidoDetalhe.taxa_entrega > 0 && (
                  <View style={styles.valorRow}><Text style={styles.valorLabel}>Taxa entrega</Text><Text style={styles.valorVal}>{fmt(pedidoDetalhe.taxa_entrega)}</Text></View>
                )}
                <View style={[styles.valorRow, { marginTop: 4 }]}>
                  <Text style={[styles.valorLabel, { fontWeight: "800", color: "#18181b" }]}>Total</Text>
                  <Text style={[styles.valorVal, { fontWeight: "800", color: "#f97316" }]}>{fmt(pedidoDetalhe.total)}</Text>
                </View>
                <View style={styles.valorRow}><Text style={styles.valorLabel}>Pagamento</Text><Text style={styles.valorVal}>{pedidoDetalhe.forma_pagamento}</Text></View>
              </View>

              {pedidoDetalhe.observacao && (
                <View style={styles.modalSecao}>
                  <Text style={styles.modalLabel}>OBSERVAÇÃO</Text>
                  <Text style={styles.modalValor}>{pedidoDetalhe.observacao}</Text>
                </View>
              )}

              {getNext(pedidoDetalhe) && (
                <TouchableOpacity
                  style={[styles.botaoAvancar, avancando && { opacity: 0.7 }]}
                  onPress={() => avancarStatus(pedidoDetalhe)}
                  disabled={avancando}
                >
                  {avancando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botaoAvancarTexto}>{getNextLabel(pedidoDetalhe)} →</Text>}
                </TouchableOpacity>
              )}

              {!["finalizado", "cancelado"].includes(pedidoDetalhe.status) && (
                <TouchableOpacity style={styles.botaoCancelar} onPress={() => cancelarPedido(pedidoDetalhe)}>
                  <Text style={styles.botaoCancelarTexto}>Cancelar pedido</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e4e4e7", gap: 8 },
  headerTitulo: { fontSize: 17, fontWeight: "800", color: "#18181b" },
  headerSub: { fontSize: 11, color: "#71717a", marginTop: 1 },
  toggleLoja: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  toggleLojaTexto: { fontSize: 12, fontWeight: "700" },
  sairBotao: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#f4f4f5" },
  sairTexto: { fontSize: 13, color: "#71717a", fontWeight: "600" },
  dashboard: { flexDirection: "row", backgroundColor: "#fff", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  dashCard: { flex: 1, alignItems: "center" },
  dashValor: { fontSize: 15, fontWeight: "800", color: "#18181b" },
  dashLabel: { fontSize: 10, color: "#a1a1aa", marginTop: 1 },
  dashDivider: { width: 1, backgroundColor: "#e4e4e7" },
  abas: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 16 },
  aba: { paddingVertical: 11, paddingHorizontal: 4, marginRight: 16, borderBottomWidth: 2, borderBottomColor: "transparent" },
  abaAtiva: { borderBottomColor: "#f97316" },
  abaTexto: { fontSize: 13, color: "#71717a", fontWeight: "600" },
  abaTextoAtivo: { color: "#f97316" },
  lista: { padding: 12, gap: 10 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, elevation: 2, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  numero: { fontSize: 16, fontWeight: "800", color: "#18181b" },
  tipoBadge: { backgroundColor: "#f4f4f5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tipoTexto: { fontSize: 9, fontWeight: "700", color: "#a1a1aa" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  cliente: { fontSize: 14, color: "#3f3f46", marginBottom: 2 },
  endereco: { fontSize: 11, color: "#a1a1aa", marginBottom: 6 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  total: { fontSize: 15, fontWeight: "700", color: "#18181b" },
  horario: { fontSize: 12, color: "#a1a1aa" },
  avancarBtn: { marginTop: 10, backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  avancarTexto: { color: "#fff", fontSize: 14, fontWeight: "700" },
  vazio: { alignItems: "center", paddingTop: 60, gap: 8 },
  vazioTexto: { fontSize: 14, color: "#a1a1aa" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" },
  modalHandle: { width: 36, height: 4, backgroundColor: "#e4e4e7", borderRadius: 2, alignSelf: "center", marginTop: 10 },
  modalScroll: { padding: 20, gap: 14 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  modalNumero: { fontSize: 20, fontWeight: "800", color: "#18181b" },
  modalTipo: { fontSize: 12, color: "#a1a1aa", marginTop: 2 },
  modalSecao: { gap: 6, backgroundColor: "#f9f9f9", borderRadius: 12, padding: 12 },
  modalLabel: { fontSize: 10, fontWeight: "800", color: "#a1a1aa", letterSpacing: 0.8 },
  modalValor: { fontSize: 14, fontWeight: "600", color: "#18181b" },
  modalSub: { fontSize: 13, color: "#71717a" },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  itemQty: { fontSize: 13, fontWeight: "700", color: "#f97316", width: 26 },
  itemNome: { fontSize: 13, fontWeight: "600", color: "#18181b" },
  itemObs: { fontSize: 11, color: "#a1a1aa" },
  itemPreco: { fontSize: 13, fontWeight: "700", color: "#18181b" },
  valorRow: { flexDirection: "row", justifyContent: "space-between" },
  valorLabel: { fontSize: 13, color: "#71717a" },
  valorVal: { fontSize: 13, fontWeight: "600", color: "#18181b" },
  botaoAvancar: { backgroundColor: "#f97316", borderRadius: 14, height: 52, justifyContent: "center", alignItems: "center" },
  botaoAvancarTexto: { color: "#fff", fontSize: 16, fontWeight: "800" },
  botaoCancelar: { borderWidth: 1.5, borderColor: "#fee2e2", borderRadius: 14, height: 48, justifyContent: "center", alignItems: "center" },
  botaoCancelarTexto: { color: "#dc2626", fontSize: 14, fontWeight: "700" },
});
