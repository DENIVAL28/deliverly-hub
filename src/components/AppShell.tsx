import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ReactNode, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppShell({ title, items, children }: { title: string; items: NavItem[]; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const NavLinks = () => (
    <>
      {items.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || (to !== "/master" && to !== "/empresa" && pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              active ? "bg-brand/10 text-brand" : "text-zinc-600 hover:bg-zinc-100 hover:text-ink"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-black/5 bg-background">
        <div className="px-6 h-16 flex items-center border-b border-black/5">
          <Link to="/"><img src="/segments/logo.png" alt="Deliverly Hub" className="h-9 w-auto object-contain" /></Link>
        </div>
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{title}</div>
        <nav className="px-2 flex-1 space-y-0.5">
          <NavLinks />
        </nav>
        <div className="p-3 border-t border-black/5">
          <Button onClick={signOut} variant="ghost" className="w-full justify-start gap-2 text-zinc-600">
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Topbar mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-background border-b border-black/5 flex items-center justify-between px-4">
        <img src="/segments/logo.png" alt="Deliverly Hub" className="h-8 w-auto object-contain" />
        <button onClick={() => setMobileOpen((v) => !v)} className="p-2 rounded-md text-zinc-600 hover:bg-zinc-100">
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute top-14 left-0 bottom-0 w-64 bg-background flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{title}</div>
            <nav className="px-2 flex-1 space-y-0.5 overflow-y-auto">
              <NavLinks />
            </nav>
            <div className="p-3 border-t border-black/5">
              <Button onClick={signOut} variant="ghost" className="w-full justify-start gap-2 text-zinc-600">
                <LogOut className="size-4" /> Sair
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <main className="flex-1 min-w-0">
        <div className="pt-14 md:pt-0">
          <div className="p-4 md:p-10 max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-600 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-background rounded-xl ring-1 ring-black/5 p-5">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold text-ink mt-2">{value}</div>
      {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
    </div>
  );
}
