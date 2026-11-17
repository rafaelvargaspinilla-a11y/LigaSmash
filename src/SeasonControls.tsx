import { useState } from "react";
import { db } from "./db";
import { Modal } from "./components";
import { errorText } from "./ui";
import type { Season } from "./model";
export default function SeasonControls({
  seasons,
  selected,
  onSelect,
  onCreated,
}: {
  seasons: Season[];
  selected: Season;
  onSelect: (id: string) => void;
  onCreated: (s: Season) => void;
}) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = seasons.find((s) => !s.closed)!;
  const [expectedActiveId, setExpectedActiveId] = useState(active.id);
  const closing = seasons.find((s) => s.id === expectedActiveId) ?? active;
  return (
    <section className="season-controls panel">
      <label>
        Temporada de La liga
        <select value={selected.id} onChange={(e) => onSelect(e.target.value)}>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.closed ? " · Cerrada" : " · En juego"}
            </option>
          ))}
        </select>
      </label>
      <button
        className="secondary"
        onClick={() => {
          setExpectedActiveId(active.id);
          setName(`Temporada ${seasons.length + 1}`);
          setError("");
          setOpen(true);
        }}
      >
        Nueva temporada
      </button>
      <p className="muted">
        {selected.closed
          ? "Temporada cerrada. Sus resultados se conservan y se pueden consultar."
          : selected.format === "mixed"
            ? "Dos rondas de tres · Tres duelos de 2 puntos · Final de 6 / 2 / 0"
            : "Reglas originales · Tres rondas de tres y final doble"}
      </p>
      {open && (
        <Modal
          title="Cerrar temporada e iniciar otra"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="duel-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              try {
                const s = await db.startSeason(name, expectedActiveId);
                setOpen(false);
                onCreated(s);
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              Se cerrará <strong>{closing.name}</strong> y se conservarán sus
              resultados. La nueva temporada empezará con cero puntos y las
              nuevas rondas: seis partidas de tres jugadores, tres duelos y la
              final.
            </p>
            <label>
              Nombre de la nueva temporada
              <input
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="muted">
              Los duelos de la jornada puntúan en La liga. La liga 1vs1
              independiente no cambia.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="button-row">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={busy || !name.trim()}>
                {busy ? "Guardando…" : "Cerrar y empezar temporada"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
