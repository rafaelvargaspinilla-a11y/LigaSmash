import { test, expect, type BrowserContext } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
test("dos dispositivos: grupo privado, cambios offline, fusión y respuesta perdida", async ({
  page,
  context,
  browser,
}) => {
  const pg = new PGlite();
  await pg.exec("create role anon;create role authenticated;");
  await pg.exec(readFileSync(resolve("supabase/schema.sql"), "utf8"));
  await pg.exec("set role anon");
  let offlineA = false;
  let dropNextReply = false;
  const bind = async (ctx: BrowserContext, isA = false) =>
    ctx.route("**/rest/v1/rpc/**", async (route) => {
      if (isA && offlineA) {
        await route.abort("internetdisconnected");
        return;
      }
      const name = new URL(route.request().url()).pathname.split("/").at(-1);
      const params = route.request().postDataJSON();
      const calls: Record<string, { sql: string; args: unknown[] }> = {
        smash_create_group: {
          sql: "select public.smash_create_group($1,$2::jsonb) as value",
          args: [params.group_code, JSON.stringify(params.initial_data)],
        },
        smash_read_group: {
          sql: "select public.smash_read_group($1,$2::uuid) as value",
          args: [params.group_code, params.batch_id ?? null],
        },
        smash_write_group: {
          sql: "select public.smash_write_group($1,$2,$3::jsonb,$4::uuid) as value",
          args: [
            params.group_code,
            params.expected_revision,
            JSON.stringify(params.new_data),
            params.batch_id,
          ],
        },
      };
      try {
        const call = calls[name!];
        const result = await pg.query<{ value: unknown }>(call.sql, call.args);
        if (name === "smash_write_group" && dropNextReply) {
          dropNextReply = false;
          await route.abort("failed");
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(result.rows[0].value),
        });
      } catch {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: '{"message":"Group unavailable"}',
        });
      }
    });
  const second = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    await bind(context, true);
    await bind(second);
    await page.goto("./");
    await expect(
      page.getByRole("heading", { name: "Vuestra arena." }),
    ).toBeVisible();
    const add = async (p: typeof page, player: string, fighter: string) => {
      await p
        .getByRole("button", { name: "Registrar partida", exact: true })
        .click();
      const form = p.getByRole("dialog", {
        name: "Registrar partida",
      });
      await form.getByRole("button", { name: player, exact: true }).click();
      await form
        .getByRole("button", {
          name: `Segundo: ${player === "Carlos" ? "Rafa" : "Carlos"}`,
          exact: true,
        })
        .click();
      await form.getByLabel("Buscar luchador", { exact: true }).fill(fighter);
      await form.getByRole("button", { name: fighter, exact: true }).click();
      for (const [slot, name] of [
        [2, "Link"],
        [3, "Kirby"],
      ] as const) {
        await form
          .getByRole("button", {
            name: `Personaje del puesto ${slot}`,
            exact: true,
          })
          .click();
        await form.getByLabel("Buscar luchador", { exact: true }).fill(name);
        await form.getByRole("button", { name, exact: true }).click();
      }
      await form
        .getByRole("button", { name: "Registrar partida", exact: true })
        .click();
      await expect(form).toBeHidden();
    };
    await add(page, "Rafa", "Mario");
    await page.getByRole("button", { name: "Abrir ajustes" }).click();
    await page
      .getByRole("button", { name: "Crear grupo con estos datos" })
      .click();
    await expect(
      page.getByRole("button", { name: "Mostrar código" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mostrar código" }).click();
    const code = await page
      .getByLabel("Código privado del grupo", { exact: true })
      .inputValue();
    expect(code).toMatch(/^[a-f0-9]{64}$/);
    await page
      .getByRole("dialog", { name: "Ajustes de la arena" })
      .getByRole("button", { name: "Cerrar", exact: true })
      .click();
    const b = await second.newPage();
    await b.goto("./");
    await b.getByRole("button", { name: "Abrir ajustes" }).click();
    await b.getByLabel("Código privado del grupo", { exact: true }).fill(code);
    await b.getByRole("button", { name: "Unirme al grupo" }).click();
    await b
      .getByRole("dialog", { name: "Ajustes de la arena" })
      .getByRole("button", { name: "Cerrar", exact: true })
      .click();
    await expect(b.locator(".win-row")).toHaveCount(1);
    await add(b, "Carlos", "Daisy");
    await expect(page.locator(".win-row")).toHaveCount(2, { timeout: 15000 });
    offlineA = true;
    await context.setOffline(true);
    await add(page, "Andrés", "Sora");
    await page.reload();
    await expect(page.locator(".win-row")).toHaveCount(3);
    await expect(b.locator(".win-row")).toHaveCount(2);
    await add(b, "Rafa", "Kirby");
    await expect(b.locator(".win-row")).toHaveCount(3);
    offlineA = false;
    await context.setOffline(false);
    await expect(page.locator(".win-row")).toHaveCount(4, { timeout: 15000 });
    await expect(b.locator(".win-row")).toHaveCount(4, { timeout: 15000 });
    dropNextReply = true;
    await add(b, "Carlos", "Cloud");
    await expect(page.locator(".win-row")).toHaveCount(5, { timeout: 15000 });
    await b.reload();
    await expect(b.locator(".win-row")).toHaveCount(5);
    await b.getByRole("button", { name: "Abrir ajustes" }).click();
    await expect(
      b.getByRole("dialog", { name: "Ajustes de la arena" }),
    ).toContainText("0 cambios pendientes", { timeout: 15000 });
    await expect(b.getByText("Conflicto:", { exact: false })).toHaveCount(0);
    const remote = (
      await pg.query<{
        data: {
          wins: Array<{
            placements: string[];
            characters: string[];
            characterId: string;
          }>;
        };
      }>("select public.smash_read_group($1)->'data' as data", [code])
    ).rows[0].data;
    expect(remote.wins).toHaveLength(5);
    expect(
      remote.wins.every(
        (w) =>
          w.placements.length === 3 &&
          w.characters.length === 3 &&
          w.characters[0] === w.characterId,
      ),
    ).toBe(true);
  } finally {
    await second.close();
    await pg.close();
  }
});
