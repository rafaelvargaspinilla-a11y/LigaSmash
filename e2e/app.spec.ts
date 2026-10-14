import { test, expect } from "@playwright/test";
async function setup(page: import("@playwright/test").Page) {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Vuestra arena." }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Bienvenidos a vuestra arena" }),
  ).toHaveCount(0);
  await expect(page.locator(".ranking-grid")).toContainText("Rafa");
  await expect(page.locator(".ranking-grid")).toContainText("Carlos");
  await expect(page.locator(".ranking-grid")).toContainText("Andrés");
}
async function add(
  page: import("@playwright/test").Page,
  player = "Rafa",
  fighter = "Mario",
) {
  await page
    .locator(".sidebar nav:visible, .mobile-nav:visible")
    .getByRole("button", { name: "Inicio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar victoria", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "¿Quién se lleva la victoria?",
  });
  await dialog.getByRole("button", { name: player, exact: true }).click();
  await dialog.getByLabel("Buscar luchador").fill(fighter);
  await dialog.getByRole("button", { name: fighter, exact: true }).click();
  await dialog
    .getByRole("button", { name: "Registrar victoria", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}
test("mobile: registro, recarga, edición, eliminación y deshacer", async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.getByText("La arena está lista. Registra vuestra primera victoria."),
  ).toBeVisible();
  await add(page);
  await expect(page.getByRole("status")).toContainText("¡Victoria registrada!");
  await page.reload();
  await expect(page.locator(".win-row")).toHaveCount(1);
  await expect(
    page.locator(".ranking-card").filter({ hasText: "Rafa" }),
  ).toContainText("100");
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: "Historial" })
    .click();
  await page.getByRole("button", { name: /Editar partida de/ }).click();
  const edit = page.getByRole("dialog", { name: "Editar partida" });
  await edit.getByRole("button", { name: "Carlos", exact: true }).click();
  await edit.getByLabel("Buscar luchador").fill("Sora");
  await edit.getByRole("button", { name: "Sora", exact: true }).click();
  await edit.getByLabel("Fecha y hora local").fill("2026-10-13T14:15");
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator(".win-row")).toContainText("Carlos");
  await expect(page.locator(".win-row")).toContainText("Sora");
  await page
    .getByRole("button", { name: "Eliminar partida", exact: true })
    .click();
  await expect(page.locator(".win-row")).toHaveCount(1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar" })
    .click();
  await page
    .getByRole("button", { name: "Eliminar partida", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Eliminar partida", exact: true })
    .click();
  await expect(page.locator(".win-row")).toHaveCount(0);
  await add(page, "Andrés", "Daisy");
  await expect(page.locator(".win-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".win-row")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/smash-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("exportación e importación sin duplicados; nombres y favoritos persistentes", async ({
  page,
}) => {
  await setup(page);
  await add(page, "Rafa", "Lucina");
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: "Personajes" })
    .click();
  await page
    .getByRole("button", { name: "Añadir a favoritos: Lucina", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Quitar de favoritos: Lucina",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Abrir ajustes" }).click();
  const settings = page.getByRole("dialog", { name: "Ajustes de la arena" });
  await expect(
    settings.getByRole("button", { name: "Guardar nombres" }),
  ).toHaveCount(0);
  await expect(settings).toContainText("Rafa · Carlos · Andrés");
  const download = page.waitForEvent("download");
  await settings.getByRole("button", { name: "Exportar JSON" }).click();
  const file = await download;
  const path = await file.path();
  expect(path).toBeTruthy();
  await page.getByLabel("Archivo de copia de seguridad").setInputFiles(path!);
  await page
    .getByRole("dialog", { name: "Importar copia de seguridad" })
    .getByRole("button", { name: "Importar partidas" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "0 nuevas, 1 duplicadas",
  );
  await settings.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: "Personajes" })
    .click();
  await expect(page.locator(".favorite-players")).toContainText("Rafa");
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: "Historial" })
    .click();
  await expect(page.locator(".win-row")).toHaveCount(1);
  await expect(page.locator(".win-row")).toContainText("Rafa");
  await page.getByLabel("Archivo de copia de seguridad").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":9}'),
  });
  await page
    .getByRole("dialog", { name: "Importar copia de seguridad" })
    .getByRole("button", { name: "Importar partidas" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Copia no válida");
  await expect(page.locator(".win-row")).toHaveCount(1);
});
test("PWA precacheada funciona y registra victorias sin conexión", async ({
  page,
  context,
}) => {
  await setup(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vuestra arena." }),
  ).toBeVisible();
  await add(page, "Andrés", "Sora");
  await page.reload();
  await expect(page.locator(".win-row")).toHaveCount(1);
  await expect(page.locator(".win-row")).toContainText("Sora");
  await context.setOffline(false);
});
test("desktop: empate, filtro vacío y gráfico accesible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await add(page, "Rafa");
  await add(page, "Carlos", "Daisy");
  await expect(page.getByText("Liderato compartido")).toBeVisible();
  await expect(page.locator(".leader-tag")).toHaveCount(2);
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Estadísticas" })
    .click();
  await expect(
    page.getByRole("img", { name: /Evolución acumulada/ }),
  ).toBeVisible();
  await page.getByLabel("Periodo", { exact: true }).selectOption("custom");
  await page.getByLabel("Desde", { exact: true }).fill("2000-01-01");
  await page.getByLabel("Hasta", { exact: true }).fill("2000-01-02");
  await expect(
    page.getByText("No hay partidas en este periodo. Prueba otro filtro."),
  ).toBeVisible();
  await expect(page.locator(".ranking-card").first()).toContainText("0%");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Inicio", exact: true })
    .click();
  await page.screenshot({ path: "/tmp/smash-desktop.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("miles de partidas: totales correctos e historial paginado", async ({
  page,
}) => {
  await setup(page);
  const wins = Array.from({ length: 6000 }, (_, i) => ({
    id: `fixture-${i}`,
    playerId: `p${(i % 3) + 1}`,
    characterId: i % 2 ? "13e" : "01",
    timestamp: new Date(Date.UTC(2026, 9, 13, 0, 0, i)).toISOString(),
    localDate: "2026-10-13",
  }));
  const backup = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    players: [
      { id: "p1", name: "Rafa" },
      { id: "p2", name: "Carlos" },
      { id: "p3", name: "Andrés" },
    ],
    wins,
    favorites: [],
  };
  await page.getByLabel("Archivo de copia de seguridad").setInputFiles({
    name: "large.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page
    .getByRole("dialog", { name: "Importar copia de seguridad" })
    .getByRole("button", { name: "Importar partidas" })
    .click();
  await expect(page.getByRole("status")).toContainText("6000 nuevas", {
    timeout: 15000,
  });
  await expect(page.locator(".ranking-card").first()).toContainText(
    (2000).toLocaleString("es"),
  );
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: "Historial" })
    .click();
  await expect(page.locator(".win-row")).toHaveCount(50);
  await page.getByRole("button", { name: /Mostrar 50 más/ }).click();
  await expect(page.locator(".win-row")).toHaveCount(100);
});

