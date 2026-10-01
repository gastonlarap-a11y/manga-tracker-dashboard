import type { CSSProperties } from "react";
import { useState } from "react";

interface CoverImageProps {
  mangaId: string;
  name: string;
  coverUrl: string | null;
  coverVersion: number;
  className?: string;
  /** The cover the page opens on is worth loading before the rest. */
  priority?: boolean;
}

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash;
}

// Deterministic hue from the name: mangas without a cover (or whose upstream
// is unreachable) get a stable, distinct gradient instead of a broken img.
function hueFromName(name: string): number {
  return hashString(name) % 360;
}

/** The gradient a manga without a usable cover is drawn with. */
export function fallbackBackground(name: string): CSSProperties {
  const hue = hueFromName(name);
  return {
    background: `linear-gradient(160deg, oklch(0.5 0.12 ${hue}), oklch(0.28 0.09 ${(hue + 45) % 360}))`,
  };
}

/**
 * Where a manga's cover is fetched from, or null when it has none.
 *
 * Covers load through the API proxy: hotlink-protected CDNs (img2mw.xyz serves
 * manhwaweb covers only with that site's Referer) reject the browser but not
 * the local server. ?v= includes coverVersion because bytes can arrive AFTER
 * the url (extension byte capture): the bump busts the day-long proxy cache and
 * clears the remembered per-src failure, so a previously-404ing cover retries
 * without a page reload. Encoded like every other path in src/api/client.ts:
 * an id is data, and raw in a path it would be read as one.
 */
export function coverSrc(
  mangaId: string,
  coverUrl: string | null,
  coverVersion: number,
): string | null {
  return coverUrl
    ? `/api/mangas/${encodeURIComponent(mangaId)}/cover?v=${hashString(`${coverUrl}:${coverVersion}`).toString(36)}`
    : null;
}

export function CoverImage({
  mangaId,
  name,
  coverUrl,
  coverVersion,
  className,
  priority = false,
}: CoverImageProps) {
  const src = coverSrc(mangaId, coverUrl, coverVersion);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div
        className={`cover cover-fallback ${className ?? ""}`}
        style={fallbackBackground(name)}
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      className={`cover ${className ?? ""}`}
      src={src}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}

/**
 * The cover again, blurred into a backdrop: the colour of the page comes from
 * the manga it is about. Decorative, so hidden from assistive technology, and
 * the gradient stands in when there is no cover to blur.
 */
export function AmbientCover({
  mangaId,
  name,
  coverUrl,
  coverVersion,
  className,
}: Omit<CoverImageProps, "priority">) {
  const src = coverSrc(mangaId, coverUrl, coverVersion);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <div className={`ambient ${className ?? ""}`} aria-hidden="true">
      {src && failedSrc !== src ? (
        <img src={src} alt="" onError={() => setFailedSrc(src)} />
      ) : (
        <div className="ambient-fill" style={fallbackBackground(name)} />
      )}
    </div>
  );
}
