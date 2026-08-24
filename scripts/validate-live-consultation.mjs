import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.E2E_BASE_URL || "https://sandbox.aloclinica.com.br";
const appointmentId = process.env.E2E_APPOINTMENT_ID;
const headed = process.env.E2E_HEADED === "1";
const keepOpen = process.env.E2E_KEEP_OPEN === "1";
if (!appointmentId) throw new Error("E2E_APPOINTMENT_ID is required");

const outputDir = "test-results/live-consultation";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: !headed,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

const login = async (page, path, email) => {
  page.on("pageerror", (error) => process.stderr.write(`[pageerror] ${error.message}\n`));
  page.on("console", (message) => {
    if (message.type() === "error") process.stderr.write(`[console] ${message.text()}\n`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const url = new URL(response.url());
      process.stderr.write(`[http ${response.status()}] ${url.origin}${url.pathname}\n`);
    }
  });
  await page.goto(`${baseURL}${path}`, { waitUntil: "commit", timeout: 60_000 });
  if (path.startsWith("/medico")) {
    const accountLogin = page.getByRole("button", { name: /entrar na minha conta/i });
    await accountLogin.waitFor({ state: "visible", timeout: 30_000 });
    await accountLogin.click();
  }
  const loginForm = page.locator("form").filter({ has: page.locator('input[type="password"]') }).first();
  const emailInput = loginForm.locator('input[type="email"]');
  try {
    await emailInput.waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    throw new Error(`login unavailable at ${page.url()}: ${(await page.locator("body").innerText()).slice(0, 800)}`, { cause: error });
  }
  await emailInput.fill(email);
  await loginForm.locator('input[type="password"]').fill("Teste123!");
  await loginForm.locator('button[type="submit"]').click();
  try {
    await page.waitForURL(/dashboard/, { timeout: 30_000 });
  } catch (error) {
    throw new Error(`login failed at ${page.url()}: ${(await page.locator("body").innerText()).slice(-1000)}`, { cause: error });
  }
  await page.goto(`${baseURL}/dashboard/consultation/${appointmentId}`, { waitUntil: "commit", timeout: 60_000 });
};

const enterRoom = async (page, patient = false) => {
  const terms = page.getByRole("dialog").filter({ hasText: "Atualização dos Termos de Uso" });
  if (await terms.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false)) {
    await terms.getByRole("checkbox").check();
    await terms.getByRole("button", { name: /aceitar e continuar/i }).click();
  }
  const cookies = page.getByRole("button", { name: /aceitar todos/i });
  if (await cookies.waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false)) await cookies.click();
  try {
    await page.getByRole("heading", { name: /sala de espera/i }).waitFor({ timeout: 30_000 });
  } catch (error) {
    const role = patient ? "patient" : "doctor";
    await page.screenshot({ path: `${outputDir}/${role}-blocked.png`, fullPage: true });
    const text = (await page.locator("body").innerText()).slice(0, 1200);
    throw new Error(`${role} blocked at ${page.url()}: ${text}`, { cause: error });
  }
  if (patient) {
    const sign = page.getByRole("button", { name: /ler e assinar tcle/i });
    if (await sign.isVisible().catch(() => false)) {
      await sign.click();
      const scrollArea = page.locator('[data-radix-scroll-area-viewport]');
      await scrollArea.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
      await page.getByRole("button", { name: /aceitar e iniciar consulta/i }).click();
    }
  }
  const continueButton = page.getByRole("button", { name: /continuar para pré-checagem/i });
  try {
    await continueButton.waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    const text = (await page.locator("body").innerText()).slice(0, 1200);
    throw new Error(`requirements blocked at ${page.url()}: ${text}`, { cause: error });
  }
  await continueButton.click();
  const directFallback = page.getByRole("button", { name: /usar conex[aã]o direta/i });
  if (await directFallback.waitFor({ state: "visible", timeout: 8_000 }).then(() => true).catch(() => false)) {
    await directFallback.click();
  }
  const roomStatus = page.getByText(/aguardando outro participante|p2p ativo|conectad[oa]|conectando/i).first();
  if (await roomStatus.waitFor({ state: "visible", timeout: 8_000 }).then(() => true).catch(() => false)) return;
  const enter = page.getByRole("button", { name: /entrar (na consulta|mesmo assim)/i });
  try {
    await enter.waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    const role = patient ? "patient" : "doctor";
    await page.screenshot({ path: `${outputDir}/${role}-precheck.png`, fullPage: true });
    throw new Error(`precheck blocked at ${page.url()}: ${(await page.locator("body").innerText()).slice(0, 1200)}`, { cause: error });
  }
  await enter.click();
};

try {
  const patientContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] });
  const doctorContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["camera", "microphone"] });
  const patient = await patientContext.newPage();
  const doctor = await doctorContext.newPage();

  await login(patient, "/paciente", "paciente@teste.com");
  await enterRoom(patient, true);
  await login(doctor, "/medico?acesso=entrar", "medico@teste.com");
  await enterRoom(doctor, false);

  await Promise.all([
    patient.getByText(/aguardando|conectado|p2p ativo/i).first().waitFor({ timeout: 30_000 }).catch(() => {}),
    doctor.getByText(/aguardando|conectado|p2p ativo/i).first().waitFor({ timeout: 30_000 }).catch(() => {}),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  await patient.screenshot({ path: `${outputDir}/patient-mobile.png`, fullPage: true });
  await doctor.screenshot({ path: `${outputDir}/doctor-desktop.png`, fullPage: true });
  await doctor.setViewportSize({ width: 768, height: 1024 });
  await doctor.screenshot({ path: `${outputDir}/doctor-tablet.png`, fullPage: true });

  const result = {
    patientUrl: patient.url(), doctorUrl: doctor.url(),
    patientHorizontalOverflow: await patient.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    doctorHorizontalOverflow: await doctor.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (keepOpen) {
    process.stdout.write("Consulta aberta. Feche as janelas do navegador para encerrar.\n");
    await new Promise((resolve) => browser.on("disconnected", resolve));
  }
  await patientContext.close();
  await doctorContext.close();
} finally {
  await browser.close();
}
