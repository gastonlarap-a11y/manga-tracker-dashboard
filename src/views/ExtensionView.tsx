import { useAtomValue, useSetAtom } from "jotai";
import { BookOpenCheck, Check, Puzzle, X } from "lucide-react";
import {
  type FormEvent,
  Suspense,
  startTransition,
  useId,
  useState,
} from "react";
import {
  type ApiResult,
  removeCalibration,
  saveExtensionSettings,
} from "../api/client";
import type { CalibrationDto, ExtensionSettingsDto } from "../api/types";
import { extensionKnowledgeAtom, extensionSettingsAtom } from "../state/atoms";

// Theme ids as the backend names them, as a person would read them.
const THEME_NAMES: Record<string, string> = {
  madara: "Madara",
  mangathemesia: "MangaThemesia",
  zeistmanga: "ZeistManga",
  mmrcms: "MMRCMS",
};

export function ExtensionView() {
  return (
    <section className="extension-page">
      <header className="page-head">
        <h1>Extensión</h1>
        <p className="lede">
          Cómo reconoce la extensión del navegador lo que leés. Lo que cambies
          acá le llega sola en unos minutos, y al instante la próxima vez que
          abras su ventanita.
        </p>
      </header>
      {/* Two columns where there is room for them, the settings first:
          they are what the page is for, the list beside them is context. */}
      <div className="extension-grid">
        <Suspense
          fallback={
            <div className="tile skeleton skeleton-block" aria-hidden="true" />
          }
        >
          <ReadingSettings />
        </Suspense>
        <Suspense
          fallback={
            <div className="tile skeleton skeleton-block" aria-hidden="true" />
          }
        >
          <Knowledge />
        </Suspense>
      </div>
    </section>
  );
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; error: string };

function ReadingSettings() {
  const result = useAtomValue(extensionSettingsAtom);
  if (!result.ok) {
    return (
      <p className="status error" role="alert">
        No se pudieron cargar los ajustes de la extensión: {result.error}
      </p>
    );
  }
  // Not keyed by the data: the refresh after a save would remount the form and
  // take "Guardado" with it. The form compares itself against `saved` instead.
  return <ReadingForm saved={result.data} />;
}

function ReadingForm({ saved }: { saved: ExtensionSettingsDto }) {
  const refresh = useSetAtom(extensionSettingsAtom);
  const [form, setForm] = useState(saved);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const switchId = useId();
  const secondsId = useId();
  const scrollId = useId();

  const changed = JSON.stringify(form) !== JSON.stringify(saved);
  const invalid =
    !Number.isInteger(form.readMinSeconds) ||
    form.readMinSeconds < 0 ||
    form.readMinSeconds > 3600 ||
    !Number.isInteger(form.readMinScrollPercent) ||
    form.readMinScrollPercent < 0 ||
    form.readMinScrollPercent > 100;

  function update(patch: Partial<ExtensionSettingsDto>): void {
    setForm((current) => ({ ...current, ...patch }));
    setState({ kind: "idle" });
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setState({ kind: "saving" });
    const result = await saveExtensionSettings(form);
    if (!result.ok) {
      setState({ kind: "error", error: result.error });
      return;
    }
    setState({ kind: "saved" });
    startTransition(() => refresh());
  }

  return (
    <form
      className="tile reading-settings"
      onSubmit={(event) => void submit(event)}
    >
      <header className="tile-head">
        <h2 className="tile-title">
          <BookOpenCheck aria-hidden="true" />
          Lectura real
        </h2>
      </header>
      <label className="setting-row" htmlFor={switchId}>
        <span>
          <span className="setting-label">
            Contar un capítulo recién cuando lo leíste
          </span>
          <span className="tile-note">
            Apagado, se guarda apenas se abre la página — como siempre.
            Prendido, espera a que pase el tiempo y bajes hasta donde digas:
            hojear la lista de capítulos deja de contar como leerlos.
          </span>
        </span>
        <input
          id={switchId}
          type="checkbox"
          role="switch"
          aria-checked={form.readingRequired}
          className="switch"
          checked={form.readingRequired}
          onChange={(event) =>
            update({ readingRequired: event.target.checked })
          }
        />
      </label>
      <fieldset className="reading-thresholds" disabled={!form.readingRequired}>
        <label htmlFor={secondsId}>
          <span className="field-label">Tiempo en la página</span>
          <span className="number-field">
            <input
              id={secondsId}
              type="number"
              inputMode="numeric"
              min={0}
              max={3600}
              step={5}
              value={form.readMinSeconds}
              onChange={(event) =>
                update({ readMinSeconds: event.target.valueAsNumber })
              }
            />
            <span className="unit">segundos</span>
          </span>
        </label>
        <label htmlFor={scrollId}>
          <span className="field-label">Hasta dónde bajar</span>
          <span className="number-field">
            <input
              id={scrollId}
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={5}
              value={form.readMinScrollPercent}
              onChange={(event) =>
                update({ readMinScrollPercent: event.target.valueAsNumber })
              }
            />
            <span className="unit">% de la página</span>
          </span>
        </label>
        <p className="tile-note">
          Cualquiera de los dos en 0 deja de pedirse. Una página que no se
          desplaza (un lector de a una imagen) cuenta como leída hasta el final.
        </p>
      </fieldset>
      <div className="form-actions">
        <button
          type="submit"
          className="primary"
          disabled={!changed || invalid || state.kind === "saving"}
        >
          {state.kind === "saving" ? "Guardando…" : "Guardar"}
        </button>
        {state.kind === "saved" && (
          <span className="saved" role="status">
            <Check aria-hidden="true" />
            Guardado
          </span>
        )}
        {state.kind === "error" && (
          <span className="error" role="alert">
            No se pudo guardar: {state.error}
          </span>
        )}
        {invalid && (
          <span className="error">
            Los segundos van de 0 a 3600 y el porcentaje de 0 a 100.
          </span>
        )}
      </div>
    </form>
  );
}

