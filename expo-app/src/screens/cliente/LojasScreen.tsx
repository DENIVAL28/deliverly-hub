import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Image, ActivityIndicator, RefreshControl, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  aguardando_confirmacao: { label: "Aguardando", bg: "#f4f4f5", color: "#71717a" },
  aguardando_pagamento:   { label: "Aguard. pgto", bg: "#dbeafe", color: "#1d4ed8" },
  novo:       { label: "Novo",       bg: "#dbeafe", color: "#1d4ed8" },
  aceito:     { label: "Aceito",     bg: "#fef3c7", color: "#d97706" },
  preparo:    { label: "Em preparo", bg: "#ffedd5", color: "#ea580c" },
  entrega:    { label: "Saiu p/ entrega", bg: "#ede9fe", color: "#7c3aed" },
  finalizado: { label: "Finalizado", bg: "#dcfce7", color: "#16a34a" },
  cancelado:  { label: "Cancelado",  bg: "#fee2e2", color: "#dc2626" },
};

export default function LojasScreen({ navigation }: any) {
  const [lojas, setLojas]           = useState<any[]>([]);
  const [busca, setBusca]           = useState("");
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal rastrear pedido
  const [modalRastreio, setModalRastreio]     = useState(false);
  const [telefoneBusca, setTelefoneBusca]     = useState("");
  const [buscandoPedido, setBuscandoPedido]   = useState(false);
  const [pedidosEncontrados, setPedidosEncontrados] = useState<any[]>([]);
  const [erroBusca, setErroBusca]             = useState("");

  async function carregar() {
    const { data } = await supabase
      .from("empresas")
      .select("id, nome_fantasia, slug, logo_url, segmento, cidade, aberto, status")
      .eq("status", "ativa")
      .order("nome_fantasia");
    setLojas(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { carregar(); }, []);

  const filtradas = lojas.filter((l) =>
    l.nome_fantasia?.toLowerCase().includes(busca.toLowerCase()) ||
    l.segmento?.toLowerCase().includes(busca.toLowerCase())
  );

  async function buscarPedidosPorTelefone() {
    const tel = telefoneBusca.replace(/\D/g, "");
    if (tel.length < 8) { setErroBusca("Digite um telefone válido."); return; }
    setBuscandoPedido(true);
    setErroBusca("");
    const { data } = await supabase
      .from("pedidos")
      .select("id, numero, status, total, created_at, empresas(nome_fantasia)")
      .eq("cliente_telefone", tel)
      .order("created_at", { ascending: false })
      .limit(10);
    setBuscandoPedido(false);
    if (!data?.length) { setErroBusca("Nenhum pedido encontrado para este telefone."); }
    setPedidosEncontrados(data ?? []);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f97316" /></View>;

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>🛵 Deliverly Hub</Text>
          <Text style={s.sub}>Peça agora na sua loja favorita</Text>
        </View>
        <TouchableOpacity style={s.lojistaBotao} onPress={() => navigation.navigate("Login")}>
          <Text style={s.lojistaTexto}>Sou lojista</Text>
        </TouchableOpacity>
      </View>

      {/* Busca loja */}
      <View style={s.buscaWrap}>
        <TextInput
          style={s.busca}
          placeholder="Buscar loja ou categoria..."
          placeholderTextColor="#a1a1aa"
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      {/* Botão rastrear pedido */}
      <TouchableOpacity style={s.rastrearBtn} onPress={() => { setModalRastreio(true); setPedidosEncontrados([]); setErroBusca(""); setTelefoneBusca(""); }}>
        <Text style={s.rastrearTexto}>📦 Acompanhar meu pedido</Text>
      </TouchableOpacity>

      {/* Lista de lojas */}
      <FlatList
        data={filtradas}
        keyExtractor={(l) => l.id}
        contentContainerStyle={s.lista}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} colors={["#f97316"]} />}
        renderItem={({ item: l }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate("Cardapio", { slug: l.slug, nome: l.nome_fantasia })}
            activeOpacity={0.8}
          >
            {l.logo_url
              ? <Image source={{ uri: l.logo_url }} style={s.logo} />
              : <View style={[s.logo, s.logoPlaceholder]}><Text style={{ fontSize: 20 }}>🍽️</Text></View>
            }
            <View style={s.info}>
              <Text style={s.nome} numberOfLines={1}>{l.nome_fantasia}</Text>
              <Text style={s.detalhe}>{l.segmento ?? "Delivery"}{l.cidade ? ` · ${l.cidade}` : ""}</Text>
            </View>
            <View style={[s.abertoBadge, { backgroundColor: l.aberto ? "#dcfce7" : "#f4f4f5" }]}>
              <Text style={[s.abertoTexto, { color: l.aberto ? "#16a34a" : "#a1a1aa" }]}>
                {l.aberto ? "Aberta" : "Fechada"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.vazio}>
            <Text style={{ fontSize: 40 }}>🔍</Text>
            <Text style={s.vazioTexto}>Nenhuma loja encontrada</Text>
          </View>
        }
      />

      {/* Modal rastreio por telefone */}
      <Modal visible={modalRastreio} animationType="slide" transparent>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModalRastreio(false)} />
        <View style={s.modal}>
          <View style={s.modalHandle} />
          <View style={s.modalContent}>
            <Text style={s.modalTitulo}>📦 Acompanhar pedido</Text>
            <Text style={s.modalSub}>Digite seu telefone para encontrar seus pedidos</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <TextInput
                style={[s.busca, { flex: 1, marginBottom: 0 }]}
                placeholder="Telefone (ex: 11999998888)"
                placeholderTextColor="#a1a1aa"
                value={telefoneBusca}
                onChangeText={setTelefoneBusca}
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={s.buscarBtn} onPress={buscarPedidosPorTelefone} disabled={buscandoPedido}>
                {buscandoPedido ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.buscarBtnTexto}>Buscar</Text>}
              </TouchableOpacity>
            </View>
            {erroBusca ? <Text style={s.erroTexto}>{erroBusca}</Text> : null}

            {pedidosEncontrados.map((p) => {
              const st = STATUS_LABEL[p.status] ?? { label: p.status, bg: "#f4f4f5", color: "#71717a" };
              const hora = new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
              return (
                <TouchableOpacity
                  key={p.id}
                  style={s.pedidoCard}
                  onPress={() => { setModalRastreio(false); navigation.navigate("Rastreio", { pedidoId: p.id, empresaNome: p.empresas?.nome_fantasia ?? "Loja" }); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.pedidoNome}>{p.empresas?.nome_fantasia}</Text>
                    <Text style={s.pedidoInfo}>Pedido #{p.numero} · {hora}</Text>
                  </View>
                  <View style={[s.abertoBadge, { backgroundColor: st.bg }]}>
                    <Text style={[s.abertoTexto, { color: st.color }]}>{st.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f97316", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  titulo: { fontSize: 22, fontWeight: "800", color: "#fff" },
  sub: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  lojistaBotao: { backgroundColor: "rgba(0,0,0,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  lojistaTexto: { color: "#fff", fontSize: 12, fontWeight: "700" },
  buscaWrap: { padding: 12, backgroundColor: "#f97316" },
  busca: { height: 44, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: "#18181b" },
  rastrearBtn: { margin: 12, marginTop: 4, backgroundColor: "#fff", borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "center", borderWidth: 1, borderColor: "#e4e4e7" },
  rastrearTexto: { fontSize: 14, fontWeight: "600", color: "#f97316" },
  lista: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 },
  logo: { width: 52, height: 52, borderRadius: 12 },
  logoPlaceholder: { backgroundColor: "#fff7ed", justifyContent: "center", alignItems: "center" },
  info: { flex: 1 },
  nome: { fontSize: 15, fontWeight: "700", color: "#18181b" },
  detalhe: { fontSize: 12, color: "#71717a", marginTop: 2 },
  abertoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  abertoTexto: { fontSize: 11, fontWeight: "700" },
  vazio: { alignItems: "center", paddingTop: 60, gap: 8 },
  vazioTexto: { fontSize: 14, color: "#a1a1aa" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHandle: { width: 36, height: 4, backgroundColor: "#e4e4e7", borderRadius: 2, alignSelf: "center", marginTop: 10 },
  modalContent: { padding: 20, gap: 8 },
  modalTitulo: { fontSize: 20, fontWeight: "800", color: "#18181b" },
  modalSub: { fontSize: 13, color: "#71717a" },
  buscarBtn: { backgroundColor: "#f97316", borderRadius: 12, paddingHorizontal: 16, height: 44, justifyContent: "center" },
  buscarBtnTexto: { color: "#fff", fontWeight: "700", fontSize: 14 },
  erroTexto: { fontSize: 12, color: "#dc2626", marginTop: 4 },
  pedidoCard: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#f9f9f9", borderRadius: 12, marginTop: 8 },
  pedidoNome: { fontSize: 14, fontWeight: "700", color: "#18181b" },
  pedidoInfo: { fontSize: 12, color: "#71717a", marginTop: 2 },
});
