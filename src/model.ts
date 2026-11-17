import { fighterById } from "./characters";
export const playerIds = ["p1", "p2", "p3"] as const;
export type PlayerId = (typeof playerIds)[number];
export interface Player {
  id: PlayerId;
  name: string;
}
export const fixedPlayers: Player[] = [
  { id: "p1", name: "Rafa" },
  { id: "p2", name: "Carlos" },
  { id: "p3", name: "Andrés" },
];
export function fixedPlayerNames(current: Player[]): Player[] {
  // Canonicalize spelling while preserving existing assignments and statistics.
  const canonical = (name: string) => {
    const value = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    return value === "rafa" || value === "rafael"
      ? "Rafa"
      : value === "carlos"
        ? "Carlos"
        : value === "andres"
          ? "Andrés"
          : undefined;
  };
  const mapped = current.map((p) => ({ ...p, name: canonical(p.name) }));
  if (
    mapped.length === 3 &&
    fixedPlayers.every((p) => mapped.some((c) => c.name === p.name))
  )
    return mapped as Player[];
  return fixedPlayers.map((p) => ({ ...p }));
}
export type MatchCharacters = [string, string, string];
export type Placements = [PlayerId, PlayerId, PlayerId];
export interface Season {
  id: string;
  name: string;
  closed: boolean;
  format: "classic" | "mixed";
}
export const firstSeason: Season = {
  id: "season-1",
  name: "Temporada 1",
  closed: false,
  format: "classic",
};
export const sameSeason = (a: Season, b: Season) =>
  a.id === b.id &&
  a.name === b.name &&
  a.closed === b.closed &&
  a.format === b.format;
export const seasonsOf = (b: Pick<Backup, "seasons">): Season[] =>
  b.seasons ?? [{ ...firstSeason }];
export const seasonOf = (w: Win) => w.seasonId ?? firstSeason.id;
export const isJornadaDuel = (w: Pick<Win, "jornada">) =>
  w.jornada?.format === "mixed" && w.jornada.game >= 7 && w.jornada.game <= 9;
export const duelPair = (game: number): readonly PlayerId[] =>
  game === 7 ? ["p1", "p2"] : game === 8 ? ["p1", "p3"] : ["p2", "p3"];
export interface Win {
  id: string;
  playerId: PlayerId;
  characterId: string;
  timestamp: string;
  localDate: string;
  league?: "duel";
  opponentId?: PlayerId;
  opponentCharacterId?: string;
  seasonId?: string;
  jornada?: { id: string; game: number; format?: "mixed" };
  placements?: Placements;
  characters?: MatchCharacters;
}
export interface Preferences {
  id: "main";
  favorites: string[];
}
export interface Backup {
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6;
  seasons?: Season[];
  exportedAt: string;
  players: Player[];
  wins: Win[];
  favorites: string[];
}
export type Period =
  | "today"
  | "yesterday"
  | "week"
  | "lastWeek"
  | "month"
  | "lastMonth"
  | "all"
  | "custom";
