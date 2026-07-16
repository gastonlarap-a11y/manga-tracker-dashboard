import { useEffect, useState } from "react";
import { pingHealth } from "../api/client";

const PING_INTERVAL_MS = 30_000;

type Connection = "checking" | "online" | "offline";

const LABELS: Record<Connection, string> = {
  checking: "Verificando…",
  online: "Conectado",
  offline: "Sin conexión",
};

export function ConnectionBadge() {
  const [connection, setConnection] = useState<Connection>("checking");

  useEffect(() => {
    let cancelled = false;

    async function ping(): Promise<void> {
      const result = await pingHealth();
      if (!cancelled) {
        setConnection(result.ok ? "online" : "offline");
      }
    }

    void ping();
    const timer = setInterval(() => void ping(), PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <span className={`badge badge-${connection}`}>{LABELS[connection]}</span>
  );
}
