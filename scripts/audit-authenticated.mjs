// Run locally; credentials stay in a temporary browser profile, never in reports.
import { chromium } from "file:///C:/Users/ra654/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const chat = new URL(process.argv[2] || "https://trayl-ten.vercel.app/");
if (chat.origin !== "https://trayl-ten.vercel.app" || !/^\/chat\/[0-9a-f-]{36}$/.test(chat.pathname)) {
  throw new Error("Pass your accepted chat URL as the first argument.");
}
mkdirSync("performance", { recursive: true });
const temporaryProfile = mkdtempSync(join(tmpdir(), "trayl-audit-"));
const context = await chromium.launchPersistentContext(temporaryProfile, {
  headless: false,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--remote-debugging-port=9223"],
});
const terminal = createInterface({ input: stdin, output: stdout });
try {
  // Use the default context so Lighthouse's new tab shares the manual login.
  const page = await context.newPage();
  await page.goto("https://trayl-ten.vercel.app/login");
  await terminal.question("Log in in the browser, then press Enter here. Do not type credentials here. ");
  await page.goto(chat.href);
  if (!page.url().includes(chat.pathname)) throw new Error("The account cannot open this accepted chat.");
  console.log("Authenticated chat opened. Keep this browser open and tell Codex you are ready.");
  await terminal.question("Press Enter only when Codex has finished the audit to close this temporary session. ");
} finally {
  terminal.close();
  await context.close();
  const target = resolve(temporaryProfile);
  if (target.startsWith(resolve(tmpdir()) + "\\trayl-audit-")) rmSync(target, { recursive: true, force: true });
}