export const periods: Record<Period, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  week: "Esta semana",
  lastWeek: "Semana anterior",
  month: "Este mes",
  lastMonth: "Mes anterior",
  all: "Todo el histórico",
  custom: "Intervalo personalizado",
};
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function periodBounds(
  period: Period,
  now = new Date(),
  custom?: [string, string],
): [string, string] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  switch (period) {
    case "today":
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case "week":
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      break;
    case "lastWeek":
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      break;
    case "month":
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
      break;
    case "lastMonth":
      start.setMonth(start.getMonth() - 1, 1);
      end.setDate(0);
      break;
    case "all":
      return ["0000-01-01", "9999-12-31"];
    case "custom":
      return custom ?? ["", ""];
  }
  return [localDate(start), localDate(end)];
}
export function filterPeriod(wins: Win[], bounds: [string, string]): Win[] {
  return wins.filter(
    (w) => w.localDate >= bounds[0] && w.localDate <= bounds[1],
  );
}
export function pointsFor(win: Win, player: PlayerId): number {
  if (win.league === "duel") return 0;
  if (isJornadaDuel(win)) return win.playerId === player ? 2 : 0;
  const multiplier = win.jornada?.game === 10 ? 2 : 1;
  return (
    (win.playerId === player ? 3 : win.placements?.[1] === player ? 1 : 0) *
    multiplier
  );
}
export function validCharacters(
  input: unknown,
  winnerCharacter: string,
): input is MatchCharacters {
  return (
    Array.isArray(input) &&
    input.length === 3 &&
    input.every((id) => typeof id === "string" && fighterById.has(id)) &&
    input[0] === winnerCharacter
  );
}
export function characterAt(win: Win, index: number): string | undefined {
  return win.characters?.[index] ?? (index === 0 ? win.characterId : undefined);
}
export function validPlacements(
  input: unknown,
  winner: PlayerId,
): input is Placements {
  return (
    Array.isArray(input) &&
    input.length === 3 &&
    new Set(input).size === 3 &&
    input.every((id) => playerIds.includes(id)) &&
    input[0] === winner
  );
}
export function statistics(wins: Win[], players: Player[]) {
  wins = wins.filter((w) => w.league !== "duel");
  const counts = new Map<PlayerId, number>(playerIds.map((id) => [id, 0]));
  const points = new Map<PlayerId, number>(playerIds.map((id) => [id, 0]));
  const seconds = new Map<PlayerId, number>(playerIds.map((id) => [id, 0]));
  const thirds = new Map<PlayerId, number>(playerIds.map((id) => [id, 0]));
  const characters = new Map<string, number>();
  const best = new Map<PlayerId, number>(playerIds.map((id) => [id, 0]));
  let previous: PlayerId | undefined;
  let streak = 0;
  const sorted = [...wins].sort(
    (a, b) =>
      a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id),
  );
  for (const w of sorted) {
    counts.set(w.playerId, (counts.get(w.playerId) ?? 0) + 1);
    characters.set(w.characterId, (characters.get(w.characterId) ?? 0) + 1);
    for (const id of playerIds)
      points.set(id, (points.get(id) ?? 0) + pointsFor(w, id));
    if (w.placements) {
      seconds.set(w.placements[1], (seconds.get(w.placements[1]) ?? 0) + 1);
      thirds.set(w.placements[2], (thirds.get(w.placements[2]) ?? 0) + 1);
    }
    streak = w.playerId === previous ? streak + 1 : 1;
    previous = w.playerId;
    best.set(w.playerId, Math.max(best.get(w.playerId) ?? 0, streak));
  }
  const ranking = players
    .map((p) => ({
      ...p,
      wins: counts.get(p.id) ?? 0,
      firsts: wins.filter((w) => w.playerId === p.id && !isJornadaDuel(w))
        .length,
      points: points.get(p.id) ?? 0,
      seconds: seconds.get(p.id) ?? 0,
      thirds: thirds.get(p.id) ?? 0,
      percent: wins.length ? ((counts.get(p.id) ?? 0) / wins.length) * 100 : 0,
      streak: best.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins);
  const max = ranking[0]?.points ?? 0;
  const maxWins = Math.max(0, ...counts.values());
  const characterRanking = [...characters].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  return {
    total: wins.length,
    ranking,
    leaders: max ? ranking.filter((p) => p.points === max) : [],
    victoryLeaders: maxWins ? ranking.filter((p) => p.wins === maxWins) : [],
    incomplete: wins.filter((w) => !w.placements && !isJornadaDuel(w)).length,
    incompleteCharacters: wins.filter((w) => !w.characters && !isJornadaDuel(w))
      .length,
    characterPointsRanking: [
      ...wins.reduce((map, w) => {
        for (const entry of matchEntries(w))
          map.set(
            entry.characterId,
            (map.get(entry.characterId) ?? 0) + entry.points,
          );
        return map;
      }, new Map<string, number>()),
    ].sort((a, b) => b[1] - a[1]),
    characterRanking,
    topCharacters: characterRanking.filter(
      ([, n]) => n === characterRanking[0]?.[1],
    ),
    maxStreak: Math.max(0, ...best.values()),
  };
}
export function makeWin(
  playerId: PlayerId,
  characterId: string,
  date = new Date(),
  placements?: Placements,
  characters?: MatchCharacters,
): Win {
  if (
    !playerIds.includes(playerId) ||
    !fighterById.has(characterId) ||
    !Number.isFinite(date.getTime()) ||
    (placements !== undefined && !validPlacements(placements, playerId)) ||
    (characters !== undefined &&
      (!placements || !validCharacters(characters, characterId)))
  )
    throw new Error("Victoria no válida");
  return {
    id: crypto.randomUUID(),
    playerId,
    characterId,
    timestamp: date.toISOString(),
    localDate: localDate(date),
    ...(placements ? { placements: [...placements] as Placements } : {}),
    ...(characters ? { characters: [...characters] as MatchCharacters } : {}),
  };
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 1900 || y > 9999) return false;
  const parsed = new Date(y, m - 1, d);
  return localDate(parsed) === value;
}
export function validateBackup(input: unknown): Backup {
  const fail = () => {
    throw new Error(
      "Copia no válida. Se requiere JSON de Smash Tracker con esquema 1 a 6 y datos correctos.",
    );
  };
  if (!input || typeof input !== "object") return fail();
  const b = input as Partial<Backup>;
  if (
    ![1, 2, 3, 4, 5, 6].includes(b.schemaVersion!) ||
    !Array.isArray(b.players) ||
    b.players.length !== 3 ||
    !Array.isArray(b.wins) ||
    !Array.isArray(b.favorites) ||
    typeof b.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(b.exportedAt))
  )
    return fail();
  const seasons = b.schemaVersion === 6 ? b.seasons : [{ ...firstSeason }];
  if (
    !Array.isArray(seasons) ||
    !seasons.length ||
    seasons.filter((s) => s && !s.closed).length !== 1 ||
    new Set(seasons.map((s) => s?.id)).size !== seasons.length ||
    seasons.some(
      (s) =>
        !s ||
        typeof s.id !== "string" ||
        !/^[a-z0-9-]{1,80}$/.test(s.id) ||
        typeof s.name !== "string" ||
        !s.name.trim() ||
        s.name.length > 60 ||
        typeof s.closed !== "boolean" ||
        !["classic", "mixed"].includes(s.format),
    ) ||
    !seasons.some((s) => s.id === firstSeason.id)
  )
    return fail();
  const ids = new Set<string>();
  const players = b.players.map((p) => {
    if (
      !p ||
      !playerIds.includes(p.id) ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 40
    )
      return fail();
    ids.add(p.id);
    return { id: p.id, name: p.name.trim() };
  });
  ids.clear();
  const wins = b.wins.map((w) => {
    if (
      !w ||
      typeof w.id !== "string" ||
      !w.id ||
      w.id.length > 100 ||
      ids.has(w.id) ||
      !playerIds.includes(w.playerId) ||
      (w.league === "duel"
        ? !(w.characterId === "" && w.opponentCharacterId === undefined) &&
          !(
            b.schemaVersion! >= 4 &&
            fighterById.has(w.characterId) &&
            fighterById.has(w.opponentCharacterId!)
          )
        : !fighterById.has(w.characterId)) ||
      (w.league !== undefined &&
        (w.league !== "duel" ||
          b.schemaVersion! < 3 ||
          !playerIds.includes(w.opponentId!) ||
          w.opponentId === w.playerId ||
          w.placements !== undefined ||
          w.characters !== undefined)) ||
      (w.league === undefined &&
        !isJornadaDuel(w) &&
        (w.opponentId !== undefined || w.opponentCharacterId !== undefined)) ||
      typeof w.timestamp !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(w.timestamp) ||
      !Number.isFinite(Date.parse(w.timestamp)) ||
      new Date(w.timestamp).toISOString() !== w.timestamp ||
      !validDate(w.localDate) ||
      (w.seasonId !== undefined &&
        (b.schemaVersion !== 6 ||
          typeof w.seasonId !== "string" ||
          w.league === "duel" ||
          !seasons.some((s) => s.id === w.seasonId))) ||
      (w.jornada?.format === "mixed" &&
        seasons.find((s) => s.id === seasonOf(w))?.format !== "mixed") ||
      (w.jornada !== undefined &&
        (b.schemaVersion! < 5 ||
          !w.jornada ||
          typeof w.jornada.id !== "string" ||
          !/^[a-f0-9-]{36}$/.test(w.jornada.id) ||
          !Number.isInteger(w.jornada.game) ||
          w.jornada.game < 1 ||
          w.jornada.game > 10 ||
          w.league !== undefined ||
          (w.jornada.format !== undefined &&
            (w.jornada.format !== "mixed" || b.schemaVersion! < 6)) ||
          (isJornadaDuel(w)
            ? !duelPair(w.jornada.game).includes(w.playerId) ||
              !duelPair(w.jornada.game).includes(w.opponentId!) ||
              w.opponentId === w.playerId ||
              !fighterById.has(w.opponentCharacterId!) ||
              w.placements !== undefined ||
              w.characters !== undefined
            : !w.placements || !w.characters))) ||
      (w.placements !== undefined &&
        (b.schemaVersion === 1 ||
          !validPlacements(w.placements, w.playerId))) ||
      (w.characters !== undefined &&
        (b.schemaVersion === 1 ||
          !w.placements ||
          !validCharacters(w.characters, w.characterId)))
    )
      return fail();
    ids.add(w.id);
    return {
      ...(w.league === "duel" || isJornadaDuel(w)
        ? {
            ...(w.league === "duel" ? { league: "duel" as const } : {}),
            opponentId: w.opponentId,
            ...(w.opponentCharacterId !== undefined
              ? { opponentCharacterId: w.opponentCharacterId }
              : {}),
          }
        : {}),
      ...(w.seasonId ? { seasonId: w.seasonId } : {}),
      ...(w.jornada ? { jornada: { ...w.jornada } } : {}),
      id: w.id,
      playerId: w.playerId,
      characterId: w.characterId,
      timestamp: new Date(w.timestamp).toISOString(),
      localDate: w.localDate,
      ...(w.placements ? { placements: [...w.placements] as Placements } : {}),
      ...(w.characters
        ? { characters: [...w.characters] as MatchCharacters }
        : {}),
    };
  });
  validateJornadas(wins);
  if (b.favorites.some((id) => typeof id !== "string" || !fighterById.has(id)))
    return fail();
  return {
    schemaVersion: 6,
    seasons: seasons.map((s) => ({
      id: s.id,
      name: s.name.trim(),
      closed: s.closed,
      format: s.format,
    })),
    exportedAt: b.exportedAt,
    players,
    wins,
    favorites: [...new Set(b.favorites)],
  };
}

