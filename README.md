# Smash Tracker

Aplicación para registrar las victorias de un grupo fijo de tres jugadores de Super Smash Bros. Ultimate. React + TypeScript + Vite, Tailwind CSS, Dexie/IndexedDB, Supabase y PWA. Modo local o grupo compartido sin cuentas de jugadores. Empieza sin partidas ficticias.

## Desarrollo

Requisitos: Node.js 22.12+ (probado con 24.19), npm.

```sh
npm ci
npm run dev
```

Abre la dirección que indica Vite. Configura los tres nombres; selecciona ganador, luchador y **Registrar victoria**. Puedes marcar favoritos en Personajes. Los últimos luchadores usados aparecen primero al registrar. El aviso permite deshacer; Historial permite editar fecha/hora/ganador/luchador y eliminar previa confirmación. Los nombres se cambian en Ajustes sin perder registros.

```sh
npm test
npm run build
npm run preview
```

Pruebas de registro, porcentajes, empates, rachas, calendario local, edición, eliminación, exportación, importación y transacciones IndexedDB. Para comprobar cambios de horario y fechas en otra zona:

```sh
TZ=Europe/Madrid npm test
TZ=America/New_York npm test
```

Para las pruebas de navegador (Chromium):

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

En Linux con Chromium del sistema, las pruebas lo usan automáticamente. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permite indicar otra ruta. La suite verifica vistas móvil/escritorio, CRUD, importación, favoritos y registro offline. No sustituye las pruebas en un iPhone real.

`dist/` es el resultado de producción, incluyendo manifest y service worker. En desarrollo no se activa el service worker. `npm run preview` sirve la compilación; no es un servidor para despliegues públicos.

## Uso desde un móvil y sin conexión

Para probar en la misma red Wi-Fi, ejecuta `npm run dev` y abre en el teléfono `http://IP-DEL-ORDENADOR:5173` (permite el puerto en el cortafuegos si hace falta). Esto permite probar la interfaz; la PWA requiere HTTPS, excepto localhost en el propio dispositivo.

El workflow `.github/workflows/pages.yml` publica en GitHub Pages bajo `/LigaSmash/` al subir a `main`. Activa primero Settings → Pages → Source → GitHub Actions. Consulta [DEPLOYMENT.md](DEPLOYMENT.md) para configurar el almacenamiento compartido. `VITE_BASE_PATH` adapta automáticamente recursos, iconos, manifest y service worker al subdirectorio. En Safari/iPhone abre la URL HTTPS, usa Compartir → Añadir a pantalla de inicio. En Android usa Instalar aplicación. Visita primero con conexión: el service worker precachea la aplicación y sus imágenes locales; después podrás abrirla sin conexión. Las actualizaciones se aplican al cerrar las instancias y volver a abrir. Cada push a `main` comprueba las pruebas y compila antes de publicar.

## Datos y copias

Los IDs `p1`, `p2`, `p3` permanecen estables. Cada victoria tiene UUID, ganador, luchador, timestamp ISO UTC exacto y fecha local `YYYY-MM-DD` tomada al registrar. Las semanas son lunes–domingo; los meses son naturales. El calendario usa operaciones de fecha local, nunca sumas de 24 horas para avanzar días. La fecha local guardada se conserva al importar incluso si se cambia de zona horaria; la hora mostrada se presenta en la zona del dispositivo actual. Las rachas se calculan por orden cronológico dentro del periodo, sin arrastrar partidas anteriores. Para marcas de tiempo idénticas se desempata por ID. Los líderes y personajes favoritos empatados se muestran juntos. El gráfico representa victorias acumuladas, agrupando hasta 32 muestras de fechas sin perder registros.

Solo se conoce el personaje ganador. Los porcentajes por personaje indican qué parte de las victorias de ese jugador consiguió con él; **no** son tasas de éxito de los personajes.

En modo local, los datos pertenecen al navegador. En modo compartido, nombres y victorias se sincronizan con Supabase; los favoritos permanecen personales. La conexión guarda su código privado en el navegador, y su copia IndexedDB está separada de los datos locales. Borrar almacenamiento del sitio elimina los cambios aún pendientes; para recuperar el grupo compartido necesitas conservar su código. Los navegadores también pueden desalojar almacenamiento bajo presión. En Ajustes exporta JSON periódicamente, especialmente antes de cambiar de dispositivo. Es una copia manual, no una garantía de retención. Cada origen/dominio y perfil del navegador tiene sus propios datos.

Las copias llevan `schemaVersion: 1`. La importación valida jugadores, IDs, nombres, fechas, personajes y favoritos. Fusiona por ID, omite duplicados idénticos y cancela toda la transacción si un ID existente contiene datos diferentes. Conserva los nombres actuales y une favoritos. Una base vacía restaura también los nombres. Importa exclusivamente copias del mismo grupo de tres personas: los IDs son posiciones estables dentro de ese grupo. Límite de archivo: 30 MB. Nuevas versiones deben añadir migraciones Dexie y un validador explícito del esquema.

## Retratos: recursos sustituibles

