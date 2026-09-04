import { expect, test } from "@playwright/test";
import { adminClient, signIn } from "./test-helpers";

test("PDF mocké : prévisualisation puis confirmation crée une commande, sans écriture avant confirmation", async ({ page }) => {
  const orderNumber = `E2E-PDF-${Date.now()}`;
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/orders/new");
  await page.getByRole("button", { name: "Importer un PDF" }).click();
  await page.getByLabel(/pdf/i).setInputFiles({
    name: "commande.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("mock pdf"),
  });
  await page.getByRole("button", { name: "Analyser le PDF" }).click();
  await expect(page.getByRole("heading", { name: "Prévisualisation obligatoire" })).toBeVisible();

  await expect(page.getByLabel("Pharmacie")).toHaveValue("00000000-0000-0000-0000-000000000401");
  await expect(page.locator('input[name="brandPharmacyId"]')).toHaveValue("00000000-0000-0000-0000-000000000411");
  await expect(page.getByLabel("Produit 1")).toHaveValue("00000000-0000-0000-0000-000000000601");

  const service = adminClient();
  const { count: beforeConfirmation } = await service
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("order_number", orderNumber);
  expect(beforeConfirmation).toBe(0);

  await page.getByLabel("Numéro commande").fill(orderNumber);
  await page.getByRole("button", { name: "Envoyer à la marque" }).click();
  await expect(page.getByText("Commande envoyée à la marque.")).toBeVisible();

  await expect.poll(async () => {
    const { data } = await service
      .from("orders")
      .select("id,brand_pharmacy_id,source,order_status")
      .eq("order_number", orderNumber)
      .single();
    return data;
  }).toMatchObject({
    brand_pharmacy_id: "00000000-0000-0000-0000-000000000411",
    source: "import",
    order_status: "pending",
  });
});