test("móvil: campos sin auto-zoom y registro solo en Inicio", async ({
  page,
}) => {
  await setup(page);
  const controls = async () => {
    const fields = page.locator(
      "input:visible,select:visible,textarea:visible",
    );
    for (const field of await fields.all())
      expect(
        await field.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
      ).toBeGreaterThanOrEqual(16);
  };
  for (const section of ["Personajes", "Historial", "Estadísticas"]) {
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("button", { name: section, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Registrar victoria", exact: true }),
    ).toHaveCount(0);
    await controls();
  }
  await page.getByLabel("Periodo", { exact: true }).selectOption("custom");
  await controls();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("button", { name: "Inicio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar victoria", exact: true })
    .click();
  await controls();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir ajustes" }).click();
  await controls();
  await page.setViewportSize({ width: 844, height: 390 });
  await controls();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("plantel completo con retratos locales, sin formularios de nombres", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Registrar victoria", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const portraits = dialog.locator(".roster-grid img");
  await expect(portraits).toHaveCount(86);
  await expect
    .poll(async () =>
      portraits.evaluateAll(
        (images) =>
          images.filter(
            (i) =>
              !(i as HTMLImageElement).complete ||
              !(i as HTMLImageElement).naturalWidth,
          ).length,
      ),
    )
    .toBe(0);
  await expect(
    dialog.getByText("Retrato pendiente", { exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vuestra arena." }),
  ).toBeVisible();
  await expect(page.getByLabel("Jugador 1")).toHaveCount(0);
});
