import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const PAGAMENTOS = ["Dinheiro", "Cartão na entrega", "PIX na entrega"];

export default function CheckoutScreen({ route, navigation }: any) {
  const { empresa, carrinho } = route.params;

  const [nome, setNome]           = useState("");
  const [telefone, setTelefone]   = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero]       = useState("");
  const [bairro, setBairro]       = useState("");
  const [complemento, setComplemento] = useState("");
  const [pagamento, setPagamento] = useState("PIX na entrega");
  const [troco, setTroco]         = useState("");
  const [obs, setObs]             = useState("");
  const [loading, setLoading]     = useState(false);

  const subtotal = carrinho.reduce((s: number, i: any) => s + i.preco * i.qty, 0);
  const taxa = empresa.taxa_entrega ?? 0;
  const total = subtotal + taxa;

  async function finalizar() {
    if (!nome.trim()) { Alert.alert("Informe seu nome."); return; }
    if (!telefone.trim()) { Alert.alert("Informe seu telefone."); return; }
    if (!logradouro.trim() || !numero.trim() || !bairro.trim()) {
      Alert.alert("Preencha o endereço completo."); return;
    }
    setLoading(true);

    const obsCompleta = [
      obs,
      pagamento === "Dinheiro" && troco ? `Troco para R$ ${troco}` : null,
    ].filter(Boolean).join(" | ");

    const endereco = `${logradouro}, ${numero}${complemento ? `, ${complemento}` : ""} - ${bairro}`;

    const { data: pedido, error } = await supabase.rpc("finalizar_pedido", {
      p_empresa_id: empresa.id,
      p_cliente_nome: nome.trim(),
      p_cliente_telefone: telefone.trim(),
      p_endereco_entrega: endereco,
      p_tipo: "delivery",
      p_forma_pagamento: pagamento,
      p_observacao: obsCompleta || null,
      p_itens: carrinho.map((i: any) => ({
        produto_id: i.id,
        nome: i.nome,
        preco: i.preco,
        quantidade: i.qty,
        observacao: i.obs || null,
      })),
    });

    setLoading(false);
    if (error) { Alert.alert("Erro ao finalizar pedido", error.message); return; }
    navigation.replace("Rastreio", { pedidoId: pedido, empresaNome: empresa.nome_fantasia });
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.voltarBtn}>
          <Text style={s.voltarTexto}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerNome}>Finalizar pedido</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Resumo */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Resumo do pedido</Text>
          {carrinho.map((i: any, idx: number) => (
            <View key={idx} style={s.itemRow}>
              <Text style={s.itemQty}>{i.qty}x</Text>
              <Text style={s.itemNome} numberOfLines={1}>{i.nome}</Text>
              <Text style={s.itemPreco}>{fmt(i.preco * i.qty)}</Text>
            </View>
          ))}
          {taxa > 0 && (
            <View style={s.itemRow}>
              <Text style={s.itemQty}></Text>
              <Text style={[s.itemNome, { color: "#71717a" }]}>Taxa de entrega</Text>
              <Text style={s.itemPreco}>{fmt(taxa)}</Text>
            </View>
          )}
          <View style={[s.itemRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e4e4e7" }]}>
            <Text style={{ flex: 1, fontWeight: "800", fontSize: 15, color: "#18181b" }}>Total</Text>
            <Text style={{ fontWeight: "800", fontSize: 15, color: "#f97316" }}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Dados pessoais */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Seus dados</Text>
          <TextInput style={s.input} placeholder="Nome completo" placeholderTextColor="#a1a1aa" value={nome} onChangeText={setNome} />
          <TextInput style={s.input} placeholder="WhatsApp / Telefone" placeholderTextColor="#a1a1aa" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />
        </View>

        {/* Endereço */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Endereço de entrega</Text>
          <TextInput style={s.input} placeholder="Rua / Avenida" placeholderTextColor="#a1a1aa" value={logradouro} onChangeText={setLogradouro} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="Número" placeholderTextColor="#a1a1aa" value={numero} onChangeText={setNumero} keyboardType="numeric" />
            <TextInput style={[s.input, { flex: 2 }]} placeholder="Complemento" placeholderTextColor="#a1a1aa" value={complemento} onChangeText={setComplemento} />
          </View>
          <TextInput style={s.input} placeholder="Bairro" placeholderTextColor="#a1a1aa" value={bairro} onChangeText={setBairro} />
        </View>

        {/* Pagamento */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Forma de pagamento</Text>
          {PAGAMENTOS.map((p) => (
            <TouchableOpacity key={p} style={[s.pgOpcao, pagamento === p && s.pgOpcaoAtiva]} onPress={() => setPagamento(p)}>
              <View style={[s.radio, pagamento === p && s.radioAtivo]} />
              <Text style={[s.pgTexto, pagamento === p && s.pgTextoAtivo]}>{p}</Text>
            </TouchableOpacity>
          ))}
          {pagamento === "Dinheiro" && (
            <TextInput
              style={[s.input, { marginTop: 8 }]} placeholder="Troco para quanto? (ex: 50)"
              placeholderTextColor="#a1a1aa" value={troco} onChangeText={setTroco} keyboardType="numeric"
            />
          )}
        </View>

        {/* Observação */}
        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Observação (opcional)</Text>
          <TextInput
            style={[s.input, { height: 70 }]} placeholder="Ex: sem cebola, portão azul..."
            placeholderTextColor="#a1a1aa" value={obs} onChangeText={setObs} multiline
          />
        </View>

        <TouchableOpacity style={s.botao} onPress={finalizar} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.botaoTexto}>Fazer pedido · {fmt(total)}</Text>
          }
        </TouchableOpacity>
        <View style={{ height: 24 }} />
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
  secaoTitulo: { fontSize: 14, fontWeight: "800", color: "#18181b", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  itemQty: { fontSize: 13, fontWeight: "700", color: "#f97316", width: 24 },
  itemNome: { flex: 1, fontSize: 14, color: "#3f3f46" },
  itemPreco: { fontSize: 14, fontWeight: "700", color: "#18181b" },
  input: { height: 50, borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: "#18181b", marginBottom: 10, backgroundColor: "#fafafa" },
  pgOpcao: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#e4e4e7", marginBottom: 8 },
  pgOpcaoAtiva: { borderColor: "#f97316", backgroundColor: "#fff7ed" },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#d4d4d8" },
  radioAtivo: { borderColor: "#f97316", backgroundColor: "#f97316" },
  pgTexto: { fontSize: 15, color: "#3f3f46", fontWeight: "500" },
  pgTextoAtivo: { color: "#f97316", fontWeight: "700" },
  botao: { backgroundColor: "#f97316", borderRadius: 14, height: 56, justifyContent: "center", alignItems: "center" },
  botaoTexto: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
