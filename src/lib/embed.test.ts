import { beforeEach, describe, expect, it, vi } from "vitest";
import { type EmbedWindow, installEmbedLinkBridge } from "./embed";

const ORIGIN = "http://127.0.0.1:5150";

type Harness = {
  target: EmbedWindow;
  posted: { type: string; url: string }[];
  greet: () => void;
  clickOn: (href: string) => MouseEvent;
};

/**
 * A window that is embedded in something else. Each harness gets its own
 * subtree to listen on, so listeners from one test cannot see another's clicks
 * — sharing `document` made the first listener cancel the event and every later
 * one correctly ignore it.
 */
function embedded(): Harness {
  const posted: { type: string; url: string }[] = [];
  let onMessage: ((event: MessageEvent) => void) | null = null;
  const root = document.createElement("div");
  document.body.appendChild(root);

  const target: EmbedWindow = {
    parent: {
      postMessage: (message: unknown) => {
        posted.push(message as { type: string; url: string });
      },
    },
    location: { origin: ORIGIN },
    document: root,
    addEventListener: (_type, listener) => {
      onMessage = listener;
    },
  };
  installEmbedLinkBridge(target);

  return {
    target,
    posted,
    greet: () =>
      onMessage?.({
        data: { type: "manga-tracker:embed-hello" },
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
    const { posted, greet, clickOn } = embedded();
    greet();

    const event = clickOn("https://lectorxd.com/manhua/dragona/leer/56");

    expect(posted).toEqual([
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
    const { posted, greet, clickOn } = embedded();
    greet();

    const event = clickOn(`${ORIGIN}/manga/dragona`);

    expect(posted).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it.each(["mailto:alguien@example.com", "javascript:alert(1)"])(
    "ignores %s",
    (href) => {
      const { posted, greet, clickOn } = embedded();
      greet();

      const event = clickOn(href);

      expect(posted).toEqual([]);
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it("posts one message per click however often it is greeted", () => {
    const { posted, greet, clickOn } = embedded();
    greet();
    greet();

    clickOn("https://lectorxd.com/manhua/dragona/leer/56");

    expect(posted).toHaveLength(1);
  });
});
