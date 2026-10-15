import {
  sameResult,
  validateBackup,
  type Backup,
  type Player,
  type Win,
} from "./model";
export type Change =
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
  const data = structuredClone(input);
  const wins = new Map(data.wins.map((w) => [w.id, w]));
  for (const { change: c } of changes) {
    if (c.kind === "players") {
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
      for (const win of imported.wins) {
        const current = wins.get(win.id);
        if (current && !sameWin(current, win))
          throw new Error(
            "Conflicto de importación: un ID tiene datos distintos.",
          );
        wins.set(win.id, win);
      }
    } else if (c.kind === "add") {
      const current = wins.get(c.win.id);
      if (current && !sameWin(current, c.win))
        throw new Error("Conflicto: el ID de una victoria ya existe.");
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
      wins.set(c.after.id, c.after);
    } else {
      const current = wins.get(c.before.id);
      if (current && !sameWin(current, c.before))
        throw new Error(
          "Conflicto: la partida que eliminaste fue editada en otro dispositivo.",
        );
      wins.delete(c.before.id);
    }
  }
  data.schemaVersion = 5;
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
