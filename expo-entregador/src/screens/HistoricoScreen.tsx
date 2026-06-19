import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from "react-native";
import { supabase } from "@/lib/supabase";

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

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function totalMes(pedidos: PedidoHistorico[]) {
  const agora = new Date();
  return pedidos
    .filter((p) => {
      const d = new Date(p.created_at);
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
    })
    .reduce((acc, p) => acc + Number(p.taxa_entrega), 0);
}

export default function HistoricoScreen({ token }: { token: string }) {
  const [pedidos, setPedidos] = useState<PedidoHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await (supabase as any).rpc("entregador_meus_pedidos", { p_token: token });
    if (data) {
      setPedidos(
        (data as PedidoHistorico[]).filter((p) => p.status === "finalizado")
      );
    }
  }, [token]);

  useEffect(() => {
    carregar().finally(() => setLoading(false));
  }, [carregar]);

  async function onRefresh() {
    setRefresh(true);
    await carregar();
    setRefresh(false);
  }

  if (loading) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const ganhosMes = totalMes(pedidos);
  const entregasMes = pedidos.filter((p) => {
    const d = new Date(p.created_at);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  return (
    <FlatList
      style={styles.lista}
      contentContainerStyle={styles.content}
      data={pedidos}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor="#f97316" />}
      ListHeaderComponent={
        <View style={styles.resumoCard}>
          <Text style={styles.resumoTitulo}>Este mês</Text>
          <Text style={styles.resumoValor}>{fmt(ganhosMes)}</Text>
          <Text style={styles.resumoSub}>{entregasMes} entrega{entregasMes !== 1 ? "s" : ""} realizadas</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.vazio}>
          <Text style={styles.vazioCod}>📋</Text>
          <Text style={styles.vazioTxt}>Nenhuma entrega realizada ainda</Text>
        </View>
      }
      renderItem={({ item: p }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardNum}>Pedido #{p.numero}</Text>
              {p.empresa_nome && (
                <Text style={styles.cardEmpresa}>{p.empresa_nome}</Text>
              )}
            </View>
            <Text style={styles.cardTaxa}>{fmt(p.taxa_entrega)}</Text>
          </View>
          <Text style={styles.cardCliente}>👤 {p.cliente_nome}</Text>
          {p.cliente_endereco && (
            <Text style={styles.cardEndereco}>📍 {p.cliente_endereco}</Text>
          )}
          <Text style={styles.cardData}>✅ {formatarData(p.created_at)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: "#f4f4f5" },
  content: { padding: 16 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },

  resumoCard: {
    backgroundColor: "#16a34a", borderRadius: 20, padding: 24,
    alignItems: "center", marginBottom: 20,
  },
  resumoTitulo: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  resumoValor: { color: "#fff", fontSize: 36, fontWeight: "900", marginVertical: 4 },
  resumoSub: { color: "rgba(255,255,255,0.8)", fontSize: 13 },

  vazio: { alignItems: "center", paddingVertical: 40 },
  vazioCod: { fontSize: 48 },
  vazioTxt: { fontSize: 14, color: "#999", marginTop: 12 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardNum: { fontSize: 14, fontWeight: "800", color: "#111" },
  cardEmpresa: { fontSize: 11, color: "#f97316", fontWeight: "600", marginTop: 1 },
  cardTaxa: { fontSize: 16, fontWeight: "800", color: "#16a34a" },
  cardCliente: { fontSize: 13, color: "#444", marginBottom: 2 },
  cardEndereco: { fontSize: 12, color: "#666", lineHeight: 16, marginBottom: 4 },
  cardData: { fontSize: 11, color: "#999" },
});
