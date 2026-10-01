import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmbedStore,
  type EmbedStore,
  type EmbedWindow,
  installEmbedLinkBridge,
} from "./embed";

const ORIGIN = "http://127.0.0.1:5150";

type Posted = { type: string; url?: string; features?: string[] };

type Harness = {
  target: EmbedWindow;
  store: EmbedStore;
  /** Everything posted to the app, in order. */
  posted: Posted[];
  /** Only the forwarded links, which is what most tests are about. */
  opened: () => Posted[];
  greet: (extra?: Record<string, unknown>) => void;
  clickOn: (href: string) => MouseEvent;
};

/**
 * A window that is embedded in something else. Each harness gets its own
 * subtree to listen on, so listeners from one test cannot see another's clicks
 * — sharing `document` made the first listener cancel the event and every later
 * one correctly ignore it.
 */
function embedded(): Harness {
  const posted: Posted[] = [];
  let onMessage: ((event: MessageEvent) => void) | null = null;
  const root = document.createElement("div");
  document.body.appendChild(root);
  const store = createEmbedStore();

  const target: EmbedWindow = {
    parent: {
      postMessage: (message: unknown) => {
        posted.push(message as Posted);
      },
    },
    location: { origin: ORIGIN },
    document: root,
    addEventListener: (_type, listener) => {
      onMessage = listener;
    },
  };
  installEmbedLinkBridge(target, store);

  return {
    target,
    store,
    posted,
    opened: () =>
      posted.filter(
        (message) => message.type === "manga-tracker:open-external",
      ),
    greet: (extra = {}) =>
      onMessage?.({
        data: { type: "manga-tracker:embed-hello", ...extra },
      } as MessageEvent),
    clickOn: (href) => {
      root.innerHTML = `<a href="${href}">Seguir leyendo</a>`;
      const anchor = root.querySelector("a");
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      anchor?.dispatchEvent(event);
      return event;
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("installEmbedLinkBridge", () => {
  it("does nothing at all in a normal browser tab", () => {
    // window.parent === window there, so no listener is ever registered and
    // target="_blank" keeps opening tabs.
    const addEventListener = vi.fn();
    const standalone = { addEventListener } as unknown as EmbedWindow;
    (standalone as { parent: unknown }).parent = standalone;

    installEmbedLinkBridge(standalone);

    expect(addEventListener).not.toHaveBeenCalled();
  });

  it("stays inert until the embedder greets it", () => {
    const { posted, clickOn } = embedded();

    const event = clickOn("https://lectorxd.com/manhua/dragona/leer/56");

    expect(posted).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it("forwards an external link once greeted, and cancels the click", () => {
    const { opened, greet, clickOn } = embedded();
    greet();

    const event = clickOn("https://lectorxd.com/manhua/dragona/leer/56");

    expect(opened()).toEqual([
      {
        type: "manga-tracker:open-external",
        url: "https://lectorxd.com/manhua/dragona/leer/56",
      },
    ]);
    // Cancelling is what keeps the platform default (nothing on macOS, a
    // chromeless popup on Windows) from running.
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves the app's own navigation alone", () => {
    const { opened, greet, clickOn } = embedded();
    greet();

    const event = clickOn(`${ORIGIN}/manga/dragona`);

    expect(opened()).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it.each(["mailto:alguien@example.com", "javascript:alert(1)"])(
    "ignores %s",
    (href) => {
      const { opened, greet, clickOn } = embedded();
      greet();

      const event = clickOn(href);

      expect(opened()).toEqual([]);
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it("posts one message per click however often it is greeted", () => {
    const { opened, greet, clickOn } = embedded();
    greet();
    greet();

    clickOn("https://lectorxd.com/manhua/dragona/leer/56");

    expect(opened()).toHaveLength(1);
  });

  it("answers every greeting with what it can ask the app for", () => {
    const { posted, greet } = embedded();
    greet();
    greet();

    expect(posted).toEqual([
      { type: "manga-tracker:embed-ready", features: ["settings"] },
      { type: "manga-tracker:embed-ready", features: ["settings"] },
    ]);
  });
});

describe("the embed store", () => {
  it("starts standalone, and asks nothing of an app that is not there", () => {
    const { store, posted } = embedded();

    store.requestSettings();

    expect(store.getSnapshot()).toEqual({ kind: "standalone" });
    expect(posted).toEqual([]);
  });

  it("knows it is embedded, and whether the window is translucent", () => {
    const { store, greet } = embedded();
    const listener = vi.fn();
    store.subscribe(listener);

    greet({ translucent: true });

    expect(store.getSnapshot()).toEqual({
      kind: "embedded",
      translucent: true,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("treats a greeting without the field as an opaque window", () => {
    const { store, greet } = embedded();

    greet();

    expect(store.getSnapshot()).toEqual({
      kind: "embedded",
      translucent: false,
    });
  });

  it("keeps the same snapshot, and stays quiet, when nothing changed", () => {
    const { store, greet } = embedded();
    greet();
    const first = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    greet();

    expect(store.getSnapshot()).toBe(first);
    expect(listener).not.toHaveBeenCalled();
  });

  it("asks the app to open its settings once greeted", () => {
    const { store, posted, greet } = embedded();
    greet();

    store.requestSettings();

    expect(posted.at(-1)).toEqual({ type: "manga-tracker:open-settings" });
  });
});
