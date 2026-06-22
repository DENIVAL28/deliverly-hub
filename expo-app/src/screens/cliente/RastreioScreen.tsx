import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Linking, Modal, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const ETAPAS = [
  { key: "aguardando_confirmacao", label: "Aguardando confirmacao", icon: "..." },
  { key: "aguardando_pagamento", label: "Aguardando pagamento", icon: "PIX" },
  { key: "novo", label: "Pedido recebido", icon: "OK" },
  { key: "aceito", label: "Aceito pela loja", icon: "OK" },
  { key: "preparo", label: "Em preparo", icon: "FOGO" },
  { key: "entrega", label: "Saiu para entrega", icon: "MOTO" },
  { key: "finalizado", label: "Entregue", icon: "OK" },
];

const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function RastreioScreen({ route, navigation }: any) {
  const { pedidoId, empresaNome } = route.params;
  const [pedido, setPedido] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [entregadorGps, setEntregadorGps] = useState<any | null>(null);
  const [gpsAtualizadoEm, setGpsAtualizadoEm] = useState<string | null>(null);

  const [cancelModal, setCancelModal]     = useState(false);
  const [motivoCancel, setMotivoCancel]   = useState("");
  const [cancelando, setCancelando]       = useState(false);
  const [recModal, setRecModal]           = useState(false);
  const [recTipo, setRecTipo]             = useState("");
  const [recDesc, setRecDesc]             = useState("");
  const [enviandoRec, setEnviandoRec]     = useState(false);
  const [recEnviada, setRecEnviada]       = useState(false);

  const PODE_CANCELAR = ["novo", "aguardando_confirmacao", "aguardando_pagamento"];

  async function cancelarPedido() {
    if (!motivoCancel.trim()) return;
    setCancelando(true);
    const { data, error } = await (supabase as any).rpc("cancelar_pedido_cliente", {
      p_pedido_id: pedidoId,
      p_motivo: motivoCancel,
    });
    setCancelando(false);
    if (error || data?.error) {
      Alert.alert("Erro", error?.message ?? data?.error);
      return;
    }
    setCancelModal(false);
    setPedido((prev: any) => ({ ...prev, status: "cancelado", cancelado_por: "cliente", motivo_cancelamento: motivoCancel }));
  }

  async function enviarReclamacao() {
    if (!recTipo) return;
    setEnviandoRec(true);
    const { data, error } = await (supabase as any).rpc("abrir_reclamacao", {
      p_pedido_id: pedidoId,
      p_tipo: recTipo,
      p_descricao: recDesc.trim() || null,
    });
    setEnviandoRec(false);
    if (error || data?.error) {
      Alert.alert("Erro", error?.message ?? data?.error);
      return;
    }
    setRecModal(false);
    setRecEnviada(true);
    Alert.alert("Reclamação enviada", "A loja foi notificada e entrará em contato.");
  }

  useEffect(() => {
    async function buscar() {
      // Usa RPC SECURITY DEFINER para bypass do RLS — query direta falha para sessões anônimas
      const { data } = await (supabase as any).rpc("buscar_pedido_tracking", {
        p_pedido_id: pedidoId,
      });
      setPedido(data);
      setLoading(false);
    }

    buscar();

    const channel = supabase
      .channel(`rastreio-${pedidoId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "pedidos",
        filter: `id=eq.${pedidoId}`,
      }, (payload) => setPedido((prev: any) => ({ ...prev, ...payload.new })))
      .subscribe();

    const interval = setInterval(buscar, 8000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [pedidoId]);

  useEffect(() => {
    if (pedido?.status !== "entrega") {
      setEntregadorGps(null);
      return;
    }

    async function buscarGps() {
      const { data } = await (supabase as any).rpc("pedido_rastrear_entregador", {
        p_pedido_id: pedidoId,
      });
      if (data?.gps_ativo) {
        setEntregadorGps(data);
        setGpsAtualizadoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
    }

    buscarGps();
    const interval = setInterval(buscarGps, 20000);
    return () => clearInterval(interval);
  }, [pedido?.status, pedidoId]);

  if (loading || !pedido) {
    return <View style={s.center}><ActivityIndicator size="large" color="#f97316" /></View>;
  }

  const cancelado = pedido.status === "cancelado";
  const aguardandoPagamento = pedido.status === "aguardando_pagamento";
  const isRetirada = pedido.tipo === "retirada";
  const statusIdx = ETAPAS.findIndex((e) => e.key === pedido.status);
  const etapasFiltradas = isRetirada
    ? ETAPAS.filter((e) => e.key !== "entrega").map((e) =>
        e.key === "finalizado" ? { ...e, label: "Pronto para retirar! 🏪", icon: "OK" } : e
      )
    : pedido.tipo === "mesa"
      ? ETAPAS.filter((e) => !["entrega", "aguardando_confirmacao"].includes(e.key))
      : ETAPAS;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.popToTop()} style={s.voltarBtn}>
          <Text style={s.voltarTexto}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={s.headerNome}>Pedido #{pedido.numero}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <Text style={s.cardTitulo}>{empresaNome}</Text>
          <Text style={s.cardSub}>{pedido.cliente_nome}</Text>
          {pedido.cliente_endereco && pedido.tipo === "delivery" && (
            <Text style={s.cardSub}>{pedido.cliente_endereco}</Text>
          )}
          <View style={s.divider} />
          <View style={s.cardRow}>
            <Text style={s.cardLabel}>Total</Text>
            <Text style={s.cardValor}>{fmt(pedido.total)}</Text>
          </View>
          <View style={s.cardRow}>
            <Text style={s.cardLabel}>Pagamento</Text>
            <Text style={s.cardValor}>{pedido.forma_pagamento}</Text>
          </View>
          {pedido.observacao && (
            <View style={s.cardRow}>
              <Text style={s.cardLabel}>Obs</Text>
              <Text style={[s.cardValor, { flex: 1, textAlign: "right" }]} numberOfLines={2}>{pedido.observacao}</Text>
            </View>
          )}
        </View>

        {aguardandoPagamento && (
          <View style={s.pixCard}>
            <Text style={s.pixTitulo}>Aguardando pagamento</Text>
            <Text style={s.pixTexto}>Realize o pagamento e aguarde a confirmacao da loja.</Text>
          </View>
        )}

        {pedido.status === "entrega" && (
          <View style={s.gpsCard}>
            <Text style={s.gpsTitulo}>
              {entregadorGps?.nome ? `${entregadorGps.nome} esta a caminho` : "Entregador a caminho"}
            </Text>
            {entregadorGps?.gps_ativo ? (
              <>
                <Text style={s.gpsTexto}>
                  Localizacao atualizada{gpsAtualizadoEm ? ` as ${gpsAtualizadoEm}` : ""}.
                </Text>
                <TouchableOpacity
                  style={s.gpsBotao}
                  onPress={() => Linking.openURL(`https://maps.google.com/maps?q=${entregadorGps.lat},${entregadorGps.lng}`)}
                >
                  <Text style={s.gpsBotaoTexto}>Abrir no mapa</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={s.gpsTexto}>Aguardando o entregador ativar o GPS.</Text>
            )}
          </View>
        )}

        {cancelado ? (
          <View style={s.cancelado}>
            <Text style={s.canceladoIcone}>X</Text>
            <Text style={s.canceladoTexto}>Pedido cancelado</Text>
          </View>
        ) : (
          <View style={s.timelineCard}>
            <Text style={s.timelineTitulo}>Acompanhamento</Text>
            {etapasFiltradas.map((etapa, idx) => {
              const etapaStatusIdx = ETAPAS.findIndex((e) => e.key === etapa.key);
              const feito = statusIdx >= etapaStatusIdx && statusIdx >= 0;
              const atual = etapa.key === pedido.status;
              const ultimo = idx === etapasFiltradas.length - 1;
              return (
                <View key={etapa.key} style={s.etapaRow}>
                  <View style={s.etapaEsq}>
                    <View style={[s.etapaBolha, feito && s.etapaBolhaFeita, atual && s.etapaBolhaAtual]}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: atual ? "#fff" : "#71717a" }}>{feito ? etapa.icon : ""}</Text>
                    </View>
                    {!ultimo && <View style={[s.etapaLinha, feito && !atual && s.etapaLinhaFeita]} />}
                  </View>
                  <View style={s.etapaDireita}>
                    <Text style={[s.etapaLabel, feito && s.etapaLabelFeita, atual && s.etapaLabelAtual]}>
                      {etapa.label}
                    </Text>
                    {atual && <Text style={s.etapaAtualSub}>Em andamento...</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Cancelar pedido — só se status permite */}
        {PODE_CANCELAR.includes(pedido.status) && (
          <TouchableOpacity style={s.botaoCancelar} onPress={() => setCancelModal(true)}>
            <Text style={s.botaoCancelarTexto}>Cancelar pedido</Text>
          </TouchableOpacity>
        )}

        {/* Tive um problema — só se finalizado */}
        {pedido.status === "finalizado" && !recEnviada && (
          <TouchableOpacity style={s.botaoProblema} onPress={() => setRecModal(true)}>
            <Text style={s.botaoProblemaTexto}>⚠️ Tive um problema</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.botaoNovo} onPress={() => navigation.popToTop()}>
          <Text style={s.botaoNovoTexto}>Fazer novo pedido</Text>
        </TouchableOpacity>
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Modal: cancelar */}
      <Modal visible={cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>Por que quer cancelar?</Text>
            {["Me arrependi do pedido","Digitei o endereço errado","Demorou muito para confirmar","Vou buscar pessoalmente","Outro motivo"].map((op) => (
              <TouchableOpacity key={op} style={[s.opcaoBtn, motivoCancel === op && s.opcaoBtnAtivo]} onPress={() => setMotivoCancel(op)}>
                <Text style={[s.opcaoTexto, motivoCancel === op && s.opcaoTextoAtivo]}>{op}</Text>
              </TouchableOpacity>
            ))}
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.btnVoltar} onPress={() => setCancelModal(false)}>
                <Text style={s.btnVoltarTexto}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirmar, (!motivoCancel || cancelando) && s.btnDisabled]}
                onPress={cancelarPedido}
                disabled={!motivoCancel || cancelando}
              >
                <Text style={s.btnConfirmarTexto}>{cancelando ? "Cancelando…" : "Confirmar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: reclamar */}
      <Modal visible={recModal} transparent animationType="slide" onRequestClose={() => setRecModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>O que aconteceu?</Text>
            {[{v:"pedido_errado",l:"Recebi o pedido errado"},{v:"item_faltando",l:"Faltou um item"},{v:"nao_chegou",l:"O pedido não chegou"},{v:"qualidade",l:"Qualidade ruim"},{v:"outro",l:"Outro problema"}].map(({v,l}) => (
              <TouchableOpacity key={v} style={[s.opcaoBtn, recTipo === v && s.opcaoBtnAtivo]} onPress={() => setRecTipo(v)}>
                <Text style={[s.opcaoTexto, recTipo === v && s.opcaoTextoAtivo]}>{l}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              value={recDesc}
              onChangeText={setRecDesc}
              placeholder="Descreva o problema (opcional)"
              multiline
              style={s.inputDesc}
              placeholderTextColor="#a1a1aa"
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.btnVoltar} onPress={() => setRecModal(false)}>
                <Text style={s.btnVoltarTexto}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirmarRec, (!recTipo || enviandoRec) && s.btnDisabled]}
                onPress={enviarReclamacao}
                disabled={!recTipo || enviandoRec}
              >
                <Text style={s.btnConfirmarTexto}>{enviandoRec ? "Enviando…" : "Enviar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  voltarBtn: { width: 36, height: 36, justifyContent: "center" },
  voltarTexto: { fontSize: 24, color: "#18181b", lineHeight: 28 },
  headerNome: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#18181b" },
  scroll: { padding: 14, gap: 14 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6 },
  cardTitulo: { fontSize: 17, fontWeight: "800", color: "#18181b" },
  cardSub: { fontSize: 13, color: "#71717a", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#f4f4f5", marginVertical: 12 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  cardLabel: { fontSize: 13, color: "#71717a" },
  cardValor: { fontSize: 13, fontWeight: "700", color: "#18181b" },
  pixCard: { backgroundColor: "#fff7ed", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#fed7aa" },
  pixTitulo: { fontSize: 16, fontWeight: "800", color: "#ea580c", marginBottom: 6 },
  pixTexto: { fontSize: 13, color: "#71717a" },
  gpsCard: { backgroundColor: "#eef2ff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#c7d2fe" },
  gpsTitulo: { fontSize: 16, fontWeight: "800", color: "#4338ca", marginBottom: 6 },
  gpsTexto: { fontSize: 13, color: "#4f46e5", marginBottom: 12 },
  gpsBotao: { backgroundColor: "#4f46e5", borderRadius: 12, height: 44, justifyContent: "center", alignItems: "center" },
  gpsBotaoTexto: { color: "#fff", fontSize: 14, fontWeight: "800" },
  cancelado: { alignItems: "center", paddingVertical: 40, gap: 10 },
  canceladoIcone: { fontSize: 32, fontWeight: "900", color: "#dc2626" },
  canceladoTexto: { fontSize: 18, fontWeight: "700", color: "#dc2626" },
  timelineCard: { backgroundColor: "#fff", borderRadius: 14, padding: 20, elevation: 2, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6 },
  timelineTitulo: { fontSize: 13, fontWeight: "800", color: "#71717a", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16 },
  etapaRow: { flexDirection: "row", gap: 14, minHeight: 52 },
  etapaEsq: { alignItems: "center", width: 36 },
  etapaBolha: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f4f4f5", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#e4e4e7" },
  etapaBolhaFeita: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  etapaBolhaAtual: { backgroundColor: "#f97316", borderColor: "#f97316" },
  etapaLinha: { flex: 1, width: 2, backgroundColor: "#e4e4e7", marginVertical: 4 },
  etapaLinhaFeita: { backgroundColor: "#fed7aa" },
  etapaDireita: { flex: 1, paddingTop: 6, paddingBottom: 8 },
  etapaLabel: { fontSize: 14, color: "#a1a1aa", fontWeight: "500" },
  etapaLabelFeita: { color: "#71717a" },
  etapaLabelAtual: { color: "#f97316", fontWeight: "700" },
  etapaAtualSub: { fontSize: 12, color: "#f97316", marginTop: 2 },
  botaoNovo: { backgroundColor: "#f97316", borderRadius: 14, height: 52, justifyContent: "center", alignItems: "center" },
  botaoNovoTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
  botaoCancelar: { borderRadius: 14, height: 48, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#dc2626" },
  botaoCancelarTexto: { color: "#dc2626", fontSize: 15, fontWeight: "700" },
  botaoProblema: { borderRadius: 14, height: 48, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#d97706", backgroundColor: "#fffbeb" },
  botaoProblemaTexto: { color: "#d97706", fontSize: 15, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, gap: 10 },
  modalTitulo: { fontSize: 17, fontWeight: "800", color: "#18181b", marginBottom: 4 },
  opcaoBtn: { borderRadius: 10, borderWidth: 1.5, borderColor: "#e4e4e7", paddingVertical: 11, paddingHorizontal: 14 },
  opcaoBtnAtivo: { borderColor: "#f97316", backgroundColor: "#fff7ed" },
  opcaoTexto: { fontSize: 14, color: "#71717a", fontWeight: "500" },
  opcaoTextoAtivo: { color: "#f97316", fontWeight: "700" },
  inputDesc: { borderWidth: 1.5, borderColor: "#e4e4e7", borderRadius: 10, padding: 12, fontSize: 14, color: "#18181b", minHeight: 70, textAlignVertical: "top" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  btnVoltar: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: "#e4e4e7", justifyContent: "center", alignItems: "center" },
  btnVoltarTexto: { color: "#71717a", fontSize: 14, fontWeight: "700" },
  btnConfirmar: { flex: 2, height: 48, borderRadius: 12, backgroundColor: "#dc2626", justifyContent: "center", alignItems: "center" },
  btnConfirmarRec: { flex: 2, height: 48, borderRadius: 12, backgroundColor: "#f97316", justifyContent: "center", alignItems: "center" },
  btnConfirmarTexto: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
});