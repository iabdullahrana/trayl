import { chromium } from "file:///C:/Users/ra654/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const directory = "tests/ui-preview/artifacts";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const report = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const routes = [
    "/",
    "/home",
    "/login",
    "/signup",
    "/post-journey",
    "/search?from=Jaipur&to=Gurgaon",
    "/search?from=NoMatches",
    "/dashboard",
    "/dashboard/requests-received",
    "/dashboard/requests-sent",
    "/messages",
    "/messages?empty=1",
    "/chat/11111111-1111-4111-8111-111111111111",
    "/admin",
    "/admin?empty=1",
    "/dashboard-empty",
    "/style-guide",
    "/error-demo",
    "/not-found-demo",
  ];
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({
      width,
      height: width === 375 ? 812 : width === 768 ? 1024 : 900,
    });
    for (const route of routes) {
      errors = [];
      try {
        const response = await page.goto(`http://127.0.0.1:3200${route}`, {
          waitUntil: "networkidle",
          timeout: 120000,
        });
        await page.waitForTimeout(200);
        if (route.startsWith("/search"))
          await page
            .locator('.search-results[aria-busy="false"]')
            .waitFor({ timeout: 15000 });
        const geometry = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          width: innerWidth,
          title: document.querySelector("h1")?.textContent,
          small: [
            ...document.querySelectorAll(
              "a,button,input,select,textarea,summary,[role=tab]",
            ),
          ]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.height > 0 &&
                getComputedStyle(e).visibility !== "hidden" &&
                !e.disabled &&
                !e.classList.contains("sr-only")
              );
            })
            .map((e) => {
              let r = e.getBoundingClientRect();
              if (e.matches("input[type=checkbox],input[type=radio]")) {
                const label =
                  e.closest("label") ||
                  document.querySelector(`label[for="${e.id}"]`);
                if (label) r = label.getBoundingClientRect();
              }
              return {
                tag: e.tagName,
                text: (
                  e.getAttribute("aria-label") ||
                  e.textContent ||
                  e.getAttribute("name") ||
                  ""
                )
                  .trim()
                  .slice(0, 60),
                width: r.width,
                height: r.height,
              };
            })
            .filter((e) => e.width < 43.5 || e.height < 43.5),
        }));
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        const focus = [];
        const seen = new Set();
        let firstIndex = null;
        for (let i = 0; i < 200; i++) {
          await page.keyboard.press("Tab");
          const item = await page.evaluate(() => {
            const e = document.activeElement;
            if (!e || e === document.body) return null;
            const s = getComputedStyle(e),
              r = e.getBoundingClientRect();
            return {
              index: [...document.querySelectorAll("*")].indexOf(e),
              tag: e.tagName,
              text: (
                e.getAttribute("aria-label") ||
                e.textContent ||
                e.getAttribute("name") ||
                ""
              )
                .trim()
                .slice(0, 60),
              id: e.id,
              outline: s.outlineStyle,
              outlineWidth: s.outlineWidth,
              outlineColor: s.outlineColor,
              shadow: s.boxShadow,
              pseudo: getComputedStyle(e, "::after").borderStyle,
              width: r.width,
              height: r.height,
            };
          });
          if (!item) continue;
          if (firstIndex === null) firstIndex = item.index;
          else if (item.index === firstIndex && i > 2) break;
          if (seen.has(item.index)) continue;
          seen.add(item.index);
          focus.push(item);
        }
        const missingFocus = focus.filter(
          (e) =>
            (e.outline === "none" || e.outlineWidth === "0px") &&
            e.shadow === "none" &&
            e.pseudo === "none",
        );
        const filename = `${width}-${route.replace(/[^a-z0-9]+/gi, "-") || "landing"}.png`;
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: `${directory}/${filename}`,
          fullPage: true,
        });
        const row = {
          route,
          width,
          status: response.status(),
          ...geometry,
          focusCount: focus.length,
          missingFocus,
          errors,
        };
        report.push(row);
        console.log(JSON.stringify(row));
      } catch (error) {
        const row = { route, width, error: String(error), errors };
        report.push(row);
        console.log(JSON.stringify(row));
      }
    }
  }
  await writeFile(`${directory}/audit.json`, JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
