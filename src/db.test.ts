import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { TrackerDB } from "./db";
let db: TrackerDB;
beforeEach(async () => {
  db = new TrackerDB(`test-${crypto.randomUUID()}`);
  await db.setupPlayers(["Ana", "Luis", "Sol"]);
});
afterEach(async () => {
  await db.delete();
});
describe("persistencia IndexedDB", () => {
  it("registra y conserva partidas al reabrir", async () => {
    const w = await db.addWin("p1", "01", new Date(2026, 9, 13, 10));
    db.close();
    await db.open();
    expect(await db.wins.get(w.id)).toEqual(w);
  });
  it("renombra conservando IDs y estadísticas", async () => {
    const w = await db.addWin("p2", "13e");
    await db.setupPlayers(["Ana", "Nuevo nombre", "Sol"]);
    expect((await db.players.get("p2"))?.name).toBe("Nuevo nombre");
    expect((await db.wins.get(w.id))?.playerId).toBe("p2");
  });
  it("edita ganador, personaje, hora y fecha sin duplicar, y elimina", async () => {
    const w = await db.addWin("p1", "01");
    const date = new Date(2026, 8, 1, 23, 42);
    await db.editWin(w.id, "p3", "82", date);
    expect(await db.wins.count()).toBe(1);
    expect(await db.wins.get(w.id)).toMatchObject({
      playerId: "p3",
      characterId: "82",
      localDate: "2026-09-01",
      timestamp: date.toISOString(),
    });
    await db.deleteWin(w.id);
    expect(await db.wins.count()).toBe(0);
  });
  it("deshace la victoria indicada sin borrar otras", async () => {
    const a = await db.addWin("p1", "01");
    const b = await db.addWin("p2", "82");
    await db.deleteWin(b.id);
    expect(await db.wins.toArray()).toEqual([a]);
  });
  it("exporta e importa sin duplicados y conserva nombres actuales", async () => {
    await db.addWin("p1", "01");
    await db.preferences.put({ id: "main", favorites: ["82"] });
    const b = await db.exportBackup();
    expect(b.schemaVersion).toBe(1);
    await db.wins.clear();
    expect(await db.importBackup(b)).toEqual({ added: 1, duplicates: 0 });
    await db.setupPlayers(["Nuevo", "Luis", "Sol"]);
    expect(await db.importBackup(b)).toEqual({ added: 0, duplicates: 1 });
    expect((await db.players.get("p1"))?.name).toBe("Nuevo");
    expect(await db.wins.count()).toBe(1);
  });
  it("cancela importación completa ante IDs conflictivos", async () => {
    await db.addWin("p1", "01");
    const b = await db.exportBackup();
    const newWin = { ...b.wins[0], id: crypto.randomUUID() };
    b.wins = [newWin, { ...b.wins[0], playerId: "p2" }];
    await expect(db.importBackup(b)).rejects.toThrow("IDs");
    expect(await db.wins.count()).toBe(1);
  });
  it("rechaza copia malformada sin mutar almacenamiento", async () => {
    await db.addWin("p1", "01");
    await expect(db.importBackup({ schemaVersion: 2 })).rejects.toThrow();
    expect(await db.wins.count()).toBe(1);
  });
  it("restaura jugadores y favoritos en una base vacía", async () => {
    const w = await db.addWin("p3", "79-80");
    await db.preferences.put({ id: "main", favorites: ["79-80"] });
    const b = await db.exportBackup();
    await db.players.clear();
    await db.wins.clear();
    await db.preferences.clear();
    await db.importBackup(b);
    expect(await db.players.count()).toBe(3);
    expect(await db.wins.get(w.id)).toEqual(w);
    expect((await db.preferences.get("main"))?.favorites).toEqual(["79-80"]);
  });
  it("rechaza editar una partida inexistente", async () => {
    await expect(db.editWin("missing", "p1", "01", new Date())).rejects.toThrow(
      "no existe",
    );
  });
});

it("encola cambios compartidos en orden y en la misma transacción", async () => {
  const shared = new TrackerDB(`shared-${crypto.randomUUID()}`, true);
  try {
    await shared.setupPlayers(["Ana", "Luis", "Sol"]);
    await shared.pending.clear();
    const win = await shared.addWin("p1", "01");
    await shared.editWin(win.id, "p2", "82", new Date());
    await shared.deleteWin(win.id);
    expect((await shared.pending.toArray()).map((p) => p.change.kind)).toEqual([
      "add",
      "edit",
      "delete",
    ]);
    expect(await shared.wins.count()).toBe(0);
  } finally {
    await shared.delete();
  }
});

it("inicializa el trío fijo una vez sin crear partidas", async () => {
  await db.players.clear();
  await db.ensureFixedPlayers();
  expect(await db.players.toArray()).toEqual([
    { id: "p1", name: "Rafa" },
    { id: "p2", name: "Carlos" },
    { id: "p3", name: "Andrés" },
  ]);
  await db.ensureFixedPlayers();
  expect(await db.wins.count()).toBe(0);
  expect(await db.pending.count()).toBe(0);
});
it("conserva el orden existente de los jugadores y sus victorias al normalizar nombres", async () => {
  await db.setupPlayers(["Carlos", "Andres", "Rafael"]);
  const win = await db.addWin("p1", "01");
  await db.ensureFixedPlayers();
  expect((await db.players.toArray()).map((p) => p.name)).toEqual([
    "Carlos",
    "Andrés",
    "Rafa",
  ]);
  expect(await db.wins.get(win.id)).toEqual(win);
});
it("migra los nombres de un grupo con un solo cambio pendiente", async () => {
  const shared = new TrackerDB(`fixed-${crypto.randomUUID()}`, true);
  try {
    await shared.setupPlayers(["Ana", "Luis", "Sol"]);
    await shared.pending.clear();
    const win = await shared.addWin("p1", "01");
    await shared.pending.clear();
    await shared.ensureFixedPlayers();
    await shared.ensureFixedPlayers();
    expect(await shared.pending.count()).toBe(1);
    expect((await shared.pending.toArray())[0].change.kind).toBe("players");
    expect(await shared.wins.get(win.id)).toEqual(win);
  } finally {
    await shared.delete();
  }
});
