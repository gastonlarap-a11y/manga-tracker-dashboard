import { useAtomValue } from "jotai";
import { Activity, Flame, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Suspense } from "react";
import {
  type ActivitySummary,
  type HeatCell,
  summarizeActivity,
} from "../../lib/activity";
import { formatCalendarDay } from "../../lib/dates";
import { activityAtom } from "../../state/atoms";

const WEEKS = 12;
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

function chapters(count: number): string {
  return count === 1 ? "1 capítulo" : `${count} capítulos`;
}

/**
 * How much has been read lately, at a glance: a heatmap of the last twelve
 * weeks, the last seven days against the seven before, and the streak.
 *
 * Its own Suspense boundary, so a slow or missing activity endpoint (a backend
 * older than it) never holds up the library around it.
 */
export function ActivityPanel() {
  return (
    <section
      className="tile activity bento-activity"
      aria-labelledby="activity-title"
    >
      <header className="tile-head">
        <h2 id="activity-title" className="tile-title">
          <Activity aria-hidden="true" />
          Actividad
        </h2>
        <span className="tile-sub">Últimas {WEEKS} semanas</span>
      </header>
      <Suspense fallback={<div className="skeleton heatmap-placeholder" />}>
        <ActivityBody />
      </Suspense>
    </section>
  );
}

function ActivityBody() {
  const result = useAtomValue(activityAtom);
  if (!result.ok) {
    return (
      <p className="tile-note">
        No pude leer la actividad de lectura: {result.error}
      </p>
    );
  }
  const summary = summarizeActivity(result.data.days, WEEKS);
  return (
    <div className="activity-content">
      <div className="activity-figures">
        <p className="figure">
          <span className="figure-value">{summary.lastSeven}</span>
          <span className="figure-label">capítulos en los últimos 7 días</span>
        </p>
        <div className="activity-chips">
          <Change summary={summary} />
          <Streak summary={summary} />
        </div>
      </div>
      <Heatmap weeks={summary.weeks} />
    </div>
  );
}

function Change({ summary }: { summary: ActivitySummary }) {
  if (summary.change === null) {
    return null;
  }
  if (summary.change === 0) {
    return (
      <span className="chip">
        <Minus aria-hidden="true" />
        Igual que los 7 anteriores
      </span>
    );
  }
  const up = summary.change > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`chip ${up ? "chip-good" : "chip-bad"}`}>
      <Icon aria-hidden="true" />
      {up ? "+" : "−"}
      {Math.abs(summary.change)} % vs. los 7 anteriores
    </span>
  );
}

function Streak({ summary }: { summary: ActivitySummary }) {
  if (summary.streak === 0) {
    return <span className="chip">Sin racha activa</span>;
  }
  return (
    <span className="chip chip-warm">
      <Flame aria-hidden="true" />
      Racha de {summary.streak === 1 ? "1 día" : `${summary.streak} días`}
      {summary.streakReachesStart && " o más"}
    </span>
  );
}

function Heatmap({ weeks }: { weeks: ActivitySummary["weeks"] }) {
  const total = weeks
    .flat()
    .reduce((sum, cell) => sum + (cell.chapters ?? 0), 0);
  return (
    <figure className="heatmap">
      {/* The squares are for the eye; the sentence is what a screen reader
          gets, together with the figures above. */}
      <div
        className="heatmap-body"
        role="img"
        aria-label={`${chapters(total)} en las últimas ${WEEKS} semanas`}
      >
        <div className="heatmap-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="heatmap-grid" aria-hidden="true">
          {weeks.map((week) => (
            <div key={week[0]?.date} className="heatmap-week">
              {week.map((cell) => (
                <HeatSquare key={cell.date} cell={cell} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="heatmap-legend" aria-hidden="true">
        Menos
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className="heat" data-level={level} />
        ))}
        Más
      </figcaption>
    </figure>
  );
}

function HeatSquare({ cell }: { cell: HeatCell }) {
  if (cell.chapters === null) {
    return <span className="heat" data-level="none" />;
  }
  return (
    <span
      className="heat"
      data-level={cell.level}
      title={`${formatCalendarDay(cell.date)} · ${chapters(cell.chapters)}`}
    />
  );
}
