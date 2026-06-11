import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Eye, EyeOff, ImagePlus, Settings2, ChevronDown, ChevronUp, Pencil, Package, PackageX, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { UpgradeGuard, LimiteBanner } from "@/components/UpgradeGuard";
import { PLANO_LIMITS, limiteAtingido, parsarErroSupabase } from "@/lib/plano";
import { ImportarProdutos } from "@/components/ImportarProdutos";

export const Route = createFileRoute("/_authenticated/empresa/produtos")({
  component: ProdutosPage,
});

function ProdutosPage() {
  const { empresaId, plano } = useAuth();
  const limites = PLANO_LIMITS[plano];
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [opcoesAberto, setOpcoesAberto] = useState<string | null>(null);
  const [controlarEstoque, setControlarEstoque] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edição
  const [editProduto, setEditProduto] = useState<any | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [editControlarEstoque, setEditControlarEstoque] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  const { data: produtos } = useQuery({
    queryKey: ["produtos", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("produtos").select("*, categorias(nome)").eq("empresa_id", empresaId!).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: categorias } = useQuery({
    queryKey: ["categorias", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await supabase.from("categorias").select("id,nome").eq("empresa_id", empresaId!).order("ordem")).data ?? [],
  });

  async function uploadFoto(file: File, path: string): Promise<string | null> {
    if (!file.type.startsWith("image/")) { toast.error("Envie apenas imagens (JPG, PNG, WebP)."); return null; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 5 MB."); return null; }
    const { error } = await supabase.storage.from("produtos").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload da imagem."); return null; }
    return supabase.storage.from("produtos").getPublicUrl(path).data.publicUrl;
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    const fd = new FormData(e.currentTarget);
    const file = fileRef.current?.files?.[0];
    const { data: produto, error } = await supabase.from("produtos").insert({
      empresa_id: empresaId!,
      nome: String(fd.get("nome")),
      descricao: String(fd.get("descricao") || ""),
      preco: Number(fd.get("preco") || 0),
      preco_promocional: fd.get("preco_promocional") ? Number(fd.get("preco_promocional")) : null,
      categoria_id: fd.get("categoria_id") ? String(fd.get("categoria_id")) : null,
      controlar_estoque: fd.get("controlar_estoque") === "on",
      estoque: Number(fd.get("estoque") || 0),
    } as any).select("id").single();
    if (error || !produto) { toast.error(parsarErroSupabase(error)); setUploading(false); return; }
    if (file) {
      const ext = file.name.split(".").pop();
      const url = await uploadFoto(file, `${empresaId}/${produto.id}.${ext}`);
      if (url) await supabase.from("produtos").update({ foto_url: url }).eq("id", produto.id);
    }
    toast.success("Produto criado");
    setOpen(false); setPreview(null); setUploading(false); setControlarEstoque(false);
    qc.invalidateQueries({ queryKey: ["produtos", empresaId] });
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editProduto) return;
    setUploading(true);
    const fd = new FormData(e.currentTarget);
    const file = editFileRef.current?.files?.[0];
    let foto_url = editProduto.foto_url;
    if (file) {
      const ext = file.name.split(".").pop();
      const url = await uploadFoto(file, `${empresaId}/${editProduto.id}.${ext}`);
      if (url) foto_url = url;
    }
    const { error } = await supabase.from("produtos").update({
      nome: String(fd.get("nome")),
      descricao: String(fd.get("descricao") || ""),
      preco: Number(fd.get("preco") || 0),
      preco_promocional: fd.get("preco_promocional") ? Number(fd.get("preco_promocional")) : null,
      categoria_id: fd.get("categoria_id") ? String(fd.get("categoria_id")) : null,
      foto_url,
      controlar_estoque: fd.get("controlar_estoque") === "on",
      estoque: Number(fd.get("estoque") || 0),
    } as any).eq("id", editProduto.id);
    setUploading(false);
    if (error) { toast.error(parsarErroSupabase(error)); return; }
    toast.success("Produto atualizado");
    setEditProduto(null); setEditPreview(null);
    qc.invalidateQueries({ queryKey: ["produtos", empresaId] });
  }

  async function remove(id: string) {
    await supabase.from("produtos").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["produtos", empresaId] });
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("produtos").update({ ativo: !ativo }).eq("id", id);
    toast.success(!ativo ? "Produto ativado" : "Produto ocultado do cardápio");
    qc.invalidateQueries({ queryKey: ["produtos", empresaId] });
  }

  async function adjustEstoque(id: string, delta: number, atual: number) {
    const novo = Math.max(0, atual + delta);
    await supabase.from("produtos").update({ estoque: novo }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["produtos", empresaId] });
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalProdutos = (produtos ?? []).length;
  const noLimit = limites.produtos === null;
  const atingiuLimite = !noLimit && limiteAtingido(totalProdutos, limites.produtos!);

  return (
    <>
      <ImportarProdutos
        open={importarOpen}
        onClose={() => setImportarOpen(false)}
        empresaId={empresaId!}
        categoriasExistentes={categorias ?? []}
        onImportado={() => {
          qc.invalidateQueries({ queryKey: ["produtos", empresaId] });
          qc.invalidateQueries({ queryKey: ["categorias", empresaId] });
        }}
      />

      <PageHeader title="Produtos" subtitle="Itens do seu cardápio"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportarOpen(true)} className="gap-2">
              <FileSpreadsheet className="size-4" /> Importar planilha
            </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPreview(null); setControlarEstoque(false); } }}>
            <DialogTrigger asChild>
              <Button disabled={atingiuLimite} className="bg-brand hover:bg-brand/90 gap-2" title={atingiuLimite ? `Limite de ${limites.produtos} produtos atingido` : undefined}>
                <Plus className="size-4" /> Novo produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
              <DialogHeader className="shrink-0"><DialogTitle>Novo produto</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-4 overflow-y-auto pr-1">
                <div className="space-y-2">
                  <Label>Foto</Label>
                  <div className="border-2 border-dashed border-zinc-200 rounded-xl h-44 flex flex-col items-center justify-center cursor-pointer hover:border-brand/50 transition-colors overflow-hidden relative bg-zinc-50"
                    onClick={() => fileRef.current?.click()}>
                    {preview ? (
                      <>
                        <img src={preview} alt="preview" className="w-full h-full object-contain" />
                        <div className="absolute bottom-2 right-2 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Trocar</div>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="size-6 text-zinc-300 mb-1" />
                        <span className="text-xs text-zinc-400">Clique para adicionar foto</span>
                        <span className="text-[10px] text-zinc-300 mt-0.5">Qualquer tamanho — exibida inteira</span>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
                </div>
                <Field name="nome" label="Nome" required />
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea id="descricao" name="descricao" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field name="preco" label="Preço base (R$)" type="number" step="0.01" required />
                  <Field name="preco_promocional" label="Preço promo (R$)" type="number" step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select name="categoria_id">
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(categorias ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 border border-zinc-100 rounded-xl p-3 bg-zinc-50/60">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="controlar_estoque"
                      checked={controlarEstoque} onChange={(e) => setControlarEstoque(e.target.checked)}
                      className="rounded border-zinc-300" />
                    <span className="text-sm font-medium text-zinc-700">Controlar estoque</span>
                  </label>
                  {controlarEstoque && (
                    <div className="flex items-center gap-2">
                      <Package className="size-4 text-zinc-400 shrink-0" />
                      <Input name="estoque" type="number" min="0" placeholder="Qtd. em estoque" className="h-8 text-sm" defaultValue="0" />
                    </div>
                  )}
                </div>
                <Button type="submit" disabled={uploading} className="w-full bg-brand hover:bg-brand/90">
                  {uploading ? "Salvando..." : "Criar produto"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {!noLimit && (
        <LimiteBanner atual={totalProdutos} limite={limites.produtos!} tipo="produtos" minPlano="profissional" />
      )}

      {/* Modal de edição */}
      <Dialog open={!!editProduto} onOpenChange={(v) => { if (!v) { setEditProduto(null); setEditPreview(null); setEditControlarEstoque(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0"><DialogTitle>Editar produto</DialogTitle></DialogHeader>
          {editProduto && (
            <form onSubmit={save} className="space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label>Foto</Label>
                <div className="border-2 border-dashed border-zinc-200 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-brand/50 transition-colors overflow-hidden relative bg-zinc-50"
                  onClick={() => editFileRef.current?.click()}>
                  {editPreview ? (
                    <>
                      <img src={editPreview} alt="preview" className="w-full h-full object-contain" />
                      <div className="absolute bottom-2 right-2 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Trocar</div>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="size-5 text-zinc-300 mb-1" />
                      <span className="text-xs text-zinc-400">Clique para trocar a foto</span>
                    </>
                  )}
                </div>
                <input ref={editFileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; setEditPreview(f ? URL.createObjectURL(f) : editProduto.foto_url); }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome</Label>
                <Input id="edit-nome" name="nome" defaultValue={editProduto.nome} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-descricao">Descrição</Label>
                <Textarea id="edit-descricao" name="descricao" rows={2} defaultValue={editProduto.descricao ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-preco">Preço base (R$)</Label>
                  <Input id="edit-preco" name="preco" type="number" step="0.01" defaultValue={editProduto.preco} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-preco-promo">Preço promo (R$)</Label>
                  <Input id="edit-preco-promo" name="preco_promocional" type="number" step="0.01" defaultValue={editProduto.preco_promocional ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select name="categoria_id" defaultValue={editProduto.categoria_id ?? ""}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(categorias ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 border border-zinc-100 rounded-xl p-3 bg-zinc-50/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="controlar_estoque"
                    checked={editControlarEstoque}
                    onChange={(e) => setEditControlarEstoque(e.target.checked)}
                    className="rounded border-zinc-300" />
                  <span className="text-sm font-medium text-zinc-700">Controlar estoque</span>
                </label>
                {editControlarEstoque && (
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-zinc-400 shrink-0" />
                    <Input name="estoque" type="number" min="0" placeholder="Qtd. em estoque" className="h-8 text-sm"
                      defaultValue={editProduto.estoque ?? 0} />
                  </div>
                )}
              </div>
              <Button type="submit" disabled={uploading} className="w-full bg-brand hover:bg-brand/90">
                {uploading ? "Salvando..." : "Salvar alterações"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(produtos ?? []).map((p: any) => (
          <div key={p.id} className={`bg-background rounded-xl ring-1 ring-black/5 overflow-hidden transition-opacity ${!p.ativo ? "opacity-60" : ""}`}>
            {p.foto_url ? (
              <div className="w-full h-40 bg-zinc-50 flex items-center justify-center overflow-hidden">
                <img src={p.foto_url} alt={p.nome} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-full h-40 bg-surface flex items-center justify-center">
                <ImagePlus className="size-8 text-zinc-200" />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-brand font-semibold uppercase tracking-widest truncate">{p.categorias?.nome ?? "Sem categoria"}</div>
                  <h3 className="font-semibold text-ink mt-0.5 truncate">{p.nome}</h3>
                </div>
                <div className="flex shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setEditProduto(p); setEditPreview(p.foto_url ?? null); setEditControlarEstoque(p.controlar_estoque ?? false); }} className="text-zinc-400 hover:text-brand size-8" title="Editar">
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => toggleAtivo(p.id, p.ativo)} className="text-zinc-400 hover:text-ink size-8" title={p.ativo ? "Ocultar" : "Ativar"}>
                    {p.ativo ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)} className="text-zinc-400 hover:text-red-600 size-8">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              {p.descricao && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{p.descricao}</p>}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-base font-semibold text-ink">{fmt(Number(p.preco_promocional ?? p.preco))}</span>
                {p.preco_promocional && <span className="text-xs text-zinc-400 line-through">{fmt(Number(p.preco))}</span>}
                {!p.ativo && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 ml-auto">Oculto</span>}
              </div>

              {p.controlar_estoque && (
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    p.estoque === 0
                      ? "bg-red-100 text-red-600"
                      : p.estoque <= 5
                      ? "bg-amber-100 text-amber-600"
                      : "bg-green-100 text-green-700"
                  }`}>
                    {p.estoque === 0 ? (
                      <span className="flex items-center gap-1"><PackageX className="size-3" /> Esgotado</span>
                    ) : p.estoque <= 5 ? (
                      <span className="flex items-center gap-1"><AlertTriangle className="size-3" /> {p.estoque} restantes</span>
                    ) : (
                      <span className="flex items-center gap-1"><Package className="size-3" /> {p.estoque} em estoque</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => adjustEstoque(p.id, -1, p.estoque ?? 0)}
                      className="size-6 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 flex items-center justify-center text-base leading-none font-bold transition-colors">−</button>
                    <button onClick={() => adjustEstoque(p.id, +1, p.estoque ?? 0)}
                      className="size-6 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-100 flex items-center justify-center text-base leading-none font-bold transition-colors">+</button>
                  </div>
                </div>
              )}

              {/* Botão de opções */}
              <button
                onClick={() => setOpcoesAberto(opcoesAberto === p.id ? null : p.id)}
                className="mt-3 w-full flex items-center justify-between text-xs font-medium text-zinc-500 hover:text-brand transition-colors border-t pt-3"
              >
                <span className="flex items-center gap-1.5"><Settings2 className="size-3.5" /> Opções / Adicionais</span>
                {opcoesAberto === p.id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>

              {opcoesAberto === p.id && <GruposOpcoes produtoId={p.id} />}
            </div>
          </div>
        ))}
        {(produtos ?? []).length === 0 && (
          <div className="col-span-full text-center text-sm text-zinc-500 py-12 rounded-xl ring-1 ring-black/5 bg-background">
            Nenhum produto ainda. Cadastre o primeiro item do seu cardápio.
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Gerenciador de grupos de opções ─── */
function GruposOpcoes({ produtoId }: { produtoId: string }) {
  const qc = useQueryClient();
  const [novoGrupoNome,  setNovoGrupoNome]  = useState("");
  const [novoGrupoObrg,  setNovoGrupoObrg]  = useState(true);
  const [novoGrupoMax,   setNovoGrupoMax]   = useState(1);
  const [novoGrupoMulti, setNovoGrupoMulti] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos-opcoes", produtoId],
    queryFn: async () =>
      (await (supabase.from("grupos_opcoes") as any).select("*, opcoes(*)").eq("produto_id", produtoId).order("ordem")).data ?? [],
  });

  async function addGrupo() {
    if (!novoGrupoNome.trim()) return;
    const { error } = await (supabase.from("grupos_opcoes") as any).insert({
      produto_id: produtoId, nome: novoGrupoNome.trim(),
      obrigatorio: novoGrupoObrg, multiplo: novoGrupoMulti, max_escolhas: novoGrupoMax,
      ordem: grupos.length,
    });
    if (error) { toast.error(error.message); return; }
    setNovoGrupoNome(""); qc.invalidateQueries({ queryKey: ["grupos-opcoes", produtoId] });
    toast.success("Grupo criado");
  }

  async function removeGrupo(id: string) {
    await (supabase.from("grupos_opcoes") as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["grupos-opcoes", produtoId] });
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Lista de grupos */}
      {grupos.map((g: any) => (
        <div key={g.id} className="border border-zinc-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 cursor-pointer"
            onClick={() => setExpandido(expandido === g.id ? null : g.id)}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-700">{g.nome}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${g.obrigatorio ? "bg-brand/10 text-brand" : "bg-zinc-100 text-zinc-400"}`}>
                {g.obrigatorio ? "Obrigatório" : "Opcional"}
              </span>
              {g.multiplo && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-50 text-blue-500">
                  Até {g.max_escolhas}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-400">{g.opcoes?.length ?? 0} opções</span>
              <button onClick={(e) => { e.stopPropagation(); removeGrupo(g.id); }}
                className="ml-2 text-zinc-300 hover:text-red-500 transition-colors">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
          {expandido === g.id && (
            <div className="p-3 space-y-2">
              {(g.opcoes ?? []).map((o: any) => (
                <OpcaoRow key={o.id} opcao={o} produtoId={produtoId} grupoId={g.id} />
              ))}
              <NovaOpcaoForm grupoId={g.id} produtoId={produtoId} ordem={(g.opcoes?.length ?? 0)} />
            </div>
          )}
        </div>
      ))}

      {/* Novo grupo */}
      <div className="border border-dashed border-zinc-200 rounded-xl p-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Novo grupo</div>
        <Input placeholder='Ex: "Tamanho", "Borda", "Adicionais"'
          value={novoGrupoNome} onChange={(e) => setNovoGrupoNome(e.target.value)}
          className="h-8 text-xs rounded-lg" />
        <div className="flex gap-2 flex-wrap text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={novoGrupoObrg} onChange={(e) => setNovoGrupoObrg(e.target.checked)} className="rounded" />
            Obrigatório
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={novoGrupoMulti} onChange={(e) => { setNovoGrupoMulti(e.target.checked); if (!e.target.checked) setNovoGrupoMax(1); }} className="rounded" />
            Múltipla escolha
          </label>
          {novoGrupoMulti && (
            <label className="flex items-center gap-1.5">
              Máx:
              <input type="number" min={1} max={10} value={novoGrupoMax}
                onChange={(e) => setNovoGrupoMax(Number(e.target.value))}
                className="w-12 h-6 text-xs border rounded px-1" />
            </label>
          )}
        </div>
        <Button size="sm" onClick={addGrupo} disabled={!novoGrupoNome.trim()}
          className="w-full bg-brand hover:bg-brand/90 h-7 text-xs gap-1">
          <Plus className="size-3" /> Adicionar grupo
        </Button>
      </div>
    </div>
  );
}

function OpcaoRow({ opcao, produtoId, grupoId }: { opcao: any; produtoId: string; grupoId: string }) {
  const qc = useQueryClient();
  async function remove() {
    await (supabase.from("opcoes") as any).delete().eq("id", opcao.id);
    qc.invalidateQueries({ queryKey: ["grupos-opcoes", produtoId] });
  }
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div className="flex items-center justify-between text-xs bg-zinc-50 rounded-lg px-3 py-1.5">
      <span className="font-medium text-zinc-700">{opcao.nome}</span>
      <div className="flex items-center gap-2">
        {Number(opcao.preco_adicional) > 0 && (
          <span className="text-green-600 font-semibold">+{fmt(Number(opcao.preco_adicional))}</span>
        )}
        <button onClick={remove} className="text-zinc-300 hover:text-red-500 transition-colors">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function NovaOpcaoForm({ grupoId, produtoId, ordem }: { grupoId: string; produtoId: string; ordem: number }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");

  async function add() {
    if (!nome.trim()) return;
    const { error } = await (supabase.from("opcoes") as any).insert({
      grupo_id: grupoId, nome: nome.trim(),
      preco_adicional: Number(preco) || 0,
    });
    if (error) { toast.error(error.message); return; }
    setNome(""); setPreco("");
    qc.invalidateQueries({ queryKey: ["grupos-opcoes", produtoId] });
  }

  return (
    <div className="flex gap-2">
      <Input placeholder='Ex: "Grande", "Com borda"' value={nome} onChange={(e) => setNome(e.target.value)}
        className="h-7 text-xs rounded-lg flex-1" onKeyDown={(e) => e.key === "Enter" && add()} />
      <Input placeholder="+R$" type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)}
        className="h-7 text-xs rounded-lg w-20" onKeyDown={(e) => e.key === "Enter" && add()} />
      <Button size="sm" onClick={add} disabled={!nome.trim()} className="h-7 bg-brand hover:bg-brand/90 px-2">
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

function Field(props: { name: string; label: string; type?: string; step?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input id={props.name} name={props.name} type={props.type ?? "text"} step={props.step} required={props.required} />
    </div>
  );
}
