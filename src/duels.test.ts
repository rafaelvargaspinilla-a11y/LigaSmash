import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { TrackerDB } from "./db";
import {
  fixedPlayers,
  makeWin,
  statistics,
  validateBackup,
  sameResult,
  pointsFor,
} from "./model";
import { applyChanges } from "./sync-model";
import schema from "../supabase/schema.sql?raw";
import migration from "../supabase/duels.sql?raw";

it("separa ligas, conserva rivales en exportación, edición e importación y sincroniza sobre copias antiguas", async () => {
  const db = new TrackerDB(crypto.randomUUID(), true);
  await db.ensureFixedPlayers();
  try {
    const trio = await db.addWin("p1", "01");
    const duel = await db.saveDuel("p2", "p1", new Date());
    expect(pointsFor(duel, "p2")).toBe(0);
    expect(
      statistics([trio, duel], fixedPlayers).ranking.find((p) => p.id === "p2")
        ?.wins,
    ).toBe(0);
    const backup = await db.exportBackup();
    expect(validateBackup(backup).wins.find((w) => w.id === duel.id)).toEqual(
      duel,
    );
    expect(
      applyChanges({ ...backup, schemaVersion: 1, wins: [trio] }, [
        { change: { kind: "add", win: duel } },
      ]).wins,
    ).toContainEqual(duel);
    await db.saveDuel("p3", "p2", new Date(), duel.id);
    const edited = (await db.wins.get(duel.id))!;
    expect(sameResult(duel, edited)).toBe(false);
    expect(edited.opponentId).toBe("p2");
    await expect(db.importBackup(backup)).rejects.toThrow();
    await expect(db.saveDuel("p1", "p1", new Date())).rejects.toThrow();
    await db.deleteWin(duel.id);
    expect(await db.wins.toArray()).toEqual([trio]);
  } finally {
    await db.delete();
  }
});
it("rechaza duelos inválidos y no interpreta datos antiguos como 1vs1", () => {
  const base = {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    players: fixedPlayers,
    favorites: [],
    wins: [
      {
        ...makeWin("p1", "01"),
        league: "duel",
        opponentId: "p2",
        characterId: "",
      },
    ],
  };
  expect(validateBackup(base).wins[0].league).toBe("duel");
  for (const change of [
    { opponentId: "p1" },
    { opponentId: "p4" },
    { league: "other" },
    { characterId: "01" },
    { placements: ["p1", "p2", "p3"] },
  ])
    expect(() =>
      validateBackup({ ...base, wins: [{ ...base.wins[0], ...change }] }),
    ).toThrow();
  expect(() => validateBackup({ ...base, schemaVersion: 2 })).toThrow();
  expect(
    validateBackup({ ...base, schemaVersion: 1, wins: [makeWin("p1", "01")] })
      .wins[0].league,
  ).toBeUndefined();
});
it("SQL: migración repetible, valida duelos y bloquea clientes que borrarían la liga", async () => {
  const pg = new PGlite();
  try {
    await pg.exec("create role anon; create role authenticated;");
    await pg.exec(schema);
    await pg.exec(migration);
    await pg.exec(migration);
    const duel = {
      ...makeWin("p1", "01"),
      characterId: "",
      league: "duel",
      opponentId: "p2",
    };
    const backup = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      players: fixedPlayers,
      favorites: [],
      wins: [duel],
    };
    const valid = async (b: unknown) =>
      (
        await pg.query<{ valid: boolean }>(
          "select public.smash_valid_data($1::jsonb) as valid",
          [JSON.stringify(b)],
        )
      ).rows[0].valid;
    expect(await valid(backup)).toBe(true);
    expect(
      await valid({ ...backup, wins: [{ ...duel, opponentId: "p1" }] }),
    ).toBe(false);
    expect(await valid({ ...backup, schemaVersion: 2 })).toBe(false);
    const code = "b".repeat(64);
    await pg.exec("set role anon");
    await pg.query("select public.smash_create_group($1,$2::jsonb)", [
      code,
      JSON.stringify(backup),
    ]);
    await expect(
      pg.query("select public.smash_write_group($1,0,$2::jsonb,$3::uuid)", [
        code,
        JSON.stringify({ ...backup, schemaVersion: 2, wins: [] }),
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow("Client update required");
    const result = await pg.query<{ state: { data: typeof backup } }>(
      "select public.smash_read_group($1) as state",
      [code],
    );
    expect(result.rows[0].state.data.wins).toEqual([duel]);
  } finally {
    await pg.close();
  }
}, 30000);
