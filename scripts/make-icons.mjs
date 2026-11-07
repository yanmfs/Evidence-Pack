// Renders public/icon.svg to a 1024px PNG with Chromium; `pnpm tauri icon` produces the rest.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const icon = readFileSync("public/icon.svg", "utf8");
const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(
  `<style>html,body{margin:0;background:transparent}svg{width:1024px;height:1024px;display:block}</style>${icon}`,
);
writeFileSync("src-tauri/icon-source.png", await page.screenshot({ omitBackground: true }));
await browser.close();
