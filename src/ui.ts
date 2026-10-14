import type { Player, Win } from "./model";
export const colors = ["#f25961", "#62b5f4", "#e2bd66"];
export const nameOf = (players: Player[], id: string) =>
  players.find((p) => p.id === id)?.name ?? "Jugador";
export const indexOf = (id: string) => Number(id.slice(1)) - 1;
export const formatTime = (w: Win) =>
  new Date(w.timestamp).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const errorText = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "No se ha podido guardar. Comprueba el almacenamiento del navegador.";
