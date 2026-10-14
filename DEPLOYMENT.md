# Publicar Smash Tracker

## 1. Preparar Supabase

Proyecto configurado: `https://bncipsmzhijwuwnlmngl.supabase.co`.

1. Abre el proyecto en Supabase y entra en **SQL Editor → New query**.
2. Abre [supabase/schema.sql](https://github.com/rafaelvargaspinilla-a11y/LigaSmash/blob/main/supabase/schema.sql), pulsa **Raw** y copia su contenido completo.
3. Pégalo en SQL Editor y pulsa **Run**. El resultado debe ser correcto, sin errores.

Crea solamente las tablas `smash_groups`, `smash_commits` y funciones `smash_*`. Las tablas de contabilidadd permanecen intactas. Puede volver a ejecutarse para actualizar las funciones. No necesitas proporcionar contraseñas, `service_role` ni acceso administrador a la aplicación.

La clave publishable en `src/public-config.json` es pública por diseño. No concede acceso directo a las tablas. Solo los RPC con un código de grupo válido pueden leer o modificar partidas. No cambies los permisos RLS para permitir acceso público a las tablas.

## 2. Activar GitHub Pages

1. Abre [Settings → Pages](https://github.com/rafaelvargaspinilla-a11y/LigaSmash/settings/pages).
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. En [Actions](https://github.com/rafaelvargaspinilla-a11y/LigaSmash/actions), ejecuta **Publish Smash Tracker → Run workflow** o sube cambios a `main`.
4. Espera a que `build` y `deploy` aparezcan en verde. Usa el enlace de `github-pages` que devuelve el despliegue.

El destino configurado es `https://rafaelvargaspinilla-a11y.github.io/LigaSmash/`. Solo estará disponible después de un despliegue correcto. No necesitas variables de Actions adicionales para este proyecto; las variables públicas `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` son overrides opcionales si cambias de proyecto. Nunca uses una clave secreta.

## 3. Compartir las partidas

1. En el primer móvil, Rafa, Carlos y Andrés ya aparecen configurados. Abre Ajustes → Grupo compartido → Crear grupo con estos datos.
2. Pulsa Copiar código y pásalo por un canal privado a tus amigos.
3. En los otros móviles, abre la misma app y pega el código en Unirme al grupo. No crees un grupo nuevo en cada móvil.
4. Registra una victoria y comprueba que aparece en el otro móvil en unos segundos.
5. En Safari puedes usar Compartir → Añadir a pantalla de inicio.

Conserva el código privado y exporta copias periódicamente. Si un dispositivo está sin conexión, sus cambios se subirán cuando vuelva a conectarse. Si hay un conflicto, exporta antes de descartar modificaciones locales.

## Comprobar el subdirectorio antes de publicar

```sh
VITE_BASE_PATH=/LigaSmash/ npm run build
SMASH_BASE_PATH=/LigaSmash/ npm run test:e2e
```

Para el desarrollo normal usa `npm run dev`, con base `/`. Las pruebas usan datos ficticios en contextos aislados.
