import { useState } from "react";
import { db } from "./db";
import {
  duelPair,
  roundCharacters,
  type Player,
  type PlayerId,
  type Win,
} from "./model";
import { fighters, fighterById, normalize } from "./characters";
import { Modal, Portrait } from "./components";
import { errorText, nameOf } from "./ui";
export default function JornadaDuelForm({
  wins,
  players,
  jornada,
  seasonId,
  editing,
  onSaved,
  onClose,
}: {
  wins: Win[];
  players: Player[];
  jornada: NonNullable<Win["jornada"]>;
  seasonId: string;
  editing?: Win;
  onSaved: (w: Win) => void;
  onClose: () => void;
}) {
  const pair = duelPair(jornada.game),
    fixed = roundCharacters(wins, jornada, editing?.id) ?? {};
  const [winner, setWinner] = useState<PlayerId>(editing?.playerId ?? pair[0]);
  const loser = pair.find((p) => p !== winner)!;
  const [chosen, setChosen] = useState<Partial<Record<PlayerId, string>>>(
    () => ({
      ...fixed,
      ...(editing
        ? {
            [editing.playerId]: editing.characterId,
            [editing.opponentId!]: editing.opponentCharacterId,
          }
        : {}),
    }),
  );
  const [slot, setSlot] = useState<PlayerId>(
      pair.find((p) => !fixed[p]) ?? pair[0],
    ),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={editing ? "Editar duelo de jornada" : "Registrar duelo de jornada"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="duel-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !chosen[winner] || !chosen[loser]) return;
          setBusy(true);
          try {
            onSaved(
              await db.saveJornadaDuel(
                winner,
                loser,
                [chosen[winner]!, chosen[loser]!],
                jornada,
                seasonId,
                editing?.id,
                editing ? new Date(editing.timestamp) : new Date(),
              ),
            );
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="jornada-form-note">
          <strong>Partida {jornada.game} de 10 · Ronda 3 · Duelo</strong>
          <p>
            {nameOf(players, pair[0])} contra {nameOf(players, pair[1])}.
            Victoria: 2 puntos · Derrota: 0. El tercer jugador descansa.
          </p>
        </div>
        <label>
          Ganador del duelo
          <select
            value={winner}
            onChange={(e) => setWinner(e.target.value as PlayerId)}
          >
            {pair.map((p) => (
              <option key={p} value={p}>
                {nameOf(players, p)}
              </option>
            ))}
          </select>
        </label>
        <div className="character-slots duel-character-slots">
          {pair.map((p) => (
            <button
              key={p}
              type="button"
              className={slot === p ? "selected" : ""}
              aria-pressed={slot === p}
              onClick={() => {
                setSlot(p);
                setQuery("");
              }}
            >
              {chosen[p] && <Portrait id={chosen[p]!} />}
              <span>
                {nameOf(players, p)}
                <small>
                  {chosen[p]
                    ? fighterById.get(chosen[p]!)?.name
                    : "Elegir personaje"}
                  {fixed[p] ? " · Fijado" : ""}
                </small>
              </span>
            </button>
          ))}
        </div>
        {fixed[slot] ? (
          <p className="muted">
            {nameOf(players, slot)} mantiene el personaje elegido en su duelo
            anterior de esta ronda.
          </p>
        ) : (
          <>
            <label>
              Buscar personaje
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="fighter-grid roster-grid duel-fighter-grid">
              {fighters
                .filter((f) => normalize(f.name).includes(normalize(query)))
                .map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`fighter-tile ${chosen[slot] === f.id ? "selected" : ""}`}
                    aria-label={f.name}
                    aria-pressed={chosen[slot] === f.id}
                    onClick={() => {
                      setChosen((c) => ({ ...c, [slot]: f.id }));
                      const next = pair.find(
                        (p) => p !== slot && !chosen[p] && !fixed[p],
                      );
                      if (next) {
                        setSlot(next);
                        setQuery("");
                      }
                    }}
                  >
                    <Portrait id={f.id} />
                    <span>{f.name}</span>
                  </button>
                ))}
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <button
          className="primary full"
          disabled={busy || !chosen[winner] || !chosen[loser]}
        >
          {busy
            ? "Guardando…"
            : editing
              ? "Guardar cambios"
              : "Registrar duelo"}
        </button>
      </form>
    </Modal>
  );
}
