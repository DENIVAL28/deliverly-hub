import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";

interface Props {
  /** Força estado offline (ex: quando o canal de pedidos reporta erro) */
  forceOffline?: boolean;
}

export function RealtimeBadge({ forceOffline = false }: Props) {
  const heartbeat = useRealtimeStatus();
  const status = forceOffline ? "offline" : heartbeat;

  return (
    <>
      {/* Banner fixo de offline — impossível de ignorar */}
      {status === "offline" && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-sm font-semibold shadow-lg">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-white animate-pulse shrink-0" />
            Sem conexão — novos pedidos podem não atualizar automaticamente
          </div>
          <button
            onClick={() => window.location.reload()}
            className="shrink-0 bg-white text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            Reconectar
          </button>
        </div>
      )}

      {/* Badge inline discreto */}
      <div className="flex items-center gap-1.5 text-xs select-none">
        {status === "connecting" && (
          <>
            <span className="size-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-zinc-400">Conectando...</span>
          </>
        )}
        {status === "online" && (
          <>
            <span className="size-2 rounded-full bg-green-500" />
            <span className="text-zinc-400">Online</span>
          </>
        )}
        {status === "offline" && (
          <>
            <span className="size-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-600 font-semibold">Sem conexão</span>
          </>
        )}
      </div>
    </>
  );
}
