import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { toast } from "sonner";
import { Trash2, UserCheck, UserX, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/master/usuarios")({
  component: UsuariosPage,
});

type Filtro = "todos" | "sem_empresa";

function UsuariosPage() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("sem_empresa");
  const [deletando, setDeletando] = useState<string | null>(null);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["master-usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, empresa_id, created_at, user_roles(role)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const lista = (usuarios ?? []).filter((u) => {
    if (filtro === "sem_empresa") return !u.empresa_id;
    return true;
  });

  const semEmpresa = (usuarios ?? []).filter((u) => !u.empresa_id).length;

  async function deletarUsuario(id: string, email: string) {
    if (!window.confirm(`Deletar o usuário ${email}? Esta ação não pode ser desfeita.`)) return;
    setDeletando(id);
    const { data, error } = await supabase.functions.invoke("delete-user", {
      body: { user_id: id },
    });
    setDeletando(null);
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "Erro ao deletar");
      return;
    }
    toast.success(`Usuário ${email} deletado.`);
    qc.invalidateQueries({ queryKey: ["master-usuarios"] });
  }

  function roleLabel(roles: any[]) {
    if (!roles?.length) return null;
    const r = roles[0]?.role;
    if (r === "master") return { label: "Master", color: "bg-purple-100 text-purple-700" };
    if (r === "empresa_owner") return { label: "Dono", color: "bg-blue-100 text-blue-700" };
    if (r === "empresa_staff") return { label: "Funcionário", color: "bg-zinc-100 text-zinc-600" };
    return null;
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie todas as contas cadastradas na plataforma"
      />

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl ring-1 ring-black/5 p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="size-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-zinc-400">Total</p>
            <p className="text-xl font-black text-zinc-900">{usuarios?.length ?? "—"}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl ring-1 ring-black/5 p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-green-50 flex items-center justify-center">
            <UserCheck className="size-5 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-zinc-400">Com empresa</p>
            <p className="text-xl font-black text-zinc-900">{(usuarios?.length ?? 0) - semEmpresa}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl ring-1 ring-black/5 p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-red-50 flex items-center justify-center">
            <UserX className="size-5 text-red-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-400">Sem empresa</p>
            <p className="text-xl font-black text-zinc-900">{semEmpresa}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 mb-4 bg-zinc-100 rounded-xl p-1 w-fit">
        {([
          { key: "sem_empresa", label: `Sem empresa (${semEmpresa})` },
          { key: "todos",       label: `Todos (${usuarios?.length ?? 0})` },
        ] as { key: Filtro; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setFiltro(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtro === t.key
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl ring-1 ring-black/5 overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-zinc-400 text-center py-12">Carregando…</p>
        ) : lista.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="size-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-600">Nenhum usuário {filtro === "sem_empresa" ? "sem empresa" : "cadastrado"}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider hidden sm:table-cell">Papel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider hidden md:table-cell">Cadastro</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {lista.map((u) => {
                const role = roleLabel((u as any).user_roles);
                const isMaster = (u as any).user_roles?.some((r: any) => r.role === "master");
                return (
                  <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 truncate max-w-[180px]">
                        {u.nome ?? <span className="text-zinc-400 italic">Sem nome</span>}
                      </p>
                      <p className="text-xs text-zinc-400 truncate max-w-[200px]">{u.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {role ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${role.color}`}>
                          {role.label}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-300 italic">Sem papel</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400 hidden md:table-cell">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isMaster && (
                        <button
                          onClick={() => deletarUsuario(u.id, u.email ?? u.id)}
                          disabled={deletando === u.id}
                          className="size-8 rounded-lg flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-auto disabled:opacity-40"
                          title="Deletar usuário"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
