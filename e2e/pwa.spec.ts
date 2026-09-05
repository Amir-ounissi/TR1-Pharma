import { expect, test } from "@playwright/test";

test("PWA manifest exposes installable TR1 metadata", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: "/dashboard",
    name: "TR1 Pharma",
    short_name: "TR1",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    theme_color: "#0b1e32",
    background_color: "#fffdf8",
  });

  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        src: "/pwa/icon/192",
        sizes: "192x192",
        type: "image/png",
      }),
      expect.objectContaining({
        src: "/pwa/icon/512",
        sizes: "512x512",
        type: "image/png",
      }),
    ]),
  );
});

test("PWA icons and Apple install metadata are served", async ({ page, request }) => {
  for (const size of [180, 192, 512]) {
    const response = await request.get(`/pwa/icon/${size}`);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }

  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /\/pwa\/icon\/180/,
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
});
