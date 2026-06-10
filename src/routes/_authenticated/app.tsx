import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppRedirect,
});

function AppRedirect() {
  const { loading, isMaster, empresaId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (isMaster)       navigate({ to: "/master",      replace: true });
    else if (empresaId) navigate({ to: "/empresa",     replace: true });
    else                navigate({ to: "/onboarding",  replace: true });
  }, [loading, isMaster, empresaId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
      Carregando seu painel…
    </div>
  );
}