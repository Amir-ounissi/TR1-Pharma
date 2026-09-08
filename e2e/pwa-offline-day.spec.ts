import { expect, test } from "@playwright/test";

function parisBusinessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

test("la PWA rouvre la tournée préchargée à froid sans réseau et conserve un compte rendu", async ({ context, page }) => {
  const now = new Date();
  const scheduledAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const snapshot = {
    version: 1 as const,
    userId: "e2e-user",
    brandId: "e2e-brand",
    brandName: "Dermavita",
    businessDate: parisBusinessDate(now),
    dayLabel: "Aujourd’hui",
    savedAt: now.toISOString(),
    day: {
      tasks: [],
      missions: [],
      reports: [],
      follow_ups: [],
    },
    nextVisit: {
      brand_pharmacy_id: "bp-1",
      pharmacy_id: "pharmacy-1",
      name: "Pharmacie République",
      address: "1 place de la République, Paris",
      phone: null,
      latitude: null,
      longitude: null,
      status: "active",
      priority: "high",
      potential: "high",
      scheduled_at: scheduledAt,
      objective: "Réassort",
      last_interaction_at: null,
      last_order_at: null,
      next_action_type: null,
      next_action_at: null,
      primary_contact: { name: "Titulaire", phone: null },
    },
    visits: [{
      id: "visit-1",
      brandPharmacyId: "bp-1",
      pharmacyId: "pharmacy-1",
      pharmacyName: "Pharmacie République",
      city: "Paris",
      startAt: scheduledAt,
      endAt: null,
      status: "planned",
    }],
    stockAlerts: [],
  };

  await page.goto("/offline");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  }

  await page.evaluate((value) => {
    window.localStorage.setItem(
      "tr1:pwa:active-scope:v1",
      JSON.stringify({ userId: value.userId, brandId: value.brandId }),
    );
    window.localStorage.setItem("tr1:pwa:day-snapshot:v1", JSON.stringify(value));
  }, snapshot);

  await page.reload();
  await expect(page.getByText("Pharmacie République").first()).toBeVisible();
  await expect(page.getByText("Tournée préchargée")).toBeVisible();

  await context.setOffline(true);
  try {
    await page.goto("/dashboard/agent", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/offline$/);
    await expect(page.getByText("TR1 hors connexion")).toBeVisible();
    await expect(page.getByText("Pharmacie République").first()).toBeVisible();

    await page.getByLabel("Ce qu’il faut retenir").fill("Stock à surveiller, réassort à relancer.");
    await page.getByRole("button", { name: "Enregistrer sur cet appareil" }).click();
    await expect(page.getByText(/Compte rendu enregistré sur cet appareil/)).toBeVisible();

    const queued = await page.evaluate(() => {
      const actions = JSON.parse(window.localStorage.getItem("tr1:offline-actions:v1") ?? "[]") as Array<{
        kind?: string;
        scope?: string | null;
        payload?: { note?: string };
      }>;
      return actions;
    });

    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      kind: "interaction",
      scope: "e2e-brand:e2e-user",
      payload: { note: "Stock à surveiller, réassort à relancer." },
    });
  } finally {
    await context.setOffline(false);
  }
});
