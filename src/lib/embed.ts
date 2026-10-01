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
 */

/** Sent by the embedder once its frame has loaded. Nothing installs before it. */
const HELLO = "manga-tracker:embed-hello";

/** Sent back per click, with the URL the person just asked for. */
const OPEN_EXTERNAL = "manga-tracker:open-external";

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
export function installEmbedLinkBridge(target: EmbedWindow = window): void {
  if ((target.parent as unknown) === (target as unknown)) {
    return;
  }

  // Scoped to this call rather than the module, so a second greeting cannot
  // stack a second forwarder and post every click twice.
  let forwarding = false;

  target.addEventListener("message", (event: MessageEvent) => {
    if (!isHello(event.data) || forwarding) {
      return;
    }
    forwarding = true;
    installClickForwarder(target);
  });
}

function isHello(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === HELLO
  );
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
