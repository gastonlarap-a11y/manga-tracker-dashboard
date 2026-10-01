import { useAtomValue } from "jotai";
import { History, Play } from "lucide-react";
import { Link } from "react-router";
import type { LibraryEntryDto } from "../../api/types";
import { AmbientCover, CoverImage } from "../../components/CoverImage";
import { markCoverForTransition } from "../../components/coverTransition";
import { relativeDate } from "../../lib/dates";
import { continueReadingAtom } from "../../state/atoms";

function siteOf(url: string | null): string | null {
  if (url === null) {
    return null;
  }
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * The manga last read, large, with the way back into it one click away — the
 * thing someone opening this app came to do — and the next few behind it.
 *
 * A query of its own — the few series in progress read most recently — so
 * what you were reading does not change because the grid below is filtered.
 * A card whose readings have not synced in yet has nothing to continue, and
 * is left out.
 */
export function ContinueReading() {
  const result = useAtomValue(continueReadingAtom);
  if (!result.ok) {
    return null;
  }
  const inProgress = result.data.items.filter(
    (entry) => entry.lastActivity !== null,
  );
  const [current, ...others] = inProgress;
  if (current === undefined) {
    return null;
  }
  const site = siteOf(current.lastSourceUrl);

  return (
    // Keyed by the manga: another one read last arrives as a new hero that
    // fades in, rather than a cover and a backdrop swapped in place. The same
    // manga's next chapter keeps the key and only updates the text.
    <section
      key={current.id}
      className="tile continue bento-continue"
      aria-labelledby="continue-title"
    >
      <AmbientCover
        mangaId={current.id}
        name={current.canonicalName}
        coverUrl={current.coverUrl}
        coverVersion={current.coverVersion}
      />
      <div className="continue-body" data-cover-root>
        <Link
          to={`/manga/${current.id}`}
          className="continue-cover"
          viewTransition
          onClick={markCoverForTransition}
          aria-hidden="true"
          tabIndex={-1}
        >
          <CoverImage
            mangaId={current.id}
            name={current.canonicalName}
            coverUrl={current.coverUrl}
            coverVersion={current.coverVersion}
            priority
          />
        </Link>
        <div className="continue-info">
          <p className="eyebrow">Última lectura</p>
          <h2 id="continue-title" className="continue-title">
            <Link
              to={`/manga/${current.id}`}
              viewTransition
              onClick={markCoverForTransition}
            >
              {current.canonicalName}
            </Link>
          </h2>
          <p className="continue-meta">
            {current.lastActivity?.chapterLabel}
            {current.lastActivity && (
              <> · {relativeDate(current.lastActivity.readAt)}</>
            )}
            {site && <> · {site}</>}
          </p>
          <div className="continue-actions">
            {current.lastSourceUrl && (
              <a
                className="button primary"
                href={current.lastSourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Play aria-hidden="true" />
                Seguir leyendo
              </a>
            )}
            <Link
              className="button tonal"
              to={`/manga/${current.id}`}
              viewTransition
              onClick={markCoverForTransition}
            >
              <History aria-hidden="true" />
              Ver historial
            </Link>
          </div>
        </div>
      </div>
      {others.length > 0 && <Recents entries={others} />}
    </section>
  );
}

function Recents({ entries }: { entries: LibraryEntryDto[] }) {
  return (
    <div className="recents">
      <h3 className="recents-title">También en curso</h3>
      <ul className="recents-list">
        {entries.map((entry) => (
          <li key={entry.id} data-cover-root>
            <Link
              to={`/manga/${entry.id}`}
              className="recent"
              viewTransition
              onClick={markCoverForTransition}
            >
              <span className="recent-media">
                <CoverImage
                  mangaId={entry.id}
                  name={entry.canonicalName}
                  coverUrl={entry.coverUrl}
                  coverVersion={entry.coverVersion}
                />
                {entry.reachedChapter && (
                  <span className="pill on-cover">
                    {entry.reachedChapter.label}
                  </span>
                )}
              </span>
              <span className="recent-name">{entry.canonicalName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
