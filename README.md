# Smash Tracker

Aplicación para registrar las victorias de un grupo fijo de tres jugadores de Super Smash Bros. Ultimate. React + TypeScript + Vite, Tailwind CSS, Dexie/IndexedDB, Supabase y PWA. Modo local o grupo compartido sin cuentas de jugadores. Empieza sin partidas ficticias.

## Desarrollo

Requisitos: Node.js 22.12+ (probado con 24.19), npm.

```sh
npm ci
npm run dev
```

Abre la dirección que indica Vite. Rafa, Carlos y Andrés ya están configurados. Selecciona ganador, luchador y **Registrar victoria**. Puedes marcar favoritos en Personajes. Los últimos luchadores usados aparecen primero al registrar. El aviso permite deshacer; Historial permite editar fecha/hora/ganador/luchador y eliminar previa confirmación. No se solicita introducir nombres. Al actualizar, se mantienen los IDs y las victorias; si los tres nombres ya estaban asignados a otros IDs, se conserva esa asignación.

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

Los IDs `p1`, `p2`, `p3` permanecen estables. Cada partida tiene UUID, podio, personajes por jugador, timestamp ISO UTC exacto y fecha local `YYYY-MM-DD` tomada al registrar. Las semanas son lunes–domingo; los meses son naturales. El calendario usa operaciones de fecha local, nunca sumas de 24 horas para avanzar días. La fecha local guardada se conserva al importar incluso si se cambia de zona horaria; la hora mostrada se presenta en la zona del dispositivo actual. Las rachas se calculan por orden cronológico dentro del periodo, sin arrastrar partidas anteriores. Para marcas de tiempo idénticas se desempata por ID. Los líderes y personajes favoritos empatados se muestran juntos. El gráfico representa victorias acumuladas, agrupando hasta 32 muestras de fechas sin perder registros.

Las partidas nuevas registran los tres puestos y sus personajes. Los porcentajes de victorias por personaje siguen indicando qué parte de las victorias de ese jugador consiguió con él, no una tasa de éxito. Los puntos y participaciones por personaje utilizan únicamente los datos registrados. Las partidas antiguas solo tienen información del ganador.

En modo local, los datos pertenecen al navegador. En modo compartido, nombres y victorias se sincronizan con Supabase; los favoritos permanecen personales. La conexión guarda su código privado en el navegador, y su copia IndexedDB está separada de los datos locales. Borrar almacenamiento del sitio elimina los cambios aún pendientes; para recuperar el grupo compartido necesitas conservar su código. Los navegadores también pueden desalojar almacenamiento bajo presión. En Ajustes exporta JSON periódicamente, especialmente antes de cambiar de dispositivo. Es una copia manual, no una garantía de retención. Cada origen/dominio y perfil del navegador tiene sus propios datos.

Las copias nuevas llevan `schemaVersion: 2`, con `placements` y `characters` en orden de puesto; las copias antiguas v1 se importan conservando sus datos. La importación valida jugadores, IDs, nombres, fechas, personajes y favoritos. Fusiona por ID, omite duplicados idénticos y cancela toda la transacción si un ID existente contiene datos diferentes. Conserva los nombres actuales y une favoritos. Una base vacía restaura también los nombres. Importa exclusivamente copias del mismo grupo de tres personas: los IDs son posiciones estables dentro de ese grupo. Límite de archivo: 30 MB. Nuevas versiones deben añadir migraciones Dexie y un validador explícito del esquema.

## Retratos reales, guardados localmente

La aplicación incluye los 86 retratos del plantel de Ultimate, incluidos los DLC y los tres tipos de Mii por separado. Se han descargado 83 retratos de la web oficial de Nintendo y los tres retratos individuales de Mii del archivo comunitario `marcrd/smash-ultimate-assets`. Son imágenes del videojuego, sin generación artificial. Entrenador Pokémon y Pyra/Mythra usan imágenes de sus selecciones conjuntas.

Los originales compactos ocupan aproximadamente 5,7 MiB y se incluyen en la caché offline de la PWA. `public/characters/sources.json` registra URL de origen, formato, dimensiones y SHA-256 por selección. `scripts/download-portraits.py` reproduce la descarga conservando la verificación TLS y comprobando formatos. No se realizan peticiones a Nintendo durante el uso de la aplicación. Más detalles en [public/characters/README.md](public/characters/README.md).

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

## Puntos y podio completo