export function sameResult(a: Win, b: Win) {
  return (
    a.league === b.league &&
    a.opponentId === b.opponentId &&
    a.opponentCharacterId === b.opponentCharacterId &&
    seasonOf(a) === seasonOf(b) &&
    a.jornada?.format === b.jornada?.format &&
    a.jornada?.id === b.jornada?.id &&
    a.jornada?.game === b.jornada?.game &&
    a.id === b.id &&
    a.playerId === b.playerId &&
    a.characterId === b.characterId &&
    a.timestamp === b.timestamp &&
    a.localDate === b.localDate &&
    (a.placements ?? []).join(",") === (b.placements ?? []).join(",") &&
    (a.characters ?? []).join(",") === (b.characters ?? []).join(",")
  );
}

export function matchEntries(win: Win) {
  if (isJornadaDuel(win))
    return [
      {
        playerId: win.playerId,
        characterId: win.characterId,
        position: 1,
        points: 2,
        duel: true,
      },
      {
        playerId: win.opponentId!,
        characterId: win.opponentCharacterId!,
        position: 2,
        points: 0,
        duel: true,
      },
    ];
  if (!win.placements)
    return [
      {
        playerId: win.playerId,
        characterId: win.characterId,
        position: 1,
        points: 3,
        duel: false,
      },
    ];
  return win.placements.flatMap((playerId, index) => {
    const characterId = characterAt(win, index);
    return characterId
      ? [
          {
            playerId,
            characterId,
            position: index + 1,
            points: pointsFor(win, playerId),
            duel: false,
          },
        ]
      : [];
  });
}

