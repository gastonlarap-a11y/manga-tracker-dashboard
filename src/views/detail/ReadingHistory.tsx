import { ArrowUpRight, History as HistoryIcon } from "lucide-react";
import type { HistoryEventDto } from "../../api/types";
import { formatDate, formatTime, groupByDay } from "../../lib/dates";

function chapters(count: number): string {
  return count === 1 ? "1 capítulo" : `${count} capítulos`;
}

/**
 * Every chapter read, grouped by the day it was read on — "Hoy", "Ayer", the
 * weekday, then the date. A table of a hundred and forty identical rows said
 * the same thing and was much harder to scan.
 */
export function ReadingHistory({ events }: { events: HistoryEventDto[] }) {
  const groups = groupByDay(events);

  return (
    <section className="tile history" aria-labelledby="history-title">
      <header className="tile-head">
        <h2 id="history-title" className="tile-title">
          <HistoryIcon aria-hidden="true" />
          Historial
        </h2>
        <span className="tile-sub">{chapters(events.length)}</span>
      </header>
      {events.length === 0 ? (
        <p className="tile-note">Sin lecturas registradas.</p>
      ) : (
        <ol className="history-days">
          {groups.map((group) => (
            <li key={group.key} className="history-day">
              <h3 className="history-day-label">{group.label}</h3>
              <ol className="history-rows">
                {group.items.map((event) => (
                  <li key={event.id} className="history-row">
                    <span className="history-chapter">
                      {event.chapterLabel}
                    </span>
                    <time
                      className="history-time"
                      dateTime={event.readAt}
                      title={formatDate(event.readAt)}
                    >
                      {formatTime(event.readAt)}
                    </time>
                    <span className="history-sites">
                      <span className="chip">{event.sourceDomain}</span>
                      {/* Same chapter, also read on another site of this card. */}
                      {event.alsoReadOn.map((domain) => (
                        <span key={domain} className="chip muted">
                          {domain}
                        </span>
                      ))}
                    </span>
                    <a
                      className="icon-link"
                      href={event.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir ${event.chapterLabel}`}
                      title="Abrir el capítulo"
                    >
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