Cada partida nueva guarda primero, segundo y tercero y el personaje usado por cada jugador. La puntuación es fija: **3 / 1 / 0**. Basta seleccionar primero y segundo; el tercero se deduce automáticamente. Los personajes se eligen por jugador y mantienen su asociación si cambias el orden del podio al editar.

El ranking se ordena por puntos; las victorias y sus porcentajes permanecen visibles. Los empates de puntos comparten posición y liderato. El gráfico permite alternar puntos y victorias, y el historial muestra jugadores, personajes y puntos de los tres puestos. Los filtros temporales afectan a todos estos cálculos. Las tarjetas de personajes muestran sus puntos y participaciones conocidas, además de victorias.

Las partidas antiguas conservan el ganador y su personaje. Se contabilizan los 3 puntos confirmados del ganador y se señala que falta el podio; no se inventa quién quedó segundo ni con qué personaje. Completa los datos desde Historial. No se duplican partidas al completarlas.

Antes de usar este formato con un proyecto Supabase que ya tenga la versión anterior, ejecuta [supabase/points.sql](supabase/points.sql) en SQL Editor. Es una actualización transaccional de las funciones de validación y escritura; no borra grupos, partidas ni códigos. Impide que un cliente antiguo sobrescriba un grupo ya actualizado al esquema 2. Cierra todas las ventanas de versiones anteriores de la app antes de volver a abrirla.

La pestaña **1vs1** registra ganador, rival y fecha, sin personajes ni puntos. Incluye clasificación por victorias (los empates comparten puesto), porcentaje sobre los duelos disputados por cada jugador, resultados entre parejas e historial editable. Sus filtros y estadísticas son independientes de la liga de tres, que conserva la puntuación 3/1/0 y los personajes de cada puesto. Las copias y el grupo compartido incluyen ambas ligas en el esquema 3; las partidas antiguas siguen perteneciendo a la liga de tres.

En Supabase existente, ejecuta `supabase/duels.sql` antes de desplegar esta versión; no hace falta repetir `points.sql`.

La pantalla principal se titula **La liga.** y la navegación comienza con **LaLiga → 1vs1**. La liga de duelos usa las mismas tarjetas y colores que LaLiga; cada duelo nuevo exige seleccionar el personaje de cada jugador, con retratos y búsqueda. Al cambiar el orden ganador/rival, los personajes permanecen asociados al jugador. Los duelos antiguos se pueden completar desde su historial.

**Estadísticas** reúne ambas ligas con los botones **La liga / 1vs1** y un filtro de periodo común. La opción 1vs1 incluye clasificación por victorias, evolución acumulada, resultados entre parejas y victorias/derrotas por luchador y jugador. Las partidas sin personajes conservan sus resultados y no se incluyen en los recuentos de luchadores.

Las copias compartidas usan el esquema 4. En Supabase existente, ejecuta `supabase/duel-characters.sql` antes de publicar esta versión.

**Historial** reúne las partidas de ambas modalidades con los botones **La liga / 1vs1**, filtros de periodo, ganador y luchador, y edición/eliminación. El luchador de un duelo puede coincidir con el del ganador o el del rival. La pantalla 1vs1 mantiene el registro y la clasificación; su historial se consulta desde Historial.

**Personajes** también permite elegir **La liga / 1vs1** y muestra únicamente los luchadores usados en partidas del periodo seleccionado, tanto por ganadores como por los otros participantes. La selección al registrar partidas sigue incluyendo los 86 personajes.

**Jornadas de La liga:** cada jornada nueva contiene diez partidas: rondas 1–3 (partidas 1–3, 4–6 y 7–9) con personajes fijos por jugador, y ronda final (partida 10) con nueva elección y puntuación 6/2/0. Las nueve primeras mantienen 3/1/0: se reparten 44 puntos por jornada completa. Inicio muestra el avance, los personajes y la puntuación de la jornada; al completarla permite empezar otra. El historial identifica número de partida, ronda y final doble. Las partidas anteriores mantienen sus datos y 3/1/0 sin asignarlas artificialmente a jornadas; 1vs1 conserva sus reglas.

Las copias y la sincronización usan esquema 5. Ejecuta `supabase/jornadas.sql` antes de publicar este cliente. No cambia tablas, códigos ni partidas: amplía validación y conserva la protección contra versiones antiguas. Las jornadas rechazan números de partida repetidos y cambios de personaje dentro de una ronda, también al importar o combinar cambios offline. Si dos dispositivos registran sin conexión el mismo hueco de una jornada, se muestra un conflicto en vez de duplicar esa partida. Al borrar una partida se puede rellenar su hueco; las otras partidas de la ronda mantienen sus personajes.
