import { describe, it, expect } from "vitest";
import {
  filterPeriod,
  localDate,
  makeWin,
  periodBounds,
  statistics,
  validateBackup,
  type Player,
  type Win,
} from "./model";
import { fighters } from "./characters";
const players: Player[] = [
  { id: "p1", name: "Ana" },
  { id: "p2", name: "Luis" },
  { id: "p3", name: "Sol" },
];
const win = (player: Win["playerId"], time: string, character = "01"): Win =>
  makeWin(player, character, new Date(time));
describe("victorias y plantel", () => {
  it("registra identificador, ganador, personaje, hora exacta y fecha local", () => {
    const date = new Date(2026, 9, 13, 23, 50, 42);
    const w = makeWin("p1", "13e", date);
    expect(w.id).toBeTruthy();
    expect(w.timestamp).toBe(date.toISOString());
    expect(w.localDate).toBe("2026-10-13");
    expect(w.playerId).toBe("p1");
    expect(w.characterId).toBe("13e");
    expect(makeWin("p1", "13e", date).id).not.toBe(w.id);
  });
  it("incluye 86 selecciones sin IDs repetidos, todos los DLC y Echo separados", () => {
    expect(fighters).toHaveLength(86);
    expect(new Set(fighters.map((f) => f.id)).size).toBe(86);
    for (const id of [
      "13",
      "13e",
      "21",
      "21e",
      "33-35",
      "79-80",
      "82",
      "51",
      "52",
      "53",
    ])
      expect(fighters.some((f) => f.id === id)).toBe(true);
  });
  it("rechaza personajes y fechas inválidos", () => {
    expect(() => makeWin("p1", "unknown")).toThrow();
    expect(() => makeWin("p1", "01", new Date("invalid"))).toThrow();
  });
});
describe("estadísticas", () => {
  it("calcula porcentajes sobre partidas, clasificaciones con empate y personajes líderes", () => {
    const wins = [
      win("p1", "2026-10-13T10:00:00Z"),
      win("p2", "2026-10-13T10:01:00Z", "13e"),
      win("p1", "2026-10-13T10:02:00Z"),
      win("p2", "2026-10-13T10:03:00Z", "13e"),
    ];
    const s = statistics(wins, players);
    expect(s.total).toBe(4);
    expect(s.ranking.map((p) => p.percent)).toEqual([50, 50, 0]);
    expect(s.leaders.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(s.topCharacters).toHaveLength(2);
  });
  it("muestra vacío sin NaN ni falsos líderes", () => {
    const s = statistics([], players);
    expect(s.leaders).toEqual([]);
    expect(s.ranking.every((p) => p.percent === 0)).toBe(true);
    expect(s.maxStreak).toBe(0);
    expect(s.topCharacters).toEqual([]);
  });
  it("calcula rachas ordenando por hora y reinicia con un ganador distinto", () => {
    const wins = ["p1", "p1", "p2", "p1", "p1", "p1", "p3"]
      .map((p, i) => win(p as Win["playerId"], `2026-10-13T10:0${i}:00Z`))
      .reverse();
    const s = statistics(wins, players);
    expect(s.maxStreak).toBe(3);
    expect(s.ranking.find((p) => p.id === "p1")?.streak).toBe(3);
  });
  it("no arrastra rachas fuera del periodo", () => {
    const wins = [
      win("p1", "2026-10-12T12:00:00Z"),
      win("p1", "2026-10-13T12:00:00Z"),
    ];
    expect(
      statistics(filterPeriod(wins, ["2026-10-13", "2026-10-13"]), players)
        .maxStreak,
    ).toBe(1);
  });
});
describe("calendario local", () => {
  const now = new Date(2026, 9, 13, 15, 30);
  it.each([
    ["today", ["2026-10-13", "2026-10-13"]],
    ["yesterday", ["2026-10-12", "2026-10-12"]],
    ["week", ["2026-10-12", "2026-10-18"]],
    ["lastWeek", ["2026-10-05", "2026-10-11"]],
    ["month", ["2026-10-01", "2026-10-31"]],
    ["lastMonth", ["2026-09-01", "2026-09-30"]],
  ] as const)("calcula %s", (period, bounds) =>
    expect(periodBounds(period, now)).toEqual(bounds),
  );
  it("trata domingo como final de semana y cruza años", () => {
    expect(periodBounds("week", new Date(2027, 0, 3))).toEqual([
      "2026-12-28",
      "2027-01-03",
    ]);
    expect(periodBounds("lastMonth", new Date(2027, 0, 15))).toEqual([
      "2026-12-01",
      "2026-12-31",
    ]);
  });
  it("trata meses bisiestos", () =>
    expect(periodBounds("month", new Date(2024, 1, 28))).toEqual([
      "2024-02-01",
      "2024-02-29",
    ]));
  it("atraviesa el cambio de horario usando días de calendario", () => {
    expect(periodBounds("week", new Date(2026, 2, 29, 15))).toEqual([
      "2026-03-23",
      "2026-03-29",
    ]);
    expect(periodBounds("yesterday", new Date(2026, 2, 30, 0, 10))).toEqual([
      "2026-03-29",
      "2026-03-29",
    ]);
    expect(localDate(new Date(2026, 9, 25, 0, 30))).toBe("2026-10-25");
  });
  it("incluye ambos extremos de un intervalo", () => {
    const wins = [12, 13, 14].map((day) =>
      makeWin("p1", "01", new Date(2026, 9, day, 23, 59)),
    );
    expect(filterPeriod(wins, ["2026-10-13", "2026-10-14"])).toHaveLength(2);
    expect(periodBounds("custom", now, ["2026-10-13", "2026-10-14"])).toEqual([
      "2026-10-13",
      "2026-10-14",
    ]);
  });
});
describe("validación de copias", () => {
  const backup = () => ({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    players,
    wins: [win("p1", "2026-10-13T10:00:00Z")],
    favorites: ["82"],
  });
  it("valida una copia legítima", () =>
    expect(validateBackup(backup()).players).toEqual(players));
  it.each([
    "schema",
    "player",
    "fighter",
    "date",
    "duplicates",
    "names",
    "favorite",
    "timestamp",
    "overflowTimestamp",
  ])("rechaza %s sin alterar datos", (type) => {
    const b = backup();
    if (type === "schema") b.schemaVersion = 9;
    if (type === "player") b.wins[0].playerId = "p9" as Win["playerId"];
    if (type === "fighter") b.wins[0].characterId = "999";
    if (type === "date") b.wins[0].localDate = "2026-02-30";
    if (type === "duplicates") b.wins.push(b.wins[0]);
    if (type === "names")
      b.players = [{ id: "p1", name: " " }, ...players.slice(1)];
    if (type === "favorite") b.favorites = ["999"];
    if (type === "timestamp") b.wins[0].timestamp = "nonsense";
    if (type === "overflowTimestamp")
      b.wins[0].timestamp = "2026-02-30T10:00:00.000Z";
    expect(() => validateBackup(b)).toThrow();
  });
});
