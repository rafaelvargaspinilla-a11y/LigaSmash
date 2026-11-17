import {
  sameResult,
  seasonsOf,
  sameSeason,
  seasonOf,
  assertSeasonOpen,
  type Season,
  validateBackup,
  type Backup,
  type Player,
  type Win,
} from "./model";
export type Change =
  | { kind: "seasons"; before: Season[]; after: Season[]; knownWins: Win[] }
  | { kind: "add"; win: Win }
  | { kind: "edit"; before: Win; after: Win }
  | { kind: "delete"; before: Win }
  | { kind: "players"; before: Player[]; after: Player[] }
  | { kind: "import"; backup: Backup };
export interface PendingChange {
  id?: number;
  change: Change;
}
export interface RemoteState {
  revision: number;
  data: Backup;
}
export const sameWin = sameResult;
const samePlayers = (a: Player[], b: Player[]) =>
  a.length === b.length &&
  a.every((p) => b.some((q) => p.id === q.id && p.name === q.name));
export function applyChanges(input: Backup, changes: PendingChange[]): Backup {
  const data = validateBackup(structuredClone(input));
  const wins = new Map(data.wins.map((w) => [w.id, w]));
  for (const { change: c } of changes) {
    if (c.kind === "seasons") {
      const current = seasonsOf(data);
      const equals = (a: Season[], b: Season[]) =>
        a.length === b.length &&
        a.every((s) => b.some((t) => sameSeason(t, s)));
      if (!equals(current, c.after)) {
        if (!equals(current, c.before))
          throw new Error(
            "Conflicto: otro dispositivo ha cambiado la temporada.",
          );
        const closed = c.before.find((s) => !s.closed)!;
        const actual = [...wins.values()].filter(
          (w) => w.league !== "duel" && seasonOf(w) === closed.id,
        );
        if (
          actual.length !== c.knownWins.length ||
          actual.some((w) => !c.knownWins.some((t) => sameWin(w, t)))
        )
          throw new Error(
            "Conflicto: han cambiado resultados antes del cierre de temporada. Sincroniza y revisa la clasificación.",
          );
        data.seasons = c.after;
      }
    } else if (c.kind === "players") {
      if (
        !samePlayers(data.players, c.before) &&
        !samePlayers(data.players, c.after)
      )
        throw new Error(
          "Conflicto en nombres: otro dispositivo los ha cambiado.",
        );
      data.players = c.after;
    } else if (c.kind === "import") {
      const imported = validateBackup(c.backup);
      if (
        !wins.size &&
        seasonsOf(data).length === 1 &&
        !seasonsOf(data)[0].closed
      )
        data.seasons = seasonsOf(imported);
      else if (
        seasonsOf(imported).some(
          (s) => !seasonsOf(data).some((t) => sameSeason(t, s)),
        )
      )
        throw new Error("Conflicto en las temporadas de la importación.");
      const restoring = !wins.size;
      for (const win of imported.wins) {
        const current = wins.get(win.id);
        if (current && !sameWin(current, win))
          throw new Error(
            "Conflicto de importación: un ID tiene datos distintos.",
          );
        if (!current && !restoring) assertSeasonOpen(seasonsOf(data), win);
        wins.set(win.id, win);
      }
    } else if (c.kind === "add") {
      const current = wins.get(c.win.id);
      if (current && !sameWin(current, c.win))
        throw new Error("Conflicto: el ID de una victoria ya existe.");
      if (!current) assertSeasonOpen(seasonsOf(data), c.win);
      wins.set(c.win.id, c.win);
    } else if (c.kind === "edit") {
      const current = wins.get(c.before.id);
      if (!current)
        throw new Error(
          "Conflicto: la partida que editaste fue eliminada en otro dispositivo.",
        );
      if (!sameWin(current, c.before) && !sameWin(current, c.after))
        throw new Error(
          "Conflicto: otro dispositivo ha editado la misma partida.",
        );
      if (!sameWin(current, c.after))
        assertSeasonOpen(seasonsOf(data), current);
      wins.set(c.after.id, c.after);
    } else {
      const current = wins.get(c.before.id);
      if (current && !sameWin(current, c.before))
        throw new Error(
          "Conflicto: la partida que eliminaste fue editada en otro dispositivo.",
        );
      if (current) assertSeasonOpen(seasonsOf(data), current);
      wins.delete(c.before.id);
    }
  }
  data.schemaVersion = 6;
  data.wins = [...wins.values()];
  data.favorites = [];
  return validateBackup(data);
}
export function validateRemote(input: unknown): RemoteState {
  if (!input || typeof input !== "object")
    throw new Error("Respuesta de sincronización no válida.");
  const value = input as Partial<RemoteState>;
  if (!Number.isSafeInteger(value.revision) || value.revision! < 0)
    throw new Error("Revisión remota no válida.");
  return { revision: value.revision!, data: validateBackup(value.data) };
}
export function groupCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function validCode(code: string) {
  return /^[a-f0-9]{64}$/.test(code);
}
