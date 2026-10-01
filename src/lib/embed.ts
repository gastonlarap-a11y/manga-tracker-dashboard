/**
 * Link handling for when this dashboard runs inside the desktop app's window.
 *
 * The app shows this page in an `<iframe>` pointing at the backend, which is a
 * different origin from the window itself (`wails://wails/` on macOS,
 * `http://wails.localhost/` on Windows). Wails 2.12 implements no handler for a
 * new-window request — no `createWebViewWithConfiguration:` on macOS, nothing
 * subscribed to `NewWindowRequested` on Windows — so `target="_blank"` silently
 * does nothing there, and being cross-origin, the app cannot intercept the click
 * from outside. This side has to hand the URL over.
 *
 * In a normal browser `window.parent === window` and none of this runs: the
 * links keep opening tabs exactly as before.
 *
 * The same handshake carries the rest of what the window and this page say to
 * each other: the app has no bar of its own while it shows the dashboard, so
 * the settings button lives in this page's bar and asks the app to open them.
 */

/**
 * Sent by the embedder once its frame has loaded. Nothing installs before it.
 * `translucent: true` means the window behind this page is the system's own
 * material (macOS vibrancy), so the page lets it show through.
 */
const HELLO = "manga-tracker:embed-hello";

/** Sent back per click, with the URL the person just asked for. */
const OPEN_EXTERNAL = "manga-tracker:open-external";

/**
 * The answer to each greeting: what this page can ask the app for. An app that
 * never receives it is showing a dashboard older than this bridge, and keeps a
 * way to its settings of its own — this page has no button for them.
 */
const READY = "manga-tracker:embed-ready";

/** Sent when the person presses the settings button in this page's bar. */
const OPEN_SETTINGS = "manga-tracker:open-settings";

export type EmbedState =
  | { readonly kind: "standalone" }
  | { readonly kind: "embedded"; readonly translucent: boolean };

type Parent = Pick<Window, "postMessage">;

/**
 * Whether this page is showing inside the app, for the components that change
 * because of it. Shaped for `useSyncExternalStore`: the snapshot is the same
 * object until something actually changes.
 */
export interface EmbedStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): EmbedState;
  /** Asks the app to open its settings. Does nothing outside the app. */
  requestSettings(): void;
  /** The bridge's half: called on each greeting. */
  greeted(parent: Parent, translucent: boolean): void;
}

const STANDALONE: EmbedState = { kind: "standalone" };

export function createEmbedStore(): EmbedStore {
  let state: EmbedState = STANDALONE;
  let parent: Parent | null = null;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    requestSettings() {
      // "*" for the reason given in installClickForwarder; the message says
      // only "open your settings", which no page could misuse.
      parent?.postMessage({ type: OPEN_SETTINGS }, "*");
    },
    greeted(to, translucent) {
      parent = to;
      if (state.kind === "embedded" && state.translucent === translucent) {
        return;
      }
      state = { kind: "embedded", translucent };
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

/** The one this page uses; tests build their own with createEmbedStore. */
export const embedStore = createEmbedStore();

/** The parts of `window` this needs, so a test can supply them. */
export type EmbedWindow = {
  readonly parent: Pick<Window, "postMessage">;
  readonly location: { readonly origin: string };
  readonly document: Pick<Document, "addEventListener">;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
};

/**
 * Listens for the embedder's greeting and, once greeted, forwards clicks on
 * external links to it instead of letting them open a tab that never appears.
 *
 * The handshake keeps this inert where nobody asked for it: an embedder that
 * never says hello gets the plain browser behaviour. It is not an access
 * check, and should not be read as one. The greeting's origin is not verified,
 * so a page that manages to frame this dashboard can send it, and then
 * receives the URL of each external link clicked inside its frame. Nothing
 * more: no data from the page, nothing executed.
 *
 * Who may frame it is the backend's call, as a `frame-ancestors` policy naming
 * the app's origins (manga-tracker-api, src/modules/embedding). It is enforced
 * on each system only once a real build there has been measured: macOS since
 * 2026-10-01, where nothing else can frame it now; Windows still Report-Only.
 * Guessed wrong, it blanks the dashboard inside the app.
 */
export function installEmbedLinkBridge(
  target: EmbedWindow = window,
  store: EmbedStore = embedStore,
): void {
  if ((target.parent as unknown) === (target as unknown)) {
    return;
  }

  // Scoped to this call rather than the module, so a second greeting cannot
  // stack a second forwarder and post every click twice.
  let forwarding = false;

  target.addEventListener("message", (event: MessageEvent) => {
    const hello = helloOf(event.data);
    if (hello === null) {
      return;
    }
    store.greeted(target.parent, hello.translucent);
    // Answered every time: the app greets on each load of its frame.
    target.parent.postMessage({ type: READY, features: ["settings"] }, "*");
    if (forwarding) {
      return;
    }
    forwarding = true;
    installClickForwarder(target);
  });
}

function helloOf(data: unknown): { translucent: boolean } | null {
  if (
    typeof data !== "object" ||
    data === null ||
    (data as { type?: unknown }).type !== HELLO
  ) {
    return null;
  }
  // Absent on an app older than the field, which is an opaque window.
  return {
    translucent: (data as { translucent?: unknown }).translucent === true,
  };
}

function installClickForwarder(target: EmbedWindow): void {
  // Capture phase: the click has to be stopped before React or the browser act
  // on it. Cancelling here is also what keeps the platform default (nothing on
  // macOS, a chromeless popup on Windows) from ever running.
  target.document.addEventListener(
    "click",
    ((event: MouseEvent) => {
      const url = externalUrlOf(event, target.location.origin);
      if (url === null) {
        return;
      }
      event.preventDefault();
      // "*" is deliberate: the parent is `wails://wails/` in the packaged app
      // and `http://localhost:34115` under `wails dev`, so there is no fixed
      // origin to name, and a custom scheme is not a usable targetOrigin. What
      // travels is one URL the user just clicked, to the process already
      // serving them this page. The strict check belongs on the receiving end,
      // which is the direction that matters.
      target.parent.postMessage({ type: OPEN_EXTERNAL, url }, "*");
    }) as EventListener,
    true,
  );
}

/**
 * The absolute http(s) URL of the external link this click landed on, or null
 * when the click is none of our business: a plain in-app navigation, a
 * `mailto:`/`javascript:` href, or a click the browser already handles itself.
 */
function externalUrlOf(event: MouseEvent, origin: string): string | null {
  if (event.defaultPrevented || event.button !== 0) {
    return null;
  }
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }
  const anchor = target.closest("a[href]");
  if (anchor === null) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(anchor.getAttribute("href") ?? "", origin);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  // Same-origin links are this app navigating itself; they must keep working
  // inside the frame.
  return url.origin === origin ? null : url.href;
}
