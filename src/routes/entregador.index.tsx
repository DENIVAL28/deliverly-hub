import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/entregador/")({
  ssr: false,
  component: EntregadorIndex,
});

function EntregadorIndex() {
  useEffect(() => {
    const token = localStorage.getItem("entregador_token");
    if (token) {
      window.location.replace(`/entregador/${token}`);
    } else {
      window.location.replace("/");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
      Redirecionando…
    </div>
  );
}
