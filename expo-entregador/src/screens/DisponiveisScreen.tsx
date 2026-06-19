import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { supabase } from "@/lib/supabase";

interface PedidoDisponivel {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_endereco: string | null;
  taxa_entrega: number;
  status: string;
}

interface Entregador {
  tipo: string | null;
  aprovado: boolean | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DisponiveisScreen({ token }: { token: string }) {
  const [entregador, setEntregador] = useState<Entregador | null>(null);
  const [pedidos, setPedidos]       = useState<PedidoDisponivel[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refresh, setRefresh]       = useState(false);
  const [pegando, setPegando]       = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data: ent } = await supabase
      .from("entregadores")
      .select("tipo, aprovado")
      .eq("public_token" as never, token)
      .maybeSingle();
    if (ent) setEntregador(ent as any);

    const { data } = await (supabase as any).rpc("freelancer_pedidos_disponiveis", { p_token: token });
    if (data) setPedidos(data as PedidoDisponivel[]);
  }, [token]);

  useEffect(() => {
    carregar().finally(() => setLoading(false));
    const interval = setInterval(carregar, 15000);
    return () => clearInterval(interval);
  }, [carregar]);

  async function aceitar(pedidoId: string, numero: number) {
    Alert.alert(
      `Aceitar pedido #${numero}?`,
      "Você será responsável por esta entrega.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aceitar",
          onPress: async () => {
            setPegando(pedidoId);
            const { data } = await (supabase as any).rpc("freelancer_pegar_entrega", {
              p_token: token,
              p_pedido_id: pedidoId,
            });
            setPegando(null);
            if (!data?.ok) {
              Alert.alert("Erro", data?.erro ?? "Não foi possível aceitar. Tente novamente.");
              return;
            }
            Alert.alert("✅ Aceito!", "O pedido foi adicionado às suas entregas em andamento.");
            await carregar();
          },
        },
      ]
    );
  }

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

  if (entregador?.tipo !== "freelancer") {
    return (
      <View style={styles.centro}>
        <Text style={styles.emoji}>🔒</Text>
        <Text style={styles.infoTitulo}>Não disponível</Text>
        <Text style={styles.infoTexto}>Esta área é exclusiva para entregadores freelancer.</Text>
      </View>
    );
  }

  if (entregador?.aprovado === false) {
    return (
      <View style={styles.centro}>
        <Text style={styles.emoji}>⏳</Text>
        <Text style={styles.infoTitulo}>Cadastro em análise</Text>
        <Text style={styles.infoTexto}>
          Aguarde a aprovação do restaurante. Você receberá uma notificação pelo WhatsApp.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.lista}
      contentContainerStyle={styles.content}
      data={pedidos}
      keyExtractor={(p) => p.id}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor="#f97316" />}
      ListHeaderComponent={
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitulo}>
            {pedidos.length === 0
              ? "Nenhum pedido disponível"
              : `${pedidos.length} pedido${pedidos.length > 1 ? "s" : ""} disponível${pedidos.length > 1 ? "eis" : ""}`}
          </Text>
          <Text style={styles.headerSub}>Puxe para baixo para atualizar</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.vazio}>
          <Text style={styles.vazioCod}>📭</Text>
          <Text style={styles.vazioTxt}>Nenhum pedido no momento</Text>
          <Text style={styles.vazioDica}>Fique de olho, novos pedidos aparecem aqui em tempo real</Text>
        </View>
      }
      renderItem={({ item: p }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardNum}>Pedido #{p.numero}</Text>
            <Text style={styles.cardTaxa}>{fmt(p.taxa_entrega)}</Text>
          </View>
          <Text style={styles.cardCliente}>👤 {p.cliente_nome}</Text>
          {p.cliente_endereco && (
            <Text style={styles.cardEndereco}>📍 {p.cliente_endereco}</Text>
          )}
          <TouchableOpacity
            style={[styles.btnAceitar, pegando === p.id && styles.btnDisabled]}
            onPress={() => aceitar(p.id, p.numero)}
            disabled={pegando !== null}
          >
            {pegando === p.id
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnAceitarText}>Aceitar entrega</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: "#f4f4f5" },
  content: { padding: 16 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emoji: { fontSize: 48, marginBottom: 12 },
  infoTitulo: { fontSize: 18, fontWeight: "700", color: "#111", textAlign: "center" },
  infoTexto: { fontSize: 14, color: "#666", textAlign: "center", marginTop: 8, lineHeight: 20 },

  headerInfo: { marginBottom: 16 },
  headerTitulo: { fontSize: 16, fontWeight: "700", color: "#111" },
  headerSub: { fontSize: 12, color: "#999", marginTop: 2 },

  vazio: { alignItems: "center", paddingVertical: 40 },
  vazioCod: { fontSize: 48 },
  vazioTxt: { fontSize: 15, fontWeight: "600", color: "#666", marginTop: 12 },
  vazioDica: { fontSize: 12, color: "#999", marginTop: 6, textAlign: "center" },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardNum: { fontSize: 15, fontWeight: "800", color: "#111" },
  cardTaxa: { fontSize: 18, fontWeight: "800", color: "#16a34a" },
  cardCliente: { fontSize: 13, color: "#444", marginBottom: 3 },
  cardEndereco: { fontSize: 13, color: "#666", lineHeight: 18, marginBottom: 12 },
  btnAceitar: {
    backgroundColor: "#f97316", borderRadius: 12,
    height: 46, alignItems: "center", justifyContent: "center",
  },
  btnAceitarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
