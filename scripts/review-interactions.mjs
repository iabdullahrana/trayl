import { chromium } from "file:///C:/Users/ra654/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const results = [];
try {
  const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    }),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const visit = (route) =>
    page.goto(`http://127.0.0.1:3200${route}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
  async function check(name, fn) {
    try {
      await fn();
      results.push({ name, pass: true });
      console.log("PASS", name);
    } catch (e) {
      results.push({ name, pass: false, error: String(e) });
      console.log("FAIL", name, String(e));
    }
  }
  async function overflow() {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  async function screenshot(name) {
    await page.screenshot({
      path: `tests/ui-preview/artifacts/${name}.png`,
      fullPage: true,
    });
  }
  await check(
    "Mobile search expands with keyboard and keeps its form in the viewport",
    async () => {
      await visit("/search?from=Jaipur&to=Gurgaon");
      const toggle = page.getByRole("button", { name: /Jaipur.*Gurgaon/ });
      await toggle.focus();
      await page.keyboard.press("Enter");
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      await overflow();
      await screenshot("375-search-expanded");
    },
  );
  await check(
    "Dashboard arrows move the selected tab and accepted request reveals chat",
    async () => {
      await visit("/dashboard");
      const tab = page.getByRole("tab", { name: "My Journeys" });
      await tab.focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page
          .getByRole("tab", { name: "Requests Received" })
          .getAttribute("aria-selected"),
        "true",
      );
      await page.getByRole("button", { name: "Accept", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(3500);
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        "Open chat",
      );
      await overflow();
      await screenshot("375-request-accepted");
      await page.keyboard.press("Enter");
      await page.waitForURL("**/chat/**");
    },
  );
  await check(
    "Chat handover expands, downloads a PNG, and preserves composer space",
    async () => {
      await visit("/chat/11111111-1111-4111-8111-111111111111");
      const summary = page.locator(".chat-handover summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(900);
      await overflow();
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download delivery card" })
        .focus();
      await page.keyboard.press("Enter");
      const file = await download;
      await file.saveAs("tests/ui-preview/artifacts/delivery-card.png");
      const bounds = await page.locator("textarea").last().boundingBox();
      assert.ok(bounds.y + bounds.height <= 812);
      await screenshot("375-handover-expanded");
    },
  );
  await check(
    "Chat report dialog traps keyboard focus and Escape restores its opener",
    async () => {
      await visit("/chat/11111111-1111-4111-8111-111111111111");
      const summary = page.getByLabel("Conversation options");
      await summary.focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("button", { name: "Report conversation", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog").waitFor();
      await page.getByLabel("Reason").fill("Test reason only");
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(
            () =>
              Boolean(document.activeElement.closest("dialog")) ||
              (document.activeElement === document.body &&
                Boolean(document.querySelector("dialog:modal"))),
          ),
          true,
        );
      }
      await screenshot("375-report-dialog");
      await page.keyboard.press("Escape");
      assert.equal(
        await summary.evaluate((e) => e === document.activeElement),
        true,
      );
    },
  );
  await check(
    "Attachment preview wraps, traps focus, and returns to paperclip on Escape",
    async () => {
      await visit("/chat/11111111-1111-4111-8111-111111111111");
      await page.getByLabel("Choose PDF").setInputFiles({
        name: "long-document-name-for-layout-review.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 preview"),
      });
      await page.getByRole("dialog", { name: "Preview attachment" }).waitFor();
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(
            () =>
              Boolean(document.activeElement.closest("dialog")) ||
              (document.activeElement === document.body &&
                Boolean(document.querySelector("dialog:modal"))),
          ),
          true,
        );
      }
      await screenshot("375-attachment-preview");
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .getByRole("button", { name: "Attach a file" })
          .evaluate((e) => e === document.activeElement),
        true,
      );
    },
  );
  await check(
    "Reduced-height chat viewport keeps composer inside the visible area",
    async () => {
      await visit("/chat/11111111-1111-4111-8111-111111111111");
      await page.locator(".chat-handover summary").click();
      await page.setViewportSize({ width: 375, height: 480 });
      await page.getByRole("textbox", { name: /Message/ }).focus();
      await page.waitForTimeout(250);
      const box = await page
        .getByRole("button", { name: "Send", exact: true })
        .boundingBox();
      assert.ok(box.y + box.height <= 480);
      await overflow();
      await screenshot("375-chat-short-viewport");
      await page.setViewportSize({ width: 375, height: 812 });
    },
  );
  await check(
    "First-post pulse expires and does not replay when motion preference changes",
    async () => {
      await visit("/post-journey");
      await page.getByLabel("From city").fill("Jaipur");
      await page.getByLabel("To city").fill("Gurgaon");
      await page.locator("#travel_date").fill("2099-10-10");
      await page.locator("#travel_time").fill("17:30");
      await page
        .getByRole("button", { name: "Post journey", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("heading", { name: "Your first journey is out there" })
        .waitFor();
      await page.waitForTimeout(850);
      assert.equal(await page.locator(".first-moment").count(), 0);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      assert.equal(await page.locator(".first-moment").count(), 0);
      await screenshot("375-post-success");
    },
  );
  await check(
    "Reduced motion disables hero, route, pulse, spinner, skeleton and counter motion",
    async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const path of ["/", "/style-guide", "/motion"]) {
        await visit(path);
        assert.equal(
          await page.evaluate(() => document.getAnimations().length),
          0,
        );
      }
      await page.getByRole("button", { name: "Change count" }).focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page.locator("[data-testid=count] [aria-hidden]").textContent(),
        "9",
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Change count" })
          .evaluate((e) => getComputedStyle(e).transitionDuration),
        "0s",
      );
    },
  );
  await check(
    "Primary press has a small scale and releases; preference toggle cancels a counter tween",
    async () => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await visit("/motion");
      const button = page.getByRole("button", { name: "Change count" });
      await button.focus();
      await page.keyboard.down("Space");
      await page.waitForTimeout(130);
      const transform = await button.evaluate(
        (e) => getComputedStyle(e).transform,
      );
      assert.match(transform, /0\.97/);
      await page.keyboard.up("Space");
      await page.waitForTimeout(150);
      assert.equal(
        await button.evaluate((e) => getComputedStyle(e).transform),
        "none",
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(
        () =>
          document.querySelector("[data-testid=count] [aria-hidden]")
            ?.textContent === "9",
        { timeout: 1000 },
      );
      assert.equal(
        await page.locator("[data-testid=count] [aria-hidden]").textContent(),
        "9",
      );
      assert.equal(
        await page.evaluate(() => document.getAnimations().length),
        0,
      );
    },
  );
  results.push({
    name: "Browser page errors",
    errors,
    pass: errors.length === 0,
  });
  await writeFile(
    "tests/ui-preview/artifacts/interactions.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
if (results.some((r) => !r.pass)) process.exitCode = 1;
