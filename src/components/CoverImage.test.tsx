import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverImage } from "./CoverImage";

const COVER_URL = "https://img2mw.xyz/manhwas/carnicero/cover_123.webp";

describe("CoverImage", () => {
  it("loads the cover through the api proxy with a version bust", () => {
    const { container } = render(
      <CoverImage mangaId="m1" name="Carnicero Marcial" coverUrl={COVER_URL} />,
    );

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toMatch(/^\/api\/mangas\/m1\/cover\?v=/);
  });

  it("renders the gradient fallback when there is no cover", () => {
    const { container } = render(
      <CoverImage mangaId="m1" name="Carnicero Marcial" coverUrl={null} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".cover-fallback")?.textContent).toBe("C");
  });

  it("falls back on error and retries when the cover changes", () => {
    const { container, rerender } = render(
      <CoverImage mangaId="m1" name="Carnicero Marcial" coverUrl={COVER_URL} />,
    );

    const img = container.querySelector("img");
    if (!img) {
      throw new Error("expected the proxy img to render");
    }
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();

    // A different stored cover produces a different ?v= → a fresh attempt.
    rerender(
      <CoverImage
        mangaId="m1"
        name="Carnicero Marcial"
        coverUrl="https://cdn.example.com/manual-cover.webp"
      />,
    );
    expect(container.querySelector("img")).not.toBeNull();
  });
});
