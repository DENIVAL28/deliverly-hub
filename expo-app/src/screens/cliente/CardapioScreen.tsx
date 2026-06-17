import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, ScrollView, Modal, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function CardapioScreen({ route, navigation }: any) {
  const { slug, nome } = route.params;

  const [empresa, setEmpresa]       = useState<any>(null);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [produtos, setProdutos]     = useState<any[]>([]);
  const [catAtiva, setCatAtiva]     = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [carrinho, setCarrinho]     = useState<any[]>([]);
  const [modalProd, setModalProd]   = useState<any | null>(null);
  const [obs, setObs]               = useState("");
  const [qty, setQty]               = useState(1);

  useEffect(() => {
    async function carregar() {
      const { data: emp } = await supabase
        .from("empresas")
        .select("id, nome_fantasia, logo_url, banner_url, segmento, tempo_entrega, taxa_entrega, pedido_minimo")
        .eq("slug", slug)
        .single();
      if (!emp) return;
      setEmpresa(emp);

      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from("categorias").select("id, nome, ordem").eq("empresa_id", emp.id).order("ordem"),
        supabase.from("produtos").select("id, nome, descricao, preco, foto_url, categoria_id, ativo").eq("empresa_id", emp.id).eq("ativo", true),
      ]);
      setCategorias(cats ?? []);
      setProdutos(prods ?? []);
      if (cats?.length) setCatAtiva(cats[0].id);
      setLoading(false);
    }
    carregar();
  }, [slug]);

  const total = carrinho.reduce((s, i) => s + i.preco * i.qty, 0);
  const qtdCarrinho = carrinho.reduce((s, i) => s + i.qty, 0);

  function adicionarAoCarrinho() {
    if (!modalProd) return;
    setCarrinho((prev) => {
      const existe = prev.findIndex((i) => i.id === modalProd.id && i.obs === obs);
      if (existe >= 0) {
        const novo = [...prev];
        novo[existe] = { ...novo[existe], qty: novo[existe].qty + qty };
        return novo;
      }
      return [...prev, { ...modalProd, qty, obs }];
    });
    setModalProd(null);
    setObs("");
    setQty(1);
  }

  const produtosDaCat = catAtiva ? produtos.filter((p) => p.categoria_id === catAtiva) : [];

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f97316" /></View>;

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.voltarBtn}>
          <Text style={s.voltarTexto}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerNome} numberOfLines={1}>{empresa?.nome_fantasia}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Info da loja */}
      <View style={s.lojaInfo}>
        {empresa?.logo_url
          ? <Image source={{ uri: empresa.logo_url }} style={s.logo} />
          : <View style={[s.logo, s.logoPlaceholder]}><Text style={{ fontSize: 20 }}>🍽️</Text></View>
        }
        <View style={{ flex: 1 }}>
          <Text style={s.segmento}>{empresa?.segmento}</Text>
          <Text style={s.meta}>
            {empresa?.tempo_entrega ? `${empresa.tempo_entrega} min` : ""}
            {empresa?.taxa_entrega != null ? ` · Taxa R$ ${Number(empresa.taxa_entrega).toFixed(2)}` : ""}
          </Text>
        </View>
      </View>

      {/* Categorias */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catsScroll} contentContainerStyle={s.cats}>
        {categorias.map((c) => (
          <TouchableOpacity key={c.id} style={[s.catChip, catAtiva === c.id && s.catChipAtiva]} onPress={() => setCatAtiva(c.id)}>
            <Text style={[s.catTexto, catAtiva === c.id && s.catTextoAtivo]}>{c.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Produtos */}
      <FlatList
        data={produtosDaCat}
        keyExtractor={(p) => p.id}
        contentContainerStyle={s.lista}
        renderItem={({ item: p }) => (
          <TouchableOpacity style={s.card} onPress={() => { setModalProd(p); setQty(1); setObs(""); }} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={s.prodNome}>{p.nome}</Text>
              {p.descricao ? <Text style={s.prodDesc} numberOfLines={2}>{p.descricao}</Text> : null}
              <Text style={s.prodPreco}>{fmt(p.preco)}</Text>
            </View>
            {p.foto_url
              ? <Image source={{ uri: p.foto_url }} style={s.prodFoto} />
              : null
            }
          </TouchableOpacity>
        )}
      />

      {/* Botão carrinho */}
      {qtdCarrinho > 0 && (
        <View style={s.carrinhoBar}>
          <TouchableOpacity
            style={s.carrinhoBotao}
            onPress={() => navigation.navigate("Checkout", { empresa, carrinho })}
          >
            <View style={s.carrinhoBadge}><Text style={s.carrinhoBadgeTexto}>{qtdCarrinho}</Text></View>
            <Text style={s.carrinhoBotaoTexto}>Ver carrinho</Text>
            <Text style={s.carrinhoBotaoTexto}>{fmt(total)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal produto */}
      <Modal visible={!!modalProd} animationType="slide" transparent>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModalProd(null)} />
        <View style={s.modal}>
          {modalProd?.foto_url && <Image source={{ uri: modalProd.foto_url }} style={s.modalFoto} />}
          <View style={s.modalBody}>
            <Text style={s.modalNome}>{modalProd?.nome}</Text>
            {modalProd?.descricao ? <Text style={s.modalDesc}>{modalProd.descricao}</Text> : null}
            <Text style={s.modalPreco}>{modalProd ? fmt(modalProd.preco) : ""}</Text>
            <TextInput
              style={s.obsInput} placeholder="Observação (opcional)"
              placeholderTextColor="#a1a1aa" value={obs} onChangeText={setObs} multiline
            />
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                <Text style={s.qtyBtnTexto}>−</Text>
              </TouchableOpacity>
              <Text style={s.qtyVal}>{qty}</Text>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setQty((q) => q + 1)}>
                <Text style={s.qtyBtnTexto}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.addBotao} onPress={adicionarAoCarrinho}>
              <Text style={s.addBotaoTexto}>Adicionar {modalProd ? fmt(modalProd.preco * qty) : ""}</Text>
            </TouchableOpacity>
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
  voltarTexto: { fontSize: 28, color: "#18181b", lineHeight: 30 },
  headerNome: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#18181b" },
  lojaInfo: { backgroundColor: "#fff", padding: 14, flexDirection: "row", gap: 12, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  logo: { width: 52, height: 52, borderRadius: 12 },
  logoPlaceholder: { backgroundColor: "#fff7ed", justifyContent: "center", alignItems: "center" },
  segmento: { fontSize: 14, fontWeight: "700", color: "#18181b" },
  meta: { fontSize: 12, color: "#71717a", marginTop: 2 },
  catsScroll: { backgroundColor: "#fff", maxHeight: 52 },
  cats: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: "center" },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f4f4f5" },
  catChipAtiva: { backgroundColor: "#f97316" },
  catTexto: { fontSize: 13, fontWeight: "600", color: "#71717a" },
  catTextoAtivo: { color: "#fff" },
  lista: { padding: 12, gap: 10 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", gap: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6 },
  prodNome: { fontSize: 15, fontWeight: "700", color: "#18181b", marginBottom: 4 },
  prodDesc: { fontSize: 12, color: "#71717a", marginBottom: 6 },
  prodPreco: { fontSize: 15, fontWeight: "800", color: "#f97316" },
  prodFoto: { width: 80, height: 80, borderRadius: 10 },
  carrinhoBar: { padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e4e4e7" },
  carrinhoBotao: { backgroundColor: "#f97316", borderRadius: 14, height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, justifyContent: "space-between" },
  carrinhoBadge: { backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 20, width: 26, height: 26, justifyContent: "center", alignItems: "center" },
  carrinhoBadgeTexto: { color: "#fff", fontSize: 13, fontWeight: "800" },
  carrinhoBotaoTexto: { color: "#fff", fontSize: 15, fontWeight: "700" },
  overlay: { flex: 1 },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  modalFoto: { width: "100%", height: 200 },
  modalBody: { padding: 20 },
  modalNome: { fontSize: 20, fontWeight: "800", color: "#18181b", marginBottom: 6 },
  modalDesc: { fontSize: 14, color: "#71717a", marginBottom: 10 },
  modalPreco: { fontSize: 20, fontWeight: "800", color: "#f97316", marginBottom: 14 },
  obsInput: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 10, padding: 12, fontSize: 14, color: "#18181b", marginBottom: 14, minHeight: 56 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 16 },
  qtyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f4f4f5", justifyContent: "center", alignItems: "center" },
  qtyBtnTexto: { fontSize: 22, color: "#18181b", lineHeight: 24 },
  qtyVal: { fontSize: 20, fontWeight: "700", color: "#18181b", minWidth: 30, textAlign: "center" },
  addBotao: { backgroundColor: "#f97316", borderRadius: 14, height: 52, justifyContent: "center", alignItems: "center" },
  addBotaoTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
