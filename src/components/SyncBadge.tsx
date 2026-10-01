import { useAtomValue, useSetAtom } from "jotai";
import { unwrap } from "jotai/utils";
import { startTransition, useId, useState } from "react";
import { syncNow } from "../api/client";
import type { SyncStatusDto } from "../api/types";
import { relativeDate } from "../lib/dates";
import { refreshLibraryAtom, syncStatusAtom } from "../state/atoms";

// Renders nothing while the first request is in flight, and nothing at all when
// this install never configured the off-site store — an empty header beats a
// badge reporting on a feature the user does not use. `unwrap` keeps the async
// atom from suspending the whole header.
const statusAtom = unwrap(syncStatusAtom);

interface Appearance {
  readonly label: string;
  readonly tone: string;
  readonly hint: string;
}

function appearance(
  status: SyncStatusDto,
  running: boolean,
  clickError: string | null,
): Appearance {
  if (running) {
    return {
      label: "Sincronizando…",
      tone: "badge-checking",
      hint: "Sincronizando con las otras máquinas",
    };
  }
  // Errors win over staleness: "sincronizado hace 2 min" next to a dead
  // connection would be technically true and actively misleading.
  if (clickError !== null || status.lastError !== null || !status.connected) {
    return {
      label: "Sin sincronizar",
      tone: "badge-offline",
      hint:
        clickError ??
        status.lastError?.message ??
        "Sin conexión con el store compartido",
    };
  }
  if (status.lastSyncAt === null) {
    return {
      label: "Sincronizando…",
      tone: "badge-checking",
      hint: "Primera sincronización en curso",
    };
  }
  return {
    label: `Sincronizado ${relativeDate(status.lastSyncAt)}`,
    tone: "badge-online",
    hint: `Última sincronización: ${status.lastSyncAt}. Click para sincronizar ahora.`,
  };
}

/**
 * The badge is the button. The automatic schedule only pulls at boot and every
 * 6 h, so what another machine recorded a minute ago is not here yet; this is
 * how you ask for it without waiting. Reporting the state and acting on it in
 * one control beats a second element competing for the same corner of the
 * header.
 */
export function SyncBadge() {
  const result = useAtomValue(statusAtom);
  const refreshStatus = useSetAtom(syncStatusAtom);
  const refreshLibrary = useSetAtom(refreshLibraryAtom);
  // Only what this component owns: the outcome of a click. Everything else is
  // read back from the server through syncStatusAtom.
  const [running, setRunning] = useState(false);
  const [clickError, setClickError] = useState<string | null>(null);
  const hintId = useId();

  if (result === undefined || !result.ok || !result.data.enabled) {
    return null;
  }

  async function run(): Promise<void> {
    setRunning(true);
    setClickError(null);
    const outcome = await syncNow();
    setClickError(outcome.ok ? null : outcome.error);
    // Refreshed explicitly rather than left to the SSE stream: a sync that
    // pulled nothing publishes no library change, so LiveRefresh never fires,
    // yet lastSyncAt moved and the badge would keep showing the old time. In a
    // transition, like LiveRefresh, so the library stays on screen meanwhile.
    startTransition(() => {
      refreshStatus();
      refreshLibrary();
    });
    setRunning(false);
  }

  const { label, tone, hint } = appearance(result.data, running, clickError);

  // The reason a sync failed lived only in `title`, which neither a keyboard
  // nor a screen reader ever reaches. It is the button's description now, and
  // the label is a polite live region, so "Sin sincronizar" is announced when
  // it happens instead of waiting to be found.
  return (
    <>
      <button
        type="button"
        className={`badge badge-action ${tone}`}
        onClick={() => void run()}
        disabled={running}
        title={hint}
        aria-describedby={hintId}
        aria-live="polite"
      >
        {label}
      </button>
      <span id={hintId} className="visually-hidden">
        {hint}
      </span>
    </>
  );
}
