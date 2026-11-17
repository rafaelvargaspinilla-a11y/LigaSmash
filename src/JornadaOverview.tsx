import {
  jornadas,
  pointsFor,
  roundCharacters,
  duelPair,
  type Player,
  type Win,
} from "./model";
import { fighterById } from "./characters";
import { Portrait } from "./components";
export default function JornadaOverview({
  wins,
  players,
  onRecord,
  format = "classic",
  readOnly = false,
}: {
  wins: Win[];
  players: Player[];
  onRecord: () => void;
  format?: "classic" | "mixed";
  readOnly?: boolean;
}) {
  const all = jornadas(wins),
    latest = all.at(-1),
    complete = latest?.games.length === 10;
  const mixed = latest
    ? latest.games[0].jornada?.format === "mixed"
    : format === "mixed";
  const next =
    Array.from({ length: 10 }, (_, i) => i + 1).find(
      (n) => !latest?.games.some((w) => w.jornada!.game === n),
    ) ?? 1;
  return (
    <section className="panel jornada-panel" aria-label="Jornada de La liga">
      <div className="section-heading">
        <div>
          <p className="eyebrow">3 + 3 + {mixed ? "3 DUELOS" : "3"} + 1</p>
          <h2>
            {latest ? `Jornada ${all.length}` : "Vuestra primera jornada"}
          </h2>
        </div>
        <span className="tag">{latest?.games.length ?? 0} / 10 PARTIDAS</span>
      </div>
      <p className="muted">
        {mixed
          ? "Dos rondas de tres partidas con personajes fijos, tres duelos de 2 puntos y una final a seis vidas de 6 / 2 / 0 puntos."
          : "Tres rondas de tres partidas con personajes fijos. La partida final vale el doble."}
      </p>
      <div className="jornada-rounds">
        {[[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]].map((games, i) => {
          const chars = latest
            ? roundCharacters(latest.games, { id: latest.id, game: games[0] })
            : undefined;
          return (
            <div
              key={i}
              className={`jornada-round ${games.includes(next) && !complete ? "current-round" : ""}`}
            >
              <h3>
                {i === 3
                  ? "Ronda final · 6 vidas"
                  : i === 2 && mixed
                    ? "Ronda 3 · Duelos"
                    : `Ronda ${i + 1}`}
              </h3>
              <small>
                {i === 3
                  ? "6 / 2 / 0 puntos"
                  : i === 2 && mixed
                    ? "2 puntos al ganador · 0 al perdedor"
                    : "3 / 1 / 0 puntos"}
              </small>
              <div className="jornada-slots">
                {games.map((n) => {
                  const game = latest?.games.find((w) => w.jornada!.game === n);
                  return (
                    <span
                      key={n}
                      className={game ? "done" : ""}
                      aria-label={`Partida ${n}: ${game ? "registrada" : "pendiente"}`}
                    >
                      {n}
                      {game && " ✓"}
                    </span>
                  );
                })}
              </div>
              {mixed && i === 2 && (
                <div className="jornada-pairs">
                  {games.map((n) => (
                    <p key={n}>
                      {duelPair(n)
                        .map((id) => players.find((p) => p.id === id)?.name)
                        .join(" vs ")}
                    </p>
                  ))}
                </div>
              )}
              {chars ? (
                <div className="jornada-roster">
                  {players
                    .filter((p) => chars[p.id])
                    .map((p) => (
                      <div key={p.id}>
                        <Portrait id={chars[p.id]!} />
                        <span>
                          {p.name}
                          <small>{fighterById.get(chars[p.id]!)?.name}</small>
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="muted">
                  {i === 3
                    ? "Nueva elección de personajes"
                    : "Elegid personajes al empezar"}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {latest && (
        <div className="jornada-scores">
          {players.map((p) => (
            <span key={p.id}>
              {p.name}
              <strong>
                {latest.games.reduce((sum, w) => sum + pointsFor(w, p.id), 0)}{" "}
                pts
              </strong>
            </span>
          ))}
        </div>
      )}
      {!readOnly && (
        <button className="primary" onClick={onRecord}>
          {complete
            ? "Empezar nueva jornada"
            : `Registrar partida ${latest ? next : 1} de 10`}
        </button>
      )}
    </section>
  );
}
