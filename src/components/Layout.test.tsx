import { act, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { useState } from "react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it, vi } from "vitest";
import { embedStore } from "../lib/embed";
import { jsonResponse } from "../test-utils";
import { Layout } from "./Layout";

vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.resolve(jsonResponse({ enabled: false }))),
);

// LiveRefresh opens the event stream on mount; nothing has to arrive on it.
class SilentEventSource {
  addEventListener(): void {}
  close(): void {}
}
vi.stubGlobal("EventSource", SilentEventSource);

/**
 * The real shell, in the data router it needs (ScrollRestoration and
 * viewTransition links exist only there). One store per file: the embed
 * store is a module singleton, and each test below moves it forward.
 */
async function renderShell() {
  const router = createMemoryRouter([
    {
      element: <Layout library={<Counter />} />,
      children: [
        { index: true, element: null },
        { path: "duplicates", element: <p>duplicados</p> },
      ],
    },
  ]);
  await act(async () => {
    render(
      <Provider store={createStore()}>
        <RouterProvider router={router} />
      </Provider>,
    );
  });
  return router;
}

/** A stand-in library with state of its own, to see whether it survives. */
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      inicio {count}
    </button>
  );
}

describe("Layout", () => {
  it("keeps the library alive behind another page, as it was left", async () => {
    const router = await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "inicio 0" }));

    await act(async () => {
      await router.navigate("/duplicates");
    });
    expect(screen.getByText("duplicados")).toBeDefined();
    // Still in the page with its state, hidden from everyone: out of the
    // accessibility tree (no role query finds it), nothing rebuilt later.
    expect(screen.queryByRole("button", { name: /inicio/ })).toBeNull();
    expect(screen.getByText("inicio 1")).toBeDefined();

    await act(async () => {
      await router.navigate("/");
    });
    expect(screen.getByRole("button", { name: "inicio 1" })).toBeDefined();
    expect(screen.queryByText("duplicados")).toBeNull();
  });

  it("has no settings button in a browser tab, where there is no app", async () => {
    await renderShell();

    expect(screen.getByText("inicio 0")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Configuración" })).toBeNull();
    expect(document.documentElement.dataset.embed).toBeUndefined();
  });

  it("asks the desktop app for its settings once inside it", async () => {
    const postMessage = vi.fn();
    await renderShell();

    act(() => embedStore.greeted({ postMessage }, false));
    fireEvent.click(screen.getByRole("button", { name: "Configuración" }));

    expect(postMessage).toHaveBeenCalledWith(
      { type: "manga-tracker:open-settings" },
      "*",
    );
    expect(document.documentElement.dataset.embed).toBeUndefined();
  });

  it("lets a translucent window show through", async () => {
    await renderShell();

    act(() => embedStore.greeted({ postMessage: vi.fn() }, true));

    expect(document.documentElement.dataset.embed).toBe("translucent");
  });
});
