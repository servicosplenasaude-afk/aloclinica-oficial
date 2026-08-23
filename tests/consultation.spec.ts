import { test, expect } from "@playwright/test";

/**
 * E2E da sala de teleconsulta.
 *
 * Cobre os caminhos que não exigem autenticação real (smoke + guards):
 * - rotas protegidas redirecionam para login;
 * - a página final da consulta encerrada não vaza em rota pública;
 * - manifest PWA canônico é servido e o app shell carrega.
 *
 * Os caminhos AUTENTICADOS (entrar na sala, IA Clínica, gravar) são exercidos
 * pelo script `scripts/abrir-consulta.mjs` contra a produção, com sessão real
 * dos usuários `medico.teste`/`paciente.teste`.
 */

const FAKE_APPT = "00000000-0000-0000-0000-000000000000";

test.describe("Teleconsulta — guards e infraestrutura", () => {
  test("rota /dashboard/consultation/:id exige autenticação", async ({ page }) => {
    await page.goto(`/dashboard/consultation/${FAKE_APPT}`);
    // ProtectedRoute manda para /paciente|/medico|/admin
    await page.waitForURL(/\/(auth|paciente|medico|admin)/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/(auth|paciente|medico|admin)/);
  });

  test("rotas pós-consulta (ranking/avaliação) exigem autenticação", async ({ page }) => {
    await page.goto(`/dashboard/rate/${FAKE_APPT}`);
    await page.waitForURL(/\/(auth|paciente|medico|admin)/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/(auth|paciente|medico|admin)/);
  });

  test("manifest PWA é servido com display standalone e ícones", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toMatch(/^\//);
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.some((i: { sizes?: string }) => i.sizes === "512x512")).toBe(true);
  });

  test("página de termos da teleconsulta está acessível", async ({ page }) => {
    await page.goto("/termo-telemedicina");
    // O conteúdo deve mencionar a Resolução CFM aplicável à teleconsulta
    await expect(page.locator("body")).toContainText(/CFM|telemedicina/i, { timeout: 10_000 });
  });

  test("app shell carrega e expõe theme-color (PWA)", async ({ page }) => {
    await page.goto("/");
    const theme = await page
      .locator('meta[name="theme-color"]')
      .first()
      .getAttribute("content");
    expect(theme).toBeTruthy();
  });
});
