import { useEffect, useState } from "react";
import { db } from "./db";
import {
  localDate,
  filterPeriod,
  periodBounds,
  type Period,
  type Player,
  type PlayerId,
  type Win,
} from "./model";
import { Modal, PeriodFilter, Empty } from "./components";
import { dateLabel, errorText, nameOf } from "./ui";

export default function DuelLeague({
  players,
  wins,
  onChange,
  databaseName,
}: {
  players: Player[];
  wins: Win[];
  onChange: (message: string) => void;
  databaseName: string;
}) {
  const [period, setPeriod] = useState<Period>("all");
  const [custom, setCustom] = useState<[string, string]>([
    localDate(new Date()),
    localDate(new Date()),
  ]);
  const [form, setForm] = useState<Win | "new">();
  const [winner, setWinner] = useState<PlayerId>("p1");
  const [loser, setLoser] = useState<PlayerId>("p2");
  const [date, setDate] = useState(localDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<Win>();
  const [limit, setLimit] = useState(50);
  useEffect(() => {
    setForm(undefined);
    setDeleting(undefined);
    setError("");
  }, [databaseName]);
  useEffect(() => setLimit(50), [period, custom]);
  const matches = filterPeriod(
    wins.filter((w) => w.league === "duel"),
    periodBounds(period, new Date(), custom),
  );
  const ranking = players
    .map((p) => ({
      ...p,
      victories: matches.filter((w) => w.playerId === p.id).length,
      played: matches.filter(
        (w) => w.playerId === p.id || w.opponentId === p.id,
      ).length,
    }))
    .sort((a, b) => b.victories - a.victories);
  const history = [...matches].sort(
    (a, b) =>
      b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id),
  );
  function open(win?: Win) {
    setWinner(win?.playerId ?? "p1");
    setLoser(win?.opponentId ?? "p2");
    setDate(win?.localDate ?? localDate(new Date()));
    setError("");
    setForm(win ?? "new");
  }
  return (
    <>
      <button className="primary" onClick={() => open()}>
        Registrar victoria 1vs1
      </button>
      <PeriodFilter
        period={period}
        setPeriod={setPeriod}
        custom={custom}
        setCustom={setCustom}
      />
      <section className="panel duel-panel">
        <h2>Clasificación 1vs1</h2>
        <p className="muted">
          {matches.length} partidas · Clasificación por victorias
        </p>
        {ranking.map((p) => (
          <div className="duel-row" key={p.id}>
            <strong>
              {1 + ranking.filter((q) => q.victories > p.victories).length}.{" "}
              {p.name}
            </strong>
            <span>
              {p.victories} victorias · {p.played} partidas ·{" "}
              {p.played ? Math.round((p.victories / p.played) * 100) : 0}%
            </span>
          </div>
        ))}
      </section>
      <section className="panel duel-panel">
        <h2>Enfrentamientos</h2>
        {players.flatMap((a, i) =>
          players.slice(i + 1).map((b) => {
            const pair = matches.filter(
              (w) =>
                (w.playerId === a.id && w.opponentId === b.id) ||
                (w.playerId === b.id && w.opponentId === a.id),
            );
            return (
              <div className="duel-row" key={a.id + b.id}>
                <span>
                  {a.name} vs {b.name}
                </span>
                <strong>
                  {pair.filter((w) => w.playerId === a.id).length} –{" "}
                  {pair.filter((w) => w.playerId === b.id).length}
                </strong>
              </div>
            );
          }),
        )}
      </section>
      <section className="panel duel-panel">
        <h2>Historial 1vs1</h2>
        {!history.length && (
          <Empty text="Todavía no hay duelos en este periodo." />
        )}
        {history.slice(0, limit).map((w) => (
          <div className="duel-row" key={w.id}>
            <div>
              <strong>
                {nameOf(players, w.playerId)} gana a{" "}
                {nameOf(players, w.opponentId!)}
              </strong>
              <p className="muted">{dateLabel(w.localDate)}</p>
            </div>
            <div className="button-row">
              <button className="secondary" onClick={() => open(w)}>
                Editar
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setError("");
                  setDeleting(w);
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {history.length > limit && (
          <button
            className="secondary full"
            onClick={() => setLimit((n) => n + 50)}
          >
            Mostrar 50 más
          </button>
        )}
      </section>
      {form && (
        <Modal
          title={
            form === "new" ? "Registrar victoria 1vs1" : "Editar partida 1vs1"
          }
          onClose={() => {
            if (!busy) setForm(undefined);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                const d =
                  form === "new" ? new Date() : new Date(form.timestamp);
                const [y, m, day] = date.split("-").map(Number);
                d.setFullYear(y, m - 1, day);
                await db.saveDuel(
                  winner,
                  loser,
                  d,
                  form === "new" ? undefined : form.id,
                );
                setForm(undefined);
                onChange("Partida 1vs1 guardada.");
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Ganador
              <select
                value={winner}
                onChange={(e) => {
                  const next = e.target.value as PlayerId;
                  setWinner(next);
                  if (next === loser) setLoser(winner);
                }}
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rival
              <select
                value={loser}
                onChange={(e) => setLoser(e.target.value as PlayerId)}
              >
                {players
                  .filter((p) => p.id !== winner)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Fecha
              <input
                type="date"
                required
                min="1900-01-01"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button
              className="primary full"
              disabled={busy || winner === loser}
            >
              {busy ? "Guardando…" : "Guardar victoria"}
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="¿Eliminar partida 1vs1?"
          onClose={() => {
            if (!busy) setDeleting(undefined);
          }}
        >
          <p>
            {nameOf(players, deleting.playerId)} contra{" "}
            {nameOf(players, deleting.opponentId!)}. Se actualizarán las
            estadísticas 1vs1.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(undefined)}
            >
              Cancelar
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await db.deleteWin(deleting.id);
                  setDeleting(undefined);
                  onChange("Partida 1vs1 eliminada.");
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Eliminar partida
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
