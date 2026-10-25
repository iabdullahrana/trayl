import { chromium } from "file:///C:/Users/ra654/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const id = randomUUID(),
  password = randomUUID() + "Aa1!",
  email = `logout-${id}@example.invalid`;
const sqlFile = `.logout-test-${id}.sql`;
function query(sql) {
  writeFileSync(sqlFile, sql);
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `supabase db query --linked --file ${sqlFile}`,
      ],
      { stdio: "pipe", timeout: 60000 },
    );
  } catch {
    throw Error("Temporary auth fixture database operation failed");
  } finally {
    unlinkSync(sqlFile);
  }
}
let browser;
try {
  query(
    `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) VALUES ('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"name":"Logout Test","is_adult_confirmed":true}',now(),now(),'','','','');`,
  );
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const visit = (path) =>
    page.goto("http://127.0.0.1:3100" + path, {
      timeout: 120000,
      waitUntil: "networkidle",
    });
  async function login() {
    await visit("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL("http://127.0.0.1:3100/", { timeout: 60000 });
    await page.getByRole("navigation", { name: "Main navigation" }).waitFor();
  }
  await login();
  console.log("PASS password login");
  await visit("/dashboard");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Cancel", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  console.log("PASS cancel retains session and focuses safely");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const size = await page
    .getByRole("button", { name: "Logout", exact: true })
    .boundingBox();
  assert.ok(size.width >= 44 && size.height >= 44);
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await dialog.getByRole("button", { name: "Logout", exact: true }).click();
  await page.waitForURL("**/login", { timeout: 60000 });
  console.log("PASS logout redirects to login");
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  assert.equal(
    await page.getByRole("navigation", { name: "Main navigation" }).count(),
    0,
  );
  console.log("PASS browser Back does not expose signed-in navigation");
  await visit("/dashboard");
  assert.equal(new URL(page.url()).pathname, "/login");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(new URL(page.url()).pathname, "/login");
  console.log("PASS protected route reload redirects after logout");
  await login();
  console.log("PASS login works again");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Logout", exact: true })
    .click();
  await page.waitForURL("**/login", { timeout: 60000 });
  assert.deepEqual(errors, []);
  console.log("PASS no browser runtime errors");
} finally {
  await browser?.close();
  query(
    `DELETE FROM public.profiles WHERE id='${id}'; DELETE FROM auth.users WHERE id='${id}';`,
  );
  console.log("Temporary auth account removed");
}
