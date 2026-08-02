import { useAtomValue } from "jotai";
import { unwrap } from "jotai/utils";
import { relativeDate } from "../lib/dates";
import { syncStatusAtom } from "../state/atoms";

// Renders nothing while the first request is in flight, and nothing at all when
// this install never configured the off-site store — an empty header beats a
// badge reporting on a feature the user does not use. `unwrap` keeps the async
// atom from suspending the whole header.
const statusAtom = unwrap(syncStatusAtom);

export function SyncBadge() {
  const result = useAtomValue(statusAtom);
  if (result === undefined || !result.ok || !result.data.enabled) {
    return null;
  }

  const { connected, lastSyncAt, lastError } = result.data;

  // Errors win over staleness: "synced 2 min ago" next to a dead connection
  // would be technically true and actively misleading.
  if (lastError !== null || !connected) {
    return (
      <span className="badge badge-offline" title={lastError?.message}>
        Sin sincronizar
      </span>
    );
  }

  if (lastSyncAt === null) {
    return <span className="badge badge-checking">Sincronizando…</span>;
  }

  return (
    <span
      className="badge badge-online"
      title={`Última sincronización: ${lastSyncAt}`}
    >
      Sincronizado {relativeDate(lastSyncAt)}
    </span>
  );
}
