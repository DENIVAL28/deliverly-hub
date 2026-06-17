import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, ScrollView, Modal, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function CardapioScreen({ route, navigation }: any) {
  const { slug } = route.params;

  const [empresa, setEmpresa]         = useState<any>(null);
  const [categorias, setCategorias]   = useState<any[]>([]);
  const [produtos, setProdutos]       = useState<any[]>([]);
  const [catAtiva, setCatAtiva]       = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [carrinho, setCarrinho]       = useState<any[]>([]);

  // Modal produto
  const [modalProd, setModalProd]     = useState<any | null>(null);
  const [grupos, setGrupos]           = useState<any[]>([]);
  const [selecoes, setSelecoes]       = useState<Record<string, string[]>>({});
  const [obs, setObs]                 = useState("");
  const [qty, setQty]                 = useState(1);
  const [loadingGrupos, setLoadingGrupos] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: emp } = await supabase
        .from("empresas")
        .select("id, nome_fantasia, logo_url, segmento, tempo_entrega, taxa_entrega, pedido_minimo, aberto, retirada_ativa, horario_abertura, horario_fechamento")
        .eq("slug", slug)
        .single();
      if (!emp) return;
      setEmpresa(emp);

      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from("categorias").select("id, nome, ordem").eq("empresa_id", emp.id).order("ordem"),
        supabase.from("produtos").select("id, nome, descricao, preco, preco_promocional, foto_url, categoria_id, ativo, controlar_estoque, estoque").eq("empresa_id", emp.id).eq("ativo", true),
      ]);
      setCategorias(cats ?? []);
      setProdutos(prods ?? []);
      if (cats?.length) setCatAtiva(cats[0].id);
      setLoading(false);
    }
    carregar();
  }, [slug]);

  const abrirProduto = useCallback(async (p: any) => {
    setModalProd(p);
    setQty(1);
    setObs("");
    setSelecoes({});
    setGrupos([]);
    setLoadingGrupos(true);
    const { data } = await (supabase.from("grupos_opcoes") as any)
      .select("*, opcoes(*)")
      .eq("produto_id", p.id)
      .order("ordem");
    setGrupos(data ?? []);
    setLoadingGrupos(false);
  }, []);

  function toggleOpcao(grupoId: string, opcaoId: string, multiplo: boolean, maxEscolhas: number) {
    setSelecoes((prev) => {
      const atual = prev[grupoId] ?? [];
      if (!multiplo) return { ...prev, [grupoId]: [opcaoId] };
      if (atual.includes(opcaoId)) return { ...prev, [grupoId]: atual.filter((id) => id !== opcaoId) };
      if (maxEscolhas > 0 && atual.length >= maxEscolhas) return { ...prev, [grupoId]: [...atual.slice(1), opcaoId] };
      return { ...prev, [grupoId]: [...atual, opcaoId] };
    });
  }

  const precoAdicionais = grupos.reduce((sum, g) => {
    const ids = selecoes[g.id] ?? [];
    return sum + ids.reduce((s: number, id: string) => {
      const op = g.opcoes?.find((o: any) => o.id === id);
      return s + (op ? Number(op.preco_adicional ?? 0) : 0);
    }, 0);
  }, 0);

  const precoBase = modalProd ? Number(modalProd.preco_promocional ?? modalProd.preco) : 0;
  const precoTotal = (precoBase + precoAdicionais) * qty;

  const obrigatoriosPendentes = grupos.filter((g) => g.obrigatorio && !(selecoes[g.id]?.length));

  function adicionarAoCarrinho() {
    if (!modalProd) return;
    if (obrigatoriosPendentes.length > 0) return;

    // Monta texto de opções selecionadas
    const opcoesTexto = grupos
      .flatMap((g) => (selecoes[g.id] ?? []).map((id) => g.opcoes?.find((o: any) => o.id === id)?.nome).filter(Boolean))
      .join(", ");

    const obsCompleta = [opcoesTexto, obs.trim()].filter(Boolean).join(" | ");

    setCarrinho((prev) => {
      const chave = modalProd.id + "_" + opcoesTexto;
      const existe = prev.findIndex((i) => i._chave === chave);
      if (existe >= 0) {
        const novo = [...prev];
        novo[existe] = { ...novo[existe], qty: novo[existe].qty + qty };
        return novo;
      }
      return [...prev, {
        _chave: chave,
        id: modalProd.id,
        nome: modalProd.nome,
        preco: precoBase + precoAdicionais,
        qty,
        obs: obsCompleta,
      }];
    });
    setModalProd(null);
  }

  const total = carrinho.reduce((s, i) => s + i.preco * i.qty, 0);
  const qtdCarrinho = carrinho.reduce((s, i) => s + i.qty, 0);
  const produtosDaCat = catAtiva ? produtos.filter((p) => p.categoria_id === catAtiva) : [];

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#f97316" /></View>;

  const estaAberto = empresa?.aberto;

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <Text style={s.lojaSegmento}>{empresa?.segmento}</Text>
            <View style={[s.statusBadge, { backgroundColor: estaAberto ? "#dcfce7" : "#fee2e2" }]}>
              <Text style={[s.statusTexto, { color: estaAberto ? "#16a34a" : "#dc2626" }]}>
                {estaAberto ? "Aberto" : "Fechado"}
              </Text>
            </View>
          </View>
          <Text style={s.lojaMeta}>
            {empresa?.tempo_entrega ? `${empresa.tempo_entrega} min` : ""}
            {empresa?.taxa_entrega != null ? ` · Taxa ${fmt(empresa.taxa_entrega)}` : ""}
            {empresa?.pedido_minimo > 0 ? ` · Mín. ${fmt(empresa.pedido_minimo)}` : ""}
          </Text>
        </View>
      </View>

      {!estaAberto && (
        <View style={s.fechadoBanner}>
          <Text style={s.fechadoTexto}>⚠️ Esta loja está fechada no momento. Pedidos podem não ser atendidos.</Text>
        </View>
      )}

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
        renderItem={({ item: p }) => {
          const preco = Number(p.preco_promocional ?? p.preco);
          const esgotado = p.controlar_estoque && p.estoque === 0;
          return (
            <TouchableOpacity
              style={[s.card, esgotado && { opacity: 0.5 }]}
              onPress={() => !esgotado && abrirProduto(p)}
              activeOpacity={esgotado ? 1 : 0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.prodNome}>{p.nome}</Text>
                {p.descricao ? <Text style={s.prodDesc} numberOfLines={2}>{p.descricao}</Text> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <Text style={s.prodPreco}>{fmt(preco)}</Text>
                  {p.preco_promocional && (
                    <Text style={s.prodPrecoOld}>{fmt(Number(p.preco))}</Text>
                  )}
                  {esgotado && <Text style={s.esgotadoBadge}>Esgotado</Text>}
                  {p.controlar_estoque && !esgotado && p.estoque <= 5 && (
                    <Text style={s.estoqueBadge}>Últimas {p.estoque}</Text>
                  )}
                </View>
              </View>
              {p.foto_url ? <Image source={{ uri: p.foto_url }} style={s.prodFoto} /> : null}
            </TouchableOpacity>
          );
        }}
      />

      {/* Barra carrinho */}
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
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.overlay} onPress={() => setModalProd(null)} activeOpacity={1} />
          <View style={s.modal}>
            <View style={s.modalHandle} />
            {modalProd?.foto_url && <Image source={{ uri: modalProd.foto_url }} style={s.modalFoto} />}
            <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={s.modalNome}>{modalProd?.nome}</Text>
              {modalProd?.descricao ? <Text style={s.modalDesc}>{modalProd.descricao}</Text> : null}
              <Text style={s.modalPreco}>{fmt(precoBase)}</Text>

              {/* Grupos de opções */}
              {loadingGrupos ? (
                <ActivityIndicator color="#f97316" style={{ marginVertical: 16 }} />
              ) : (
                grupos.map((g) => (
                  <View key={g.id} style={s.grupo}>
                    <View style={s.grupoHeader}>
                      <Text style={s.grupoNome}>{g.nome}</Text>
                      {g.obrigatorio
                        ? <Text style={s.grupoObrig}>Obrigatório</Text>
                        : <Text style={s.grupoOpcional}>Opcional</Text>
                      }
                    </View>
                    {g.min_escolhas > 0 && <Text style={s.grupoInfo}>Escolha {g.min_escolhas === g.max_escolhas ? `${g.min_escolhas}` : `entre ${g.min_escolhas} e ${g.max_escolhas}`}</Text>}
                    {(g.opcoes ?? []).filter((o: any) => o.ativo !== false).map((op: any) => {
                      const selecionado = (selecoes[g.id] ?? []).includes(op.id);
                      return (
                        <TouchableOpacity
                          key={op.id}
                          style={[s.opcaoRow, selecionado && s.opcaoRowAtiva]}
                          onPress={() => toggleOpcao(g.id, op.id, g.multiplo, g.max_escolhas ?? 1)}
                        >
                          <View style={[s.opcaoCheck, selecionado && s.opcaoCheckAtivo]}>
                            {selecionado && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>✓</Text>}
                          </View>
                          <Text style={[s.opcaoNome, selecionado && { fontWeight: "700" }]}>{op.nome}</Text>
                          {op.preco_adicional > 0 && (
                            <Text style={s.opcaoPreco}>+{fmt(op.preco_adicional)}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))
              )}

              <TextInput
                style={s.obsInput}
                placeholder="Observação (opcional)"
                placeholderTextColor="#a1a1aa"
                value={obs}
                onChangeText={setObs}
                multiline
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

              {obrigatoriosPendentes.length > 0 && (
                <Text style={s.obrigMsg}>Selecione: {obrigatoriosPendentes.map((g) => g.nome).join(", ")}</Text>
              )}

              <TouchableOpacity
                style={[s.addBotao, obrigatoriosPendentes.length > 0 && { opacity: 0.5 }]}
                onPress={adicionarAoCarrinho}
                disabled={obrigatoriosPendentes.length > 0}
              >
                <Text style={s.addBotaoTexto}>Adicionar · {fmt(precoTotal)}</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
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
  lojaSegmento: { fontSize: 14, fontWeight: "700", color: "#18181b" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  statusTexto: { fontSize: 11, fontWeight: "700" },
  lojaMeta: { fontSize: 12, color: "#71717a" },
  fechadoBanner: { backgroundColor: "#fff7ed", padding: 10, borderBottomWidth: 1, borderBottomColor: "#fed7aa" },
  fechadoTexto: { fontSize: 12, color: "#ea580c", textAlign: "center" },
  catsScroll: { backgroundColor: "#fff", maxHeight: 52 },
  cats: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: "center" },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f4f4f5" },
  catChipAtiva: { backgroundColor: "#f97316" },
  catTexto: { fontSize: 13, fontWeight: "600", color: "#71717a" },
  catTextoAtivo: { color: "#fff" },
  lista: { padding: 12, gap: 10 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", gap: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6 },
  prodNome: { fontSize: 15, fontWeight: "700", color: "#18181b" },
  prodDesc: { fontSize: 12, color: "#71717a", marginTop: 2 },
  prodPreco: { fontSize: 15, fontWeight: "800", color: "#f97316" },
  prodPrecoOld: { fontSize: 12, color: "#a1a1aa", textDecorationLine: "line-through" },
  esgotadoBadge: { fontSize: 10, fontWeight: "700", color: "#dc2626", backgroundColor: "#fee2e2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  estoqueBadge: { fontSize: 10, fontWeight: "700", color: "#d97706", backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  prodFoto: { width: 80, height: 80, borderRadius: 10 },
  carrinhoBar: { padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e4e4e7" },
  carrinhoBotao: { backgroundColor: "#f97316", borderRadius: 14, height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, justifyContent: "space-between" },
  carrinhoBadge: { backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 20, width: 26, height: 26, justifyContent: "center", alignItems: "center" },
  carrinhoBadgeTexto: { color: "#fff", fontSize: 13, fontWeight: "800" },
  carrinhoBotaoTexto: { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalContainer: { flex: 1, justifyContent: "flex-end" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", overflow: "hidden" },
  modalHandle: { width: 36, height: 4, backgroundColor: "#e4e4e7", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  modalFoto: { width: "100%", height: 200 },
  modalBody: { padding: 20, gap: 12 },
  modalNome: { fontSize: 20, fontWeight: "800", color: "#18181b" },
  modalDesc: { fontSize: 14, color: "#71717a" },
  modalPreco: { fontSize: 20, fontWeight: "800", color: "#f97316" },
  grupo: { backgroundColor: "#f9f9f9", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#e4e4e7" },
  grupoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#f4f4f5" },
  grupoNome: { fontSize: 14, fontWeight: "800", color: "#18181b" },
  grupoObrig: { fontSize: 11, fontWeight: "700", color: "#f97316", backgroundColor: "#fff7ed", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  grupoOpcional: { fontSize: 11, color: "#a1a1aa" },
  grupoInfo: { fontSize: 11, color: "#71717a", paddingHorizontal: 14, paddingBottom: 6 },
  opcaoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#e4e4e7" },
  opcaoRowAtiva: { backgroundColor: "#fff7ed" },
  opcaoCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#d4d4d8", justifyContent: "center", alignItems: "center" },
  opcaoCheckAtivo: { backgroundColor: "#f97316", borderColor: "#f97316" },
  opcaoNome: { flex: 1, fontSize: 14, color: "#3f3f46" },
  opcaoPreco: { fontSize: 13, fontWeight: "700", color: "#f97316" },
  obsInput: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 10, padding: 12, fontSize: 14, color: "#18181b", minHeight: 56 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#f4f4f5", justifyContent: "center", alignItems: "center" },
  qtyBtnTexto: { fontSize: 24, color: "#18181b", lineHeight: 26 },
  qtyVal: { fontSize: 20, fontWeight: "700", color: "#18181b", minWidth: 30, textAlign: "center" },
  obrigMsg: { fontSize: 12, color: "#dc2626", textAlign: "center" },
  addBotao: { backgroundColor: "#f97316", borderRadius: 14, height: 52, justifyContent: "center", alignItems: "center" },
  addBotaoTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
