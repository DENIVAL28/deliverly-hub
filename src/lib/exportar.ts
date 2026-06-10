// Utilitários de exportação CSV — sem dependências externas

interface Coluna {
  chave: string;
  label: string;
  formatar?: (valor: any, linha: Record<string, any>) => string;
}

function escapar(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const s = String(valor).replace(/"/g, '""');
  return `"${s}"`;
}

export function gerarCSV(dados: Record<string, any>[], colunas: Coluna[]): string {
  const header = colunas.map((c) => escapar(c.label)).join(",");
  const rows = dados.map((linha) =>
    colunas
      .map((c) => {
        const val = c.formatar ? c.formatar(linha[c.chave], linha) : linha[c.chave];
        return escapar(val);
      })
      .join(",")
  );
  return [header, ...rows].join("\r\n");
}

export function baixarCSV(conteudo: string, nomeArquivo: string) {
  // BOM UTF-8 para o Excel abrir corretamente com acentos
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Formatadores reutilizáveis ──────────────────────────────

export const fmtBRL  = (v: any) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtData = (v: any) => v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
export const fmtDataCurta = (v: any) => v ? new Date(v).toLocaleDateString("pt-BR") : "";

// ── Colunas predefinidas ────────────────────────────────────

export const COLUNAS_PEDIDOS: Coluna[] = [
  { chave: "numero",           label: "Nº Pedido" },
  { chave: "created_at",       label: "Data/Hora",       formatar: fmtData },
  { chave: "cliente_nome",     label: "Cliente" },
  { chave: "cliente_telefone", label: "Telefone" },
  { chave: "cliente_endereco", label: "Endereço" },
  { chave: "status",           label: "Status" },
  { chave: "tipo",             label: "Canal",            formatar: (v) => v === "pdv" ? "PDV/Balcão" : "Online" },
  { chave: "subtotal",         label: "Subtotal",         formatar: fmtBRL },
  { chave: "taxa_entrega",     label: "Taxa Entrega",     formatar: fmtBRL },
  { chave: "total",            label: "Total",            formatar: fmtBRL },
  { chave: "forma_pagamento",  label: "Pagamento" },
  { chave: "entregador_nome",  label: "Entregador" },
  { chave: "observacao",       label: "Observação" },
];

export const COLUNAS_CLIENTES: Coluna[] = [
  { chave: "nome",       label: "Nome" },
  { chave: "telefone",   label: "Telefone" },
  { chave: "endereco",   label: "Endereço" },
  { chave: "created_at", label: "Cadastrado em", formatar: fmtDataCurta },
];

export const COLUNAS_EMPRESAS_RELATORIO: Coluna[] = [
  { chave: "nome",    label: "Empresa" },
  { chave: "pedidos", label: "Pedidos" },
  { chave: "total",   label: "Faturamento", formatar: fmtBRL },
];
