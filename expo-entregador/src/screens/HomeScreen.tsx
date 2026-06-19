import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, RefreshControl,
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import { getGpsAtivo, setGpsAtivo } from "@/lib/storage";

interface Entregador {
  id: string;
  public_token: string;
  nome: string;
  status: string;
  tipo: string | null;
  aprovado: boolean | null;
  empresas: { nome_fantasia: string } | null;
}

interface Pedido {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_endereco: string | null;
  cliente_telefone: string | null;
  cliente_lat: number | null;
  cliente_lng: number | null;
  taxa_entrega: number;
  status: string;
  empresa_nome: string | null;
}

const STATUS_OPCOES = [
  { value: "disponivel", label: "Disponível", cor: "#16a34a", bg: "#dcfce7" },
  { value: "em_rota",    label: "Em rota",    cor: "#d97706", bg: "#fef3c7" },
  { value: "indisponivel", label: "Indisponível", cor: "#dc2626", bg: "#fee2e2" },
];

const STATUS_PEDIDO: Record<string, { label: string; cor: string; bg: string }> = {
  aceito:  { label: "Confirmado",      cor: "#92400e", bg: "#fef3c7" },
  preparo: { label: "Em preparo",      cor: "#9a3412", bg: "#ffedd5" },
  entrega: { label: "Saiu p/ entrega", cor: "#6b21a8", bg: "#f3e8ff" },
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function HomeScreen({ token }: { token: string }) {
  const [entregador, setEntregador] = useState<Entregador | null>(null);
  const [pedidos, setPedidos]       = useState<Pedido[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refresh, setRefresh]       = useState(false);
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const [finalizando, setFinalizando] = useState<string | null>(null);

  const [gpsAtivo, setGpsAtivoState]  = useState(false);
  const [gpsLoading, setGpsLoading]   = useState(false);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const gpsInterval     = useRef<ReturnType<typeof setInterval> | null>(null);
  const ultimaPosicao   = useRef<{ lat: number; lng: number } | null>(null);

  const carregarDados = useCallback(async () => {
    const { data: ent } = await supabase
      .from("entregadores")
      .select("id, public_token, nome, status, tipo, aprovado, empresas(nome_fantasia)")
      .eq("public_token" as never, token)
      .maybeSingle();
    if (ent) setEntregador(ent as any);

    const { data: peds } = await (supabase as any).rpc("entregador_meus_pedidos", { p_token: token });
    if (peds) {
      setPedidos((peds as Pedido[]).filter((p) =>
        ["aceito", "preparo", "entrega"].includes(p.status)
      ));
    }
  }, [token]);

  useEffect(() => {
    carregarDados().finally(() => setLoading(false));
    const interval = setInterval(carregarDados, 15000);
    return () => clearInterval(interval);
  }, [carregarDados]);

  useEffect(() => {
    getGpsAtivo(token).then((ativo) => { if (ativo) iniciarGPS(); });
    return () => pararGPS();
  }, []);

  async function mudarStatus(novoStatus: string) {
    setMudandoStatus(true);
    await (supabase as any).rpc("entregador_atualizar_status", {
      p_token: token,
      p_status: novoStatus,
    });
    setEntregador((prev) => prev ? { ...prev, status: novoStatus } : prev);
    setMudandoStatus(false);
  }

  async function enviarPosicao(lat: number, lng: number) {
    await (supabase as any).rpc("entregador_atualizar_gps", {
      p_token: token,
      p_lat: lat,
      p_lng: lng,
    });
  }

  async function iniciarGPS() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à localização para o restaurante acompanhar sua posição."
        );
        setGpsLoading(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      ultimaPosicao.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      await enviarPosicao(pos.coords.latitude, pos.coords.longitude);

      locationWatcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20 },
        (loc) => {
          ultimaPosicao.current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        }
      );

      gpsInterval.current = setInterval(async () => {
        if (ultimaPosicao.current) {
          await enviarPosicao(ultimaPosicao.current.lat, ultimaPosicao.current.lng);
        }
      }, 30000);

      setGpsAtivoState(true);
      await setGpsAtivo(token, true);
    } catch {
      Alert.alert("Erro", "Não foi possível obter sua localização.");
    }
    setGpsLoading(false);
  }

  function pararGPS() {
    locationWatcher.current?.remove();
    locationWatcher.current = null;
    if (gpsInterval.current) {
      clearInterval(gpsInterval.current);
      gpsInterval.current = null;
    }
    ultimaPosicao.current = null;
    setGpsAtivoState(false);
    setGpsAtivo(token, false);
  }

  async function finalizarEntrega(pedidoId: string) {
    setFinalizando(pedidoId);
    const { data } = await (supabase as any).rpc("entregador_finalizar_entrega", {
      p_token: token,
      p_pedido_id: pedidoId,
    });
    setFinalizando(null);
    if (!data?.ok) {
      Alert.alert("Erro", data?.erro ?? "Não foi possível finalizar.");
      return;
    }
    await carregarDados();
  }

  function navegar(pedido: Pedido) {
    const url =
      pedido.cliente_lat != null
        ? `https://maps.google.com/maps?daddr=${pedido.cliente_lat},${pedido.cliente_lng}`
        : `https://maps.google.com/maps?daddr=${encodeURIComponent(pedido.cliente_endereco ?? "")}`;
    Linking.openURL(url);
  }

  async function onRefresh() {
    setRefresh(true);
    await carregarDados();
    setRefresh(false);
  }

  if (loading) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!entregador) {
    return (
      <View style={styles.centro}>
        <Text style={{ color: "#666" }}>Erro ao carregar dados.</Text>
      </View>
    );
  }

  const statusAtual = STATUS_OPCOES.find((s) => s.value === entregador.status);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor="#f97316" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{entregador.nome.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nome}>{entregador.nome}</Text>
          <Text style={styles.empresa}>{entregador.empresas?.nome_fantasia ?? "Freelancer"}</Text>
        </View>
      </View>

      {/* Aviso cadastro em análise */}
      {entregador.tipo === "freelancer" && entregador.aprovado === false && (
        <View style={styles.aviso}>
          <Text style={styles.avisoTitulo}>⏳ Cadastro em análise</Text>
          <Text style={styles.avisoTexto}>
            Aguarde a aprovação do restaurante. Você receberá o link de acesso pelo WhatsApp.
          </Text>
        </View>
      )}

      {/* Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Meu status</Text>
        <View style={styles.statusRow}>
          {STATUS_OPCOES.map((s) => {
            const ativo = entregador.status === s.value;
            return (
              <TouchableOpacity
                key={s.value}
                style={[styles.statusBtn, ativo && { backgroundColor: s.bg, borderColor: s.cor }]}
                onPress={() => !ativo && !mudandoStatus && mudarStatus(s.value)}
                disabled={mudandoStatus}
              >
                {mudandoStatus && ativo
                  ? <ActivityIndicator size="small" color={s.cor} />
                  : <Text style={[styles.statusBtnText, ativo && { color: s.cor, fontWeight: "700" }]}>
                      {s.label}
                    </Text>
                }
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* GPS */}
      <View style={styles.card}>
        <View style={styles.gpsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitulo}>Compartilhar localização</Text>
            <Text style={styles.gpsDesc}>
              {gpsAtivo
                ? "Sua posição está sendo enviada ao restaurante"
                : "Ative para o restaurante ver sua posição"}
            </Text>
          </View>
          {gpsAtivo && (
            <View style={styles.gpsBadge}>
              <View style={styles.gpsPoint} />
              <Text style={styles.gpsBadgeText}>Ativo</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.gpsBtn, gpsAtivo && styles.gpsBtnStop]}
          onPress={gpsAtivo ? pararGPS : iniciarGPS}
          disabled={gpsLoading}
        >
          {gpsLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.gpsBtnText}>{gpsAtivo ? "Parar rastreio" : "Iniciar rastreio"}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Pedidos ativos */}
      <Text style={styles.secao}>
        Pedidos em andamento
        {pedidos.length > 0 && (
          <Text style={styles.badge}> {pedidos.length}</Text>
        )}
      </Text>

      {pedidos.length === 0 ? (
        <View style={styles.vazio}>
          <Text style={styles.vazioCod}>📦</Text>
          <Text style={styles.vazioTxt}>Nenhum pedido em andamento</Text>
        </View>
      ) : (
        pedidos.map((p) => {
          const st = STATUS_PEDIDO[p.status];
          return (
            <View key={p.id} style={styles.pedidoCard}>
              <View style={styles.pedidoHeader}>
                <Text style={styles.pedidoNum}>Pedido #{p.numero}</Text>
                {st && (
                  <View style={[styles.statusTag, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusTagText, { color: st.cor }]}>{st.label}</Text>
                  </View>
                )}
              </View>
              {p.empresa_nome && (
                <Text style={styles.pedidoEmpresa}>{p.empresa_nome}</Text>
              )}
              <Text style={styles.pedidoCliente}>👤 {p.cliente_nome}</Text>
              {p.cliente_endereco && (
                <Text style={styles.pedidoEndereco}>📍 {p.cliente_endereco}</Text>
              )}
              <Text style={styles.pedidoTaxa}>{fmt(p.taxa_entrega)}</Text>

              <View style={styles.pedidoBtns}>
                {p.cliente_telefone && (
                  <TouchableOpacity
                    style={styles.btnTel}
                    onPress={() => Linking.openURL(`tel:${p.cliente_telefone}`)}
                  >
                    <Text style={styles.btnTelText}>📞 Ligar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.btnNav}
                  onPress={() => navegar(p)}
                >
                  <Text style={styles.btnNavText}>🗺 Navegar</Text>
                </TouchableOpacity>
              </View>

              {p.status === "entrega" && (
                <TouchableOpacity
                  style={[styles.btnEntregue, finalizando === p.id && styles.btnDisabled]}
                  onPress={() => finalizarEntrega(p.id)}
                  disabled={finalizando === p.id}
                >
                  {finalizando === p.id
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnEntregueText}>✅ Entregue!</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f4f4f5" },
  content: { padding: 16 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#f97316", alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  nome: { fontSize: 17, fontWeight: "700", color: "#111" },
  empresa: { fontSize: 13, color: "#666", marginTop: 1 },

  aviso: {
    backgroundColor: "#fef3c7", borderWidth: 1.5, borderColor: "#f59e0b",
    borderRadius: 14, padding: 14, marginBottom: 14,
  },
  avisoTitulo: { fontWeight: "700", color: "#92400e", fontSize: 14 },
  avisoTexto: { color: "#78350f", fontSize: 13, marginTop: 4, lineHeight: 18 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.04,
    shadowRadius: 8, elevation: 2,
  },
  cardTitulo: { fontSize: 14, fontWeight: "700", color: "#111", marginBottom: 10 },

  statusRow: { flexDirection: "row", gap: 8 },
  statusBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#e5e7eb", alignItems: "center",
  },
  statusBtnText: { fontSize: 12, fontWeight: "600", color: "#666" },

  gpsRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12 },
  gpsDesc: { fontSize: 12, color: "#666", marginTop: 2, lineHeight: 16 },
  gpsBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#dcfce7", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  gpsPoint: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },
  gpsBadgeText: { fontSize: 12, fontWeight: "700", color: "#16a34a" },
  gpsBtn: {
    backgroundColor: "#f97316", borderRadius: 12,
    height: 46, alignItems: "center", justifyContent: "center",
  },
  gpsBtnStop: { backgroundColor: "#64748b" },
  gpsBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  secao: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 10 },
  badge: { color: "#f97316" },

  vazio: {
    backgroundColor: "#fff", borderRadius: 16, padding: 32,
    alignItems: "center", marginBottom: 14,
  },
  vazioCod: { fontSize: 40 },
  vazioTxt: { color: "#999", marginTop: 8, fontSize: 14 },

  pedidoCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.04,
    shadowRadius: 8, elevation: 2,
  },
  pedidoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  pedidoNum: { fontSize: 15, fontWeight: "800", color: "#111" },
  statusTag: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusTagText: { fontSize: 11, fontWeight: "700" },
  pedidoEmpresa: { fontSize: 12, color: "#f97316", fontWeight: "600", marginBottom: 4 },
  pedidoCliente: { fontSize: 13, color: "#444", marginBottom: 3 },
  pedidoEndereco: { fontSize: 13, color: "#666", marginBottom: 6, lineHeight: 18 },
  pedidoTaxa: { fontSize: 17, fontWeight: "800", color: "#16a34a", marginBottom: 10 },

  pedidoBtns: { flexDirection: "row", gap: 8, marginBottom: 10 },
  btnTel: {
    flex: 1, height: 42, borderRadius: 10, borderWidth: 1.5,
    borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center",
  },
  btnTelText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  btnNav: {
    flex: 1, height: 42, borderRadius: 10,
    backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center",
  },
  btnNavText: { fontSize: 13, fontWeight: "600", color: "#1d4ed8" },
  btnEntregue: {
    backgroundColor: "#16a34a", borderRadius: 12,
    height: 48, alignItems: "center", justifyContent: "center",
  },
  btnEntregueText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
