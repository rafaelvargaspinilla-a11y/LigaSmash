import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { TrackerDB } from "./db";
import {
  firstSeason,
  validateBackup,
  makeWin,
  statistics,
  pointsFor,
  matchEntries,
  seasonOf,
  type Backup,
  type Season,
  type Win,
} from "./model";
import { applyChanges } from "./sync-model";
import schema from "../supabase/schema.sql?raw";
import upgrade from "../supabase/seasons.sql?raw";
const season: Season = {
  id: "season-2",
  name: "Temporada 2",
  closed: false,
  format: "mixed",
};
const seasons = [{ ...firstSeason, closed: true }, season];
const jid = crypto.randomUUID();
const trio = (game: number): Win => ({
  ...makeWin("p1", "01", new Date(), ["p1", "p2", "p3"], ["01", "03", "06"]),
  jornada: { id: jid, game, format: "mixed" },
  seasonId: season.id,
});
const duel = (game: number, winner: "p1" | "p2" = "p1"): Win => ({
  id: crypto.randomUUID(),
  playerId: game === 9 ? "p2" : winner,
  opponentId: game === 7 ? (winner === "p1" ? "p2" : "p1") : "p3",
  characterId: game === 9 ? "03" : winner === "p1" ? "01" : "03",
  opponentCharacterId: game === 7 ? (winner === "p1" ? "03" : "01") : "06",
  timestamp: new Date().toISOString(),
  localDate: new Date().toISOString().slice(0, 10),
  jornada: { id: jid, game, format: "mixed" },
  seasonId: season.id,
});
const data = (wins: Win[]): Backup => ({
  schemaVersion: 6,
  seasons,
  wins,
  players: [
    { id: "p1", name: "Rafa" },
    { id: "p2", name: "Carlos" },
    { id: "p3", name: "Andrés" },
  ],
  favorites: [],
  exportedAt: new Date().toISOString(),
});
it("conserva la temporada histórica y puntúa 38 puntos por jornada mixta", () => {
  const old = makeWin("p1", "01");
  const legacy = validateBackup({
    ...data([old]),
    schemaVersion: 5,
    seasons: undefined,
  });
  expect(legacy.seasons).toEqual([firstSeason]);
  expect(seasonOf(legacy.wins[0])).toBe("season-1");
  const wins = [
    ...Array.from({ length: 6 }, (_, i) => trio(i + 1)),
    duel(7),
    duel(8),
    duel(9),
    trio(10),
  ];
  expect(validateBackup(data(wins)).wins).toEqual(wins);
  expect(applyChanges(data(wins), []).wins).toEqual(wins);
  expect(
    wins.reduce(
      (n, w) => n + matchEntries(w).reduce((sum, e) => sum + e.points, 0),
      0,
    ),
  ).toBe(38);
  expect(pointsFor(wins[6], "p1")).toBe(2);
  expect(pointsFor(wins[6], "p2")).toBe(0);
  expect(statistics(wins, data([]).players).incomplete).toBe(0);
  expect(() =>
    validateBackup(data([{ ...duel(7), opponentId: "p3" }])),
  ).toThrow();
  expect(() =>
    validateBackup(data([duel(7), { ...duel(8), characterId: "02" }])),
  ).toThrow();
  expect(() =>
    validateBackup(data([{ ...trio(1), seasonId: "unknown" }])),
  ).toThrow();
});
it("cierra temporadas en una transacción, impide cambios y conserva ambas al exportar/importar", async () => {
  const db = new TrackerDB(crypto.randomUUID(), true);
  const other = new TrackerDB(crypto.randomUUID());
  try {
    await db.ensureFixedPlayers();
    const old = await db.addWin("p1", "01");
    const next = await db.startSeason("Segunda liga");
    await expect(
      db.startSeason("No debe crearse", firstSeason.id),
    ).rejects.toThrow("ha cambiado");
    expect(
      (await db.seasonList()).find((s) => s.id === firstSeason.id)?.closed,
    ).toBe(true);
    await expect(db.deleteWin(old.id)).rejects.toThrow("cerrada");
    await expect(db.editWin(old.id, "p2", "03", new Date())).rejects.toThrow(
      "cerrada",
    );
    await expect(db.addWin("p1", "01")).rejects.toThrow("cerrada");
    await db.addWin(
      "p1",
      "01",
      new Date(),
      ["p1", "p2", "p3"],
      ["01", "03", "06"],
      { id: crypto.randomUUID(), game: 1, format: "mixed" },
      next.id,
    );
    const backup = await db.exportBackup();
    await other.importBackup(backup);
    expect((await other.exportBackup()).wins).toEqual(backup.wins);
    expect(await other.seasonList()).toHaveLength(2);
    const pending = await db.pending.toArray();
    const remote = applyChanges(
      { ...data([]), seasons: [firstSeason] },
      pending,
    );
    expect(remote.wins).toHaveLength(2);
    expect(remote.seasons).toHaveLength(2);
  } finally {
    await db.delete();
    await other.delete();
  }
});
it("sincronización detecta duelos incompatibles y cierre con resultados nuevos en otro dispositivo", () => {
  const old = makeWin("p1", "01");
  const base = { ...data([old]), seasons: [firstSeason] };
  const closure = {
    kind: "seasons" as const,
    before: [firstSeason],
    after: seasons,
    knownWins: [old],
  };
  expect(applyChanges(base, [{ change: closure }]).seasons).toEqual(seasons);
  expect(() =>
    applyChanges({ ...base, wins: [old, makeWin("p2", "03")] }, [
      { change: closure },
    ]),
  ).toThrow("Conflicto");
  expect(() =>
    applyChanges(data([old]), [{ change: { kind: "delete", before: old } }]),
  ).toThrow("cerrada");
  expect(() =>
    applyChanges(data([duel(7)]), [
      { change: { kind: "add", win: duel(7, "p2") } },
    ]),
  ).toThrow();
});
it("PostgreSQL: migración repetible, jornadas mixtas y temporadas cerradas protegidas", async () => {
  const pg = new PGlite();
  try {
    await pg.exec("create role anon;create role authenticated;");
    await pg.exec(schema);
    await pg.exec(upgrade);
    await pg.exec(upgrade);
    const valid = async (b: unknown) =>
      (
        await pg.query<{ ok: boolean }>(
          "select public.smash_valid_data($1::jsonb) as ok",
          [JSON.stringify(b)],
        )
      ).rows[0].ok;
    const wins = [
      ...Array.from({ length: 6 }, (_, i) => trio(i + 1)),
      duel(7),
      duel(8),
      duel(9),
      trio(10),
    ];
    expect(await valid(data(wins))).toBe(true);
    expect(await valid(data([{ ...duel(7), opponentId: "p3" }]))).toBe(false);
    expect(
      await valid(data([duel(7), { ...duel(8), characterId: "02" }])),
    ).toBe(false);
    const old = makeWin("p1", "01");
    const code = "e".repeat(64);
    const initial = { ...data([old]), seasons: [firstSeason] };
    await pg.exec("set role anon");
    await pg.query("select public.smash_create_group($1,$2::jsonb)", [
      code,
      JSON.stringify(initial),
    ]);
    await pg.query("select public.smash_write_group($1,0,$2::jsonb,$3::uuid)", [
      code,
      JSON.stringify(data([old, ...wins])),
      crypto.randomUUID(),
    ]);
    await expect(
      pg.query("select public.smash_write_group($1,1,$2::jsonb,$3::uuid)", [
        code,
        JSON.stringify(data(wins)),
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow("Season is closed");
    const read = await pg.query<{ d: Backup }>(
      "select public.smash_read_group($1)->'data' as d",
      [code],
    );
    expect(read.rows[0].d.wins).toHaveLength(11);
  } finally {
    await pg.close();
  }
}, 30000);
