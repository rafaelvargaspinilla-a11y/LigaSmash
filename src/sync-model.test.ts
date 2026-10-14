import { describe, it, expect } from "vitest";
import { applyChanges, groupCode, validCode } from "./sync-model";
import { makeWin, type Backup } from "./model";
const initial = (): Backup => ({
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  players: [
    { id: "p1", name: "Ana" },
    { id: "p2", name: "Luis" },
    { id: "p3", name: "Sol" },
  ],
  wins: [],
  favorites: [],
});
describe("fusión de cambios compartidos", () => {
  it("conserva las victorias simultáneas de dos dispositivos", () => {
    const a = makeWin("p1", "01");
    const b = makeWin("p2", "13e");
    const remote = applyChanges(initial(), [
      { change: { kind: "add", win: a } },
    ]);
    expect(
      applyChanges(remote, [{ change: { kind: "add", win: b } }]).wins,
    ).toEqual([a, b]);
  });
  it("respeta orden add → edit → delete sin resucitar partidas", () => {
    const a = makeWin("p1", "01");
    const edited = { ...a, characterId: "82" };
    expect(
      applyChanges(initial(), [
        { change: { kind: "add", win: a } },
        { change: { kind: "edit", before: a, after: edited } },
        { change: { kind: "delete", before: edited } },
      ]).wins,
    ).toEqual([]);
  });
  it("detecta ediciones concurrentes incompatibles", () => {
    const a = makeWin("p1", "01");
    const remote = { ...initial(), wins: [{ ...a, characterId: "82" }] };
    expect(() =>
      applyChanges(remote, [
        {
          change: {
            kind: "edit",
            before: a,
            after: { ...a, characterId: "13e" },
          },
        },
      ]),
    ).toThrow("Conflicto");
    expect(() =>
      applyChanges(remote, [{ change: { kind: "delete", before: a } }]),
    ).toThrow("Conflicto");
  });
  it("no recrea una partida eliminada por otro dispositivo", () => {
    const a = makeWin("p1", "01");
    expect(() =>
      applyChanges(initial(), [
        {
          change: {
            kind: "edit",
            before: a,
            after: { ...a, characterId: "82" },
          },
        },
      ]),
    ).toThrow("eliminada");
  });
  it("detecta nombres modificados por otro dispositivo", () => {
    const before = initial().players;
    const remote = initial();
    remote.players[0].name = "Otra Ana";
    expect(() =>
      applyChanges(remote, [
        {
          change: {
            kind: "players",
            before,
            after: before.map((p) => ({ ...p, name: p.name + " nuevo" })),
          },
        },
      ]),
    ).toThrow("nombres");
  });
  it("importa registros nuevos sin duplicar existentes", () => {
    const a = makeWin("p1", "01");
    const remote = { ...initial(), wins: [a] };
    const backup = { ...remote, wins: [a, makeWin("p2", "82")] };
    expect(
      applyChanges(remote, [{ change: { kind: "import", backup } }]).wins,
    ).toHaveLength(2);
  });
  it("genera códigos de 256 bits, válidos y distintos", () => {
    const a = groupCode();
    expect(validCode(a)).toBe(true);
    expect(groupCode()).not.toBe(a);
    expect(validCode("123456")).toBe(false);
  });
});
