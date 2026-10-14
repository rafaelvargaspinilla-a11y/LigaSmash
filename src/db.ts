import Dexie, { type Table } from "dexie";
import {
  makeWin,
  sameResult,
  type Placements,
  type MatchCharacters,
  fixedPlayerNames,
  validateBackup,
  type Player,
  type Win,
  type Preferences,
  type PlayerId,
  type Backup,
} from "./model";
import type { Change, PendingChange } from "./sync-model";
export interface SyncAttempt {
  id: "main";
  batchId: string;
  changeIds: number[];
}
export class TrackerDB extends Dexie {
  players!: Table<Player, string>;
  wins!: Table<Win, string>;
  preferences!: Table<Preferences, string>;
  pending!: Table<PendingChange, number>;
  attempts!: Table<SyncAttempt, string>;
  constructor(
    name = "smash-tracker",
    readonly shared = false,
  ) {
    super(name);
    this.version(1).stores({
      players: "id",
      wins: "id, playerId, characterId, timestamp, localDate",
      preferences: "id",
    });
    this.version(2).stores({ pending: "++id" });
    this.version(3).stores({ attempts: "id" });
  }
  private async enqueue(change: Change) {
    if (this.shared) await this.pending.add({ change });
  }
  async ensureFixedPlayers() {
    await this.transaction("rw", this.players, this.pending, async () => {
      const before = await this.players.toArray();
      const after = fixedPlayerNames(before);
      if (
        before.length === after.length &&
        before.every((p) =>
          after.some((q) => q.id === p.id && q.name === p.name),
        )
      )
        return;
      await this.players.bulkPut(after);
      await this.enqueue({ kind: "players", before, after });
    });
  }
  async setupPlayers(names: string[]) {
    if (
      names.length !== 3 ||
      names.some((n) => !n.trim() || n.trim().length > 40)
    )
      throw new Error("Introduce tres nombres de hasta 40 caracteres.");
    const after = names.map((name, i) => ({
      id: `p${i + 1}` as PlayerId,
      name: name.trim(),
    }));
    await this.transaction("rw", this.players, this.pending, async () => {
      const before = await this.players.toArray();
      await this.players.bulkPut(after);
      await this.enqueue({ kind: "players", before, after });
    });
  }
  async addWin(
    playerId: PlayerId,
    characterId: string,
    date = new Date(),
    placements?: Placements,
    characters?: MatchCharacters,
  ) {
    const w = makeWin(playerId, characterId, date, placements, characters);
    await this.transaction(
      "rw",
      this.players,
      this.wins,
      this.pending,
      async () => {
        if ((await this.players.count()) !== 3)
          throw new Error("Configura los tres jugadores primero.");
        await this.wins.add(w);
        await this.enqueue({ kind: "add", win: w });
      },
    );
    return w;
  }
  async editWin(
    id: string,
    playerId: PlayerId,
    characterId: string,
    date: Date,
    placements?: Placements,
    characters?: MatchCharacters,
  ) {
    const w = makeWin(playerId, characterId, date, placements, characters);
    await this.transaction("rw", this.wins, this.pending, async () => {
      const before = await this.wins.get(id);
      if (!before) throw new Error("La partida ya no existe.");
      if (before.placements && !placements)
        throw new Error("Selecciona el podio completo al editar esta partida.");
      if (before.characters && !characters)
        throw new Error(
          "Selecciona los tres personajes al editar esta partida.",
        );
      const after = { ...w, id };
      await this.wins.put(after);
      await this.enqueue({ kind: "edit", before, after });
    });
  }
  async deleteWin(id: string) {
    await this.transaction("rw", this.wins, this.pending, async () => {
      const before = await this.wins.get(id);
      if (before) {
        await this.wins.delete(id);
        await this.enqueue({ kind: "delete", before });
      }
    });
  }
  async exportBackup(): Promise<Backup> {
    return this.transaction(
      "r",
      this.players,
      this.wins,
      this.preferences,
      async () => ({
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        players: await this.players.toArray(),
        wins: await this.wins.toArray(),
        favorites: (await this.preferences.get("main"))?.favorites ?? [],
      }),
    );
  }
  async importBackup(input: unknown) {
    const b = validateBackup(input);
    return this.transaction(
      "rw",
      this.players,
      this.wins,
      this.preferences,
      this.pending,
      async () => {
        const players = await this.players.toArray();
        const existing = await this.wins.toArray();
        const byId = new Map(existing.map((w) => [w.id, w]));
        let added = 0;
        let duplicates = 0;
        for (const w of b.wins) {
          const old = byId.get(w.id);
          if (old) {
            if (!sameResult(old, w))
              throw new Error(
                "Hay IDs con datos distintos. Importación cancelada para proteger tus partidas.",
              );
            duplicates++;
          } else {
            await this.wins.add(w);
            added++;
          }
        }
        // Preserve names on an existing device. Player IDs identify the same three people.
        if (!players.length) await this.players.bulkPut(b.players);
        const favorites = (await this.preferences.get("main"))?.favorites ?? [];
        await this.preferences.put({
          id: "main",
          favorites: [...new Set([...favorites, ...b.favorites])],
        });
        if (added) await this.enqueue({ kind: "import", backup: b });
        return { added, duplicates };
      },
    );
  }
}
export let db = new TrackerDB();
export function activateDatabase(next: TrackerDB) {
  const previous = db;
  db = next;
  previous.close();
}