No se distribuyen imágenes de Nintendo ni de terceros sin permiso verificado. Los espacios numerados son marcadores de recursos pendientes, **no** retratos ficticios ni imágenes generadas. La interfaz está preparada para cargar retratos reales locales. Consulta [public/characters/README.md](public/characters/README.md) para la lista completa de archivos que debe proporcionar un usuario con autorización. Si falta una imagen, sigue siendo posible seleccionar y registrar el luchador por nombre.

El plantel contiene 86 selecciones: los Echo tienen ID propio con sufijo `e`; Entrenador Pokémon agrupa Squirtle/Ivysaur/Charizard como una selección `33-35`; Pyra/Mythra es una selección intercambiable `79-80`. No se cuenta cada transformación como victoria independiente. Los tres tipos de Mii son entradas separadas; variantes cosméticas como Alex/Steve o héroes alternativos se agrupan bajo la misma selección. Los números proceden del plantel oficial; los nombres están localizados al español de España.

Super Smash Bros. y los personajes pertenecen a sus titulares. Proyecto personal no oficial, sin afiliación a Nintendo.

## Estructura

- `src/characters.ts`: catálogo e IDs estables.
- `src/model.ts`: modelos, calendario, estadísticas y validación pura.
- `src/db.ts`: esquema IndexedDB, operaciones transaccionales y cola de cambios.
- `src/sync.ts` y `src/sync-model.ts`: protocolo compartido y resolución de conflictos.
- `src/SharedSettings.tsx`: creación, conexión y recuperación del grupo.
- `supabase/schema.sql`: tablas privadas y RPC con acceso mediante código de grupo.
- `src/public-config.json`: URL y clave pública de cliente; no contiene secretos.
- `src/App.tsx`: navegación y coordinación de pantallas.
- `src/components.tsx`: formularios, diálogos, tarjetas y gráficos accesibles.
- `src/ui.ts`: presentación de fechas, colores e información de jugadores.
- `src/styles.css`: estilos responsive y movimiento reducido.
- `src/*.test.ts`: pruebas de lógica y persistencia con fake-indexeddb.
- `vite.config.ts`: React, Tailwind y generación PWA.

El historial muestra lotes de 50 para mantener limitada la cantidad de elementos DOM. Las estadísticas se calculan en memoria a partir de IndexedDB y se actualizan con suscripciones reactivas. Para volúmenes mucho mayores que miles de partidas, convendría introducir agregaciones incrementales.

## Grupos compartidos

Primero instala `supabase/schema.sql` en el SQL Editor del proyecto Supabase. Solo crea recursos `smash_*` y no modifica las tablas de otras aplicaciones. La URL y clave **publishable** configuradas en `src/public-config.json` son públicas y se distribuyen al navegador. Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` permiten reemplazarlas. Nunca uses `service_role`, claves secretas o contraseñas en Vite o en GitHub Pages.

En Ajustes, el primer dispositivo crea el grupo con sus datos existentes. Comparte su código de 64 caracteres en privado; los otros dispositivos pueden pegarlo en la pantalla inicial o en Ajustes. Los datos locales previos no se borran. Los favoritos se guardan en cada dispositivo. Quien posea el código puede consultar y modificar todo el grupo: guárdalo como una contraseña, no lo publiques en GitHub ni lo incluyas en la URL. El servidor conserva únicamente SHA-256 del código; las tablas no tienen acceso directo para los clientes. Si se pierde el código, no hay recuperación automática ni identidad de usuario.

Los cambios se guardan inmediatamente en IndexedDB y se encolan en la misma transacción. Una revisión del servidor evita sobrescribir cambios simultáneos; las victorias de distintos dispositivos se fusionan por ID. Un identificador persistente por lote evita duplicar cambios si se pierde una respuesta después de guardar en el servidor. Se consulta el grupo cada cinco segundos, al volver a la pestaña y al recuperar conexión. El modo compartido necesita Internet para sincronizar; sin conexión sigue guardando localmente y envía los pendientes después.

Las ediciones o eliminaciones simultáneas de una misma partida y los cambios incompatibles de nombres se detienen con un conflicto explícito. No se elige silenciosamente un ganador. Exporta tu copia local; en Ajustes puedes confirmar que descartas los pendientes y recuperas la copia compartida. Después reintroduce los cambios que quieras conservar. No puedes salir del grupo con cambios pendientes sin resolver. Las copias JSON siguen sin contener el código del grupo.

Supabase ofrece un plan gratuito con límites de almacenamiento, tráfico y actividad; no se garantiza gratuidad ilimitada. Esta versión intercambia instantáneas completas del grupo, con un máximo de 20 MiB por estado; el historial usa paginación visual y se ha probado con 6000 partidas. Para grupos mucho mayores conviene un protocolo incremental. No requiere un servidor administrado por ti. Los proyectos gratuitos pueden pausarse por inactividad; revisa su estado en Supabase si falla la conexión.

Las pruebas de sincronización ejecutan SQL PostgreSQL con PGlite y conectan dos navegadores al mismo protocolo RPC de prueba. Verifican fusión, reintentos, permisos, almacenamiento offline y cola transaccional. La comprobación del proyecto Supabase real se realiza por separado tras instalar el esquema.
