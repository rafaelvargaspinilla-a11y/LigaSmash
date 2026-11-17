import Dexie, { type Table } from "dexie";
import {
  makeWin,
  firstSeason,
  seasonOf,
  seasonsOf,
  sameSeason,
  assertSeasonOpen,
  isJornadaDuel,
  localDate,
  type Season,
  validateJornadas,
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
  seasons!: Table<Season, string>;
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
    this.version(4).stores({ seasons: "id" });
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
    jornada?: Win["jornada"],
    seasonId?: string,
  ) {
    const w = {
      ...makeWin(playerId, characterId, date, placements, characters),
      ...(jornada ? { jornada } : {}),
      ...(seasonId ? { seasonId } : {}),
    };
    await this.transaction(
      "rw",
      this.players,
      this.seasons,
      this.wins,
      this.pending,
      async () => {
        if ((await this.players.count()) !== 3)
          throw new Error("Configura los tres jugadores primero.");
        const seasons = await this.seasonList();
        assertSeasonOpen(seasons, w);
        if (jornada)
          validateBackup({
            seasons,
            schemaVersion: 6,
            exportedAt: date.toISOString(),
            players: await this.players.toArray(),
            wins: [...(await this.wins.toArray()), w],
            favorites: [],
          });
        await this.wins.add(w);
        await this.enqueue({ kind: "add", win: w });
      },
    );
    return w;
  }
  async saveDuel(
    playerId: PlayerId,
    opponentId: PlayerId,
    date: Date,
    id?: string,
    characters?: [string, string],
  ) {
    const win: Win = {
      id: id ?? crypto.randomUUID(),
      playerId,
      opponentId,
      league: "duel",
      characterId: characters?.[0] ?? "",
      ...(characters ? { opponentCharacterId: characters[1] } : {}),
      timestamp: date.toISOString(),
      localDate:
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0"),
    };
    validateBackup({
      schemaVersion: 6,
      seasons: await this.seasonList(),
      exportedAt: date.toISOString(),
      players: await this.players.toArray(),
      wins: [win],
      favorites: [],
    });
    await this.transaction(
      "rw",
      this.wins,
      this.pending,
      this.seasons,
      async () => {
        const before = id ? await this.wins.get(id) : undefined;
        if (id && (!before || before.league !== "duel"))
          throw new Error("La partida 1vs1 ya no existe.");
        if (before?.opponentCharacterId && !characters)
          throw new Error(
            "Selecciona los dos personajes para conservar la partida.",
          );
        await this.wins.put(win);
        await this.enqueue(
          before ? { kind: "edit", before, after: win } : { kind: "add", win },
        );
      },
    );
    return win;
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
    await this.transaction(
      "rw",
      this.wins,
      this.pending,
      this.seasons,
      async () => {
        const before = await this.wins.get(id);
        if (!before) throw new Error("La partida ya no existe.");
        assertSeasonOpen(await this.seasonList(), before);
        if (isJornadaDuel(before))
          throw new Error(
            "Usa el formulario de duelo para editar esta partida.",
          );
        if (before.placements && !placements)
          throw new Error(
            "Selecciona el podio completo al editar esta partida.",
          );
        if (before.characters && !characters)
          throw new Error(
            "Selecciona los tres personajes al editar esta partida.",
          );
        const after = {
          ...w,
          id,
          ...(before.jornada ? { jornada: before.jornada } : {}),
          ...(before.seasonId ? { seasonId: before.seasonId } : {}),
        };
        validateJornadas([
          ...(await this.wins.toArray()).filter((row) => row.id !== id),
          after,
        ]);
        await this.wins.put(after);
        await this.enqueue({ kind: "edit", before, after });
      },
    );
  }
  async deleteWin(id: string) {
    await this.transaction(
      "rw",
      this.wins,
      this.pending,
      this.seasons,
      async () => {
        const before = await this.wins.get(id);
        if (before) {
          assertSeasonOpen(await this.seasonList(), before);
          await this.wins.delete(id);
          await this.enqueue({ kind: "delete", before });
        }
      },
    );
  }
  async seasonList(): Promise<Season[]> {
    const stored = await this.seasons.toArray();
    return stored.length ? stored : [{ ...firstSeason }];
  }
  async startSeason(name: string, expectedActiveId?: string) {
    const clean = name.trim();
    if (!clean || clean.length > 60)
      throw new Error("El nombre debe tener entre 1 y 60 caracteres.");
    return this.transaction(
      "rw",
      this.seasons,
      this.wins,
      this.pending,
      async () => {
        const before = await this.seasonList();
        const active = before.find((s) => !s.closed)!;
        if (expectedActiveId && active.id !== expectedActiveId)
          throw new Error(
            "La temporada activa ha cambiado. Revisa sus resultados antes de iniciar otra.",
          );
        const knownWins = (await this.wins.toArray()).filter(
          (w) => w.league !== "duel" && seasonOf(w) === active.id,
        );
        const next: Season = {
          id: crypto.randomUUID(),
          name: clean,
          closed: false,
          format: "mixed",
        };
        const after = [...before.map((s) => ({ ...s, closed: true })), next];
        await this.seasons.bulkPut(after);
        await this.enqueue({ kind: "seasons", before, after, knownWins });
        return next;
      },
    );
  }
  async saveJornadaDuel(
    playerId: PlayerId,
    opponentId: PlayerId,
    characters: [string, string],
    jornada: NonNullable<Win["jornada"]>,
    seasonId: string,
    id?: string,
    date = new Date(),
  ) {
    return this.transaction(
      "rw",
      this.players,
      this.seasons,
      this.wins,
      this.pending,
      async () => {
        const before = id ? await this.wins.get(id) : undefined;
        if (id && (!before || before.league === "duel" || !before.opponentId))
          throw new Error("El duelo de jornada ya no existe.");
        const win: Win = {
          id: id ?? crypto.randomUUID(),
          playerId,
          opponentId,
          characterId: characters[0],
          opponentCharacterId: characters[1],
          jornada,
          seasonId,
          timestamp: date.toISOString(),
          localDate: localDate(date),
        };
        const seasons = await this.seasonList();
        assertSeasonOpen(seasons, win);
        if (
          before &&
          (JSON.stringify(before.jornada) !== JSON.stringify(jornada) ||
            seasonOf(before) !== seasonId)
        )
          throw new Error(
            "No se puede mover la partida de jornada o temporada.",
          );
        const wins = [
          ...(await this.wins.toArray()).filter((w) => w.id !== id),
          win,
        ];
        validateBackup({
          schemaVersion: 6,
          seasons,
          wins,
          players: await this.players.toArray(),
          favorites: [],
          exportedAt: date.toISOString(),
        });
        await this.wins.put(win);
        await this.enqueue(
          before ? { kind: "edit", before, after: win } : { kind: "add", win },
        );
        return win;
      },
    );
  }
  async exportBackup(): Promise<Backup> {
    return this.transaction(
      "r",
      this.players,
      this.seasons,
      this.wins,
      this.preferences,
      async () => ({
        schemaVersion: 6,
        seasons: await this.seasonList(),
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
      this.seasons,
      this.wins,
      this.preferences,
      this.pending,
      async () => {
        const players = await this.players.toArray();
        const existing = await this.wins.toArray();
        const localSeasons = await this.seasonList();
        const importedSeasons = seasonsOf(b);
        const empty = !existing.length && !(await this.seasons.count());
        if (
          !empty &&
          importedSeasons.some(
            (s) => !localSeasons.some((t) => sameSeason(t, s)),
          )
        )
          throw new Error(
            "Las temporadas de esta copia son diferentes. Importación cancelada para conservar las actuales.",
          );
        const seasons = empty ? importedSeasons : localSeasons;
        const byId = new Map(existing.map((w) => [w.id, w]));
        validateJornadas([
          ...existing,
          ...b.wins.filter((w) => !byId.has(w.id)),
        ]);
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
            if (!empty) assertSeasonOpen(seasons, w);
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
        if (empty) await this.seasons.bulkPut(seasons);
        if (added || empty) await this.enqueue({ kind: "import", backup: b });
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
