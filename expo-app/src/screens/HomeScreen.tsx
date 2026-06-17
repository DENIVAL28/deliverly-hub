import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Linking, Alert,
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

const ATIVOS = ["aguardando_confirmacao", "aguardando_pagamento", "novo", "aceito", "preparo", "entrega"];

const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function HomeScreen() {
  const [empresaId, setEmpresaId]   = useState<string | null>(null);
  const [userId, setUserId]         = useState<string | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState("Minha Loja");
  const [pedidos, setPedidos]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [abaAtiva, setAbaAtiva]     = useState<"ativos" | "todos">("ativos");

  // Carrega dados da empresa ao iniciar
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (!profile?.empresa_id) return;
      setEmpresaId(profile.empresa_id);

      const { data: empresa } = await supabase
        .from("empresas")
        .select("nome_fantasia")
        .eq("id", profile.empresa_id)
        .single();
      if (empresa) setNomeEmpresa(empresa.nome_fantasia ?? "Minha Loja");

      // Registra token de push
      await registerExpoPushToken(profile.empresa_id, user.id);
    }
    init();
  }, []);

  const buscarPedidos = useCallback(async () => {
    if (!empresaId) return;
    const query = supabase
      .from("pedidos")
      .select("id, numero, cliente_nome, total, status, tipo, forma_pagamento, created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (abaAtiva === "ativos") query.in("status", ATIVOS);

    const { data } = await query;
    setPedidos(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [empresaId, abaAtiva]);

  useEffect(() => { buscarPedidos(); }, [buscarPedidos]);

  // Realtime — atualiza lista quando chega pedido novo
  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel(`pedidos-app-${empresaId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "pedidos",
        filter: `empresa_id=eq.${empresaId}`,
      }, () => buscarPedidos())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [empresaId, buscarPedidos]);

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

  function abrirPedido(pedido: any) {
    Linking.openURL(`https://deliverly-hub.vercel.app/empresa/pedidos`);
  }

  const ativos = pedidos.filter((p) => ATIVOS.includes(p.status));

  function renderPedido({ item: p }: { item: any }) {
    const s = STATUS[p.status] ?? { bg: "#f4f4f5", text: "#71717a", label: p.status };
    const data = new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return (
      <TouchableOpacity style={styles.card} onPress={() => abrirPedido(p)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <Text style={styles.numero}>#{p.numero}</Text>
          <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
          </View>
        </View>
        <Text style={styles.cliente}>{p.cliente_nome}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.total}>{fmt(p.total)}</Text>
          <Text style={styles.horario}>{data} · {p.forma_pagamento ?? "—"}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitulo}>{nomeEmpresa}</Text>
          <Text style={styles.headerSub}>
            {ativos.length > 0 ? `${ativos.length} pedido${ativos.length > 1 ? "s" : ""} ativo${ativos.length > 1 ? "s" : ""}` : "Nenhum pedido ativo"}
          </Text>
        </View>
        <TouchableOpacity onPress={sair} style={styles.sairBotao}>
          <Text style={styles.sairTexto}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Abas */}
      <View style={styles.abas}>
        {(["ativos", "todos"] as const).map((aba) => (
          <TouchableOpacity
            key={aba}
            style={[styles.aba, abaAtiva === aba && styles.abaAtiva]}
            onPress={() => setAbaAtiva(aba)}
          >
            <Text style={[styles.abaTexto, abaAtiva === aba && styles.abaTextoAtivo]}>
              {aba === "ativos" ? `Ativos${ativos.length > 0 ? ` (${ativos.length})` : ""}` : "Todos"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      <FlatList
        data={pedidos}
        keyExtractor={(p) => p.id}
        renderItem={renderPedido}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); buscarPedidos(); }} colors={["#f97316"]} />
        }
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={styles.vazioCentro}>🎉</Text>
            <Text style={styles.vazioTexto}>
              {abaAtiva === "ativos" ? "Nenhum pedido ativo no momento" : "Nenhum pedido ainda"}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#e4e4e7",
  },
  headerTitulo: { fontSize: 18, fontWeight: "800", color: "#18181b" },
  headerSub: { fontSize: 12, color: "#71717a", marginTop: 2 },
  sairBotao: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#f4f4f5" },
  sairTexto: { fontSize: 13, color: "#71717a", fontWeight: "600" },

  abas: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 0 },
  aba: { paddingVertical: 12, paddingHorizontal: 4, marginRight: 20, borderBottomWidth: 2, borderBottomColor: "transparent" },
  abaAtiva: { borderBottomColor: "#f97316" },
  abaTexto: { fontSize: 14, color: "#71717a", fontWeight: "600" },
  abaTextoAtivo: { color: "#f97316" },

  lista: { padding: 12, gap: 10 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  numero: { fontSize: 16, fontWeight: "800", color: "#18181b" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  cliente: { fontSize: 14, color: "#3f3f46", marginBottom: 8 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  total: { fontSize: 15, fontWeight: "700", color: "#18181b" },
  horario: { fontSize: 12, color: "#a1a1aa" },

  vazio: { flex: 1, alignItems: "center", paddingTop: 60 },
  vazioCentro: { fontSize: 40 },
  vazioTexto: { fontSize: 14, color: "#a1a1aa", marginTop: 8 },
});