export function roundOf(game: number) {
  return Math.min(4, Math.ceil(game / 3));
}
export function jornadas(wins: Win[]) {
  const groups = new Map<string, Win[]>();
  for (const w of wins)
    if (w.jornada)
      groups.set(w.jornada.id, [...(groups.get(w.jornada.id) ?? []), w]);
  return [...groups]
    .map(([id, games]) => ({
      id,
      games: games.sort((a, b) => a.jornada!.game - b.jornada!.game),
      started: games.reduce(
        (date, w) => (w.timestamp < date ? w.timestamp : date),
        games[0].timestamp,
      ),
    }))
    .sort(
      (a, b) => a.started.localeCompare(b.started) || a.id.localeCompare(b.id),
    );
}
export function jornadaSlot(
  wins: Win[],
  newId: string,
): NonNullable<Win["jornada"]> {
  const last = jornadas(wins).at(-1);
  if (!last || last.games.length === 10) return { id: newId, game: 1 };
  return {
    id: last.id,
    ...(last.games[0].jornada!.format
      ? { format: last.games[0].jornada!.format }
      : {}),
    game: Array.from({ length: 10 }, (_, i) => i + 1).find(
      (n) => !last.games.some((w) => w.jornada!.game === n),
    )!,
  };
}
export function roundCharacters(
  wins: Win[],
  jornada: { id: string; game: number },
  exceptId?: string,
) {
  const result: Partial<Record<PlayerId, string>> = {};
  for (const w of wins)
    if (
      w.id !== exceptId &&
      w.jornada?.id === jornada.id &&
      roundOf(w.jornada.game) === roundOf(jornada.game)
    ) {
      for (const e of matchEntries(w)) result[e.playerId] = e.characterId;
    }
  return Object.keys(result).length ? result : undefined;
}
export function validateJornadas(wins: Win[]) {
  const slots = new Set<string>(),
    choices = new Map<string, string>(),
    contexts = new Map<string, string>();
  for (const w of wins)
    if (w.jornada) {
      const context = seasonOf(w) + ":" + (w.jornada.format ?? "classic");
      if (contexts.has(w.jornada.id) && contexts.get(w.jornada.id) !== context)
        throw new Error(
          "Una jornada no puede cambiar de temporada ni de reglas.",
        );
      contexts.set(w.jornada.id, context);
      const slot = w.jornada.id + ":" + w.jornada.game;
      if (slots.has(slot))
        throw new Error(
          "Dos partidas ocupan el mismo puesto de una jornada. Revisa los cambios antes de sincronizar.",
        );
      slots.add(slot);
      for (const e of matchEntries(w)) {
        const key =
          w.jornada.id + ":" + roundOf(w.jornada.game) + ":" + e.playerId;
        if (choices.has(key) && choices.get(key) !== e.characterId)
          throw new Error(
            "Cada jugador debe mantener su personaje durante las tres partidas de la ronda.",
          );
        choices.set(key, e.characterId);
      }
    }
}
export function assertSeasonOpen(seasons: Season[], win: Win) {
  if (
    win.league !== "duel" &&
    !seasons.some((s) => s.id === seasonOf(win) && !s.closed)
  )
    throw new Error(
      "Esta temporada está cerrada. Sus resultados se conservan sin cambios.",
    );
}
