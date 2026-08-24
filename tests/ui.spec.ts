import { test, expect } from "@playwright/test";

test.describe("UI quality checks", () => {
  test("landing page has no JS errors in console", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (error) => {
      const msg = error.message.toLowerCase();
      // Filtra erros esperados em ambiente sem env vars completas / sem auth
      if (
        msg.includes("supabase") ||
        msg.includes("credenciais") ||
        msg.includes("sentry") ||
        msg.includes("workbox") ||
        msg.includes("service worker")
      ) return;
      jsErrors.push(error.message);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(jsErrors, jsErrors.join("\n")).toEqual([]);
  });

  test("página de login (/paciente) exibe botão de submit habilitado", async ({ page }) => {
    // /auth redireciona para /paciente (AuthPaciente.tsx) que tem o form visível
    await page.goto("/paciente");
    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test("landing page shows hero content", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    // Should have at least a heading
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("dark mode toggle does not break layout", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Try to find and click theme toggle if present
    const themeToggle = page.locator('[aria-label*="tema"], [aria-label*="theme"], [data-testid="theme-toggle"]');
    if (await themeToggle.count() > 0) {
      await themeToggle.first().click();
      await page.waitForTimeout(500);
      // Page should still be visible
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
