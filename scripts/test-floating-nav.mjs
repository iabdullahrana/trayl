import { chromium } from "file:///C:/Users/ra654/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3200/dashboard", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  async function check() {
    await page.waitForTimeout(300);
    const result = await nav.evaluate((n) => {
      const links = [...n.querySelectorAll("a,button[aria-haspopup]")];
      const active = n.querySelector("[aria-current]");
      const h = n
        .querySelector(".floating-nav-highlight")
        .getBoundingClientRect();
      const a = active.getBoundingClientRect();
      return {
        targets: links.map((e) => ({
          w: e.getBoundingClientRect().width,
          h: e.getBoundingClientRect().height,
        })),
        aligned: Math.abs(h.x - a.x) < 1 && Math.abs(h.width - a.width) < 1,
        labels: n.querySelectorAll(".floating-nav-label").length,
        w: n.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.ok(result.targets.every((t) => t.w >= 44 && t.h >= 44));
    assert.ok(result.aligned);
    assert.equal(result.labels, 1);
    assert.equal(result.overflow, false);
    return result;
  }
  await check();
  await page.screenshot({
    path: "tests/ui-preview/artifacts/floating-nav-375.png",
    fullPage: false,
  });
  await nav.getByRole("link", { name: "Search", exact: true }).click();
  await page.waitForURL("**/search");
  await check();
  await nav.getByRole("link", { name: "Post Journey", exact: true }).click();
  await page.waitForURL("**/post-journey");
  await check();
  await nav.getByRole("link", { name: /Messages/ }).click();
  await page.waitForURL("**/messages");
  await check();
  assert.equal(await nav.locator(".nav-unread-dot").count(), 1);
  await nav.getByRole("button", { name: "Logout", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.keyboard.press("Tab");
  await nav.getByRole("link", { name: "Dashboard", exact: true }).focus();
  assert.equal(
    await nav
      .getByRole("link", { name: "Dashboard", exact: true })
      .evaluate((e) => getComputedStyle(e).outlineStyle),
    "solid",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await nav
      .locator(".floating-nav-highlight")
      .evaluate((e) => getComputedStyle(e).transitionDuration),
    "0s",
  );
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await check();
  }
  await page.goto("http://127.0.0.1:3200/", { waitUntil: "networkidle" });
  assert.equal(await nav.count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS 375/768/1280 sizing, 44px targets, route highlight alignment, unread dot, logout dialog, focus, reduced motion, guest hidden, no runtime errors",
  );
} finally {
  await browser.close();
}
