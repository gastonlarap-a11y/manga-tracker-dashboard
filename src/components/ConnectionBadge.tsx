import { useAtomValue } from "jotai";
import type { LiveStatus } from "../state/atoms";
import { liveStatusAtom } from "../state/atoms";

// Reflects the real state of the SSE stream (owned by LiveRefresh) — no
// polling: if the stream is up, the backend is up.
const LABELS: Record<LiveStatus, string> = {
  connecting: "Conectando…",
  live: "En vivo",
  offline: "Reconectando…",
};

const CLASSES: Record<LiveStatus, string> = {
  connecting: "badge-checking",
  live: "badge-online",
  offline: "badge-offline",
};

export function ConnectionBadge() {
  const status = useAtomValue(liveStatusAtom);
  return <span className={`badge ${CLASSES[status]}`}>{LABELS[status]}</span>;
}
