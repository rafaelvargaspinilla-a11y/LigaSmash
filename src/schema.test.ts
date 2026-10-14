import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
import schema from "../supabase/schema.sql?raw";
import { makeWin, type Backup } from "./model";
let pg: PGlite;
const code = "a".repeat(64);
const data: Backup = {
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  players: [
    { id: "p1", name: "Ana" },
    { id: "p2", name: "Luis" },
    { id: "p3", name: "Sol" },
  ],
  wins: [],
  favorites: [],
};
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec("create role anon; create role authenticated;");
  await pg.exec(schema);
}, 30000);
afterAll(async () => {
  await pg.close();
});
it("PostgreSQL: valida datos y bloquea registros malformados", async () => {
  const query = async (input: unknown) =>
    (
      await pg.query<{ valid: boolean }>(
        "select public.smash_valid_data($1::jsonb) as valid",
        [JSON.stringify(input)],
      )
    ).rows[0].valid;
  expect(await query(data)).toBe(true);
  const win = makeWin("p1", "01");
  expect(await query({ ...data, wins: [win] })).toBe(true);
  const { playerId: _, ...missing } = win;
  expect(await query({ ...data, wins: [missing] })).toBe(false);
  expect(await query({ ...data, schemaVersion: "1" })).toBe(false);
  expect(
    await query({ ...data, wins: [{ ...win, localDate: "2026-02-30" }] }),
  ).toBe(false);
  expect(await query({ ...data, wins: [{ ...win, characterId: "999" }] })).toBe(
    false,
  );
  expect(await query({ ...data, players: [] })).toBe(false);
});
it("PostgreSQL: RPC privados, CAS y reintentos idempotentes", async () => {
  await pg.exec("set role anon");
  const result = await pg.query<{ state: { revision: number } }>(
    "select public.smash_create_group($1,$2::jsonb) as state",
    [code, JSON.stringify(data)],
  );
  expect(result.rows[0].state.revision).toBe(0);
  await expect(pg.query("select * from public.smash_groups")).rejects.toThrow();
  await expect(
    pg.query("select public.smash_read_group($1)", ["b".repeat(64)]),
  ).rejects.toThrow("unavailable");
  const batch = crypto.randomUUID();
  const changed = { ...data, wins: [makeWin("p1", "01")] };
  const write = async (revision: number, payload: Backup, id: string) =>
    (
      await pg.query<{
        result: { accepted: boolean; state: { revision: number } };
      }>(
        "select public.smash_write_group($1,$2,$3::jsonb,$4::uuid) as result",
        [code, revision, JSON.stringify(payload), id],
      )
    ).rows[0].result;
  expect(await write(0, changed, batch)).toMatchObject({
    accepted: true,
    state: { revision: 1 },
  });
  expect(await write(0, data, batch)).toMatchObject({
    accepted: true,
    state: { revision: 1 },
  });
  expect(await write(0, data, crypto.randomUUID())).toMatchObject({
    accepted: false,
    state: { revision: 1 },
  });
  const read = (
    await pg.query<{ state: { acknowledged: boolean; data: Backup } }>(
      "select public.smash_read_group($1,$2::uuid) as state",
      [code, batch],
    )
  ).rows[0].state;
  expect(read.acknowledged).toBe(true);
  expect(read.data.wins).toHaveLength(1);
  await pg.exec("reset role");
});
