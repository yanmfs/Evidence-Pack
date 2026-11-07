// Usage: node scripts/screenshots.mjs [baseUrl]  (serve the built app first, e.g. `vite preview`)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:4173";
const out = "docs/shots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "chromium" });
for (const os of ["macos", "windows"]) {
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({
      viewport: { width: 1240, height: 820 },
      colorScheme: scheme,
      deviceScaleFactor: 2,
      locale: "pt-BR",
    });
    await page.goto(`${base}/?os=${os}`);
    await page.getByRole("heading", { name: "Seu primeiro relatório" }).waitFor();
    await page.screenshot({ path: `${out}/${os}-${scheme}-empty.png` });
    await page.goto(`${base}/?os=${os}&demo=1`);
    await page.getByRole("heading", { name: "Atendimento ao usuário" }).waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${os}-${scheme}-main.png` });
    await page.close();
  }
}
await browser.close();
