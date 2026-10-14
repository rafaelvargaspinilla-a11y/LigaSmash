import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  makeWin,
  pointsFor,
  statistics,
  matchEntries,
  validateBackup,
  fixedPlayers,
  type Backup,
  type Placements,
} from "./model";
import { TrackerDB } from "./db";
import { sameWin, applyChanges } from "./sync-model";
const result = (order: Placements) =>
  makeWin(order[0], "01", new Date(), order);
describe("podio 3 / 1 / 0", () => {
  it("distribuye exactamente cuatro puntos por partida completa", () => {
    const w = result(["p1", "p2", "p3"]);
    expect(fixedPlayers.map((p) => pointsFor(w, p.id))).toEqual([3, 1, 0]);
    const s = statistics([w], fixedPlayers);
    expect(s.ranking.map((p) => p.points)).toEqual([3, 1, 0]);
    expect(s.ranking.find((p) => p.id === "p2")?.seconds).toBe(1);
    expect(s.ranking.find((p) => p.id === "p3")?.thirds).toBe(1);
  });
  it("ordena por puntos y conserva victorias y porcentajes", () => {
    const wins = [
      result(["p1", "p2", "p3"]),
      result(["p2", "p3", "p1"]),
      result(["p3", "p2", "p1"]),
    ];
    const s = statistics(wins, fixedPlayers);
    expect(s.leaders.map((p) => p.id)).toEqual(["p2"]);
    expect(s.ranking[0]).toMatchObject({ points: 5, wins: 1, seconds: 2 });
    expect(s.ranking[0].percent).toBeCloseTo(100 / 3);
    expect(s.victoryLeaders).toHaveLength(3);
  });
  it("comparte liderato con empate de puntos aunque las victorias sean distintas", () => {
    const wins = [result(["p1", "p2", "p3"]), result(["p2", "p1", "p3"])];
    expect(statistics(wins, fixedPlayers).leaders).toHaveLength(2);
  });
  it("mantiene datos antiguos sin inventar el segundo puesto", () => {
    const w = makeWin("p1", "01");
    const s = statistics([w], fixedPlayers);
    expect(s.incomplete).toBe(1);
    expect(s.ranking.map((p) => p.points)).toEqual([3, 0, 0]);
    expect(w.placements).toBeUndefined();
  });
  it("rechaza jugadores repetidos y primer puesto distinto del ganador", () => {
    expect(() => result(["p1", "p1", "p3"])).toThrow();
    expect(() => makeWin("p1", "01", new Date(), ["p2", "p1", "p3"])).toThrow();
  });
  it("exporta, valida y fusiona posiciones sin perderlas", () => {
    const w = result(["p1", "p3", "p2"]);
    const b: Backup = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      players: fixedPlayers,
      wins: [w],
      favorites: [],
    };
    expect(validateBackup(b).wins[0].placements).toEqual(w.placements);
    expect(
      applyChanges({ ...b, wins: [] }, [{ change: { kind: "add", win: w } }])
        .wins[0].placements,
    ).toEqual(w.placements);
    expect(sameWin(w, { ...w, placements: ["p1", "p2", "p3"] })).toBe(false);
    expect(() =>
      validateBackup({
        ...b,
        wins: [{ ...w, placements: ["p1", "p1", "p3"] }],
      }),
    ).toThrow();
  });
  it("migra copias v1 a v2 sin modificar victorias antiguas", () => {
    const w = makeWin("p1", "01");
    const b = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      players: fixedPlayers,
      wins: [w],
      favorites: [],
    };
    const normalized = validateBackup(b);
    expect(normalized.schemaVersion).toBe(2);
    expect(normalized.wins[0]).toEqual(w);
  });
  it("editar, completar podios antiguos, borrar y deshacer recalcula los puntos", async () => {
    const db = new TrackerDB(`points-${crypto.randomUUID()}`, true);
    try {
      await db.ensureFixedPlayers();
      const w = await db.addWin("p1", "01");
      await db.editWin(w.id, "p1", "01", new Date(), ["p1", "p2", "p3"]);
      expect(
        statistics(await db.wins.toArray(), fixedPlayers).ranking.find(
          (p) => p.id === "p2",
        )?.points,
      ).toBe(1);
      await db.editWin(w.id, "p1", "01", new Date(), ["p1", "p3", "p2"]);
      expect((await db.exportBackup()).wins[0].placements).toEqual([
        "p1",
        "p3",
        "p2",
      ]);
      await expect(
        db.importBackup({
          ...(await db.exportBackup()),
          wins: [
            { ...(await db.wins.get(w.id)), placements: ["p1", "p2", "p3"] },
          ],
        }),
      ).rejects.toThrow();
      await db.deleteWin(w.id);
      expect(
        statistics(await db.wins.toArray(), fixedPlayers).ranking.every(
          (p) => p.points === 0,
        ),
      ).toBe(true);
    } finally {
      await db.delete();
    }
  });
});

it("conserva el personaje de cada puesto en copias, edición y sincronización", async () => {
  const db = new TrackerDB(`chars-${crypto.randomUUID()}`, true);
  try {
    await db.ensureFixedPlayers();
    const win = await db.addWin(
      "p1",
      "01",
      new Date(),
      ["p1", "p2", "p3"],
      ["01", "13e", "82"],
    );
    const copy = await db.exportBackup();
    expect(validateBackup(copy).wins[0].characters).toEqual([
      "01",
      "13e",
      "82",
    ]);
    expect(
      matchEntries(win).map((e) => [e.playerId, e.characterId, e.points]),
    ).toEqual([
      ["p1", "01", 3],
      ["p2", "13e", 1],
      ["p3", "82", 0],
    ]);
    expect(statistics([win], fixedPlayers).characterPointsRanking).toEqual([
      ["01", 3],
      ["13e", 1],
      ["82", 0],
    ]);
    await db.editWin(
      win.id,
      "p2",
      "13e",
      new Date(),
      ["p2", "p1", "p3"],
      ["13e", "01", "82"],
    );
    const edited = (await db.wins.get(win.id))!;
    expect(edited.characters).toEqual(["13e", "01", "82"]);
    expect(
      sameWin(edited, { ...edited, characters: ["13e", "03", "82"] }),
    ).toBe(false);
    expect(() =>
      validateBackup({
        ...copy,
        wins: [{ ...win, characters: ["82", "13e", "01"] }],
      }),
    ).toThrow();
    expect(() =>
      validateBackup({
        ...copy,
        wins: [{ ...win, characters: ["01", "999", "82"] }],
      }),
    ).toThrow();
    await expect(
      db.editWin(win.id, "p2", "13e", new Date(), ["p2", "p1", "p3"]),
    ).rejects.toThrow("personajes");
  } finally {
    await db.delete();
  }
});
