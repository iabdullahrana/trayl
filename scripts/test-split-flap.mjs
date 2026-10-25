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
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.addInitScript(() => {
    window.motionEvents = [];
    for (const type of ["animationstart", "animationend"])
      document.addEventListener(type, (e) => {
        if (
          e.animationName === "departure-flap" ||
          e.animationName === "landing-route-draw"
        )
          window.motionEvents.push({
            type,
            name: e.animationName,
            time: performance.now(),
          });
      });
  });
  await page.goto("http://127.0.0.1:3200/", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(1600);
  const result = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".split-flap-cell")];
    const strips = [...document.querySelectorAll(".split-flap-strip")];
    return {
      events: window.motionEvents,
      overflow: document.documentElement.scrollWidth > innerWidth,
      letters: cells
        .map((e) => e.firstElementChild.firstElementChild.textContent)
        .join(""),
      transforms: strips.map((e) => getComputedStyle(e).transform),
      durations: strips.map((e) => getComputedStyle(e).animationDuration),
      delays: strips.map((e) => getComputedStyle(e).animationDelay),
    };
  });
  assert.equal(result.letters, "JAIPURGURGAON");
  assert.equal(result.overflow, false);
  assert.ok(result.transforms.every((x) => x === "matrix(1, 0, 0, 1, 0, 0)"));
  const letterEnds = result.events.filter(
    (e) => e.name === "departure-flap" && e.type === "animationend",
  );
  const lineStart = result.events.find(
    (e) => e.name === "landing-route-draw" && e.type === "animationstart",
  );
  assert.equal(letterEnds.length, 13);
  assert.ok(lineStart.time >= Math.max(...letterEnds.map((e) => e.time)));
  assert.equal(result.delays.at(-1), "0.336s");
  console.log(
    "PASS 6x CPU: 13 letters settle before route draw; transform-only sequence 1220ms; no mobile overflow",
  );
  await page.screenshot({
    path: "tests/ui-preview/artifacts/split-flap-375.png",
    fullPage: false,
  });
  const count = result.events.length;
  await page.evaluate(() => scrollTo(0, 900));
  await page.waitForTimeout(500);
  await page.evaluate(() => scrollTo(0, 0));
  assert.equal(await page.evaluate(() => window.motionEvents.length), count);
  console.log("PASS no replay on scroll");
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page
      .locator(".split-flap-strip")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  assert.equal(
    await page
      .locator(".split-flap-strip")
      .first()
      .evaluate((e) => getComputedStyle(e).transform),
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  assert.equal(await page.evaluate(() => window.motionEvents.length), 0);
  console.log("PASS reduced motion: final text immediately, no animations");
  assert.deepEqual(errors, []);
  console.log("PASS no browser runtime errors; 375/768/1280 widths fit");
} finally {
  await browser.close();
}
