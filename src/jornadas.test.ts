import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { TrackerDB } from "./db";
import {
  makeWin,
  fixedPlayers,
  validateBackup,
  pointsFor,
  matchEntries,
  jornadaSlot,
  roundCharacters,
  type Win,
  type Backup,
} from "./model";
import { applyChanges } from "./sync-model";
import schema from "../supabase/schema.sql?raw";
import upgrade from "../supabase/jornadas.sql?raw";
const id = crypto.randomUUID();
const game = (n: number): Win => ({
  ...makeWin("p1", "01", new Date(), ["p1", "p2", "p3"], ["01", "03", "06"]),
  jornada: { id, game: n },
});
const backup = (wins: Win[]): Backup => ({
  schemaVersion: 5,
  exportedAt: new Date().toISOString(),
  players: fixedPlayers,
  wins,
  favorites: [],
});
it("reparte 44 puntos por jornada y dobla solo la partida diez, también por personaje", () => {
  const wins = Array.from({ length: 10 }, (_, i) => game(i + 1));
  expect(
    wins.reduce(
      (n, w) =>
        n + fixedPlayers.reduce((p, who) => p + pointsFor(w, who.id), 0),
      0,
    ),
  ).toBe(44);
  expect(fixedPlayers.map((p) => pointsFor(wins[9], p.id))).toEqual([6, 2, 0]);
  expect(matchEntries(wins[9]).map((e) => e.points)).toEqual([6, 2, 0]);
  expect(jornadaSlot(wins, "new")).toEqual({ id: "new", game: 1 });
  expect(
    jornadaSlot(
      wins.filter((w) => w.jornada!.game !== 2),
      "new",
    ),
  ).toEqual({ id, game: 2 });
});
it("bloquea personajes por jugador en una ronda y permite cambiar al empezar otra", () => {
  const first = game(1),
    second = game(2);
  second.playerId = "p2";
  second.characterId = "03";
  second.placements = ["p2", "p1", "p3"];
  second.characters = ["03", "01", "06"];
  expect(validateBackup(backup([first, second])).wins).toHaveLength(2);
  expect(roundCharacters([first], second.jornada!)).toEqual({
    p1: "01",
    p2: "03",
    p3: "06",
  });
  const changed = {
    ...game(3),
    characters: ["01", "02", "06"] as [string, string, string],
  };
  expect(() => validateBackup(backup([first, changed]))).toThrow();
  expect(
    validateBackup(backup([first, { ...changed, jornada: { id, game: 4 } }]))
      .wins,
  ).toHaveLength(2);
  expect(() =>
    validateBackup(backup([first, { ...second, jornada: { id, game: 1 } }])),
  ).toThrow();
  expect(() =>
    applyChanges(backup([first]), [
      { change: { kind: "add", win: { ...first, id: crypto.randomUUID() } } },
    ]),
  ).toThrow();
  expect(() =>
    validateBackup({ ...backup([first]), schemaVersion: 4 }),
  ).toThrow();
});
it("persiste, exporta, edita y elimina sin perder ronda ni permitir cambiar personajes fijados", async () => {
  const db = new TrackerDB(crypto.randomUUID(), true);
  await db.ensureFixedPlayers();
  try {
    const a = await db.addWin(
      "p1",
      "01",
      new Date(),
      ["p1", "p2", "p3"],
      ["01", "03", "06"],
      { id, game: 1 },
    );
    await db.addWin(
      "p1",
      "01",
      new Date(),
      ["p1", "p2", "p3"],
      ["01", "03", "06"],
      { id, game: 2 },
    );
    await expect(
      db.editWin(
        a.id,
        "p1",
        "02",
        new Date(),
        ["p1", "p2", "p3"],
        ["02", "03", "06"],
      ),
    ).rejects.toThrow();
    await db.editWin(
      a.id,
      "p2",
      "03",
      new Date(),
      ["p2", "p1", "p3"],
      ["03", "01", "06"],
    );
    expect((await db.wins.get(a.id))?.jornada).toEqual({ id, game: 1 });
    expect(validateBackup(await db.exportBackup()).wins).toHaveLength(2);
    await db.deleteWin(a.id);
    expect(jornadaSlot(await db.wins.toArray(), "new")).toEqual({
      id,
      game: 1,
    });
  } finally {
    await db.delete();
  }
});
it("SQL acepta jornadas, rechaza duplicados y personajes inconsistentes y protege versiones anteriores", async () => {
  const pg = new PGlite();
  try {
    await pg.exec("create role anon;create role authenticated;");
    await pg.exec(schema);
    await pg.exec(upgrade);
    await pg.exec(upgrade);
    const valid = async (data: unknown) =>
      (
        await pg.query<{ ok: boolean }>(
          "select public.smash_valid_data($1::jsonb) as ok",
          [JSON.stringify(data)],
        )
      ).rows[0].ok;
    const wins = Array.from({ length: 10 }, (_, i) => game(i + 1));
    expect(await valid(backup(wins))).toBe(true);
    expect(
      await valid(backup([...wins, { ...wins[0], id: crypto.randomUUID() }])),
    ).toBe(false);
    expect(
      await valid(
        backup([game(1), { ...game(2), characters: ["01", "02", "06"] }]),
      ),
    ).toBe(false);
    expect(
      await valid(backup([{ ...game(1), jornada: { id, game: 11 } }])),
    ).toBe(false);
    const code = "d".repeat(64);
    await pg.exec("set role anon");
    await pg.query("select public.smash_create_group($1,$2::jsonb)", [
      code,
      JSON.stringify(backup(wins)),
    ]);
    await expect(
      pg.query("select public.smash_write_group($1,0,$2::jsonb,$3::uuid)", [
        code,
        JSON.stringify({ ...backup([]), schemaVersion: 4 }),
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow("Client update required");
  } finally {
    await pg.close();
  }
}, 30000);
