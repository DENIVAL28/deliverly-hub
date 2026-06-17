import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Image, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

export default function LojasScreen({ navigation }: any) {
  const [lojas, setLojas]       = useState<any[]>([]);
  const [busca, setBusca]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from("empresas")
      .select("id, nome_fantasia, slug, logo_url, segmento, cidade")
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

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f97316" /></View>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.titulo}>🛵 Deliverly Hub</Text>
        <Text style={s.sub}>Peça agora na sua loja favorita</Text>
      </View>
      <View style={s.buscaWrap}>
        <TextInput
          style={s.busca} placeholder="Buscar loja ou categoria..."
          placeholderTextColor="#a1a1aa" value={busca} onChangeText={setBusca}
        />
      </View>
      <FlatList
        data={filtradas}
        keyExtractor={(l) => l.id}
        contentContainerStyle={s.lista}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} colors={["#f97316"]} />}
        renderItem={({ item: l }) => (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate("Cardapio", { slug: l.slug, nome: l.nome_fantasia })} activeOpacity={0.8}>
            {l.logo_url
              ? <Image source={{ uri: l.logo_url }} style={s.logo} />
              : <View style={[s.logo, s.logoPlaceholder]}><Text style={s.logoEmoji}>🍽️</Text></View>
            }
            <View style={s.info}>
              <Text style={s.nome} numberOfLines={1}>{l.nome_fantasia}</Text>
              <Text style={s.detalhe}>{l.segmento ?? "Delivery"}{l.cidade ? ` · ${l.cidade}` : ""}</Text>
            </View>
            <Text style={s.seta}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.vazio}>
            <Text style={s.vazioCentro}>🔍</Text>
            <Text style={s.vazioTexto}>Nenhuma loja encontrada</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#f97316", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  titulo: { fontSize: 22, fontWeight: "800", color: "#fff" },
  sub: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  buscaWrap: { padding: 12, backgroundColor: "#f97316" },
  busca: {
    height: 44, backgroundColor: "#fff", borderRadius: 12,
    paddingHorizontal: 14, fontSize: 15, color: "#18181b",
  },
  lista: { padding: 12, gap: 8 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
  },
  logo: { width: 52, height: 52, borderRadius: 12 },
  logoPlaceholder: { backgroundColor: "#fff7ed", justifyContent: "center", alignItems: "center" },
  logoEmoji: { fontSize: 24 },
  info: { flex: 1 },
  nome: { fontSize: 15, fontWeight: "700", color: "#18181b" },
  detalhe: { fontSize: 12, color: "#71717a", marginTop: 2 },
  seta: { fontSize: 20, color: "#d4d4d8" },
  vazio: { alignItems: "center", paddingTop: 60 },
  vazioCentro: { fontSize: 40 },
  vazioTexto: { fontSize: 14, color: "#a1a1aa", marginTop: 8 },
});
