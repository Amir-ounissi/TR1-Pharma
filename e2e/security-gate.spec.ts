import { expect, test } from "@playwright/test";

test("l’optimiseur d’images Next.js reste désactivé", async ({ request }) => {
  const response = await request.get("/_next/image", {
    params: {
      url: "https://example.com/untrusted.tiff",
      w: "640",
      q: "75",
    },
  });

  expect(response.status()).toBe(404);
});
