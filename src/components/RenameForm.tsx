import { useState } from "react";
import { updateManga } from "../api/client";
import type { MangaDto } from "../api/types";

interface RenameFormProps {
  mangaId: string;
  currentName: string;
  onRenamed: (manga: MangaDto) => void;
}

type FormState =
  | { kind: "idle" }
  | { kind: "editing"; value: string }
  | { kind: "saving"; value: string }
  | { kind: "error"; value: string; error: string };

// Manual correction (PLAN.md phase 9): fixes only the visible canonicalName;
// the API never touches normalizedSlug, so dedup keys stay stable.
export function RenameForm({
  mangaId,
  currentName,
  onRenamed,
}: RenameFormProps) {
  const [state, setState] = useState<FormState>({ kind: "idle" });

  if (state.kind === "idle") {
    return (
      <button
        type="button"
        className="ghost"
        onClick={() => setState({ kind: "editing", value: currentName })}
      >
        Renombrar
      </button>
    );
  }

  const saving = state.kind === "saving";
  const value = state.value;

  async function save(): Promise<void> {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }
    setState({ kind: "saving", value: trimmed });
    const result = await updateManga(mangaId, { canonicalName: trimmed });
    if (result.ok) {
      setState({ kind: "idle" });
      onRenamed(result.data);
    } else {
      setState({ kind: "error", value: trimmed, error: result.error });
    }
  }

  return (
    <form
      className="rename"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input
        aria-label="Nuevo nombre"
        value={value}
        disabled={saving}
        onChange={(event) =>
          setState({ kind: "editing", value: event.target.value })
        }
      />
      <button type="submit" disabled={saving}>
        Guardar
      </button>
      <button
        type="button"
        className="ghost"
        disabled={saving}
        onClick={() => setState({ kind: "idle" })}
      >
        Cancelar
      </button>
      {state.kind === "error" && (
        <span className="error" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
