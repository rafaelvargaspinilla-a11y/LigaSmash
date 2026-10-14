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
import { Trophy, Swords, Star, Plus, Pencil, Trash2 } from "lucide-react";
import { fighters, fighterById, normalize } from "./characters";
import { colors, indexOf } from "./ui";
import { Modal, PeriodFilter, Empty, Portrait, Evolution } from "./components";
import { dateLabel, errorText, nameOf } from "./ui";

export default function DuelLeague({
  players,
  wins,
  onChange,
  databaseName,
  statisticsOnly = false,
  historyOnly = false,
  charactersOnly = false,
  selectedQuery = "",
  selectedPlayer = "",
  selectedCharacter = "",
  selectedPeriod,
  selectedCustom,
}: {
  players: Player[];
  wins: Win[];
  onChange: (message: string) => void;
  databaseName: string;
  statisticsOnly?: boolean;
  historyOnly?: boolean;
  charactersOnly?: boolean;
  selectedQuery?: string;
  selectedPlayer?: string;
  selectedCharacter?: string;
  selectedPeriod?: Period;
  selectedCustom?: [string, string];
}) {
  const [period, setPeriod] = useState<Period>("all");
  const [custom, setCustom] = useState<[string, string]>([
    localDate(new Date()),
    localDate(new Date()),
  ]);
  const [form, setForm] = useState<Win | "new">();
  const [winner, setWinner] = useState<PlayerId>("p1");
  const [loser, setLoser] = useState<PlayerId>("p2");
  const [characterByPlayer, setCharacterByPlayer] = useState<
    Partial<Record<PlayerId, string>>
  >({});
  const [characterSlot, setCharacterSlot] = useState<"winner" | "loser">(
    "winner",
  );
  const [query, setQuery] = useState("");
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
  useEffect(
    () => setLimit(50),
    [
      period,
      custom,
      selectedPeriod,
      selectedCustom,
      selectedPlayer,
      selectedCharacter,
    ],
  );
  const matches = filterPeriod(
    wins.filter((w) => w.league === "duel"),
    periodBounds(
      selectedPeriod ?? period,
      new Date(),
      selectedCustom ?? custom,
    ),
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
  const history = matches
    .filter(
      (w) =>
        (!selectedPlayer || w.playerId === selectedPlayer) &&
        (!selectedCharacter ||
          w.characterId === selectedCharacter ||
          w.opponentCharacterId === selectedCharacter),
    )
    .sort(
      (a, b) =>
        b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id),
    );
  const characterVictories = new Map<string, number>();
  for (const w of matches)
    if (w.characterId)
      characterVictories.set(
        w.characterId,
        (characterVictories.get(w.characterId) ?? 0) + 1,
      );
  const maxCharacterWins = Math.max(0, ...characterVictories.values());
  const topCharacters = [...characterVictories]
    .filter(([, count]) => count === maxCharacterWins)
    .map(([id]) => id);
  function open(win?: Win) {
    setWinner(win?.playerId ?? "p1");
    setLoser(win?.opponentId ?? "p2");
    setCharacterByPlayer(
      win
        ? {
            [win.playerId]: win.characterId,
            [win.opponentId!]: win.opponentCharacterId ?? "",
          }
        : {},
    );
    setCharacterSlot("winner");
    setQuery("");
    setDate(win?.localDate ?? localDate(new Date()));
    setError("");
    setForm(win ?? "new");
  }
  return (
    <>
      {!statisticsOnly && !historyOnly && !charactersOnly && (
        <div className="duel-actions">
          <button className="primary" onClick={() => open()}>
            <Plus size={20} />
            Registrar victoria 1vs1
          </button>
        </div>
      )}
      {!statisticsOnly && !historyOnly && !charactersOnly && (
        <div className="filter-bar">
          <span className="section-label">CONSULTAR PERIODO</span>
          <PeriodFilter
            period={period}
            setPeriod={setPeriod}
            custom={custom}
            setCustom={setCustom}
          />
        </div>
      )}
      {!historyOnly && !charactersOnly && (
        <>
          <div className="summary-grid">
            <section className="summary-card">
              <div className="summary-icon">
                <Swords size={21} />
              </div>
              <span>Partidas del periodo</span>
              <strong>{matches.length}</strong>
              <small>Duelos entre dos jugadores</small>
            </section>
            <section className="summary-card leader-card">
              <div className="summary-icon gold">
                <Trophy size={21} />
              </div>
              <span>
                {ranking.filter(
                  (p) =>
                    p.victories > 0 && p.victories === ranking[0]?.victories,
                ).length > 1
                  ? "Liderato compartido"
                  : "Líder actual"}
              </span>
              <strong className="text-value">
                {ranking
                  .filter(
                    (p) =>
                      p.victories > 0 && p.victories === ranking[0]?.victories,
                  )
                  .map((p) => p.name)
                  .join(" · ") || "Por decidir"}
              </strong>
              <small>Clasificación por victorias</small>
            </section>
            <section className="summary-card">
              <div className="summary-icon gold">
                <Star size={21} />
              </div>
              <span>Luchador más ganador</span>
              <strong className="text-value">
                {topCharacters
                  .map((id) => fighterById.get(id)?.name)
                  .join(" · ") || "Por descubrir"}
              </strong>
              <small>Por victorias con personaje registrado</small>
            </section>
          </div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">LA RIVALIDAD</p>
              <h2>Clasificación 1vs1</h2>
            </div>
            <span className="tag">POR VICTORIAS</span>
          </div>
          <div className="ranking-grid duel-ranking">
            {ranking.map((p) => {
              const rank =
                1 + ranking.filter((q) => q.victories > p.victories).length;
              const leader = rank === 1 && p.victories > 0;
              const percent = p.played ? (p.victories / p.played) * 100 : 0;
              return (
                <section
                  key={p.id}
                  className={`ranking-card ${leader ? "is-leader" : ""}`}
                  style={
                    {
                      "--player-color": colors[indexOf(p.id)],
                    } as React.CSSProperties
                  }
                >
                  <div className="ranking-top">
                    <span className="rank-number">0{rank}</span>
                    {leader ? (
                      <span className="leader-tag">
                        <Trophy size={12} />
                        {ranking.filter((q) => q.victories === p.victories)
                          .length > 1
                          ? "EMPATE"
                          : "LÍDER"}
                      </span>
                    ) : (
                      <span className="tag">JUGADOR {indexOf(p.id) + 1}</span>
                    )}
                  </div>
                  <div className="player-identity">
                    <span className="avatar">{p.name[0]}</span>
                    <h3>{p.name}</h3>
                  </div>
                  <div className="player-points">
                    <strong>{p.victories}</strong>
                    <span>victorias</span>
                  </div>
                  <div className="player-numbers">
                    <div>
                      <strong>{p.played}</strong>
                      <span>partidas</span>
                    </div>
                    <div>
                      <strong>
                        {Math.round(percent)}
                        <small>%</small>
                      </strong>
                      <span>de victorias</span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div style={{ width: `${percent}%` }} />
                  </div>
                  <div className="card-foot">
                    <span>Derrotas</span>
                    <strong>{p.played - p.victories}</strong>
                  </div>
                </section>
              );
            })}
          </div>
          {matches.some((w) => !w.opponentCharacterId) && (
            <p className="legacy-note">
              Hay duelos antiguos sin personajes. Puedes completarlos desde su
              historial.
            </p>
          )}
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
        </>
      )}
      {statisticsOnly && (
        <Evolution wins={matches} players={players} victoriesOnly />
      )}
      {(statisticsOnly || charactersOnly) && (
        <section className="panel duel-panel">
          <div className="section-heading">
            <h2>Luchadores del periodo</h2>
            <span className="muted">Victorias y derrotas conocidas</span>
          </div>
          <div className="character-stats-grid">
            {fighters
              .filter(
                (f) =>
                  normalize(f.name).includes(normalize(selectedQuery)) &&
                  matches.some(
                    (w) =>
                      w.characterId === f.id || w.opponentCharacterId === f.id,
                  ),
              )
              .map((f) => {
                const won = matches.filter(
                  (w) => w.characterId === f.id,
                ).length;
                const lost = matches.filter(
                  (w) => w.opponentCharacterId === f.id,
                ).length;
                return (
                  <section className="character-stat" key={f.id}>
                    <div className="duel-character-heading">
                      <Portrait id={f.id} />
                      <h3>{f.name}</h3>
                    </div>
                    <p>
                      {won} victorias · {lost} derrotas
                    </p>
                    {players.map((p) => (
                      <div className="duel-row" key={p.id}>
                        <span>{p.name}</span>
                        <span>
                          {
                            matches.filter(
                              (w) =>
                                w.playerId === p.id && w.characterId === f.id,
                            ).length
                          }{" "}
                          V ·{" "}
                          {
                            matches.filter(
                              (w) =>
                                w.opponentId === p.id &&
                                w.opponentCharacterId === f.id,
                            ).length
                          }{" "}
                          D
                        </span>
                      </div>
                    ))}
                  </section>
                );
              })}
          </div>
          {!fighters.some(
            (f) =>
              normalize(f.name).includes(normalize(selectedQuery)) &&
              matches.some(
                (w) => w.characterId === f.id || w.opponentCharacterId === f.id,
              ),
          ) && (
            <Empty text="No hay personajes jugados que coincidan con estos filtros." />
          )}
        </section>
      )}
      {historyOnly && (
        <section className="panel duel-panel duel-history-panel">
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
                {w.opponentCharacterId ? (
                  <div className="duel-portraits">
                    <span>
                      <Portrait id={w.characterId} />
                      <span>
                        {nameOf(players, w.playerId)} ·{" "}
                        {fighterById.get(w.characterId)?.name}
                        <small>Victoria</small>
                      </span>
                    </span>
                    <span>
                      <Portrait id={w.opponentCharacterId} />
                      <span>
                        {nameOf(players, w.opponentId!)} ·{" "}
                        {fighterById.get(w.opponentCharacterId)?.name}
                        <small>Derrota</small>
                      </span>
                    </span>
                  </div>
                ) : (
                  <small className="muted">Personajes pendientes</small>
                )}
              </div>
              <div className="button-row">
                <button className="secondary" onClick={() => open(w)}>
                  <Pencil size={16} /> Editar
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setError("");
                    setDeleting(w);
                  }}
                >
                  <Trash2 size={16} /> Eliminar
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
      )}
      {form && !statisticsOnly && (
        <Modal
          title={
            form === "new" ? "Registrar victoria 1vs1" : "Editar partida 1vs1"
          }
          onClose={() => {
            if (!busy) setForm(undefined);
          }}
        >
          <form
            className="duel-form"
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
                  [characterByPlayer[winner]!, characterByPlayer[loser]!],
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
            <div className="character-slots duel-character-slots">
              {(["winner", "loser"] as const).map((slot) => {
                const player = slot === "winner" ? winner : loser;
                const id = characterByPlayer[player];
                return (
                  <button
                    type="button"
                    key={slot}
                    aria-pressed={characterSlot === slot}
                    className={`secondary ${characterSlot === slot ? "selected" : ""}`}
                    onClick={() => {
                      setCharacterSlot(slot);
                      setQuery("");
                    }}
                  >
                    {id && <Portrait id={id} />}
                    <span>
                      {slot === "winner"
                        ? "Personaje ganador"
                        : "Personaje perdedor"}
                      <small>
                        {nameOf(players, player)} ·{" "}
                        {id ? fighterById.get(id)?.name : "Seleccionar"}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
            <label>
              Buscar personaje
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mario, Link, Kirby…"
              />
            </label>
            <div className="fighter-grid roster-grid duel-fighter-grid">
              {fighters
                .filter((f) => normalize(f.name).includes(normalize(query)))
                .map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    aria-label={f.name}
                    aria-pressed={
                      characterByPlayer[
                        characterSlot === "winner" ? winner : loser
                      ] === f.id
                    }
                    className={`fighter-tile ${characterByPlayer[characterSlot === "winner" ? winner : loser] === f.id ? "selected" : ""}`}
                    onClick={() => {
                      setCharacterByPlayer((previous) => ({
                        ...previous,
                        [characterSlot === "winner" ? winner : loser]: f.id,
                      }));
                      if (
                        characterSlot === "winner" &&
                        !characterByPlayer[loser]
                      ) {
                        setCharacterSlot("loser");
                        setQuery("");
                      }
                    }}
                  >
                    <Portrait id={f.id} />
                    <span>{f.name}</span>
                  </button>
                ))}
            </div>
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
              disabled={
                busy ||
                winner === loser ||
                !characterByPlayer[winner] ||
                !characterByPlayer[loser]
              }
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
