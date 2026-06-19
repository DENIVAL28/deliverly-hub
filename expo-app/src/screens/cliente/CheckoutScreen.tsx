import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function CheckoutScreen({ route, navigation }: any) {
  const { empresa, carrinho } = route.params;

  const [nome, setNome]               = useState("");
  const [telefone, setTelefone]       = useState("");
  const [logradouro, setLogradouro]   = useState("");
  const [numero, setNumero]           = useState("");
  const [bairro, setBairro]           = useState("");
  const [complemento, setComplemento] = useState("");
  const [pagamento, setPagamento]     = useState(empresa.chave_pix ? "PIX na entrega" : "Dinheiro");
  const [troco, setTroco]             = useState("");
  const [obs, setObs]                 = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<"delivery" | "retirada">("delivery");
  const [cupomCodigo, setCupomCodigo] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<any | null>(null);
  const [cupomErro, setCupomErro]     = useState("");
  const [aplicandoCupom, setAplicandoCupom] = useState(false);
  const [loading, setLoading]         = useState(false);

  const subtotal = carrinho.reduce((s: number, i: any) => s + i.preco * i.qty, 0);
  const taxa = tipoEntrega === "delivery" ? (empresa.taxa_entrega ?? 0) : 0;

  // Calcular desconto do cupom
  let desconto = 0;
  if (cupomAplicado) {
    if (cupomAplicado.tipo === "percentual") desconto = subtotal * (cupomAplicado.valor / 100);
    else if (cupomAplicado.tipo === "fixo") desconto = Math.min(cupomAplicado.valor, subtotal);
    else if (cupomAplicado.tipo === "frete_gratis") desconto = taxa;
  }

  const total = Math.max(0, subtotal + taxa - desconto);

  // Formas de pagamento disponÃ­veis
  const pagamentos = ["Dinheiro", "CartÃ£o na entrega", ...(empresa.chave_pix ? ["PIX na entrega"] : [])];

  async function aplicarCupom() {
    if (!cupomCodigo.trim()) return;
    setAplicandoCupom(true);
    setCupomErro("");
    const { data, error } = await supabase
      .from("cupons")
      .select("id, codigo, tipo, valor, desconto_max, validade, usos_max, usos_atual, ativo, pedido_minimo")
      .eq("empresa_id", empresa.id)
      .eq("codigo", cupomCodigo.trim().toUpperCase())
      .single();

    setAplicandoCupom(false);
    if (error || !data) { setCupomErro("Cupom nÃ£o encontrado."); return; }
    if (!data.ativo) { setCupomErro("Cupom inativo."); return; }
    if (data.validade && new Date(data.validade) < new Date()) { setCupomErro("Cupom expirado."); return; }
    if (data.usos_max && data.usos_atual >= data.usos_max) { setCupomErro("Cupom esgotado."); return; }
    if (data.pedido_minimo && subtotal < data.pedido_minimo) {
      setCupomErro(`Pedido mÃ­nimo para este cupom: ${fmt(data.pedido_minimo)}`); return;
    }
    setCupomAplicado(data);
    setCupomErro("");
  }

  async function finalizar() {
    // ValidaÃ§Ãµes
    if (!nome.trim()) { Alert.alert("Informe seu nome."); return; }
    if (tipoEntrega === "delivery") {
      if (!telefone.trim()) { Alert.alert("Informe seu telefone."); return; }
      if (!logradouro.trim() || !numero.trim() || !bairro.trim()) {
        Alert.alert("Preencha o endereÃ§o completo."); return;
      }
    }

    // Validar loja aberta
    if (!empresa.aberto) {
      const ok = await new Promise((resolve) =>
        Alert.alert("Loja fechada", "Esta loja estÃ¡ fechada no momento. Deseja enviar o pedido mesmo assim?",
          [{ text: "Cancelar", onPress: () => resolve(false) }, { text: "Enviar", onPress: () => resolve(true) }]
        )
      );
      if (!ok) return;
    }

    // Validar pedido mÃ­nimo
    if (empresa.pedido_minimo && subtotal < empresa.pedido_minimo) {
      Alert.alert("Pedido mÃ­nimo", `O pedido mÃ­nimo desta loja Ã© ${fmt(empresa.pedido_minimo)}.`); return;
    }

    setLoading(true);

    // Garante sessao autenticada para que user_id seja gravado no pedido
    // e o cliente possa acompanhar o rastreio via RLS
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) await supabase.auth.signInAnonymously();

    const obsCompleta = [
      obs.trim() || null,
      pagamento === "Dinheiro" && troco ? `Troco para R$ ${troco}` : null,
    ].filter(Boolean).join(" | ");

    const endereco = tipoEntrega === "retirada"
      ? "Retirada no balcÃ£o"
      : `${logradouro}, ${numero}${complemento ? `, ${complemento}` : ""} - ${bairro}`;

    const { data: pedidoJson, error } = await supabase.rpc("finalizar_pedido", {
      p_empresa_id:       empresa.id,
      p_cliente_nome:     nome.trim(),
      p_cliente_telefone: telefone.trim() || null,
      p_cliente_endereco: endereco,
      p_tipo:             tipoEntrega,
      p_forma_pagamento:  pagamento,
      p_observacao:       obsCompleta || null,
      p_cupom_id:         cupomAplicado?.id ?? null,
      p_itens: carrinho.map((i: any) => ({
        produto_id: i.id,
        quantidade: i.qty,
        observacao: i.obs || null,
      })),
    });

    setLoading(false);
    if (error) { Alert.alert("Erro ao finalizar pedido", error.message); return; }

    const pedidoId =
      typeof pedidoJson === "string"
        ? pedidoJson
        : (pedidoJson as any)?.id;

    if (!pedidoId) {
      Alert.alert("Pedido criado", "Nao foi possivel abrir o rastreio automaticamente.");
      navigation.popToTop();
      return;
    }

    navigation.replace("Rastreio", { pedidoId, empresaNome: empresa.nome_fantasia, empresa });
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.voltarBtn}>
          <Text style={s.voltarTexto}>â€¹</Text>
        </TouchableOpacity>
        <Text style={s.headerNome}>Finalizar pedido</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Resumo */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Resumo</Text>
          {carrinho.map((i: any, idx: number) => (
            <View key={idx} style={s.itemRow}>
              <Text style={s.itemQty}>{i.qty}Ã—</Text>
              <Text style={s.itemNome} numberOfLines={1}>{i.nome}</Text>
              <Text style={s.itemPreco}>{fmt(i.preco * i.qty)}</Text>
            </View>
          ))}
          <View style={s.divider} />
          <View style={s.itemRow}><Text style={s.itemQty} /><Text style={[s.itemNome, { color: "#71717a" }]}>Subtotal</Text><Text style={s.itemPreco}>{fmt(subtotal)}</Text></View>
          {taxa > 0 && <View style={s.itemRow}><Text style={s.itemQty} /><Text style={[s.itemNome, { color: "#71717a" }]}>Taxa de entrega</Text><Text style={s.itemPreco}>{fmt(taxa)}</Text></View>}
          {desconto > 0 && <View style={s.itemRow}><Text style={s.itemQty} /><Text style={[s.itemNome, { color: "#16a34a" }]}>Desconto</Text><Text style={[s.itemPreco, { color: "#16a34a" }]}>-{fmt(desconto)}</Text></View>}
          <View style={[s.itemRow, s.totalRow]}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValor}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Tipo de entrega */}
        {empresa.retirada_ativa && (
          <View style={s.secao}>
            <Text style={s.secaoTitulo}>Tipo de entrega</Text>
            <View style={s.tipoRow}>
              {(["delivery", "retirada"] as const).map((t) => (
                <TouchableOpacity key={t} style={[s.tipoBtn, tipoEntrega === t && s.tipoBtnAtivo]} onPress={() => setTipoEntrega(t)}>
                  <Text style={[s.tipoTexto, tipoEntrega === t && s.tipoTextoAtivo]}>{t === "delivery" ? "ðŸ›µ Delivery" : "ðŸƒ Retirada"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Dados */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Seus dados</Text>
          <TextInput style={s.input} placeholder="Nome completo *" placeholderTextColor="#a1a1aa" value={nome} onChangeText={setNome} />
          {tipoEntrega === "delivery" && (
            <TextInput style={s.input} placeholder="WhatsApp / Telefone *" placeholderTextColor="#a1a1aa" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />
          )}
        </View>

        {/* EndereÃ§o */}
        {tipoEntrega === "delivery" && (
          <View style={s.secao}>
            <Text style={s.secaoTitulo}>EndereÃ§o de entrega</Text>
            <TextInput style={s.input} placeholder="Rua / Avenida *" placeholderTextColor="#a1a1aa" value={logradouro} onChangeText={setLogradouro} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="NÂº *" placeholderTextColor="#a1a1aa" value={numero} onChangeText={setNumero} keyboardType="numeric" />
              <TextInput style={[s.input, { flex: 2 }]} placeholder="Complemento" placeholderTextColor="#a1a1aa" value={complemento} onChangeText={setComplemento} />
            </View>
            <TextInput style={s.input} placeholder="Bairro *" placeholderTextColor="#a1a1aa" value={bairro} onChangeText={setBairro} />
          </View>
        )}

        {/* Cupom */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Cupom de desconto</Text>
          {cupomAplicado ? (
            <View style={s.cupomAplicado}>
              <Text style={s.cupomAplicadoTexto}>ðŸŽ‰ {cupomAplicado.codigo} â€” desconto de {fmt(desconto)}</Text>
              <TouchableOpacity onPress={() => { setCupomAplicado(null); setCupomCodigo(""); }}>
                <Text style={s.cupomRemover}>Remover</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                placeholder="CÃ³digo do cupom"
                placeholderTextColor="#a1a1aa"
                value={cupomCodigo}
                onChangeText={(t) => setCupomCodigo(t.toUpperCase())}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={s.cupomBtn} onPress={aplicarCupom} disabled={aplicandoCupom}>
                {aplicandoCupom ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.cupomBtnTexto}>Aplicar</Text>}
              </TouchableOpacity>
            </View>
          )}
          {cupomErro ? <Text style={s.cupomErro}>{cupomErro}</Text> : null}
        </View>

        {/* Pagamento */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Pagamento</Text>
          {pagamentos.map((p) => (
            <TouchableOpacity key={p} style={[s.pgOpcao, pagamento === p && s.pgOpcaoAtiva]} onPress={() => setPagamento(p)}>
              <View style={[s.radio, pagamento === p && s.radioAtivo]} />
              <Text style={[s.pgTexto, pagamento === p && s.pgTextoAtivo]}>{p}</Text>
            </TouchableOpacity>
          ))}
          {pagamento === "Dinheiro" && (
            <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Troco para quanto?" placeholderTextColor="#a1a1aa" value={troco} onChangeText={setTroco} keyboardType="numeric" />
          )}
        </View>

        {/* ObservaÃ§Ã£o */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>ObservaÃ§Ã£o</Text>
          <TextInput style={[s.input, { height: 70 }]} placeholder="Ex: sem cebola, portÃ£o azul..." placeholderTextColor="#a1a1aa" value={obs} onChangeText={setObs} multiline />
        </View>

        <TouchableOpacity style={s.botao} onPress={finalizar} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTexto}>Fazer pedido Â· {fmt(total)}</Text>}
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f5" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  voltarBtn: { width: 36, height: 36, justifyContent: "center" },
  voltarTexto: { fontSize: 28, color: "#18181b", lineHeight: 30 },
  headerNome: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#18181b" },
  scroll: { padding: 14, gap: 14 },
  secao: { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4 },
  secaoTitulo: { fontSize: 11, fontWeight: "800", color: "#71717a", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  itemQty: { fontSize: 13, fontWeight: "700", color: "#f97316", width: 28 },
  itemNome: { flex: 1, fontSize: 13, color: "#3f3f46" },
  itemPreco: { fontSize: 13, fontWeight: "700", color: "#18181b" },
  divider: { height: 1, backgroundColor: "#f4f4f5", marginVertical: 8 },
  totalRow: { marginTop: 4 },
  totalLabel: { flex: 1, fontSize: 15, fontWeight: "800", color: "#18181b" },
  totalValor: { fontSize: 15, fontWeight: "800", color: "#f97316" },
  tipoRow: { flexDirection: "row", gap: 10 },
  tipoBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#e4e4e7", alignItems: "center" },
  tipoBtnAtivo: { borderColor: "#f97316", backgroundColor: "#fff7ed" },
  tipoTexto: { fontSize: 14, fontWeight: "600", color: "#71717a" },
  tipoTextoAtivo: { color: "#f97316" },
  input: { height: 50, borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: "#18181b", marginBottom: 10, backgroundColor: "#fafafa" },
  cupomAplicado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#dcfce7", padding: 12, borderRadius: 10 },
  cupomAplicadoTexto: { fontSize: 13, fontWeight: "700", color: "#16a34a", flex: 1 },
  cupomRemover: { fontSize: 12, color: "#dc2626", fontWeight: "600" },
  cupomBtn: { backgroundColor: "#f97316", borderRadius: 10, paddingHorizontal: 16, height: 50, justifyContent: "center" },
  cupomBtnTexto: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cupomErro: { fontSize: 12, color: "#dc2626", marginTop: 6 },
  pgOpcao: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#e4e4e7", marginBottom: 8 },
  pgOpcaoAtiva: { borderColor: "#f97316", backgroundColor: "#fff7ed" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#d4d4d8" },
  radioAtivo: { borderColor: "#f97316", backgroundColor: "#f97316" },
  pgTexto: { fontSize: 15, color: "#3f3f46", fontWeight: "500" },
  pgTextoAtivo: { color: "#f97316", fontWeight: "700" },
  botao: { backgroundColor: "#f97316", borderRadius: 14, height: 56, justifyContent: "center", alignItems: "center" },
  botaoTexto: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
