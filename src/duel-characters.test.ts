import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { TrackerDB } from "./db";
import { fixedPlayers, makeWin, validateBackup, sameResult } from "./model";
import { applyChanges } from "./sync-model";
import schema from "../supabase/schema.sql?raw";
import previous from "../supabase/duels.sql?raw";
import upgrade from "../supabase/duel-characters.sql?raw";

it("conserva personajes de ambos jugadores en edición, copias y sincronización", async () => {
  const db = new TrackerDB(crypto.randomUUID(), true);
  await db.ensureFixedPlayers();
  try {
    const duel = await db.saveDuel("p1", "p2", new Date(), undefined, [
      "01",
      "02",
    ]);
    const backup = await db.exportBackup();
    expect(validateBackup(backup).wins[0]).toEqual(duel);
    expect(
      applyChanges({ ...backup, schemaVersion: 3, wins: [] }, [
        { change: { kind: "add", win: duel } },
      ]).wins[0],
    ).toEqual(duel);
    await expect(
      db.saveDuel("p1", "p2", new Date(), duel.id),
    ).rejects.toThrow();
    await db.saveDuel("p2", "p1", new Date(), duel.id, ["02", "01"]);
    const edited = (await db.wins.get(duel.id))!;
    expect(edited.characterId).toBe("02");
    expect(edited.opponentCharacterId).toBe("01");
    expect(sameResult(duel, edited)).toBe(false);
    await expect(db.importBackup(backup)).rejects.toThrow();
  } finally {
    await db.delete();
  }
});
it("acepta personajes iguales y duelos antiguos; rechaza información parcial o inválida", () => {
  const w = {
    ...makeWin("p1", "01"),
    league: "duel",
    opponentId: "p2",
    opponentCharacterId: "01",
  };
  const base = {
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    players: fixedPlayers,
    wins: [w],
    favorites: [],
  };
  expect(validateBackup(base).wins[0]).toEqual(w);
  for (const change of [
    { opponentCharacterId: undefined },
    { opponentCharacterId: "999" },
    { characterId: "" },
    { league: undefined },
  ])
    expect(() =>
      validateBackup({ ...base, wins: [{ ...w, ...change }] }),
    ).toThrow();
  expect(() => validateBackup({ ...base, schemaVersion: 3 })).toThrow();
  expect(
    validateBackup({
      ...base,
      schemaVersion: 3,
      wins: [{ ...w, characterId: "", opponentCharacterId: undefined }],
    }).wins[0].opponentCharacterId,
  ).toBeUndefined();
});
it("SQL: conserva grupos al actualizar dos veces y protege personajes ante clientes antiguos", async () => {
  const pg = new PGlite();
  try {
    await pg.exec("create role anon;create role authenticated;");
    await pg.exec(schema);
    await pg.exec(previous);
    const code = "c".repeat(64);
    const old = {
      ...makeWin("p1", "01"),
      league: "duel",
      opponentId: "p2",
      characterId: "",
    };
    const base = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      players: fixedPlayers,
      wins: [old],
      favorites: [],
    };
    await pg.query("select public.smash_create_group($1,$2::jsonb)", [
      code,
      JSON.stringify(base),
    ]);
    await pg.exec(upgrade);
    await pg.exec(upgrade);
    const valid = async (data: unknown) =>
      (
        await pg.query<{ ok: boolean }>(
          "select public.smash_valid_data($1::jsonb) as ok",
          [JSON.stringify(data)],
        )
      ).rows[0].ok;
    expect(await valid(base)).toBe(true);
    const modern = {
      ...base,
      schemaVersion: 4,
      wins: [{ ...old, characterId: "01", opponentCharacterId: "02" }],
    };
    expect(await valid(modern)).toBe(true);
    expect(await valid({ ...modern, schemaVersion: 3 })).toBe(false);
    expect(
      await valid({
        ...modern,
        wins: [{ ...modern.wins[0], opponentCharacterId: "999" }],
      }),
    ).toBe(false);
    await pg.exec("set role anon");
    await pg.query("select public.smash_write_group($1,0,$2::jsonb,$3::uuid)", [
      code,
      JSON.stringify(modern),
      crypto.randomUUID(),
    ]);
    await expect(
      pg.query("select public.smash_write_group($1,1,$2::jsonb,$3::uuid)", [
        code,
        JSON.stringify(base),
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow("Client update required");
    const result = await pg.query<{
      state: { revision: number; data: typeof modern };
    }>("select public.smash_read_group($1) as state", [code]);
    expect(result.rows[0].state.revision).toBe(1);
    expect(result.rows[0].state.data).toEqual(modern);
  } finally {
    await pg.close();
  }
}, 30000);
