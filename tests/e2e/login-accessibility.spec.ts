import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("login has accessible labels, keyboard focus, and no axe WCAG A/AA violations", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const violations = results.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map((node) => node.target) }));
  expect(violations, JSON.stringify(violations, null, 2)).toHaveLength(0);
});
