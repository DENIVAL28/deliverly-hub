import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const ETAPAS = [
  { key: "novo",       label: "Pedido recebido",    icone: "📋" },
  { key: "aceito",     label: "Aceito pela loja",   icone: "✅" },
  { key: "preparo",    label: "Em preparo",          icone: "👨‍🍳" },
  { key: "entrega",    label: "Saiu para entrega",   icone: "🛵" },
  { key: "finalizado", label: "Entregue!",           icone: "🎉" },
];

const STATUS_ORDER = ["novo", "aceito", "preparo", "entrega", "finalizado"];

const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function RastreioScreen({ route, navigation }: any) {
  const { pedidoId, empresaNome } = route.params;
  const [pedido, setPedido] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function buscar() {
      const { data } = await supabase
        .from("pedidos")
        .select("id, numero, status, total, created_at, cliente_nome, forma_pagamento")
        .eq("id", pedidoId)
        .single();
      setPedido(data);
      setLoading(false);
    }
    buscar();

    // Realtime — atualiza status
    const channel = supabase
      .channel(`rastreio-${pedidoId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "pedidos",
        filter: `id=eq.${pedidoId}`,
      }, (payload) => setPedido((prev: any) => ({ ...prev, ...payload.new })))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pedidoId]);

  if (loading || !pedido) {
    return <View style={s.center}><ActivityIndicator size="large" color="#f97316" /></View>;
  }

  const statusIdx = STATUS_ORDER.indexOf(pedido.status);
  const cancelado = pedido.status === "cancelado";

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.popToTop()} style={s.voltarBtn}>
          <Text style={s.voltarTexto}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerNome}>Pedido #{pedido.numero}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.scroll}>
        <View style={s.loja}>
          <Text style={s.lojaNome}>{empresaNome}</Text>
          <Text style={s.lojaMeta}>{fmt(pedido.total)} · {pedido.forma_pagamento}</Text>
        </View>

        {cancelado ? (
          <View style={s.cancelado}>
            <Text style={s.canceladoIcone}>❌</Text>
            <Text style={s.canceladoTexto}>Pedido cancelado</Text>
          </View>
        ) : (
          <View style={s.timeline}>
            {ETAPAS.map((etapa, idx) => {
              const feito = idx <= statusIdx;
              const atual = idx === statusIdx;
              return (
                <View key={etapa.key} style={s.etapaRow}>
                  <View style={s.etapaEsq}>
                    <View style={[s.etapaBolha, feito && s.etapaBolhaFeita, atual && s.etapaBolhaAtual]}>
                      <Text style={s.etapaIcone}>{feito ? etapa.icone : "○"}</Text>
                    </View>
                    {idx < ETAPAS.length - 1 && (
                      <View style={[s.etapaLinha, feito && idx < statusIdx && s.etapaLinhaFeita]} />
                    )}
                  </View>
                  <View style={s.etapaDireita}>
                    <Text style={[s.etapaLabel, atual && s.etapaLabelAtual, feito && !atual && s.etapaLabelFeita]}>
                      {etapa.label}
                    </Text>
                    {atual && <Text style={s.etapaAtualTexto}>Em andamento</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={s.botaoNovo} onPress={() => navigation.popToTop()}>
          <Text style={s.botaoNovoTexto}>Fazer novo pedido</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  voltarBtn: { width: 36, height: 36, justifyContent: "center" },
  voltarTexto: { fontSize: 28, color: "#18181b", lineHeight: 30 },
  headerNome: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#18181b" },
  scroll: { flex: 1, padding: 16 },
  loja: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4 },
  lojaNome: { fontSize: 17, fontWeight: "800", color: "#18181b" },
  lojaMeta: { fontSize: 13, color: "#71717a", marginTop: 4 },
  cancelado: { alignItems: "center", paddingVertical: 40 },
  canceladoIcone: { fontSize: 48 },
  canceladoTexto: { fontSize: 18, fontWeight: "700", color: "#dc2626", marginTop: 12 },
  timeline: { backgroundColor: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4 },
  etapaRow: { flexDirection: "row", gap: 14, minHeight: 60 },
  etapaEsq: { alignItems: "center", width: 40 },
  etapaBolha: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f4f4f5", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#e4e4e7" },
  etapaBolhaFeita: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  etapaBolhaAtual: { backgroundColor: "#f97316", borderColor: "#f97316" },
  etapaIcone: { fontSize: 16 },
  etapaLinha: { flex: 1, width: 2, backgroundColor: "#e4e4e7", marginVertical: 4 },
  etapaLinhaFeita: { backgroundColor: "#fed7aa" },
  etapaDireita: { flex: 1, paddingTop: 6, paddingBottom: 10 },
  etapaLabel: { fontSize: 15, color: "#a1a1aa", fontWeight: "500" },
  etapaLabelFeita: { color: "#71717a" },
  etapaLabelAtual: { color: "#f97316", fontWeight: "700" },
  etapaAtualTexto: { fontSize: 12, color: "#f97316", marginTop: 2 },
  botaoNovo: { backgroundColor: "#f97316", borderRadius: 14, height: 52, justifyContent: "center", alignItems: "center" },
  botaoNovoTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
