import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { notificarNovoPedido } from "@/lib/notifications";
import { C, R, shadow } from "@/theme";

interface PedidoDisponivel {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_endereco: string | null;
  taxa_entrega: number;
  empresa_nome: string | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DisponiveisScreen() {
  const [aprovado, setAprovado] = useState<boolean | null>(null);
  const [pedidos, setPedidos]   = useState<PedidoDisponivel[]>([]);
  const prevCountRef = useRef<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refresh, setRefresh]   = useState(false);
  const [pegando, setPegando]   = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data: ent } = await (supabase as any).rpc("entregador_me");
    if (ent) setAprovado((ent as any).aprovado ?? false);

    if ((ent as any)?.aprovado) {
      const { data } = await (supabase as any).rpc("entregador_pedidos_disponiveis");
      if (data) {
        const lista = data as PedidoDisponivel[];
        const count = lista.length;
        if (prevCountRef.current !== null && count > prevCountRef.current) {
          notificarNovoPedido(lista[0]?.numero);
        }
        prevCountRef.current = count;
        setPedidos(lista);
      }
    }
  }, []);

  useEffect(() => {
    carregar().finally(() => setLoading(false));
    const interval = setInterval(carregar, 12000);
    return () => clearInterval(interval);
  }, [carregar]);

  async function aceitar(pedidoId: string, numero: number) {
    Alert.alert(
      `Aceitar pedido #${numero}?`,
      "Você será responsável por esta entrega.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aceitar entrega",
          onPress: async () => {
            setPegando(pedidoId);
            const { data } = await (supabase as any).rpc("entregador_aceitar_pedido", { p_pedido_id: pedidoId });
            setPegando(null);
            if (!data?.ok) {
              Alert.alert("Erro", data?.erro ?? "Não foi possível aceitar. Tente novamente.");
              return;
            }
            Alert.alert("✅ Pedido aceito!", "Ele foi adicionado às suas entregas em andamento.");
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
        <ActivityIndicator size="large" color={C.brand} />
        <Text style={styles.loadingText}>Buscando pedidos...</Text>
      </View>
    );
  }

  if (aprovado === false) {
    return (
      <View style={styles.centro}>
        <View style={styles.bloqueadoIcon}>
          <Text style={{ fontSize: 40 }}>⏳</Text>
        </View>
        <Text style={styles.bloqueadoTitulo}>Cadastro em análise</Text>
        <Text style={styles.bloqueadoTexto}>
          Aguarde a aprovação da plataforma. Os pedidos disponíveis aparecerão aqui quando você for aprovado.
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
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={C.brand} />}
      ListHeaderComponent={
        <View style={styles.headerSection}>
          <View>
            <Text style={styles.headerTitulo}>
              {pedidos.length === 0 ? "Aguardando pedidos" : `${pedidos.length} pedido${pedidos.length > 1 ? "s" : ""} disponível${pedidos.length > 1 ? "eis" : ""}`}
            </Text>
            <Text style={styles.headerSub}>Puxe para baixo para atualizar</Text>
          </View>
          {pedidos.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{pedidos.length}</Text>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.vazio}>
          <Text style={styles.vazioEmoji}>📭</Text>
          <Text style={styles.vazioTitulo}>Nenhuma entrega disponível</Text>
          <Text style={styles.vazioSub}>
            Novos pedidos aparecem aqui automaticamente.{"\n"}Atualizando a cada 12 segundos.
          </Text>
        </View>
      }
      renderItem={({ item: p }) => (
        <View style={styles.card}>
          {/* Header do card */}
          <View style={styles.cardTopRow}>
            <View style={styles.empresaTag}>
              <Text style={styles.empresaTagText} numberOfLines={1}>
                {p.empresa_nome ?? "Estabelecimento"}
              </Text>
            </View>
            <Text style={styles.pedidoNum}>#{p.numero}</Text>
          </View>

          {/* Taxa em destaque */}
          <View style={styles.taxaDestaque}>
            <Text style={styles.taxaLabel}>Você recebe</Text>
            <Text style={styles.taxaValor}>{fmt(p.taxa_entrega)}</Text>
          </View>

          {/* Dados do cliente */}
          <View style={styles.infoBox}>
            <Text style={styles.infoItem}>👤  {p.cliente_nome}</Text>
            {p.cliente_endereco && (
              <Text style={styles.infoItem}>📍  {p.cliente_endereco}</Text>
            )}
          </View>

          {/* Botão aceitar */}
          <TouchableOpacity
            style={[styles.btnAceitar, pegando === p.id && styles.btnDisabled]}
            onPress={() => aceitar(p.id, p.numero)}
            disabled={pegando !== null}
            activeOpacity={0.85}
          >
            {pegando === p.id
              ? <ActivityIndicator color={C.white} />
              : <Text style={styles.btnAceitarText}>✅  Aceitar esta entrega</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14, color: C.textMuted },

  bloqueadoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.amberLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  bloqueadoTitulo: { fontSize: 18, fontWeight: "800", color: C.text, textAlign: "center" },
  bloqueadoTexto: { fontSize: 14, color: C.textMuted, textAlign: "center", marginTop: 10, lineHeight: 20 },

  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitulo: { fontSize: 16, fontWeight: "800", color: C.text },
  headerSub: { fontSize: 12, color: C.textLight, marginTop: 2 },
  countBadge: {
    backgroundColor: C.brand,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { color: C.white, fontWeight: "900", fontSize: 14 },

  vazio: { alignItems: "center", paddingVertical: 48 },
  vazioEmoji: { fontSize: 52 },
  vazioTitulo: { fontSize: 16, fontWeight: "700", color: C.textMid, marginTop: 16 },
  vazioSub: { fontSize: 13, color: C.textLight, marginTop: 8, textAlign: "center", lineHeight: 19 },

  card: {
    backgroundColor: C.white,
    borderRadius: R.xl,
    padding: 18,
    marginBottom: 12,
    ...shadow.md,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  empresaTag: {
    backgroundColor: C.brandLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    maxWidth: "75%",
  },
  empresaTagText: { fontSize: 13, fontWeight: "700", color: C.brandDark },
  pedidoNum: { fontSize: 14, fontWeight: "800", color: C.textMuted },

  taxaDestaque: {
    backgroundColor: C.greenLight,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  taxaLabel: { fontSize: 13, fontWeight: "600", color: C.green },
  taxaValor: { fontSize: 22, fontWeight: "900", color: C.green },

  infoBox: { gap: 6, marginBottom: 16 },
  infoItem: { fontSize: 13, color: C.textMid, lineHeight: 18 },

  btnAceitar: {
    backgroundColor: C.brand,
    borderRadius: R.lg,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  btnAceitarText: { color: C.white, fontWeight: "800", fontSize: 15 },
  btnDisabled: { opacity: 0.55 },
});
