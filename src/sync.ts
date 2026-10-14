import publicDefaults from "./public-config.json";
import { db, TrackerDB, activateDatabase } from "./db";
import { validateBackup } from "./model";
import {
  applyChanges,
  groupCode,
  validCode,
  validateRemote,
  type RemoteState,
} from "./sync-model";
interface Connection {
  url: string;
  key: string;
  code: string;
  databaseName: string;
}
export interface SyncStatus {
  databaseName: string;
  connected: boolean;
  busy: boolean;
  pending: number;
  message: string;
  lastSync?: string;
  conflict: boolean;
}
const storageKey = "smash-tracker-connection-v1";
let connection: Connection | undefined;
let inFlight: Promise<void> | undefined;
let transition = false;
let status: SyncStatus = {
  databaseName: db.name,
  connected: false,
  busy: false,
  pending: 0,
  message: "Solo en este dispositivo",
  conflict: false,
};
const listeners = new Set<() => void>();
export const subscribeSync = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getSyncStatus = () => status;
function update(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn());
}
export function publicConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL || publicDefaults.supabaseUrl,
    key:
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      publicDefaults.supabasePublishableKey,
  };
}
export function configured() {
  const { url, key } = publicConfig();
  return !!url && !!key;
}
function normalizeUrl(url: string) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    !u.hostname.endsWith(".supabase.co")
  )
    throw new Error("Usa la URL HTTPS del proyecto Supabase.");
  return u.origin;
}
async function rpc(c: Connection, method: string, params: unknown) {
  const response = await fetch(`${c.url}/rest/v1/rpc/${method}`, {
    method: "POST",
    headers: { apikey: c.key, "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    if (
      response.status === 404 ||
      response.status === 401 ||
      response.status === 403
    )
      throw new Error(
        "No se puede acceder al grupo. Comprueba su código y la configuración de Supabase.",
      );
    throw new Error(
      "Supabase no ha aceptado la operación. Revisa que esté instalado el esquema Smash Tracker.",
    );
  }
  return response.json() as Promise<unknown>;
}
async function dbName(code: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code),
  );
  return (
    "smash-tracker-group-" +
    [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 24)
  );
}
async function buildConnection(code: string): Promise<Connection> {
  if (!validCode(code))
    throw new Error(
      "El código de grupo debe contener 64 caracteres hexadecimales.",
    );
  const config = publicConfig();
  if (!config.key)
    throw new Error("Falta configurar Supabase para esta publicación.");
  return {
    url: normalizeUrl(config.url),
    key: config.key,
    code,
    databaseName: await dbName(code),
  };
}
async function installRemote(target: TrackerDB, remote: RemoteState) {
  await target.transaction(
    "rw",
    target.players,
    target.wins,
    target.pending,
    async () => {
      const pending = await target.pending.toArray();
      const merged = applyChanges(remote.data, pending);
      await target.players.clear();
      await target.players.bulkPut(merged.players);
      await target.wins.clear();
      await target.wins.bulkPut(merged.wins);
    },
  );
}
export async function connectGroup(code: string, create = false) {
  if (transition || inFlight)
    throw new Error("Espera a que termine la sincronización actual.");
  transition = true;
  try {
    const next = await buildConnection(code.trim().toLowerCase());
    const backup = create ? validateBackup(await db.exportBackup()) : undefined;
    const remote = validateRemote(
      await rpc(
        next,
        create ? "smash_create_group" : "smash_read_group",
        create
          ? {
              group_code: next.code,
              initial_data: { ...backup, favorites: [] },
            }
          : { group_code: next.code },
      ),
    );
    const target = new TrackerDB(next.databaseName, true);
    await target.open();
    try {
      await installRemote(target, remote);
      if (create)
        await target.preferences.put({
          id: "main",
          favorites: backup!.favorites,
        });
      localStorage.setItem(storageKey, JSON.stringify({ code: next.code }));
    } catch (e) {
      target.close();
      throw e;
    }
    connection = next;
    activateDatabase(target);
    update({
      databaseName: db.name,
      connected: true,
      busy: false,
      pending: await db.pending.count(),
      message: "Grupo conectado",
      conflict: false,
      lastSync: new Date().toISOString(),
    });
  } finally {
    transition = false;
  }
  await synchronize();
}
export async function createGroup() {
  const code = groupCode();
  await connectGroup(code, true);
  return code;
}
let restorePromise: Promise<void> | undefined;
export function restoreConnection() {
  return (restorePromise ??= restoreOnce());
}
async function restoreOnce() {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    const { code } = JSON.parse(stored) as { code: string };
    const next = await buildConnection(code);
    const target = new TrackerDB(next.databaseName, true);
    await target.open();
    connection = next;
    activateDatabase(target);
    update({
      databaseName: db.name,
      connected: true,
      pending: await db.pending.count(),
      message: "Conectando con el grupo…",
    });
    await synchronize();
  } catch (e) {
    update({
      message:
        e instanceof Error ? e.message : "No se pudo restaurar la conexión.",
    });
  }
}
export async function disconnectGroup() {
  if (inFlight || transition)
    throw new Error("Espera a que termine la sincronización.");
  if (await db.pending.count())
    throw new Error(
      "Hay cambios pendientes. Sincronízalos o exporta y resuelve el conflicto antes de salir.",
    );
  localStorage.removeItem(storageKey);
  connection = undefined;
  const local = new TrackerDB();
  await local.open();
  activateDatabase(local);
  update({
    databaseName: db.name,
    connected: false,
    busy: false,
    pending: 0,
    message: "Solo en este dispositivo",
    conflict: false,
    lastSync: undefined,
  });
}
export function activeCode() {
  return connection?.code ?? "";
}
export async function synchronize() {
  if (!connection || transition) return;
  if (inFlight) return inFlight;
  const c = connection;
  const target = db;
  const operation = async () => {
    update({
      busy: true,
      pending: await target.pending.count(),
      message: "Sincronizando…",
    });
    try {
      const attempt = await target.transaction(
        "rw",
        target.pending,
        target.attempts,
        async () => {
          const existing = await target.attempts.get("main");
          if (existing) return existing;
          const changes = await target.pending.toArray();
          if (!changes.length) return undefined;
          const next = {
            id: "main" as const,
            batchId: crypto.randomUUID(),
            changeIds: changes.map((p) => p.id!),
          };
          await target.attempts.put(next);
          return next;
        },
      );
      const read = (await rpc(c, "smash_read_group", {
        group_code: c.code,
        batch_id: attempt?.batchId ?? null,
      })) as { acknowledged?: boolean };
      let remote = validateRemote(read);
      const acknowledge = async () => {
        if (!attempt) return;
        await target.transaction(
          "rw",
          target.pending,
          target.attempts,
          async () => {
            await target.pending.bulkDelete(attempt.changeIds);
            if (
              (await target.attempts.get("main"))?.batchId === attempt.batchId
            )
              await target.attempts.delete("main");
          },
        );
      };
      if (attempt && read.acknowledged === true) await acknowledge();
      else if (attempt) {
        const pending = (await target.pending.toArray()).filter((p) =>
          attempt.changeIds.includes(p.id!),
        );
        let accepted = false;
        for (let retry = 0; retry < 5; retry++) {
          const merged = applyChanges(remote.data, pending);
          const reply = (await rpc(c, "smash_write_group", {
            group_code: c.code,
            expected_revision: remote.revision,
            new_data: merged,
            batch_id: attempt.batchId,
          })) as { accepted?: boolean; state?: unknown };
          remote = validateRemote(reply.state);
          if (reply.accepted === true) {
            await acknowledge();
            accepted = true;
            break;
          }
        }
        if (!accepted)
          throw new Error(
            "Hay muchos cambios simultáneos. Se reintentará la sincronización.",
          );
      }
      await installRemote(target, remote);
      update({
        pending: await target.pending.count(),
        busy: false,
        message: "Grupo actualizado",
        lastSync: new Date().toISOString(),
        conflict: false,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "No se pudo sincronizar.";
      update({
        pending: await target.pending.count(),
        busy: false,
        message: navigator.onLine
          ? message
          : "Sin conexión: tus cambios quedan pendientes",
        conflict:
          message.startsWith("Conflicto:") || message.startsWith("Conflicto "),
      });
    }
  };
  inFlight = operation();
  try {
    await inFlight;
  } finally {
    inFlight = undefined;
  }
}
// Explicit recovery after exporting: replace the cache with the current server snapshot.
export async function discardPending() {
  if (!connection || inFlight || transition)
    throw new Error("Espera a que termine la sincronización.");
  transition = true;
  try {
    const remote = validateRemote(
      await rpc(connection, "smash_read_group", {
        group_code: connection.code,
      }),
    );
    await db.transaction(
      "rw",
      db.pending,
      db.attempts,
      db.players,
      db.wins,
      async () => {
        await db.pending.clear();
        await db.attempts.clear();
        await installRemote(db, remote);
      },
    );
    update({
      pending: 0,
      message: "Copia compartida restaurada",
      conflict: false,
    });
  } finally {
    transition = false;
  }
}
