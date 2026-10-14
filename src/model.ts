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
export interface Win {
  id: string;
  playerId: PlayerId;
  characterId: string;
  timestamp: string;
  localDate: string;
}
export interface Preferences {
  id: "main";
  favorites: string[];
}
export interface Backup {
  schemaVersion: 1;
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
export function statistics(wins: Win[], players: Player[]) {
  const counts = new Map<PlayerId, number>(playerIds.map((id) => [id, 0]));
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
    streak = w.playerId === previous ? streak + 1 : 1;
    previous = w.playerId;
    best.set(w.playerId, Math.max(best.get(w.playerId) ?? 0, streak));
  }
  const ranking = players
    .map((p) => ({
      ...p,
      wins: counts.get(p.id) ?? 0,
      percent: wins.length ? ((counts.get(p.id) ?? 0) / wins.length) * 100 : 0,
      streak: best.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.wins - a.wins);
  const max = ranking[0]?.wins ?? 0;
  const characterRanking = [...characters].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  return {
    total: wins.length,
    ranking,
    leaders: max ? ranking.filter((p) => p.wins === max) : [],
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
): Win {
  if (
    !playerIds.includes(playerId) ||
    !fighterById.has(characterId) ||
    !Number.isFinite(date.getTime())
  )
    throw new Error("Victoria no válida");
  return {
    id: crypto.randomUUID(),
    playerId,
    characterId,
    timestamp: date.toISOString(),
    localDate: localDate(date),
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
      "Copia no válida. Se requiere JSON de Smash Tracker con esquema 1 y datos correctos.",
    );
  };
  if (!input || typeof input !== "object") return fail();
  const b = input as Partial<Backup>;
  if (
    b.schemaVersion !== 1 ||
    !Array.isArray(b.players) ||
    b.players.length !== 3 ||
    !Array.isArray(b.wins) ||
    !Array.isArray(b.favorites) ||
    typeof b.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(b.exportedAt))
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
      !fighterById.has(w.characterId) ||
      typeof w.timestamp !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(w.timestamp) ||
      !Number.isFinite(Date.parse(w.timestamp)) ||
      new Date(w.timestamp).toISOString() !== w.timestamp ||
      !validDate(w.localDate)
    )
      return fail();
    ids.add(w.id);
    return {
      id: w.id,
      playerId: w.playerId,
      characterId: w.characterId,
      timestamp: new Date(w.timestamp).toISOString(),
      localDate: w.localDate,
    };
  });
  if (b.favorites.some((id) => typeof id !== "string" || !fighterById.has(id)))
    return fail();
  return {
    schemaVersion: 1,
    exportedAt: b.exportedAt,
    players,
    wins,
    favorites: [...new Set(b.favorites)],
  };
}
