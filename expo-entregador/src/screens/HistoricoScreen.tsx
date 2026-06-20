import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { C, R, shadow } from "@/theme";

interface PedidoHistorico {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_endereco: string | null;
  taxa_entrega: number;
  status: string;
  created_at: string;
  empresa_nome: string | null;
}

type Filtro = "hoje" | "7d" | "mes" | "todos";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "hoje",  label: "Hoje" },
  { value: "7d",    label: "7 dias" },
  { value: "mes",   label: "Este mês" },
  { value: "todos", label: "Todos" },
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function filtrarPedidos(pedidos: PedidoHistorico[], filtro: Filtro): PedidoHistorico[] {
  const agora = new Date();
  return pedidos.filter((p) => {
    const d = new Date(p.created_at);
    switch (filtro) {
      case "hoje":
        return d.toDateString() === agora.toDateString();
      case "7d": {
        const limite = new Date(agora);
        limite.setDate(limite.getDate() - 7);
        return d >= limite;
      }
      case "mes":
        return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
      default:
        return true;
    }
  });
}

function labelPeriodo(filtro: Filtro) {
  switch (filtro) {
    case "hoje": return "hoje";
    case "7d":   return "nos últimos 7 dias";
    case "mes":  return "este mês";
    default:     return "no total";
  }
}

export default function HistoricoScreen() {
  const [pedidos, setPedidos] = useState<PedidoHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [filtro, setFiltro]   = useState<Filtro>("hoje");

  const carregar = useCallback(async () => {
    const { data } = await (supabase as any).rpc("entregador_historico_auth");
    if (data) setPedidos(data as PedidoHistorico[]);
  }, []);

  useEffect(() => {
    carregar().finally(() => setLoading(false));
  }, [carregar]);

  async function onRefresh() {
    setRefresh(true);
    await carregar();
    setRefresh(false);
  }

  const pedidosFiltrados = useMemo(() => filtrarPedidos(pedidos, filtro), [pedidos, filtro]);
  const ganhos     = useMemo(() => pedidosFiltrados.reduce((acc, p) => acc + Number(p.taxa_entrega), 0), [pedidosFiltrados]);
  const quantidade = pedidosFiltrados.length;

  if (loading) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={C.brand} />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.lista}
      contentContainerStyle={styles.content}
      data={pedidosFiltrados}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={C.brand} />}
      ListHeaderComponent={
        <>
          {/* Card de resumo */}
          <View style={styles.resumoCard}>
            <Text style={styles.resumoEmoji}>💰</Text>
            <Text style={styles.resumoValor}>{fmt(ganhos)}</Text>
            <Text style={styles.resumoQtd}>
              {quantidade} entrega{quantidade !== 1 ? "s" : ""} {labelPeriodo(filtro)}
            </Text>
          </View>

          {/* Filtros */}
          <View style={styles.filtrosRow}>
            {FILTROS.map((f) => (
              <TouchableOpacity
                key={f.value}
                style={[styles.filtroBtn, filtro === f.value && styles.filtroBtnAtivo]}
                onPress={() => setFiltro(f.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filtroBtnText, filtro === f.value && styles.filtroBtnTextAtivo]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.vazio}>
          <Text style={styles.vazioEmoji}>📋</Text>
          <Text style={styles.vazioTitulo}>
            {filtro === "hoje" ? "Nenhuma entrega hoje ainda" : "Nenhuma entrega no período"}
          </Text>
          <Text style={styles.vazioSub}>
            {filtro === "hoje"
              ? "Suas entregas de hoje aparecerão aqui."
              : "Tente selecionar um período maior."}
          </Text>
        </View>
      }
      renderItem={({ item: p }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardNum}>Pedido #{p.numero}</Text>
              {p.empresa_nome && (
                <Text style={styles.cardEmpresa}>{p.empresa_nome}</Text>
              )}
            </View>
            <Text style={styles.cardTaxa}>{fmt(p.taxa_entrega)}</Text>
          </View>
          <View style={styles.cardDivider} />
          <Text style={styles.cardCliente}>👤  {p.cliente_nome}</Text>
          {p.cliente_endereco && (
            <Text style={styles.cardEndereco}>📍  {p.cliente_endereco}</Text>
          )}
          <Text style={styles.cardData}>✅  {formatarData(p.created_at)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: C.textMuted },

  resumoCard: {
    backgroundColor: C.green,
    borderRadius: R.xl,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 14,
    ...shadow.md,
  },
  resumoEmoji: { fontSize: 32, marginBottom: 6 },
  resumoValor: {
    fontSize: 38,
    fontWeight: "900",
    color: C.white,
    letterSpacing: -1,
  },
  resumoQtd: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    marginTop: 4,
  },

  filtrosRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filtroBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    backgroundColor: C.white,
  },
  filtroBtnAtivo: { borderColor: C.brand, backgroundColor: C.brandLight },
  filtroBtnText: { fontSize: 12, fontWeight: "600", color: C.textMuted },
  filtroBtnTextAtivo: { color: C.brand, fontWeight: "700" },

  vazio: { alignItems: "center", paddingVertical: 48 },
  vazioEmoji: { fontSize: 48 },
  vazioTitulo: { fontSize: 15, fontWeight: "700", color: C.textMid, marginTop: 14, textAlign: "center" },
  vazioSub: { fontSize: 13, color: C.textLight, marginTop: 6, textAlign: "center" },

  card: {
    backgroundColor: C.white,
    borderRadius: R.xl,
    padding: 16,
    marginBottom: 10,
    ...shadow.sm,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardNum: { fontSize: 14, fontWeight: "800", color: C.text },
  cardEmpresa: { fontSize: 11, color: C.brand, fontWeight: "600", marginTop: 2 },
  cardTaxa: { fontSize: 17, fontWeight: "900", color: C.green },
  cardDivider: { height: 1, backgroundColor: C.border, marginBottom: 10 },
  cardCliente: { fontSize: 13, color: C.textMid, marginBottom: 4 },
  cardEndereco: { fontSize: 12, color: C.textMuted, lineHeight: 17, marginBottom: 4 },
  cardData: { fontSize: 11, color: C.textLight },
});
