import { act, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
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
      element: <Layout />,
      children: [{ index: true, element: <p>inicio</p> }],
    },
  ]);
  await act(async () => {
    render(
      <Provider store={createStore()}>
        <RouterProvider router={router} />
      </Provider>,
    );
  });
}

describe("Layout", () => {
  it("has no settings button in a browser tab, where there is no app", async () => {
    await renderShell();

    expect(screen.getByText("inicio")).toBeDefined();
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
