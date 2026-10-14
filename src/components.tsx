import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Trophy,
  Search,
  Star,
  X,
  Pencil,
  Trash2,
  Swords,
  Check,
} from "lucide-react";
import { db } from "./db";
import { fighters, fighterById, normalize } from "./characters";
import {
  localDate,
  pointsFor,
  type Placements,
  type MatchCharacters,
  characterAt,
  matchEntries,
  periods,
  type Player,
  type PlayerId,
  type Win,
  type Period,
} from "./model";
import {
  colors,
  nameOf,
  indexOf,
  formatTime,
  dateLabel,
  errorText,
} from "./ui";
export function Portrait({
  id,
  large = false,
}: {
  id: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  return (
    <span className={`portrait ${large ? "large" : ""}`}>
      {!failed ? (
        <img
          src={`${import.meta.env.BASE_URL}characters/${id}.${["51", "52", "53"].includes(id) ? "jpg" : "png"}`}
          alt={fighterById.get(id)?.name ?? ""}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="portrait-placeholder" aria-label="Retrato pendiente">
          {id.replace("e", "ε")}
          <small>RETRATO</small>
        </span>
      )}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  dismissible = true,
}: {
  dismissible?: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) close.current();
      if (e.key === "Tab") {
        const elements = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,a[href],[tabindex="0"]',
          ) ?? [],
        );
        const first = elements[0],
          last = elements.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, [dismissible]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <header>
          <h2>{title}</h2>
          {dismissible && (
            <button
              className="icon-button"
              aria-label="Cerrar"
              onClick={onClose}
            >
              <X size={22} />
            </button>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
export function WinForm({
  players,
  wins,
  favorites,
  editing,
  onSaved,
  onClose,
  onError,
}: {
  players: Player[];
  wins: Win[];
  favorites: string[];
  editing?: Win;
  onSaved: (w: Win) => void;
  onClose: () => void;
  onError: (s: string) => void;
}) {
  const [player, setPlayer] = useState<PlayerId | undefined>(editing?.playerId);
  const [second, setSecond] = useState<PlayerId | undefined>(
    editing?.placements?.[1],
  );
  const third = players.find((p) => p.id !== player && p.id !== second)?.id;
  const placements: Placements | undefined =
    player && second && third ? [player, second, third] : undefined;
  const [chosen, setChosen] = useState<Partial<Record<PlayerId, string>>>(
    () => {
      const initial: Partial<Record<PlayerId, string>> = {};
      if (editing) {
        initial[editing.playerId] = editing.characterId;
        editing.placements?.forEach((id, index) => {
          const char = characterAt(editing, index);
          if (char) initial[id] = char;
        });
      }
      return initial;
    },
  );
  const [slot, setSlot] = useState(0);
  const activePlayer = placements?.[slot] ?? (slot === 0 ? player : undefined);
  const character = activePlayer ? (chosen[activePlayer] ?? "") : "";
  const characters: MatchCharacters | undefined =
    placements && placements.every((id) => chosen[id])
      ? (placements.map((id) => chosen[id]!) as MatchCharacters)
      : undefined;
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const datetime = (date: Date) =>
    `${localDate(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
  const [time, setTime] = useState(
    editing ? datetime(new Date(editing.timestamp)) : "",
  );
  const recent = [
    ...new Set(
      [...wins]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .flatMap((w) => w.characters ?? [w.characterId]),
    ),
  ].slice(0, 8);
  const quick = [...new Set([...favorites, ...recent])].slice(0, 12);
  const visible = fighters.filter((f) =>
    normalize(f.name).includes(normalize(query)),
  );
  const selectCharacter = (id: string) => {
    if (!activePlayer) return;
    const next = { ...chosen, [activePlayer]: id };
    setChosen(next);
    if (placements) {
      const missing = placements.findIndex((p) => !next[p]);
      if (missing >= 0) {
        setSlot(missing);
        setQuery("");
      }
    }
  };
  const tile = (id: string) => {
    const f = fighterById.get(id)!;
    return (
      <button
        key={id}
        type="button"
        disabled={!activePlayer}
        className={`fighter-tile ${character === id ? "selected" : ""}`}
        aria-label={f.name}
        aria-pressed={character === id}
        onClick={() => selectCharacter(id)}
      >
        <Portrait id={id} />
        <span>{f.name}</span>
        {character === id && <Check className="tile-check" size={16} />}
      </button>
    );
  };
  return (
    <Modal
      title={editing ? "Editar partida" : "Registrar partida"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!placements || !characters || busyRef.current) return;
          busyRef.current = true;
          setBusy(true);
          try {
            const date = editing ? new Date(time) : new Date();
            if (editing) {
              await db.editWin(
                editing.id,
                placements[0],
                characters[0],
                date,
                placements,
                characters,
              );
              onSaved({
                ...editing,
                playerId: placements[0],
                characterId: characters[0],
                timestamp: date.toISOString(),
                localDate: localDate(date),
                placements,
                characters,
              });
            } else
              onSaved(
                await db.addWin(
                  placements[0],
                  characters[0],
                  date,
                  placements,
                  characters,
                ),
              );
          } catch (e) {
            onError(errorText(e));
          } finally {
            busyRef.current = false;
            setBusy(false);
          }
        }}
      >
        <p className="step-label">
          01 <span>Primer puesto · 3 puntos</span>
        </p>
        <div className="player-picker">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              className={player === p.id ? "selected" : ""}
              aria-label={p.name}
              aria-pressed={player === p.id}
              style={
                {
                  "--player-color": colors[indexOf(p.id)],
                } as React.CSSProperties
              }
              onClick={() => {
                setPlayer(p.id);
                if (second === p.id) setSecond(undefined);
                setSlot(0);
                setQuery("");
              }}
            >
              <span className="avatar">{p.name[0]}</span>
              {p.name}
            </button>
          ))}
        </div>
        <p className="step-label">
          02 <span>Segundo puesto · 1 punto</span>
        </p>
        <div className="player-picker second-picker">
          {players
            .filter((p) => p.id !== player)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!player}
                aria-label={`Segundo: ${p.name}`}
                aria-pressed={second === p.id}
                className={second === p.id ? "selected" : ""}
                style={
                  {
                    "--player-color": colors[indexOf(p.id)],
                  } as React.CSSProperties
                }
                onClick={() => {
                  setSecond(p.id);
                  setSlot(0);
                  setQuery("");
                }}
              >
                {p.name}
              </button>
            ))}
        </div>
        <p className="podium-third">
          Tercer puesto · 0 puntos:{" "}
          <strong>
            {placements
              ? nameOf(players, placements[2])
              : "Se determina al elegir primero y segundo"}
          </strong>
        </p>
        <p className="step-label">
          03 <span>Personaje de cada jugador</span>
        </p>
        <div className="character-slots">
          {[0, 1, 2].map((index) => {
            const id =
              placements?.[index] ?? (index === 0 ? player : undefined);
            const selected = id ? chosen[id] : undefined;
            return (
              <button
                key={index}
                type="button"
                disabled={!id}
                aria-label={`Personaje del puesto ${index + 1}`}
                aria-pressed={slot === index}
                className={slot === index ? "selected" : ""}
                onClick={() => {
                  setSlot(index);
                  setQuery("");
                }}
              >
                <span>
                  {index + 1}.º · {[3, 1, 0][index]} pts
                </span>
                {selected ? (
                  <Portrait id={selected} />
                ) : (
                  <span className="character-slot-empty">Elegir</span>
                )}
                <strong>{id ? nameOf(players, id) : "Sin elegir"}</strong>
                <small>
                  {selected
                    ? fighterById.get(selected)?.name
                    : "Personaje pendiente"}
                </small>
              </button>
            );
          })}
        </div>
        <p className="active-character-note">
          {activePlayer
            ? `Selecciona el personaje de ${nameOf(players, activePlayer)} (${slot + 1}.º puesto)`
            : "Selecciona primero el podio"}
        </p>
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Buscar luchador"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar entre 86 luchadores…"
          />
        </label>
        {!query && quick.length > 0 && (
          <>
            <p className="section-label">Favoritos y recientes</p>
            <div className="fighter-grid quick-grid">{quick.map(tile)}</div>
          </>
        )}
        <p className="section-label">
          {query ? `${visible.length} resultados` : "Plantel completo"}
          <span>Retratos oficiales</span>
        </p>
        <div className="fighter-grid roster-grid">
          {visible.map((f) => tile(f.id))}
          {!visible.length && (
            <p className="muted">No hay luchadores con ese nombre.</p>
          )}
        </div>
        {editing && (
          <label className="date-edit">
            Fecha y hora local
            <input
              required
              type="datetime-local"
              step="1"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        )}
        <div className="modal-footer">
          <span className="muted">
            {characters
              ? "Podio completo · 3 / 1 / 0"
              : "Elige los tres personajes"}
          </span>
          <button className="primary" disabled={!characters || busy}>
            <Trophy size={18} />
            {busy
              ? "Guardando…"
              : editing
                ? "Guardar cambios"
                : "Registrar partida"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function PeriodFilter({
  period,
  setPeriod,
  custom,
  setCustom,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  custom: [string, string];
  setCustom: (d: [string, string]) => void;
}) {
  return (
    <div className="period-control">
      <label>
        <span className="sr-only">Periodo</span>
        <select
          aria-label="Periodo"
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
        >
          {Object.entries(periods).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {period === "custom" && (
        <div className="custom-dates">
          <label>
            Desde
            <input
              type="date"
              value={custom[0]}
              max={custom[1]}
              onChange={(e) => setCustom([e.target.value, custom[1]])}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              min={custom[0]}
              value={custom[1]}
              onChange={(e) => setCustom([custom[0], e.target.value])}
            />
          </label>
          {custom[0] > custom[1] && (
            <span role="alert">El inicio debe ser anterior al final.</span>
          )}
        </div>
      )}
    </div>
  );
}
export function Evolution({
  wins,
  players,
  victoriesOnly = false,
}: {
  wins: Win[];
  players: Player[];
  victoriesOnly?: boolean;
}) {
  const [selectedMetric, setMetric] = useState<"points" | "wins">("points");
  const metric = victoriesOnly ? "wins" : selectedMetric;
  // At most 32 date buckets; cumulative counts retain all matches without rendering thousands of points.
  const days = [...new Set(wins.map((w) => w.localDate))].sort();
  const step = Math.max(1, Math.ceil(days.length / 32));
  const dates = days.filter((_, i) => i % step === 0 || i === days.length - 1);
  const series = players.map((p) => {
    let n = 0;
    const counts = new Map<string, number>();
    for (const w of wins) {
      const value =
        metric === "points" ? pointsFor(w, p.id) : w.playerId === p.id ? 1 : 0;
      counts.set(w.localDate, (counts.get(w.localDate) ?? 0) + value);
    }
    const totals = new Map<string, number>();
    for (const day of days) {
      n += counts.get(day) ?? 0;
      totals.set(day, n);
    }
    return { p, points: dates.map((day) => totals.get(day) ?? 0) };
  });
  const maximum = Math.max(1, ...series.flatMap((s) => s.points));
  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <h2>Evolución de {metric === "points" ? "puntos" : "victorias"}</h2>
        {!victoriesOnly && (
          <div className="metric-switch">
            <button
              aria-pressed={metric === "points"}
              onClick={() => setMetric("points")}
            >
              Puntos
            </button>
            <button
              aria-pressed={metric === "wins"}
              onClick={() => setMetric("wins")}
            >
              Victorias
            </button>
          </div>
        )}
      </div>
      {!wins.length ? (
        <Empty text="Registra tu primera partida para ver la evolución." />
      ) : (
        <>
          <svg
            viewBox="0 0 680 220"
            role="img"
            aria-label={`Evolución acumulada. ${series.map((s) => `${s.p.name}: ${s.points.at(-1)} ${metric === "points" ? "puntos" : "victorias"}`).join(". ")}`}
            className="chart"
          >
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line
                  x1="35"
                  y1={185 - t * 160}
                  x2="650"
                  y2={185 - t * 160}
                  stroke="#303139"
                  strokeDasharray="4 5"
                />
                <text x="4" y={190 - t * 160} fill="#999ba9" fontSize="12">
                  {Math.round(t * maximum)}
                </text>
              </g>
            ))}
            {series.map(({ p, points }) => (
              <g key={p.id}>
                <polyline
                  fill="none"
                  stroke={colors[indexOf(p.id)]}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  points={points
                    .map(
                      (v, i) =>
                        `${35 + (points.length === 1 ? 0.5 : i / (points.length - 1)) * 615},${185 - (v / maximum) * 160}`,
                    )
                    .join(" ")}
                />
                {points.map((v, i) => (
                  <circle
                    key={i}
                    cx={
                      35 +
                      (points.length === 1 ? 0.5 : i / (points.length - 1)) *
                        615
                    }
                    cy={185 - (v / maximum) * 160}
                    r="3.5"
                    fill={colors[indexOf(p.id)]}
                  />
                ))}
              </g>
            ))}
            <text x="35" y="214" fill="#999ba9" fontSize="12">
              {dateLabel(days[0])}
            </text>
            <text x="650" y="214" textAnchor="end" fill="#999ba9" fontSize="12">
              {dateLabel(days.at(-1)!)}
            </text>
          </svg>
          <div className="legend">
            {players.map((p) => (
              <span key={p.id}>
                <i style={{ background: colors[indexOf(p.id)] }} />
                {p.name}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Swords size={32} />
      <p>{text}</p>
    </div>
  );
}
export function WinRow({
  win,
  players,
  onEdit,
  onDelete,
}: {
  win: Win;
  players: Player[];
  onEdit: (w: Win) => void;
  onDelete: (w: Win) => void;
}) {
  return (
    <div className="win-row">
      <Portrait id={win.characterId} />
      <div className="win-detail">
        <strong>{nameOf(players, win.playerId)}</strong>
        <span>{fighterById.get(win.characterId)?.name}</span>
        <div className="podium-history">
          {win.placements ? (
            win.placements.map((id, index) => {
              const char = characterAt(win, index);
              return (
                <span className="podium-line" key={id}>
                  {char && <Portrait id={char} />}
                  <span>
                    {index + 1}.º {nameOf(players, id)} ·{" "}
                    {char ? fighterById.get(char)?.name : "Personaje pendiente"}
                  </span>
                  <b>{[3, 1, 0][index]} pts</b>
                </span>
              );
            })
          ) : (
            <span>3 puntos al ganador · podio pendiente</span>
          )}
        </div>
      </div>
      <div className="win-date">
        <span>{dateLabel(win.localDate)}</span>
        <small>{formatTime(win)}</small>
      </div>
      <button
        className="icon-button"
        aria-label={`Editar partida de ${nameOf(players, win.playerId)} del ${win.localDate}`}
        onClick={() => onEdit(win)}
      >
        <Pencil size={16} />
      </button>
      <button
        className="icon-button danger"
        aria-label="Eliminar partida"
        onClick={() => onDelete(win)}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
export function CharacterStat({
  id,
  count,
  wins,
  players,
  favorite,
  onFavorite,
}: {
  id: string;
  count: number;
  wins: Win[];
  players: Player[];
  favorite: boolean;
  onFavorite: () => void;
}) {
  const characterWins = wins.filter((w) => w.characterId === id);
  const entries = wins
    .flatMap(matchEntries)
    .filter((e) => e.characterId === id);
  const totalPoints = entries.reduce((n, e) => n + e.points, 0);
  return (
    <article className="character-stat">
      <div className="character-stat-top">
        <Portrait id={id} large />
        <button
          className={`icon-button favorite-button ${favorite ? "favorited" : ""}`}
          aria-label={`${favorite ? "Quitar de" : "Añadir a"} favoritos: ${fighterById.get(id)?.name}`}
          aria-pressed={favorite}
          onClick={onFavorite}
        >
          <Star size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
        <div>
          <span className="fighter-number">#{id.replace("e", "ε")}</span>
          <h3>{fighterById.get(id)?.name}</h3>
          <strong>
            {count} <small>{count === 1 ? "victoria" : "victorias"}</small>
          </strong>
        </div>
      </div>
      <p className="character-points">
        {totalPoints} puntos · {entries.length} participaciones conocidas
      </p>
      <div className="character-breakdown">
        {players.map((p) => {
          const n = characterWins.filter((w) => w.playerId === p.id).length;
          const total = wins.filter((w) => w.playerId === p.id).length;
          return (
            <div key={p.id}>
              <span>
                <i
                  className="color-dot"
                  style={{ background: colors[indexOf(p.id)] }}
                />
                {p.name}
              </span>
              <strong>
                {n}
                <small>
                  {" "}
                  ·{" "}
                  {total
                    ? ((n / total) * 100).toLocaleString("es", {
                        maximumFractionDigits: 1,
                      })
                    : "0"}
                  %
                </small>
              </strong>
            </div>
          );
        })}
      </div>
      <div className="character-positions">
        {players.map((p) => {
          const rows = entries.filter((e) => e.playerId === p.id);
          return (
            <p key={p.id}>
              {p.name}: {rows.reduce((n, e) => n + e.points, 0)} pts ·{" "}
              {rows.filter((e) => e.position === 1).length}/
              {rows.filter((e) => e.position === 2).length}/
              {rows.filter((e) => e.position === 3).length}{" "}
              <small>(1.º/2.º/3.º)</small>
            </p>
          );
        })}
      </div>
    </article>
  );
}
