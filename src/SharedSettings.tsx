import { useState, useSyncExternalStore } from "react";
import { Cloud, Copy, RefreshCw, LogOut, Users } from "lucide-react";
import {
  activeCode,
  configured,
  connectGroup,
  createGroup,
  disconnectGroup,
  discardPending,
  getSyncStatus,
  subscribeSync,
  synchronize,
} from "./sync";
import { errorText } from "./ui";
export default function SharedSettings({
  onError,
  onNotice,
  allowCreate = true,
}: {
  allowCreate?: boolean;
  onError: (s: string) => void;
  onNotice: (s: string) => void;
}) {
  const state = useSyncExternalStore(subscribeSync, getSyncStatus);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try {
      await action();
      if (message) onNotice(message);
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="settings-section">
      <h3>
        <Cloud size={19} />
        Grupo compartido
      </h3>
      {!configured() ? (
        <p className="muted">
          El administrador debe configurar Supabase para esta publicación.
          Puedes seguir usando las partidas locales.
        </p>
      ) : state.connected ? (
        <>
          <p className="muted" role="status">
            {state.message} · {state.pending} cambios pendientes
            {state.lastSync
              ? ` · Última conexión: ${new Date(state.lastSync).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </p>
          <p className="muted">
            Comparte el código únicamente con tus dos amigos. Quien lo tenga
            podrá consultar y modificar las partidas de este grupo.
          </p>
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy || state.busy}
              onClick={() => run(synchronize)}
            >
              <RefreshCw size={17} />
              Sincronizar
            </button>
            <button className="secondary" onClick={() => setReveal(!reveal)}>
              {reveal ? "Ocultar código" : "Mostrar código"}
            </button>
            <button
              className="secondary"
              onClick={() =>
                run(
                  () => navigator.clipboard.writeText(activeCode()),
                  "Código copiado. Envíalo por un canal privado.",
                )
              }
            >
              <Copy size={17} />
              Copiar código
            </button>
          </div>
          {reveal && (
            <input
              className="group-code"
              aria-label="Código privado del grupo"
              readOnly
              value={activeCode()}
            />
          )}
          <button
            className="secondary full"
            disabled={busy || state.busy || state.pending > 0}
            onClick={() =>
              run(
                disconnectGroup,
                "Has vuelto a tus datos locales. La copia del grupo se conserva.",
              )
            }
          >
            <LogOut size={17} />
            Volver al modo local
          </button>
          {state.conflict && (
            <div className="sync-conflict">
              <p>
                Hay cambios incompatibles entre dispositivos. Exporta una copia
                de tus datos antes de resolverlos. Puedes conservarla e importar
                después las partidas que falten.
              </p>
              {confirmDiscard ? (
                <>
                  <p>
                    ¿Descartar los cambios pendientes de este dispositivo y
                    cargar la copia compartida? Esta acción elimina esas
                    modificaciones locales.
                  </p>
                  <div className="button-row">
                    <button
                      className="secondary"
                      onClick={() => setConfirmDiscard(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await discardPending();
                          setConfirmDiscard(false);
                        }, "Copia compartida restaurada.")
                      }
                    >
                      Descartar pendientes
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="secondary full"
                  onClick={() => setConfirmDiscard(true)}
                >
                  Resolver con la copia compartida
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="muted">
            Crea un grupo desde tus partidas actuales o únete con el código que
            te pase un amigo. Tus datos locales se conservarán por separado. Los
            favoritos son personales.
          </p>
          {allowCreate && (
            <button
              className="secondary full"
              disabled={busy}
              onClick={() =>
                run(
                  createGroup,
                  "Grupo creado. Copia su código para tus amigos.",
                )
              }
            >
              <Users size={17} />
              Crear grupo con estos datos
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => connectGroup(code), "Grupo conectado.");
            }}
          >
            <label className="date-edit">
              Código privado del grupo
              <input
                autoComplete="off"
                type="password"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                minLength={64}
                maxLength={64}
              />
            </label>
            <button
              className="primary full"
              disabled={busy || code.trim().length !== 64}
            >
              Unirme al grupo
            </button>
          </form>
        </>
      )}
    </section>
  );
}