function Knowledge() {
  const { config, rules, calibrations } = useAtomValue(extensionKnowledgeAtom);
  const themes = config.ok ? config.data.themes : [];
  const curated = rules.ok
    ? rules.data
        .filter((rule) => rule.series !== null)
        .map((rule) => rule.domain)
    : [];
  return (
    <section className="tile knowledge" aria-labelledby="knowledge-title">
      <header className="tile-head">
        <h2 id="knowledge-title" className="tile-title">
          <Puzzle aria-hidden="true" />
          Lo que ya reconoce
        </h2>
      </header>
      <KnowledgeRow
        label="Temas de sitio"
        note="Muchos sitios están hechos con el mismo tema; sobre estos lee nombre, capítulo y serie sin calibrar."
        items={themes.map((theme) => THEME_NAMES[theme.name] ?? theme.name)}
        empty="Ninguno: el backend es anterior a esta función."
      />
      <KnowledgeRow
        label="Sitios con regla propia"
        note="Sitios cuyas direcciones necesitan una regla para no mezclar series."
        items={curated}
        empty="Ninguno."
      />
      <CalibrationsRow calibrations={calibrations} />
    </section>
  );
}

/**
 * The calibrations made from the extension, each one removable: a calibration
 * made on the wrong page (a series page, or picking a heading that holds the
 * chapter too) records wrong readings until it is gone, and recalibrating was
 * the only way out.
 */
function CalibrationsRow({
  calibrations,
}: {
  calibrations: ApiResult<CalibrationDto[]>;
}) {
  const refresh = useSetAtom(extensionKnowledgeAtom);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(domain: string): Promise<void> {
    setRemoving(domain);
    setError(null);
    const result = await removeCalibration(domain);
    setRemoving(null);
    if (!result.ok) {
      setError(`No se pudo quitar la de ${domain}: ${result.error}`);
      return;
    }
    startTransition(() => refresh());
  }

  return (
    <div className="knowledge-row">
      <span className="field-label">Calibrados</span>
      {!calibrations.ok ? (
        <p className="tile-note error" role="alert">
          No se pudieron leer las calibraciones: {calibrations.error}
        </p>
      ) : calibrations.data.length === 0 ? (
        <p className="tile-note">Ninguno todavía.</p>
      ) : (
        <ul className="alias-list">
          {calibrations.data.map((calibration) => (
            <li key={calibration.domain} className="alias">
              <span>{calibration.domain}</span>
              <button
                type="button"
                className="ghost small"
                disabled={removing !== null}
                onClick={() => void remove(calibration.domain)}
                aria-label={`Quitar la calibración de ${calibration.domain}`}
              >
                <X aria-hidden="true" />
                {removing === calibration.domain ? "Quitando…" : "Quitar"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="tile-note error" role="alert">
          {error}
        </p>
      )}
      <p className="tile-note">
        Los que calibraste desde la extensión; ganan sobre todo lo demás.
        Quitarla vuelve el sitio a la detección automática, acá y en tus otras
        computadoras al sincronizar.
      </p>
    </div>
  );
}

function KnowledgeRow({
  label,
  note,
  items,
  empty,
}: {
  label: string;
  note: string;
  items: readonly string[];
  empty: string;
}) {
  return (
    <div className="knowledge-row">
      <span className="field-label">{label}</span>
      {items.length === 0 ? (
        <p className="tile-note">{empty}</p>
      ) : (
        <ul className="alias-list">
          {items.map((item) => (
            <li key={item} className="chip">
              {item}
            </li>
          ))}
        </ul>
      )}
      <p className="tile-note">{note}</p>
    </div>
  );
}
