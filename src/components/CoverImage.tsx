import { useState } from "react";

interface CoverImageProps {
  mangaId: string;
  name: string;
  coverUrl: string | null;
  className?: string;
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

export function CoverImage({
  mangaId,
  name,
  coverUrl,
  className,
}: CoverImageProps) {
  // Covers load through the API proxy: hotlink-protected CDNs (img2mw.xyz
  // serves manhwaweb covers only with that site's Referer) reject the browser
  // but not the local server. ?v= busts the day-long proxy cache when the
  // cover changes; a failure is remembered per src, so a new cover retries.
  const src = coverUrl
    ? `/api/mangas/${mangaId}/cover?v=${hashString(coverUrl).toString(36)}`
    : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    const hue = hueFromName(name);
    return (
      <div
        className={`cover cover-fallback ${className ?? ""}`}
        style={{
          background: `linear-gradient(160deg, hsl(${hue} 45% 32%), hsl(${(hue + 45) % 360} 50% 16%))`,
        }}
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
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  );
}
