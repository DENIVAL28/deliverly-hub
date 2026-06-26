import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeStatus = "connecting" | "online" | "offline";

export function useRealtimeStatus(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const channel = supabase
      .channel("heartbeat-" + Date.now())
      .on("broadcast", { event: "ping" }, () => {})
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("online");
        if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("offline");
      });

    channelRef.current = channel;

    // Ping a cada 30s para detectar desconexão silenciosa
    const interval = setInterval(async () => {
      try {
        const result = await channelRef.current?.send({
          type: "broadcast",
          event: "ping",
          payload: {},
        });
        if (result === "error" || result === "timed out") setStatus("offline");
      } catch {
        setStatus("offline");
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
}
