import { Settings } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { type EmbedState, embedStore } from "../lib/embed";

/** Whether this page is showing inside the desktop app, kept current. */
export function useEmbedState(): EmbedState {
  return useSyncExternalStore(
    embedStore.subscribe,
    embedStore.getSnapshot,
    embedStore.getSnapshot,
  );
}

/**
 * Lets the window's own material show through when the app says there is one
 * (macOS vibrancy). An attribute on `<html>` rather than a class somewhere in
 * the tree, because what changes is the page's background itself.
 */
export function EmbedSurface() {
  const state = useEmbedState();
  const translucent = state.kind === "embedded" && state.translucent;

  useEffect(() => {
    const root = document.documentElement;
    if (translucent) {
      root.dataset.embed = "translucent";
    } else {
      delete root.dataset.embed;
    }
  }, [translucent]);

  return null;
}

/**
 * The app's settings, from this page's bar: inside the app this bar is the
 * only one, so the button the app used to carry lives here. Rendered only
 * there — in a browser tab there is no app to open them.
 */
export function SettingsButton() {
  const state = useEmbedState();
  if (state.kind !== "embedded") {
    return null;
  }
  return (
    <button
      type="button"
      className="icon-button"
      aria-label="Configuración"
      title="Configuración"
      onClick={() => embedStore.requestSettings()}
    >
      <Settings aria-hidden="true" />
    </button>
  );
}
