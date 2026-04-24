import { expect, test } from "@playwright/test";

test("offline page renders retry UX", async ({ page }) => {
  await page.goto("/offline");

  await expect(
    page.getByRole("heading", { name: "Pas de connexion" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Réessayer" }),
  ).toBeVisible();
});
