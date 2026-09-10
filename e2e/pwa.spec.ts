import { expect, test } from "@playwright/test";

test("PWA manifest exposes installable TR1 field metadata", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: "/dashboard/field",
    name: "TR1 Pharma",
    short_name: "TR1",
    start_url: "/dashboard/field?source=pwa",
    scope: "/",
    display: "standalone",
    theme_color: "#0e1d31",
    background_color: "#f4f0e7",
  });

  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        src: "/pwa/icon/192?v=official-svg-20260910",
        sizes: "192x192",
        type: "image/svg+xml",
      }),
      expect.objectContaining({
        src: "/pwa/icon/512?v=official-svg-20260910",
        sizes: "512x512",
        type: "image/svg+xml",
      }),
    ]),
  );
});

test("PWA icons, service worker and Apple install metadata are served", async ({ page, request }) => {
  for (const size of [180, 192, 512]) {
    const response = await request.get(`/pwa/icon/${size}`);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
    const icon = await response.text();
    expect(icon).toContain("data:image/webp;base64,");
    expect(icon).toContain("#f4f0e7");
  }

  const serviceWorker = await request.get("/sw.js");
  expect(serviceWorker.ok()).toBe(true);
  expect(await serviceWorker.text()).toContain("tr1-pwa-static-v2");

  const offline = await request.get("/offline");
  expect(offline.ok()).toBe(true);

  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /\/pwa\/icon\/180\?v=official-svg-20260910/,
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
});
