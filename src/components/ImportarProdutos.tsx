import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";

// Campos destino disponíveis para mapeamento
const CAMPOS_DESTINO = [
  { value: "nome",              label: "Nome do produto",           required: true  },
  { value: "preco",             label: "Preço",                     required: true  },
  { value: "categoria",         label: "Categoria",                 required: false },
  { value: "descricao",         label: "Descrição",                 required: false },
  { value: "preco_promocional", label: "Preço promocional",         required: false },
  { value: "estoque",           label: "Estoque inicial",           required: false },
  { value: "grupo_de",          label: "Opção para produto(s)",     required: false },
  { value: "grupo_nome",        label: "Nome do grupo de opções",   required: false },
  { value: "ignorar",           label: "— Ignorar coluna —",        required: false },
] as const;

type CampoDestino = typeof CAMPOS_DESTINO[number]["value"];

// Parser CSV inline — sem dependências externas
// Suporta vírgula e ponto-e-vírgula como delimitador, campos com aspas e CRLF
function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === sep && !inQ) {
      result.push(cur.trim()); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  // Detecta delimitador: ponto-e-vírgula (padrão Excel BR) ou vírgula
  const sep = (lines[0].split(";").length > lines[0].split(",").length) ? ";" : ",";
  const headers = parseCsvLine(lines[0], sep);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i], sep);
    if (vals.every((v) => !v)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// Tenta mapear automaticamente pelo nome da coluna
function autoMapear(col: string): CampoDestino {
  const c = col.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (/^(nome|produto|item|name|titulo|title)/.test(c))         return "nome";
  if (/^(preco|valor|price|custo|venda|preco_normal|precovenda)/.test(c)) return "preco";
  if (/^(preco_promo|promocional|promo|oferta|desconto)/.test(c)) return "preco_promocional";
  if (/^(categoria|category|tipo|tipo_produto|grupo|secao|seção)/.test(c)) return "categoria";
  if (/^(descricao|descri|description|desc|detalhe|observacao)/.test(c)) return "descricao";
  if (/^(estoque|stock|qtd|quantidade)/.test(c))                return "estoque";
  if (/^(grupo_de|grupode|produtopai|produto_pai|para_produto|opcaopara|opcao_para)/.test(c)) return "grupo_de";
  if (/^(grupo_nome|gruponome|grupoopcoes|grupo_opcoes|nomegrupo|nome_grupo)/.test(c)) return "grupo_nome";
  return "ignorar";
}

function parsePreco(v: string | number | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).replace(/[^0-9,\.]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

type Step = "upload" | "mapear" | "preview" | "importando" | "concluido";

interface Props {
  open: boolean;
  onClose: () => void;
  empresaId: string;
  categoriasExistentes: { id: string; nome: string }[];
  onImportado: () => void;
}

export function ImportarProdutos({ open, onClose, empresaId, categoriasExistentes, onImportado }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [colunas, setColunas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<Record<string, string>[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, CampoDestino>>({});
  const [resultado, setResultado] = useState({ criados: 0, categoriasCriadas: 0, opcoesCriadas: 0, erros: 0 });

  function resetar() {
    setStep("upload");
    setNomeArquivo("");
    setColunas([]);
    setLinhas([]);
    setMapeamento({});
    setResultado({ criados: 0, categoriasCriadas: 0, opcoesCriadas: 0, erros: 0 });
    if (fileRef.current) fileRef.current.value = "";
  }

  function fechar() { resetar(); onClose(); }

  function processarDados(rows: Record<string, string>[]) {
    const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
    const mapa: Record<string, CampoDestino> = {};
    cols.forEach((c) => { mapa[c] = autoMapear(c); });
    setColunas(cols);
    setLinhas(rows);
    setMapeamento(mapa);
    setStep("mapear");
  }

  async function handleFile(file: File) {
    setNomeArquivo(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast.error("Arquivo vazio ou sem dados válidos."); return; }
      processarDados(rows);
    } else if (ext === "xlsx" || ext === "xls") {
      toast.error("Exporte como CSV no Excel: Arquivo → Salvar como → CSV UTF-8");
    } else {
      toast.error("Use arquivo .csv — Excel: Arquivo → Salvar como → CSV");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file).catch((err) => toast.error("Erro: " + (err?.message ?? "falha ao processar arquivo")));
  }

  // Campos obrigatórios mapeados?
  const nomeMapeado  = Object.values(mapeamento).includes("nome");
  const precoMapeado = Object.values(mapeamento).includes("preco");
  const podeProsseguir = nomeMapeado && precoMapeado;

  // Produto preview a partir de uma linha
  function linhaParaProduto(linha: Record<string, string>) {
    const get = (campo: CampoDestino) => {
      const col = Object.entries(mapeamento).find(([, v]) => v === campo)?.[0];
      return col ? linha[col] : undefined;
    };
    return {
      nome:              get("nome") ?? "",
      preco:             parsePreco(get("preco")),
      preco_promocional: parsePreco(get("preco_promocional")),
      categoria:         get("categoria") ?? "",
      descricao:         get("descricao") ?? "",
      estoque:           get("estoque") ? parseInt(get("estoque")!) || 0 : null,
      grupo_de:          get("grupo_de")?.trim() ?? "",
      grupo_nome:        get("grupo_nome")?.trim() ?? "",
    };
  }

  const todasMapeadas = linhas.map(linhaParaProduto);
  const produtosPreview = todasMapeadas.slice(0, 5);
  const totalProdutos = todasMapeadas.filter((p) => !p.grupo_de && p.nome && p.preco !== null).length;
  const totalOpcoes   = todasMapeadas.filter((p) => !!p.grupo_de && p.nome && p.preco !== null).length;
  const totalValido   = totalProdutos + totalOpcoes;
  const totalInvalido = linhas.length - totalValido;

  async function importar() {
    setStep("importando");
    let criados = 0, categoriasCriadas = 0, opcoesCriadas = 0, erros = 0;

    const todas = linhas.map(linhaParaProduto);

    // Separa: produtos normais vs linhas de opção (têm grupo_de preenchido)
    const linhasProduto = todas.filter((p) => !p.grupo_de && p.nome && p.preco !== null);
    const linhasOpcao   = todas.filter((p) => !!p.grupo_de && p.nome && p.preco !== null);

    // Mapeia categorias existentes
    const catMap: Record<string, string> = {};
    categoriasExistentes.forEach((c) => { catMap[c.nome.toLowerCase()] = c.id; });

    // Cria categorias novas necessárias (apenas para produtos, não para opções)
    const categoriasNecessarias = new Set<string>();
    linhasProduto.forEach((p) => { if (p.categoria) categoriasNecessarias.add(p.categoria.trim()); });

    let ordemCat = categoriasExistentes.length;
    for (const nomeCat of categoriasNecessarias) {
      if (catMap[nomeCat.toLowerCase()]) continue;
      const { data, error } = await supabase.from("categorias").insert({
        empresa_id: empresaId,
        nome: nomeCat,
        ativo: true,
        ordem: ordemCat++,
      }).select("id").single();
      if (!error && data) {
        catMap[nomeCat.toLowerCase()] = data.id;
        categoriasCriadas++;
      }
    }

    // Cria produtos em lotes de 20 e constrói mapa nome → id para os grupos
    const produtoNomeParaId: Record<string, string> = {};
    const LOTE = 20;
    for (let i = 0; i < linhasProduto.length; i += LOTE) {
      const lote = linhasProduto.slice(i, i + LOTE).map((p) => ({
        empresa_id:        empresaId,
        nome:              p.nome.trim(),
        descricao:         p.descricao?.trim() || "",
        preco:             p.preco!,
        preco_promocional: p.preco_promocional ?? null,
        categoria_id:      p.categoria ? (catMap[p.categoria.toLowerCase()] ?? null) : null,
        controlar_estoque: p.estoque !== null && p.estoque !== undefined,
        estoque:           p.estoque ?? 0,
      }));

      const { data: criados_data, error } = await (supabase.from("produtos") as any).insert(lote).select("id,nome");
      if (error) {
        console.error("Erro ao importar lote:", error.message);
        erros += lote.length;
      } else {
        criados += lote.length;
        (criados_data ?? []).forEach((p: any) => { produtoNomeParaId[p.nome.toLowerCase()] = p.id; });
      }
    }

    // Inclui produtos já existentes no banco para permitir linkar opcoes a eles
    if (linhasOpcao.length > 0) {
      const { data: existentes } = await (supabase.from("produtos") as any)
        .select("id, nome")
        .eq("empresa_id", empresaId);
      (existentes ?? []).forEach((p: any) => {
        const k = p.nome.toLowerCase();
        if (!produtoNomeParaId[k]) produtoNomeParaId[k] = p.id;
      });
    }

    // Cria grupos de opções e suas opções
    if (linhasOpcao.length > 0) {
      const grupoCache: Record<string, string> = {}; // "produtoId:grupoNome" → grupoId

      for (const opcao of linhasOpcao) {
        const produtosAlvo = opcao.grupo_de
          .split(/[;,]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        const grupoNome = opcao.grupo_nome.trim() || "Adicionais";

        for (const nomeProduto of produtosAlvo) {
          const produtoId = produtoNomeParaId[nomeProduto];
          if (!produtoId) { erros++; continue; }

          const cacheKey = `${produtoId}:${grupoNome}`;
          let grupoId = grupoCache[cacheKey];

          if (!grupoId) {
            const { data: g, error: ge } = await (supabase.from("grupos_opcoes") as any)
              .insert({
                produto_id:  produtoId,
                nome:        grupoNome,
                obrigatorio: false,
                multiplo:    true,
                max_escolhas: 10,
                ordem:       0,
              })
              .select("id")
              .single();
            if (ge || !g) { erros++; continue; }
            grupoId = g.id;
            grupoCache[cacheKey] = grupoId;
          }

          const { error: oe } = await (supabase.from("opcoes") as any).insert({
            grupo_id:        grupoId,
            nome:            opcao.nome.trim(),
            preco_adicional: opcao.preco ?? 0,
            ativo:           true,
            ordem:           0,
          });
          if (oe) erros++;
          else opcoesCriadas++;
        }
      }
    }

    setResultado({ criados, categoriasCriadas, opcoesCriadas, erros });
    setStep("concluido");
    if (criados > 0 || opcoesCriadas > 0) onImportado();
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-brand" />
            Importar produtos
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: Upload ── */}
        {step === "upload" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-500">
              Importe seus produtos de uma planilha existente (.csv, .xlsx). O sistema detecta as colunas automaticamente.
            </p>

            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-zinc-200 hover:border-brand/40 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors group">
              <div className="size-14 rounded-2xl bg-brand/10 group-hover:bg-brand/15 flex items-center justify-center transition-colors">
                <Upload className="size-7 text-brand" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-zinc-800">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-xs text-zinc-400 mt-1">Arquivo .csv — sem limite de linhas</p>
              </div>
            </div>

            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f).catch((err) => toast.error("Erro: " + (err?.message ?? "falha ao processar arquivo"))); }} />

            <div className="bg-zinc-50 rounded-xl p-4 text-xs text-zinc-500 space-y-2">
              <p className="font-semibold text-zinc-700">Colunas reconhecidas automaticamente:</p>
              <div className="grid grid-cols-2 gap-1">
                <span>• nome, produto, item</span>
                <span>• preco, valor, price</span>
                <span>• categoria, tipo, grupo</span>
                <span>• descricao, desc</span>
                <span>• preco_promo, promocional</span>
                <span>• estoque, stock, qtd</span>
                <span>• grupo_de (para adicionais)</span>
                <span>• grupo_nome</span>
              </div>
              <div className="border-t border-zinc-200 pt-2 bg-amber-50 rounded-lg px-3 py-2 text-amber-700">
                <p className="font-semibold mb-1">Para importar adicionais (opções de produto):</p>
                <p>Use a coluna <strong>grupo_de</strong> com o nome do produto ao qual o adicional pertence. Separe vários produtos com ponto-e-vírgula. Use <strong>grupo_nome</strong> para nomear o grupo (ex: Adicionais).</p>
              </div>
              <div className="border-t border-zinc-200 pt-2 text-zinc-400">
                <p className="font-semibold text-zinc-600 mb-1">Tem planilha Excel (.xlsx)?</p>
                <p>Abra no Excel → <strong>Arquivo → Salvar como → CSV UTF-8</strong> e importe o arquivo gerado.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Mapeamento ── */}
        {step === "mapear" && (
          <div className="flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                Arquivo: <span className="font-medium text-zinc-800">{nomeArquivo}</span> — {linhas.length} linhas detectadas
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-700">Configure o que cada coluna representa:</p>
              {colunas.map((col) => (
                <div key={col} className="flex items-center gap-3 bg-zinc-50 rounded-xl px-4 py-2.5">
                  <span className="text-sm font-mono text-zinc-600 flex-1 truncate">{col}</span>
                  <ArrowRight className="size-4 text-zinc-300 shrink-0" />
                  <Select value={mapeamento[col]} onValueChange={(v) => setMapeamento((m) => ({ ...m, [col]: v as CampoDestino }))}>
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAMPOS_DESTINO.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}{c.required ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!podeProsseguir && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3">
                <AlertCircle className="size-4 shrink-0" />
                Mapeie pelo menos <strong>Nome</strong> e <strong>Preço</strong> para continuar.
              </div>
            )}

            <div className="flex gap-2 pt-2 shrink-0">
              <Button variant="outline" onClick={resetar} className="gap-2"><X className="size-4" /> Trocar arquivo</Button>
              <Button disabled={!podeProsseguir} onClick={() => setStep("preview")} className="flex-1 bg-brand hover:bg-brand/90 gap-2">
                Ver prévia <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Preview ── */}
        {step === "preview" && (
          <div className="flex flex-col gap-4 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {totalProdutos > 0 && (
                  <div className="flex-1 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                    ✅ {totalProdutos} produto{totalProdutos !== 1 ? "s" : ""}
                  </div>
                )}
                {totalOpcoes > 0 && (
                  <div className="flex-1 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm text-violet-700 font-medium">
                    ✦ {totalOpcoes} adicionai{totalOpcoes !== 1 ? "s" : "s"} (opções)
                  </div>
                )}
              </div>
              {totalInvalido > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
                  ⚠️ {totalInvalido} linha{totalInvalido !== 1 ? "s" : ""} sem nome/preço (serão ignoradas)
                </div>
              )}
            </div>

            <p className="text-xs text-zinc-400">Mostrando os primeiros {Math.min(5, produtosPreview.length)} produtos:</p>

            <div className="space-y-2 overflow-y-auto">
              {produtosPreview.map((p, i) => (
                <div key={i} className="bg-zinc-50 rounded-xl px-4 py-3 text-sm flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 truncate">{p.nome || <span className="text-red-400">sem nome</span>}</p>
                    {p.descricao && <p className="text-zinc-400 text-xs truncate mt-0.5">{p.descricao}</p>}
                    {p.categoria && <span className="inline-block mt-1 text-[10px] bg-brand/10 text-brand font-bold px-2 py-0.5 rounded-full">{p.categoria}</span>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-zinc-900">{p.preco !== null ? fmt(p.preco) : <span className="text-red-400">sem preço</span>}</p>
                    {p.preco_promocional !== null && (
                      <p className="text-xs text-green-600">{fmt(p.preco_promocional)} promo</p>
                    )}
                  </div>
                </div>
              ))}
              {linhas.length > 5 && (
                <p className="text-center text-xs text-zinc-400 py-2">… e mais {linhas.length - 5} produtos</p>
              )}
            </div>

            <div className="flex gap-2 pt-2 shrink-0">
              <Button variant="outline" onClick={() => setStep("mapear")}>← Voltar</Button>
              <Button onClick={importar} className="flex-1 bg-brand hover:bg-brand/90 gap-2 font-bold">
                Importar {totalProdutos > 0 && totalOpcoes > 0
                  ? `${totalProdutos} produto${totalProdutos !== 1 ? "s" : ""} + ${totalOpcoes} adicional${totalOpcoes !== 1 ? "is" : ""}`
                  : totalOpcoes > 0
                  ? `${totalOpcoes} adicional${totalOpcoes !== 1 ? "is" : ""}`
                  : `${totalProdutos} produto${totalProdutos !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Importando ── */}
        {step === "importando" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="size-16 rounded-2xl bg-brand/10 flex items-center justify-center">
              <span className="text-3xl animate-spin">⏳</span>
            </div>
            <p className="font-semibold text-zinc-800">Importando produtos…</p>
            <p className="text-sm text-zinc-400">Criando categorias e cadastrando itens</p>
          </div>
        )}

        {/* ── STEP 5: Concluído ── */}
        {step === "concluido" && (
          <div className="flex flex-col items-center justify-center py-8 gap-5">
            <div className="size-16 rounded-2xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-green-500" />
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-zinc-900 mb-1">Importação concluída!</p>
              <div className="space-y-1 text-sm text-zinc-500">
                <p>✅ <strong>{resultado.criados}</strong> produto{resultado.criados !== 1 ? "s" : ""} criado{resultado.criados !== 1 ? "s" : ""}</p>
                {resultado.opcoesCriadas > 0 && (
                  <p>✦ <strong>{resultado.opcoesCriadas}</strong> opção{resultado.opcoesCriadas !== 1 ? "ões" : ""} de adicional criada{resultado.opcoesCriadas !== 1 ? "s" : ""}</p>
                )}
                {resultado.categoriasCriadas > 0 && (
                  <p>🗂️ <strong>{resultado.categoriasCriadas}</strong> categoria{resultado.categoriasCriadas !== 1 ? "s" : ""} criada{resultado.categoriasCriadas !== 1 ? "s" : ""} automaticamente</p>
                )}
                {resultado.erros > 0 && (
                  <p>⚠️ <strong>{resultado.erros}</strong> item{resultado.erros !== 1 ? "s" : ""} com erro (verifique o cardápio)</p>
                )}
              </div>
            </div>
            <Button onClick={fechar} className="bg-brand hover:bg-brand/90 px-8">
              Ver produtos importados
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
