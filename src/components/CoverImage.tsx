import { useState } from "react";

interface CoverImageProps {
  name: string;
  coverUrl: string | null;
  className?: string;
}

// Deterministic hue from the name: mangas without a cover (or whose site
// blocks hotlinking) get a stable, distinct gradient instead of a broken img.
function hueFromName(name: string): number {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }
  return hash;
}

export function CoverImage({ name, coverUrl, className }: CoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (!coverUrl || failed) {
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
      src={coverUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
