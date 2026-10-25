import { chromium } from "file:///C:/Users/ra654/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto("http://127.0.0.1:3200/post-journey");
  const from = page.getByRole("combobox", { name: "From city", exact: true });
  await from.fill("lah");
  await page.getByRole("option", { name: "Lahore", exact: true }).click();
  assert.equal(await from.inputValue(), "Lahore");
  assert.equal(
    await page.locator("input[type=hidden][name=from_city]").inputValue(),
    "Lahore",
  );
  assert.ok((await page.locator("body").innerText()).includes("Lahore"));
  await from.fill("nonsense");
  await page
    .getByRole("heading", { name: "Post a journey", exact: true })
    .click();
  assert.equal(await from.inputValue(), "Lahore");
  const to = page.getByRole("combobox", { name: "To city", exact: true });
  await to.fill("islam");
  await to.press("ArrowDown");
  await to.press("Enter");
  assert.equal(await to.inputValue(), "Islamabad");
  await to.click();
  await to.press("Escape");
  assert.equal(await page.getByRole("listbox").count(), 0);
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await from.click();
    const box = await page.getByRole("listbox").boundingBox();
    assert.ok(
      box.x >= 0 &&
        box.x + box.width <= width &&
        box.y >= 0 &&
        box.y + box.height <= 812,
    );
    assert.ok(box.height <= 242);
    const row = await page.getByRole("option").first().boundingBox();
    assert.ok(row.height >= 44);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await from.press("Escape");
  }
  await page.goto("http://127.0.0.1:3200/search");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: /Edit/ }).click();
  await page
    .getByRole("combobox", { name: "From city", exact: true })
    .fill("zzz");
  await page
    .getByRole("button", { name: "Search journeys", exact: true })
    .click();
  await page.waitForURL(/from=&to=/);
  console.log(
    "PASS: mouse/keyboard selection, invalid draft reversion, canonical FormData, Escape, optional search clearing, 375/768/1280 panel bounds and 44px rows.",
  );
} finally {
  await browser.close();
}
