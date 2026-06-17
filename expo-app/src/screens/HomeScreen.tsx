import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { registerExpoPushToken, removeExpoPushToken } from "../lib/notifications";

const STATUS: Record<string, { bg: string; text: string; label: string }> = {
  aguardando_confirmacao: { bg: "#f4f4f5", text: "#71717a", label: "Aguardando" },
  aguardando_pagamento:   { bg: "#dbeafe", text: "#1d4ed8", label: "Aguard. pgto" },
  novo:       { bg: "#dbeafe", text: "#1d4ed8",  label: "Novo" },
  aceito:     { bg: "#fef3c7", text: "#d97706",  label: "Aceito" },
  preparo:    { bg: "#ffedd5", text: "#ea580c",  label: "Em preparo" },
  entrega:    { bg: "#ede9fe", text: "#7c3aed",  label: "Saiu p/ entrega" },
  finalizado: { bg: "#dcfce7", text: "#16a34a",  label: "Finalizado" },
  cancelado:  { bg: "#fee2e2", text: "#dc2626",  label: "Cancelado" },
};

const NEXT: Record<string, string> = {
  aguardando_confirmacao: "novo",
  novo: "aceito", aceito: "preparo", preparo: "entrega", entrega: "finalizado",
};

const NEXT_LABEL: Record<string, string> = {
  aguardando_confirmacao: "Confirmar",
  novo: "Aceitar", aceito: "Iniciar preparo", preparo: "Saiu p/ entrega", entrega: "Finalizar",
};

