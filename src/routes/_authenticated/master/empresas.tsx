import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Ban, CheckCircle2, ExternalLink, Users,
  Trash2, RefreshCw, Clock, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PLANO_LABEL, type Plano } from "@/lib/plano";

export const Route = createFileRoute("/_authenticated/master/empresas")({
  component: EmpresasPage,
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

type StatusDerived = "trial" | "ativa" | "vencida" | "bloqueada";
type EmpresaRef = { id: string; nome_fantasia: string };
type Filtro = "todas" | StatusDerived;

function derivarStatus(e: any): StatusDerived {
  if (e.status === "bloqueada") return "bloqueada";
  if (e.vencimento) {
    return new Date(e.vencimento) > new Date() ? "trial" : "vencida";
  }
  return "ativa";
}

function diasRestantes(vencimento: string): number {
  return Math.ceil((new Date(vencimento).getTime() - Date.now()) / 86400000);
}

const STATUS_META: Record<StatusDerived, { label: string; bg: string; text: string }> = {
  trial:    { label: "Em teste",  bg: "bg-blue-100",   text: "text-blue-700"   },
  ativa:    { label: "Ativa",     bg: "bg-green-100",  text: "text-green-700"  },
  vencida:  { label: "Vencida",   bg: "bg-amber-100",  text: "text-amber-700"  },
  bloqueada:{ label: "Bloqueada", bg: "bg-red-100",    text: "text-red-700"    },
};

function EmpresasPage() {
  const qc = useQueryClient();
  const [filtro, setFiltro]           = useState<Filtro>("todas");
  const [open, setOpen]               = useState(false);
  const [empresaUsuarios, setEmpresaUsuarios] = useState<EmpresaRef | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<EmpresaRef | null>(null);
  const [excluindo, setExcluindo]     = useState(false);
  const [renovarEmpresa, setRenovarEmpresa] = useState<EmpresaRef | null>(null);
  const [novosdi, setNovosdi]         = useState("30");

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*, planos(nome,valor)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: planos } = useQuery({
    queryKey: ["planos"],
    queryFn: async () => (await supabase.from("planos").select("id,nome").order("valor")).data ?? [],
  });

  const { data: empresaUsers } = useQuery({
    queryKey: ["empresa-usuarios", empresaUsuarios?.id],
    enabled: !!empresaUsuarios,
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("id, role, user_id")
        .eq("empresa_id", empresaUsuarios!.id)
        .neq("role", "master");
      if (error) throw error;
      if (!roles?.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", roles.map((r) => r.user_id));
      const pm = new Map((profs ?? []).map((p) => [p.id, p]));
      return roles.map((r) => ({ ...r, profile: pm.get(r.user_id) }));
    },
  });

  // ── Contadores por status ──────────────────────────────────
  const contas = (empresas ?? []).reduce<Record<StatusDerived, number>>(
    (acc, e: any) => { acc[derivarStatus(e)]++; return acc; },
    { trial: 0, ativa: 0, vencida: 0, bloqueada: 0 },
  );

  const listaFiltrada = (empresas ?? []).filter((e: any) =>
    filtro === "todas" || derivarStatus(e) === filtro,
  );

  // ── Ações ──────────────────────────────────────────────────
  async function createEmpresa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome_fantasia"));
    const { error } = await supabase.from("empresas").insert({
      nome_fantasia: nome,
      slug: slugify(nome),
      email: String(fd.get("email") || ""),
      whatsapp: String(fd.get("whatsapp") || ""),
      cidade: String(fd.get("cidade") || ""),
      cnpj: String(fd.get("cnpj") || "") || null,
      plano: String(fd.get("plano") || "profissional"),
      vencimento: String(fd.get("vencimento") || "") || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Empresa cadastrada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["empresas"] });
  }

  async function addUsuario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!empresaUsuarios) return;
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const role = String(fd.get("role")) as "empresa_owner" | "empresa_staff";
    const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) { toast.error("Usuário não encontrado. Verifique se ele já criou uma conta."); return; }
    const { error } = await supabase.from("user_roles").insert({ user_id: profile.id, role, empresa_id: empresaUsuarios.id });
    if (error) { toast.error(error.message); return; }
    await supabase.from("profiles").update({ empresa_id: empresaUsuarios.id }).eq("id", profile.id);
    toast.success("Usuário associado com sucesso");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["empresa-usuarios", empresaUsuarios.id] });
  }

  async function removeUsuario(roleId: string, userId: string) {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) { toast.error(error.message); return; }
    await supabase.from("profiles").update({ empresa_id: null }).eq("id", userId);
    toast.success("Usuário removido");
    qc.invalidateQueries({ queryKey: ["empresa-usuarios", empresaUsuarios?.id] });
  }

  async function mudarPlano(id: string, plano: Plano) {
    const { error } = await supabase.from("empresas").update({ plano }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Plano alterado para ${PLANO_LABEL[plano]}`);
    qc.invalidateQueries({ queryKey: ["empresas"] });
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === "bloqueada" ? "ativa" : "bloqueada";
    const { error } = await supabase.from("empresas").update({ status: next }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "ativa" ? "Empresa liberada" : "Empresa bloqueada");
    qc.invalidateQueries({ queryKey: ["empresas"] });
  }

  async function renovar() {
    if (!renovarEmpresa) return;
    const dias = parseInt(novosdi) || 30;
    const novaData = new Date();
    novaData.setDate(novaData.getDate() + dias);
    const { error } = await supabase
      .from("empresas")
      .update({ vencimento: novaData.toISOString().slice(0, 10), status: "ativa" })
      .eq("id", renovarEmpresa.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Acesso renovado por ${dias} dias`);
    setRenovarEmpresa(null);
    qc.invalidateQueries({ queryKey: ["empresas"] });
  }

  async function excluirEmpresa() {
    if (!confirmarExclusao) return;
    setExcluindo(true);
    try {
      const { error } = await (supabase.rpc as any)("excluir_empresa_completo", {
        p_empresa_id: confirmarExclusao.id,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Empresa excluída com sucesso");
      setConfirmarExclusao(null);
      qc.invalidateQueries({ queryKey: ["empresas"] });
    } finally {
      setExcluindo(false);
    }
  }

  const TABS: { key: Filtro; label: string }[] = [
    { key: "todas",    label: "Todas" },
    { key: "trial",    label: "Em teste" },
    { key: "ativa",    label: "Ativas" },
    { key: "vencida",  label: "Vencidas" },
    { key: "bloqueada",label: "Bloqueadas" },
  ];

  return (
    <>
      <PageHeader
        title="Empresas"
        subtitle="Gerencie todos os estabelecimentos da plataforma"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-brand hover:bg-brand/90 gap-2">
                <Plus className="size-4" /> Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar estabelecimento</DialogTitle></DialogHeader>
              <form onSubmit={createEmpresa} className="space-y-4">
                <Field name="nome_fantasia" label="Nome fantasia" required />
                <div className="grid grid-cols-2 gap-3">
                  <Field name="email" label="E-mail" type="email" />
                  <Field name="whatsapp" label="WhatsApp" />
                </div>
                <Field name="cidade" label="Cidade" />
                <Field name="cnpj" label="CNPJ (opcional)" />
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select name="plano" defaultValue="profissional">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basico">{PLANO_LABEL.basico}</SelectItem>
                      <SelectItem value="profissional">{PLANO_LABEL.profissional}</SelectItem>
                      <SelectItem value="premium">{PLANO_LABEL.premium}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field name="vencimento" label="Vencimento" type="date" />
                <Button type="submit" className="w-full bg-brand hover:bg-brand/90">Cadastrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* ── Abas de filtro ── */}
      <div className="flex gap-1 mb-4 bg-zinc-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => {
          const count = t.key === "todas"
            ? (empresas ?? []).length
            : contas[t.key as StatusDerived];
          return (
            <button
              key={t.key}
              onClick={() => setFiltro(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filtro === t.key
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  filtro === t.key ? "bg-brand/10 text-brand" : "bg-zinc-200 text-zinc-600"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Aviso vencidas ── */}
      {contas.vencida > 0 && filtro !== "ativas" && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-amber-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <strong>{contas.vencida} empresa{contas.vencida > 1 ? "s" : ""}</strong> com período de teste expirado.
            Renove o acesso ou exclua as contas inativas.
          </span>
        </div>
      )}

      {/* ── Tabela ── */}
      <div className="bg-background rounded-xl ring-1 ring-black/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[10px] uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="text-left px-4 py-3">Empresa</th>
              <th className="text-left px-4 py-3">Plano</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Vencimento</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((e: any) => {
              const status = derivarStatus(e);
              const meta = STATUS_META[status];
              return (
                <tr key={e.id} className="border-t border-black/5 hover:bg-zinc-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{e.nome_fantasia}</div>
                    <div className="text-xs text-zinc-500">{e.cidade || "—"} • /{e.slug}</div>
                    {e.cnpj && (
                      <div className="text-xs text-zinc-400 font-mono mt-0.5">{e.cnpj}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={e.plano ?? "profissional"}
                      onChange={(ev) => mudarPlano(e.id, ev.target.value as Plano)}
                      className="text-xs font-semibold rounded-lg border border-zinc-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 cursor-pointer"
                    >
                      <option value="basico">{PLANO_LABEL.basico}</option>
                      <option value="profissional">{PLANO_LABEL.profissional}</option>
                      <option value="premium">{PLANO_LABEL.premium}</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${meta.bg} ${meta.text}`}>
                      {status === "trial" && e.vencimento
                        ? `${diasRestantes(e.vencimento)}d restantes`
                        : meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {e.vencimento
                      ? new Date(e.vencimento).toLocaleDateString("pt-BR")
                      : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <a href={`/loja/${e.slug}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-brand px-2 py-1 rounded">
                        <ExternalLink className="size-3" /> Loja
                      </a>
                      <Button size="sm" variant="outline"
                        onClick={() => setEmpresaUsuarios({ id: e.id, nome_fantasia: e.nome_fantasia })}
                        className="gap-1 text-xs h-7">
                        <Users className="size-3" /> Usuários
                      </Button>

                      {/* Renovar — para trial e vencida */}
                      {(status === "trial" || status === "vencida") && (
                        <Button size="sm" variant="outline"
                          onClick={() => { setRenovarEmpresa({ id: e.id, nome_fantasia: e.nome_fantasia }); setNovosdi("30"); }}
                          className="gap-1 text-xs h-7 text-blue-600 border-blue-200 hover:bg-blue-50">
                          <RefreshCw className="size-3" /> Renovar
                        </Button>
                      )}

                      {/* Bloquear/Liberar — para ativa e bloqueada */}
                      {(status === "ativa" || status === "bloqueada") && (
                        <Button size="sm" variant="outline"
                          onClick={() => toggleStatus(e.id, e.status)}
                          className="gap-1 text-xs h-7">
                          {e.status === "bloqueada"
                            ? <><CheckCircle2 className="size-3" /> Liberar</>
                            : <><Ban className="size-3" /> Bloquear</>}
                        </Button>
                      )}

                      {/* Excluir — para trial, vencida e bloqueada */}
                      {(status === "trial" || status === "vencida" || status === "bloqueada") && (
                        <Button size="sm" variant="outline"
                          onClick={() => setConfirmarExclusao({ id: e.id, nome_fantasia: e.nome_fantasia })}
                          className="gap-1 text-xs h-7 text-red-500 border-red-200 hover:bg-red-50">
                          <Trash2 className="size-3" /> Excluir
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {listaFiltrada.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-14 text-center text-sm text-zinc-400">
                  Nenhuma empresa nesta categoria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Dialog: Usuários ── */}
      <Dialog open={!!empresaUsuarios} onOpenChange={(v) => { if (!v) setEmpresaUsuarios(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Usuários — {empresaUsuarios?.nome_fantasia}</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg ring-1 ring-black/5 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-surface text-[10px] uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="text-left px-3 py-2">Nome</th>
                  <th className="text-left px-3 py-2">E-mail</th>
                  <th className="text-left px-3 py-2">Papel</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(empresaUsers ?? []).map((u: any) => (
                  <tr key={u.id} className="border-t border-black/5">
                    <td className="px-3 py-2 font-medium text-ink">{u.profile?.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{u.profile?.email ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-zinc-100 text-zinc-600">
                        {u.role === "empresa_owner" ? "Dono" : "Funcionário"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="ghost"
                        onClick={() => removeUsuario(u.id, u.user_id)}
                        className="text-red-500 hover:text-red-600">
                        <Trash2 className="size-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {(empresaUsers ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-xs text-zinc-400">Nenhum usuário associado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <form onSubmit={addUsuario} className="space-y-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Associar usuário</p>
            <Field name="email" label="E-mail do usuário" type="email" required />
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select name="role" defaultValue="empresa_owner">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empresa_owner">Dono</SelectItem>
                  <SelectItem value="empresa_staff">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full bg-brand hover:bg-brand/90">Associar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Renovar ── */}
      <Dialog open={!!renovarEmpresa} onOpenChange={(v) => { if (!v) setRenovarEmpresa(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-5 text-blue-500" />
              Renovar acesso
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            Empresa: <strong>{renovarEmpresa?.nome_fantasia}</strong>
          </p>
          <div className="grid grid-cols-3 gap-2 my-2">
            {["30", "90", "365"].map((d) => (
              <button key={d} type="button" onClick={() => setNovosdi(d)}
                className={`py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  novosdi === d
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}>
                {d === "365" ? "1 ano" : `${d} dias`}
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenovarEmpresa(null)}>Cancelar</Button>
            <Button onClick={renovar} className="bg-brand hover:bg-brand/90">
              Renovar por {novosdi === "365" ? "1 ano" : `${novosdi} dias`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar exclusão ── */}
      <Dialog open={!!confirmarExclusao} onOpenChange={(v) => { if (!v) setConfirmarExclusao(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="size-5" />
              Excluir empresa
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-700">
            Você está prestes a excluir <strong>{confirmarExclusao?.nome_fantasia}</strong>.
          </p>
          <p className="text-sm text-zinc-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            Isso remove permanentemente todos os pedidos, produtos, clientes e usuários vinculados.
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmarExclusao(null)} disabled={excluindo}>
              Cancelar
            </Button>
            <Button
              onClick={excluirEmpresa}
              disabled={excluindo}
              className="bg-red-600 hover:bg-red-700 text-white">
              {excluindo ? "Excluindo…" : "Sim, excluir tudo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field(props: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input id={props.name} name={props.name} type={props.type ?? "text"} required={props.required} />
    </div>
  );
}
