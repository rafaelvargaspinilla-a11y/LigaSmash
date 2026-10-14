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
  const [character, setCharacter] = useState(editing?.characterId ?? "");
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
        .map((w) => w.characterId),
    ),
  ].slice(0, 8);
  const quick = [...new Set([...favorites, ...recent])].slice(0, 12);
  const visible = fighters.filter((f) =>
    normalize(f.name).includes(normalize(query)),
  );
  const tile = (id: string) => {
    const f = fighterById.get(id)!;
    return (
      <button
        key={id}
        type="button"
        className={`fighter-tile ${character === id ? "selected" : ""}`}
        aria-label={f.name}
        aria-pressed={character === id}
        onClick={() => setCharacter(id)}
      >
        <Portrait id={id} />
        <span>{f.name}</span>
        {character === id && <Check className="tile-check" size={16} />}
      </button>
    );
  };
  return (
    <Modal
      title={editing ? "Editar partida" : "¿Quién se lleva la victoria?"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!player || !character || busyRef.current) return;
          busyRef.current = true;
          setBusy(true);
          try {
            if (editing) {
              const date = new Date(time);
              await db.editWin(editing.id, player, character, date);
              onSaved({
                ...editing,
                playerId: player,
                characterId: character,
                timestamp: date.toISOString(),
                localDate: localDate(date),
              });
            } else onSaved(await db.addWin(player, character));
          } catch (e) {
            onError(errorText(e));
          } finally {
            busyRef.current = false;
            setBusy(false);
          }
        }}
      >
        <p className="step-label">
          01 <span>Selecciona al ganador</span>
        </p>
        <div className="player-picker">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              className={player === p.id ? "selected" : ""}
              style={
                {
                  "--player-color": colors[indexOf(p.id)],
                } as React.CSSProperties
              }
              aria-label={p.name}
              aria-pressed={player === p.id}
              onClick={() => setPlayer(p.id)}
            >
              <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
              {p.name}
            </button>
          ))}
        </div>
        <p className="step-label">
          02 <span>Elige su luchador</span>
        </p>
        <label className="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar entre 86 luchadores…"
            aria-label="Buscar luchador"
          />
        </label>
        {!query && quick.length > 0 && (
          <>
            <p className="section-label">Favoritos y recientes</p>
            <div className="fighter-grid quick-grid">{quick.map(tile)}</div>
          </>
        )}
        <p className="section-label">
          {query ? `${visible.length} resultados` : "Plantel completo"}{" "}
          <span>Retratos oficiales · plantel completo</span>
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
            {character
              ? fighterById.get(character)?.name
              : "Selecciona un luchador"}
          </span>
          <button className="primary" disabled={!player || !character || busy}>
            <Trophy size={18} />
            {busy
              ? "Guardando…"
              : editing
                ? "Guardar cambios"
                : "Registrar victoria"}
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
}: {
  wins: Win[];
  players: Player[];
}) {
  // At most 32 date buckets; cumulative counts retain all matches without rendering thousands of points.
  const days = [...new Set(wins.map((w) => w.localDate))].sort();
  const step = Math.max(1, Math.ceil(days.length / 32));
  const dates = days.filter((_, i) => i % step === 0 || i === days.length - 1);
  const series = players.map((p) => {
    let n = 0;
    const counts = new Map<string, number>();
    for (const w of wins)
      if (w.playerId === p.id)
        counts.set(w.localDate, (counts.get(w.localDate) ?? 0) + 1);
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
        <h2>Evolución de victorias</h2>
        <span className="muted">Acumuladas en el periodo</span>
      </div>
      {!wins.length ? (
        <Empty text="Registra tu primera partida para ver la evolución." />
      ) : (
        <>
          <svg
            viewBox="0 0 680 220"
            role="img"
            aria-label={`Evolución acumulada. ${series.map((s) => `${s.p.name}: ${s.points.at(-1)} victorias`).join(". ")}`}
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
    </article>
  );
}
