import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Trophy,
  Plus,
  BarChart3,
  Users,
  History,
  Settings,
  Star,
  X,
  Download,
  Upload,
  Trash2,
  Swords,
  Check,
  ArrowUpRight,
  Undo2,
  Search,
} from "lucide-react";
import { db } from "./db";
import { fighters, fighterById, normalize } from "./characters";
import {
  filterPeriod,
  localDate,
  periods,
  periodBounds,
  statistics,
  type Win,
  type Period,
} from "./model";
import {
  Modal,
  WinForm,
  PeriodFilter,
  Evolution,
  Empty,
  WinRow,
  CharacterStat,
} from "./components";
import { colors, nameOf, indexOf, dateLabel, errorText } from "./ui";
import DuelLeague from "./DuelLeague";
import JornadaOverview from "./JornadaOverview";
import SharedSettings from "./SharedSettings";
import {
  subscribeSync,
  getSyncStatus,
  restoreConnection,
  synchronize,
} from "./sync";
type Page = "home" | "stats" | "characters" | "history" | "duel";
export default function App() {
  const syncState = useSyncExternalStore(subscribeSync, getSyncStatus);
  useEffect(() => {
    void restoreConnection();
    const timer = setInterval(() => void synchronize(), 5000);
    const refresh = () => void synchronize();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    setLastSaved(undefined);
    setEditing(undefined);
    setShowWin(false);
  }, [syncState.databaseName]);
  const data = useLiveQuery(
    async () =>
      db.transaction("r", db.players, db.wins, db.preferences, async () => ({
        databaseName: db.name,
        players: await db.players.toArray(),
        wins: await db.wins.toArray(),
        favorites: (await db.preferences.get("main"))?.favorites ?? [],
      })),
    [syncState.databaseName],
  );
  const [dbError, setDbError] = useState("");
  useEffect(() => {
    const target = db;
    target
      .open()
      .then(() => target.ensureFixedPlayers())
      .then(() => synchronize())
      .catch((e) => setDbError(errorText(e)));
  }, [syncState.databaseName]);
  const [charactersLeague, setCharactersLeague] = useState<"trio" | "duel">(
    "trio",
  );
  const [historyLeague, setHistoryLeague] = useState<"trio" | "duel">("trio");
  const [statsLeague, setStatsLeague] = useState<"trio" | "duel">("trio");
  const [page, setPage] = useState<Page>("home");
  const [period, setPeriod] = useState<Period>("all");
  const [custom, setCustom] = useState<[string, string]>([
    localDate(new Date()),
    localDate(new Date()),
  ]);
  const [showWin, setShowWin] = useState(false);
  const [editing, setEditing] = useState<Win>();
  const [settings, setSettings] = useState(false);
  const [deleting, setDeleting] = useState<Win>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState<string>();
  const [undoBusy, setUndoBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [characterQuery, setCharacterQuery] = useState("");
  const [historyPlayer, setHistoryPlayer] = useState("");
  const [historyCharacter, setHistoryCharacter] = useState("");
  const [historyLimit, setHistoryLimit] = useState(50);
  const [pendingImport, setPendingImport] = useState<unknown>();
  const fileRef = useRef<HTMLInputElement>(null);
  const players = data?.players ?? [];
  const allWins = data?.wins ?? [];
  const wins = useMemo(
    () => allWins.filter((w) => w.league !== "duel"),
    [allWins],
  );
  const favorites = data?.favorites ?? [];
  const [today, setToday] = useState(localDate(new Date()));
  useEffect(() => {
    const refresh = () => setToday(localDate(new Date()));
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const filtered = useMemo(
    () => filterPeriod(wins, periodBounds(period, new Date(), custom)),
    [wins, period, custom, today],
  );
  const stats = useMemo(
    () => statistics(filtered, players),
    [filtered, players],
  );
  const plantelWins = useMemo(
    () =>
      filterPeriod(
        allWins.filter((w) =>
          charactersLeague === "duel"
            ? w.league === "duel"
            : w.league !== "duel",
        ),
        periodBounds(period, new Date(), custom),
      ),
    [allWins, charactersLeague, period, custom, today],
  );
  const playedCharacters = useMemo(
    () =>
      new Set(
        plantelWins.flatMap((w) =>
          w.league === "duel"
            ? [w.characterId, w.opponentCharacterId ?? ""]
            : (w.characters ?? [w.characterId]),
        ),
      ),
    [plantelWins],
  );
  const plantelVictories = new Map<string, number>();
  for (const w of plantelWins)
    if (w.characterId)
      plantelVictories.set(
        w.characterId,
        (plantelVictories.get(w.characterId) ?? 0) + 1,
      );
  const allStats = useMemo(() => statistics(wins, players), [wins, players]);
  const latest = useMemo(
    () =>
      [...wins].sort(
        (a, b) =>
          b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id),
      ),
    [wins],
  );
  const duelHistoryCount = filteredDuelCount();
  function filteredDuelCount() {
    return filterPeriod(
      allWins.filter((w) => w.league === "duel"),
      periodBounds(period, new Date(), custom),
    ).filter(
      (w) =>
        (!historyPlayer || w.playerId === historyPlayer) &&
        (!historyCharacter ||
          w.characterId === historyCharacter ||
          w.opponentCharacterId === historyCharacter),
    ).length;
  }
  const history = useMemo(
    () =>
      [...filtered]
        .filter(
          (w) =>
            (!historyPlayer || w.playerId === historyPlayer) &&
            (!historyCharacter ||
              (w.characters ?? [w.characterId]).includes(historyCharacter)),
        )
        .sort(
          (a, b) =>
            b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id),
        ),
    [filtered, historyPlayer, historyCharacter],
  );
  useEffect(
    () => setHistoryLimit(50),
    [period, custom, historyPlayer, historyCharacter],
  );
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(""), 7000);
      return () => clearTimeout(id);
    }
  }, [notice]);
  const notify = (message: string) => {
    void synchronize();
    setError("");
    setNotice(message);
  };
  const save = (w: Win) => {
    if (!editing) setLastSaved(w.id);
    setShowWin(false);
    setEditing(undefined);
    notify(
      editing
        ? "Partida actualizada"
        : "¡Partida registrada! El ranking ya está actualizado.",
    );
  };
  async function undo() {
    if (!lastSaved || undoBusy) return;
    setUndoBusy(true);
    try {
      await db.deleteWin(lastSaved);
      setLastSaved(undefined);
      notify("Última victoria deshecha.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUndoBusy(false);
    }
  }
  async function exportData() {
    try {
      const backup = await db.exportBackup();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `smash-tracker-${localDate(new Date())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Copia de seguridad exportada.");
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function importData() {
    if (importBusy) return;
    setImportBusy(true);
    try {
      const result = await db.importBackup(pendingImport);
      setPendingImport(undefined);
      notify(
        `Importación completa: ${result.added} nuevas, ${result.duplicates} duplicadas omitidas.`,
      );
    } catch (e) {
      setError(errorText(e));
      setPendingImport(undefined);
    } finally {
      setImportBusy(false);
    }
  }
  async function toggleFavorite(id: string) {
    try {
      await db.transaction("rw", db.preferences, async () => {
        const current = (await db.preferences.get("main"))?.favorites ?? [];
        await db.preferences.put({
          id: "main",
          favorites: current.includes(id)
            ? current.filter((f) => f !== id)
            : [...current, id],
        });
      });
    } catch (e) {
      setError(errorText(e));
    }
  }
  const navigation: [Page, string, typeof Trophy][] = [
    ["home", "LaLiga", Trophy],
    ["duel", "1vs1", Swords],
    ["stats", "Estadísticas", BarChart3],
    ["characters", "Personajes", Users],
    ["history", "Historial", History],
  ];
  if (dbError)
    return (
      <main className="onboarding">
        <h1>No podemos abrir tus datos</h1>
        <p role="alert">{dbError}</p>
        <p>
          Comprueba que el navegador permite el almacenamiento del sitio. No se
          han borrado tus partidas.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Reintentar
        </button>
      </main>
    );
  if (
    !data ||
    data.databaseName !== syncState.databaseName ||
    data.players.length !== 3
  )
    return (
      <main className="onboarding">
        <h1>Smash Tracker</h1>
        <p>Cargando tus partidas…</p>
      </main>
    );
  return (
    <>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("home");
          }}
        >
          <span className="brand-mark">
            <span aria-hidden="true">S</span>
          </span>
          <span>
            SMASH<small>TRACKER</small>
          </span>
        </a>
        <div className="nav-label">TU ARENA</div>
        <nav>
          {navigation.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={20} />
              {label}
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-badge">
            <span />
            {syncState.connected
              ? syncState.pending
                ? "Cambios pendientes"
                : "Grupo compartido"
              : "Guardado en este dispositivo"}
          </div>
          <button onClick={() => setSettings(true)}>
            <Settings size={19} />
            Ajustes
          </button>
          <p>Sin cuentas. Solo partidas.</p>
        </div>
      </aside>
      <div className="app-shell">
        <header className="topbar">
          <span className="topbar-label">SUPER SMASH BROS. ULTIMATE</span>
          <div>
            <span className="offline-pill">
              <span />{" "}
              {syncState.connected ? "GRUPO COMPARTIDO" : "LOCAL & OFFLINE"}
            </span>
            <button
              className="icon-button"
              aria-label="Abrir ajustes"
              onClick={() => setSettings(true)}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {page === "home"
                  ? "CADA PARTIDA CUENTA"
                  : "TU GRUPO, EN NÚMEROS"}
              </p>
              <h1>
                {
                  {
                    duel: "La liga 1vs1.",
                    home: "La liga.",
                    stats: "Las estadísticas.",
                    characters: "El plantel.",
                    history: "El historial.",
                  }[page]
                }
              </h1>
              <p className="muted">
                {
                  {
                    duel: "Duelos entre amigos. Cada victoria cuenta en su propia liga.",
                    home: "Tres jugadores. Diez partidas. Una jornada para decidirlo.",
                    stats: "Descubre quién domina y cómo cambia la partida.",
                    characters: "Los luchadores que os llevan a la victoria.",
                    history:
                      "Cada victoria tiene su historia. Aquí están todas.",
                  }[page]
                }
              </p>
            </div>
            {page === "home" && (
              <button
                className="primary"
                onClick={() => setShowWin(true)}
                disabled={players.length !== 3}
              >
                <Plus size={20} />
                Registrar partida
              </button>
            )}
          </div>
          {page === "stats" && (
            <div
              className="league-filter"
              role="group"
              aria-label="Liga de estadísticas"
            >
              <button
                className={`secondary ${statsLeague === "trio" ? "selected" : ""}`}
                aria-pressed={statsLeague === "trio"}
                onClick={() => setStatsLeague("trio")}
              >
                La liga
              </button>
              <button
                className={`secondary ${statsLeague === "duel" ? "selected" : ""}`}
                aria-pressed={statsLeague === "duel"}
                onClick={() => setStatsLeague("duel")}
              >
                1vs1
              </button>
            </div>
          )}
          {page === "history" && (
            <div
              className="league-filter"
              role="group"
              aria-label="Liga del historial"
            >
              <button
                className={`secondary ${historyLeague === "trio" ? "selected" : ""}`}
                aria-pressed={historyLeague === "trio"}
                onClick={() => setHistoryLeague("trio")}
              >
                La liga
              </button>
              <button
                className={`secondary ${historyLeague === "duel" ? "selected" : ""}`}
                aria-pressed={historyLeague === "duel"}
                onClick={() => setHistoryLeague("duel")}
              >
                1vs1
              </button>
            </div>
          )}
          {page === "characters" && (
            <div
              className="league-filter"
              role="group"
              aria-label="Liga de personajes"
            >
              <button
                className={`secondary ${charactersLeague === "trio" ? "selected" : ""}`}
                aria-pressed={charactersLeague === "trio"}
                onClick={() => setCharactersLeague("trio")}
              >
                La liga
              </button>
              <button
                className={`secondary ${charactersLeague === "duel" ? "selected" : ""}`}
                aria-pressed={charactersLeague === "duel"}
                onClick={() => setCharactersLeague("duel")}
              >
                1vs1
              </button>
            </div>
          )}
          {page !== "home" && page !== "duel" && (
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
          {page === "home" && (
            <JornadaOverview
              wins={wins}
              players={players}
              onRecord={() => setShowWin(true)}
            />
          )}
          {(page === "home" ||
            (page === "stats" && statsLeague === "trio")) && (
            <>
              <div className="summary-grid">
                <section className="summary-card">
                  <div className="summary-icon">
                    <Swords size={21} />
                  </div>
                  <span>
                    Partidas {page === "home" ? "registradas" : "del periodo"}
                  </span>
                  <strong>
                    {(page === "home" ? allStats : stats).total.toLocaleString(
                      "es",
                    )}
                  </strong>
                  <small>Siempre entre los tres jugadores</small>
                </section>
                <section className="summary-card leader-card">
                  <div className="summary-icon gold">
                    <Trophy size={21} />
                  </div>
                  <span>
                    {(page === "home" ? allStats : stats).leaders.length > 1
                      ? "Liderato compartido"
                      : "Líder actual"}
                  </span>
                  <strong className="text-value">
                    {(page === "home" ? allStats : stats).leaders
                      .map((p) => p.name)
                      .join(" · ") || "Por decidir"}
                  </strong>
                  <small>
                    {(page === "home" ? allStats : stats).leaders.length
                      ? "3 / 1 / 0 · Final de jornada 6 / 2 / 0"
                      : "La primera victoria puede ser tuya"}
                  </small>
                </section>
                <section className="summary-card">
                  <div className="summary-icon gold">
                    <Star size={21} />
                  </div>
                  <span>
                    {page === "home" ? "Luchador más ganador" : "Racha máxima"}
                  </span>
                  <strong className={page === "home" ? "text-value" : ""}>
                    {page === "home"
                      ? allStats.topCharacters
                          .map(([id]) => fighterById.get(id)?.name)
                          .join(" · ") || "Por descubrir"
                      : stats.maxStreak}
                  </strong>
                  <small>
                    {page === "home"
                      ? "Por victorias registradas"
                      : "Victorias consecutivas en el periodo"}
                  </small>
                </section>
              </div>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    {page === "home"
                      ? "LA RIVALIDAD"
                      : "EL PERIODO SELECCIONADO"}
                  </p>
                  <h2>Ranking por puntos</h2>
                </div>
                <span className="tag">
                  {page === "home"
                    ? "HISTÓRICO"
                    : periods[period].toUpperCase()}
                </span>
              </div>
              {(page === "home" ? allStats : stats).incomplete > 0 && (
                <p className="legacy-note">
                  {(page === "home" ? allStats : stats).incomplete} partidas
                  antiguas sin podio completo. El ganador suma 3 puntos;
                  completa segundo y tercero desde Historial para añadir el
                  punto restante.
                </p>
              )}
              {(page === "home" ? allStats : stats).incompleteCharacters >
                (page === "home" ? allStats : stats).incomplete && (
                <p className="legacy-note">
                  Hay partidas con puestos registrados pero personajes
                  pendientes. Puedes completarlos desde Historial.
                </p>
              )}
              <div className="ranking-grid">
                {(page === "home" ? allStats : stats).ranking.map(
                  (p, _index, arr) => {
                    const rank =
                      arr.filter((x) => x.points > p.points).length + 1;
                    const leader = p.points > 0 && rank === 1;
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
                              {arr.filter((x) => x.points === p.points).length >
                              1
                                ? "EMPATE"
                                : "LÍDER"}
                            </span>
                          ) : (
                            <span className="tag">
                              JUGADOR {indexOf(p.id) + 1}
                            </span>
                          )}
                        </div>
                        <div className="player-identity">
                          <span className="avatar">
                            {p.name.slice(0, 1).toUpperCase()}
                          </span>
                          <h3>{p.name}</h3>
                        </div>
                        <div className="player-points">
                          <strong>{p.points.toLocaleString("es")}</strong>
                          <span>puntos</span>
                        </div>
                        <div className="player-numbers">
                          <div>
                            <strong>{p.wins.toLocaleString("es")}</strong>
                            <span>victorias</span>
                          </div>
                          <div>
                            <strong>
                              {p.percent.toLocaleString("es", {
                                maximumFractionDigits: 1,
                              })}
                              <small>%</small>
                            </strong>
                            <span>de las partidas</span>
                          </div>
                        </div>
                        <div className="progress-track">
                          <div style={{ width: `${p.percent}%` }} />
                        </div>
                        <div className="position-counts">
                          <span>1.º {p.wins}</span>
                          <span>2.º {p.seconds}</span>
                          <span>3.º {p.thirds}</span>
                        </div>
                        <div className="card-foot">
                          <span>Mejor racha</span>
                          <strong>{p.streak} seguidas</strong>
                        </div>
                      </section>
                    );
                  },
                )}
              </div>
              {page === "stats" && (
                <>
                  <Evolution wins={filtered} players={players} />
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Luchadores del periodo</h2>
                      <span className="muted">Victorias, no tasa de éxito</span>
                    </div>
                    {stats.total ? (
                      <div className="character-stats-grid">
                        {stats.characterPointsRanking.map(([id]) => (
                          <CharacterStat
                            key={id}
                            id={id}
                            count={
                              stats.characterRanking.find(
                                ([char]) => char === id,
                              )?.[1] ?? 0
                            }
                            wins={filtered}
                            players={players}
                            favorite={favorites.includes(id)}
                            onFavorite={() => toggleFavorite(id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty text="No hay partidas en este periodo. Prueba otro filtro." />
                    )}
                  </section>
                </>
              )}
              {page === "home" && (
                <div className="home-bottom">
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Últimas partidas</h2>
                      <button
                        className="text-button"
                        onClick={() => setPage("history")}
                      >
                        Ver todas
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                    {latest.length ? (
                      latest
                        .slice(0, 5)
                        .map((w) => (
                          <WinRow
                            key={w.id}
                            win={w}
                            players={players}
                            onEdit={setEditing}
                            onDelete={setDeleting}
                          />
                        ))
                    ) : (
                      <Empty text="La arena está lista. Registra vuestra primera victoria." />
                    )}
                  </section>
                  <section className="arena-callout">
                    <span className="eyebrow">QUE EMPIECE LA PARTIDA</span>
                    <Swords size={52} strokeWidth={1.2} />
                    <h2>
                      Una más.
                      <br />Y esta la gano yo.
                    </h2>
                    <p>
                      Elige ganador y luchador.
                      <br />
                      Nosotros llevamos la cuenta.
                    </p>
                    <button
                      className="primary"
                      onClick={() => setShowWin(true)}
                      disabled={players.length !== 3}
                    >
                      <Plus size={18} />
                      Nueva partida
                    </button>
                  </section>
                </div>
              )}
            </>
          )}
          {page === "characters" && (
            <>
              <div className="panel favorites-panel">
                <h2>El favorito de cada jugador</h2>
                <p className="muted">
                  Su luchador con más victorias. Los empates se muestran juntos.
                </p>
                <div className="favorite-players">
                  {players.map((p) => {
                    const counts = new Map<string, number>();
                    for (const w of plantelWins.filter(
                      (w) => w.playerId === p.id && w.characterId,
                    ))
                      counts.set(
                        w.characterId,
                        (counts.get(w.characterId) ?? 0) + 1,
                      );
                    const maximum = Math.max(0, ...counts.values());
                    const topCharacters = [...counts].filter(
                      ([, n]) => n === maximum,
                    );
                    return (
                      <div key={p.id}>
                        <span
                          className="color-dot"
                          style={{ background: colors[indexOf(p.id)] }}
                        />
                        <strong>{p.name}</strong>
                        <p>
                          {topCharacters
                            .map(([id]) => fighterById.get(id)?.name)
                            .join(" · ") || "Todavía sin victorias"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="section-heading">
                <h2>
                  Ranking de luchadores por{" "}
                  {charactersLeague === "duel" ? "victorias" : "puntos"}
                </h2>
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder="Buscar luchador"
                    aria-label="Buscar en estadísticas de personajes"
                    value={characterQuery}
                    onChange={(e) => setCharacterQuery(e.target.value)}
                  />
                </label>
              </div>
              <p className="muted small-note">
                {charactersLeague === "duel"
                  ? "Las victorias y derrotas cuentan los personajes registrados en los duelos. Los porcentajes muestran la aportación a las victorias de cada jugador."
                  : "Los puntos cuentan los puestos registrados. Los porcentajes muestran la aportación de cada personaje a las victorias de su jugador."}
              </p>
              <div className="character-stats-grid">
                {[...fighters]
                  .filter(
                    (f) =>
                      playedCharacters.has(f.id) &&
                      normalize(f.name).includes(normalize(characterQuery)),
                  )
                  .sort((a, b) =>
                    charactersLeague === "duel"
                      ? (plantelVictories.get(b.id) ?? 0) -
                        (plantelVictories.get(a.id) ?? 0)
                      : (stats.characterPointsRanking.find(
                          ([id]) => id === b.id,
                        )?.[1] ?? 0) -
                        (stats.characterPointsRanking.find(
                          ([id]) => id === a.id,
                        )?.[1] ?? 0),
                  )
                  .map((f) => (
                    <CharacterStat
                      key={f.id}
                      id={f.id}
                      count={plantelVictories.get(f.id) ?? 0}
                      wins={plantelWins}
                      duel={charactersLeague === "duel"}
                      players={players}
                      favorite={favorites.includes(f.id)}
                      onFavorite={() => toggleFavorite(f.id)}
                    />
                  ))}
              </div>
              {!fighters.some(
                (f) =>
                  playedCharacters.has(f.id) &&
                  normalize(f.name).includes(normalize(characterQuery)),
              ) && (
                <Empty text="No hay personajes jugados que coincidan con estos filtros." />
              )}
            </>
          )}
          {page === "history" && (
            <>
              <div className="history-filters">
                <label>
                  Ganador
                  <select
                    value={historyPlayer}
                    onChange={(e) => setHistoryPlayer(e.target.value)}
                  >
                    <option value="">Todos los jugadores</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Luchador
                  <select
                    value={historyCharacter}
                    onChange={(e) => setHistoryCharacter(e.target.value)}
                  >
                    <option value="">Todos los luchadores</option>
                    {fighters.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="muted">
                  {historyLeague === "trio" ? history.length : duelHistoryCount}{" "}
                  partidas
                </span>
              </div>
              {historyLeague === "trio" && (
                <section className="panel history-panel">
                  {history.length ? (
                    history
                      .slice(0, historyLimit)
                      .map((w) => (
                        <WinRow
                          key={w.id}
                          win={w}
                          players={players}
                          onEdit={setEditing}
                          onDelete={setDeleting}
                        />
                      ))
                  ) : (
                    <Empty text="No hay partidas que coincidan con estos filtros." />
                  )}
                  {history.length > historyLimit && (
                    <button
                      className="secondary full"
                      onClick={() => setHistoryLimit((n) => n + 50)}
                    >
                      Mostrar 50 más ({history.length - historyLimit}{" "}
                      pendientes)
                    </button>
                  )}
                </section>
              )}
              {historyLeague === "duel" && (
                <DuelLeague
                  players={players}
                  wins={allWins}
                  onChange={notify}
                  databaseName={syncState.databaseName}
                  historyOnly
                  selectedPeriod={period}
                  selectedCustom={custom}
                  selectedPlayer={historyPlayer}
                  selectedCharacter={historyCharacter}
                />
              )}
            </>
          )}
          {page === "stats" && statsLeague === "duel" && (
            <DuelLeague
              players={players}
              wins={allWins}
              onChange={notify}
              databaseName={syncState.databaseName}
              statisticsOnly
              selectedPeriod={period}
              selectedCustom={custom}
            />
          )}
          {page === "duel" && (
            <DuelLeague
              players={players}
              wins={allWins}
              onChange={notify}
              databaseName={syncState.databaseName}
            />
          )}
          <footer className="page-footer">
            <span>SMASH TRACKER</span>
            <span>
              {syncState.connected
                ? "Grupo compartido · " + syncState.message
                : "Modo local. Conecta un grupo en Ajustes para compartir partidas."}
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Navegación principal">
        {navigation.map(([id, label, Icon]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            aria-current={page === id ? "page" : undefined}
            onClick={() => setPage(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {(showWin || editing) && players.length === 3 && (
        <WinForm
          players={players}
          wins={wins}
          favorites={favorites}
          editing={editing}
          onSaved={save}
          onClose={() => {
            setShowWin(false);
            setEditing(undefined);
          }}
          onError={setError}
        />
      )}
      {settings && pendingImport === undefined && (
        <Modal title="Ajustes de la arena" onClose={() => setSettings(false)}>
          <h3>Los tres jugadores</h3>
          <p className="muted">
            {players.map((p) => p.name).join(" · ")}. Siempre los mismos tres
            jugadores.
          </p>
          <SharedSettings onError={setError} onNotice={notify} />
          <div className="settings-section">
            <h3>Tus datos, bajo tu control</h3>
            <p className="muted">
              {syncState.connected
                ? "Las partidas de este grupo se sincronizan cada pocos segundos con Supabase. Sin conexión, los cambios quedan pendientes en este dispositivo. Conserva el código del grupo para volver a entrar."
                : "Tus partidas se guardan en este navegador. Para compartirlas, conecta un grupo arriba."}{" "}
              Exporta una copia periódicamente.
            </p>
            <div className="button-row">
              <button className="secondary" onClick={exportData}>
                <Download size={18} />
                Exportar JSON
              </button>
              <button
                className="secondary"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={18} />
                Importar JSON
              </button>
            </div>
            <p className="small-note muted">
              La importación fusiona registros por ID y conserva los nombres
              actuales. Úsala solo para el mismo grupo de tres jugadores.
            </p>
          </div>
          <div className="settings-section">
            <h3>Instalar en el móvil</h3>
            <p className="muted">
              En Safari: Compartir → Añadir a pantalla de inicio. En Android:
              menú del navegador → Instalar aplicación. Abre primero la
              aplicación con conexión para disponer de ella sin conexión.
            </p>
          </div>
          <div className="settings-section">
            <h3>Retratos de luchadores</h3>
            <p className="muted">
              El plantel completo incluye retratos oficiales guardados dentro de
              la aplicación para utilizarlos también sin conexión.
            </p>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="¿Eliminar esta partida?"
          onClose={() => {
            if (!deleteBusy) setDeleting(undefined);
          }}
        >
          <p>
            La victoria de <strong>{nameOf(players, deleting.playerId)}</strong>{" "}
            con {fighterById.get(deleting.characterId)?.name} del{" "}
            {dateLabel(deleting.localDate)} se eliminará de todas las
            estadísticas.
          </p>
          <div className="button-row">
            <button
              className="secondary"
              disabled={deleteBusy}
              onClick={() => setDeleting(undefined)}
            >
              Cancelar
            </button>
            <button
              className="primary"
              disabled={deleteBusy}
              onClick={async () => {
                setDeleteBusy(true);
                try {
                  await db.deleteWin(deleting.id);
                  if (lastSaved === deleting.id) setLastSaved(undefined);
                  setDeleting(undefined);
                  notify("Partida eliminada.");
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setDeleteBusy(false);
                }
              }}
            >
              <Trash2 size={18} />
              {deleteBusy ? "Eliminando…" : "Eliminar partida"}
            </button>
          </div>
        </Modal>
      )}
      {pendingImport !== undefined && (
        <Modal
          title="Importar copia de seguridad"
          onClose={() => {
            if (!importBusy) setPendingImport(undefined);
          }}
        >
          <p>
            Se añadirán las partidas nuevas y se omitirán los IDs ya existentes.
            Si un ID tiene datos distintos, se cancelará toda la importación.
            Los nombres actuales se conservarán.
          </p>
          <p className="muted">
            Confirma que esta copia corresponde al mismo grupo de tres
            jugadores.
          </p>
          <div className="button-row">
            <button
              className="secondary"
              disabled={importBusy}
              onClick={() => setPendingImport(undefined)}
            >
              Cancelar
            </button>
            <button
              className="primary"
              disabled={importBusy}
              onClick={importData}
            >
              {importBusy ? "Importando…" : "Importar partidas"}
            </button>
          </div>
        </Modal>
      )}
      <input
        className="sr-only"
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        aria-label="Archivo de copia de seguridad"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 30 * 1024 * 1024)
              throw new Error("La copia supera el límite de 30 MB.");
            const parsed: unknown = JSON.parse(await file.text());
            setPendingImport(parsed);
          } catch (e) {
            setError(errorText(e));
          }
        }}
      />
      {(notice || lastSaved) && !error && (
        <div className="toast" role="status">
          <Check size={20} />
          <span>{notice || "Última victoria guardada"}</span>
          {lastSaved && (
            <button disabled={undoBusy} onClick={undo}>
              <Undo2 size={16} />
              Deshacer
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Cerrar aviso"
            onClick={() => {
              setNotice("");
              setLastSaved(undefined);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <div className="toast error-toast" role="alert">
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="Cerrar error"
            onClick={() => setError("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