const ATIVOS = ["aguardando_confirmacao", "aguardando_pagamento", "novo", "aceito", "preparo", "entrega"];
const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function HomeScreen() {
  const [empresaId, setEmpresaId]       = useState<string | null>(null);
  const [userId, setUserId]             = useState<string | null>(null);
  const [nomeEmpresa, setNomeEmpresa]   = useState("Minha Loja");
  const [pedidos, setPedidos]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [abaAtiva, setAbaAtiva]         = useState<"ativos" | "todos">("ativos");
  const [pedidoDetalhe, setPedidoDetalhe] = useState<any | null>(null);
  const [avancando, setAvancando]       = useState(false);

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
        .from("empresas").select("nome_fantasia").eq("id", profile.empresa_id).single();
      if (empresa) setNomeEmpresa(empresa.nome_fantasia ?? "Minha Loja");

      await registerExpoPushToken(profile.empresa_id, user.id);
    }
    init();
  }, []);

  const buscarPedidos = useCallback(async () => {
    if (!empresaId) return;
    let query = supabase
      .from("pedidos")
      .select("id, numero, cliente_nome, total, status, tipo, forma_pagamento, observacao, created_at, cliente_endereco:pedidos(endereco_entrega), pedido_itens(quantidade, observacao, produtos(nome, preco))")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (abaAtiva === "ativos") query = query.in("status", ATIVOS);

    const { data } = await query;
    setPedidos(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [empresaId, abaAtiva]);

  // query simples sem joins (mais segura)
  const buscarPedidosSimples = useCallback(async () => {
    if (!empresaId) return;
    let query = supabase
      .from("pedidos")
      .select("id, numero, cliente_nome, total, status, tipo, forma_pagamento, observacao, endereco_entrega, created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (abaAtiva === "ativos") query = query.in("status", ATIVOS);

    const { data } = await query;
    setPedidos(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [empresaId, abaAtiva]);

  useEffect(() => { buscarPedidosSimples(); }, [buscarPedidosSimples]);

  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel(`pedidos-lojista-${empresaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresaId}` },
        () => buscarPedidosSimples())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [empresaId, buscarPedidosSimples]);

  async function avancarStatus(pedido: any) {
    const proximo = NEXT[pedido.status];
    if (!proximo) return;
    setAvancando(true);
    await supabase.from("pedidos").update({ status: proximo }).eq("id", pedido.id);
    setAvancando(false);
    setPedidoDetalhe((prev: any) => prev ? { ...prev, status: proximo } : null);
    buscarPedidosSimples();
  }

  async function cancelarPedido(pedido: any) {
    Alert.alert("Cancelar pedido", `Cancelar pedido #${pedido.numero}?`, [
      { text: "Não", style: "cancel" },
      {
        text: "Cancelar", style: "destructive",
        onPress: async () => {
          await supabase.from("pedidos").update({ status: "cancelado" }).eq("id", pedido.id);
          setPedidoDetalhe(null);
          buscarPedidosSimples();
        },
      },
    ]);
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

  const ativos = pedidos.filter((p) => ATIVOS.includes(p.status));

  function renderPedido({ item: p }: { item: any }) {
    const st = STATUS[p.status] ?? { bg: "#f4f4f5", text: "#71717a", label: p.status };
    const hora = new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return (
      <TouchableOpacity style={styles.card} onPress={() => setPedidoDetalhe(p)} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.numero}>#{p.numero}</Text>
            <Text style={styles.tipo}>{p.tipo?.toUpperCase()}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.text }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.cliente}>{p.cliente_nome}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.total}>{fmt(p.total)}</Text>
          <Text style={styles.horario}>{hora} · {p.forma_pagamento ?? "—"}</Text>
        </View>
        {NEXT[p.status] && (
          <TouchableOpacity
            style={styles.avancarBtn}
            onPress={(e) => { e.stopPropagation?.(); avancarStatus(p); }}
          >
            <Text style={styles.avancarTexto}>{NEXT_LABEL[p.status]} →</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#f97316" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitulo}>{nomeEmpresa}</Text>
          <Text style={styles.headerSub}>
            {ativos.length > 0 ? `${ativos.length} pedido${ativos.length > 1 ? "s" : ""} ativo${ativos.length > 1 ? "s" : ""}` : "Sem pedidos ativos"}
          </Text>
        </View>
        <TouchableOpacity onPress={sair} style={styles.sairBotao}>
          <Text style={styles.sairTexto}>Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.abas}>
        {(["ativos", "todos"] as const).map((aba) => (
          <TouchableOpacity key={aba} style={[styles.aba, abaAtiva === aba && styles.abaAtiva]} onPress={() => setAbaAtiva(aba)}>
            <Text style={[styles.abaTexto, abaAtiva === aba && styles.abaTextoAtivo]}>
              {aba === "ativos" ? `Ativos${ativos.length > 0 ? ` (${ativos.length})` : ""}` : "Histórico"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={pedidos}
        keyExtractor={(p) => p.id}
        renderItem={renderPedido}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); buscarPedidosSimples(); }} colors={["#f97316"]} />}
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={{ fontSize: 40 }}>🎉</Text>
            <Text style={styles.vazioTexto}>{abaAtiva === "ativos" ? "Nenhum pedido ativo" : "Nenhum pedido ainda"}</Text>
          </View>
        }
      />

      {/* Modal detalhe do pedido */}
      <Modal visible={!!pedidoDetalhe} animationType="slide" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPedidoDetalhe(null)} />
        {pedidoDetalhe && (
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalNumero}>Pedido #{pedidoDetalhe.numero}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS[pedidoDetalhe.status]?.bg ?? "#f4f4f5" }]}>
                  <Text style={[styles.badgeText, { color: STATUS[pedidoDetalhe.status]?.text ?? "#71717a" }]}>
                    {STATUS[pedidoDetalhe.status]?.label ?? pedidoDetalhe.status}
                  </Text>
                </View>
              </View>

              <View style={styles.modalSecao}>
                <Text style={styles.modalLabel}>CLIENTE</Text>
                <Text style={styles.modalValor}>{pedidoDetalhe.cliente_nome}</Text>
                {pedidoDetalhe.endereco_entrega && (
                  <Text style={styles.modalSub}>{pedidoDetalhe.endereco_entrega}</Text>
                )}
              </View>

              <View style={styles.modalSecao}>
                <Text style={styles.modalLabel}>PAGAMENTO</Text>
                <Text style={styles.modalValor}>{pedidoDetalhe.forma_pagamento} · {fmt(pedidoDetalhe.total)}</Text>
              </View>

              {pedidoDetalhe.observacao && (
                <View style={styles.modalSecao}>
                  <Text style={styles.modalLabel}>OBSERVAÇÃO</Text>
                  <Text style={styles.modalValor}>{pedidoDetalhe.observacao}</Text>
                </View>
              )}

              {NEXT[pedidoDetalhe.status] && (
                <TouchableOpacity
                  style={[styles.botaoAvancar, avancando && { opacity: 0.7 }]}
                  onPress={() => avancarStatus(pedidoDetalhe)}
                  disabled={avancando}
                >
                  {avancando
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.botaoAvancarTexto}>{NEXT_LABEL[pedidoDetalhe.status]} →</Text>
                  }
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  headerTitulo: { fontSize: 18, fontWeight: "800", color: "#18181b" },
  headerSub: { fontSize: 12, color: "#71717a", marginTop: 2 },
  sairBotao: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#f4f4f5" },
  sairTexto: { fontSize: 13, color: "#71717a", fontWeight: "600" },
  abas: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 16 },
  aba: { paddingVertical: 12, paddingHorizontal: 4, marginRight: 20, borderBottomWidth: 2, borderBottomColor: "transparent" },
  abaAtiva: { borderBottomColor: "#f97316" },
  abaTexto: { fontSize: 14, color: "#71717a", fontWeight: "600" },
  abaTextoAtivo: { color: "#f97316" },
  lista: { padding: 12, gap: 10 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, elevation: 2, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  numero: { fontSize: 16, fontWeight: "800", color: "#18181b" },
  tipo: { fontSize: 10, fontWeight: "700", color: "#a1a1aa", backgroundColor: "#f4f4f5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  cliente: { fontSize: 14, color: "#3f3f46", marginBottom: 8 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between" },
  total: { fontSize: 15, fontWeight: "700", color: "#18181b" },
  horario: { fontSize: 12, color: "#a1a1aa" },
  avancarBtn: { marginTop: 10, backgroundColor: "#f97316", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  avancarTexto: { color: "#fff", fontSize: 14, fontWeight: "700" },
  vazio: { alignItems: "center", paddingTop: 60, gap: 8 },
  vazioTexto: { fontSize: 14, color: "#a1a1aa" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", paddingBottom: 24 },
  modalHandle: { width: 36, height: 4, backgroundColor: "#e4e4e7", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  modalScroll: { padding: 20, gap: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalNumero: { fontSize: 20, fontWeight: "800", color: "#18181b" },
  modalSecao: { gap: 4 },
  modalLabel: { fontSize: 11, fontWeight: "800", color: "#a1a1aa", letterSpacing: 0.8 },
  modalValor: { fontSize: 15, fontWeight: "600", color: "#18181b" },
  modalSub: { fontSize: 13, color: "#71717a" },
  botaoAvancar: { backgroundColor: "#f97316", borderRadius: 14, height: 52, justifyContent: "center", alignItems: "center", marginTop: 8 },
  botaoAvancarTexto: { color: "#fff", fontSize: 16, fontWeight: "800" },
  botaoCancelar: { borderWidth: 1.5, borderColor: "#fee2e2", borderRadius: 14, height: 48, justifyContent: "center", alignItems: "center", marginTop: 8 },
  botaoCancelarTexto: { color: "#dc2626", fontSize: 14, fontWeight: "700" },
});
