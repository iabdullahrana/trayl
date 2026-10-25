import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const css = readFileSync(resolve(root, "app/globals.css"), "utf8");
const rgb = (hex) => hex.match(/.{2}/g).map((value) => parseInt(value, 16));
const token = (name) =>
  rgb(css.match(new RegExp(`--${name}: #([a-f0-9]{6});`, "i"))[1]);
const luminance = (values) =>
  values
    .map((value) => value / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    );
const contrast = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
const paper = token("paper"),
  ink = token("ink"),
  danger = token("danger");
const pairs = [
  ["sage / paper", token("sage"), paper],
  ["paper / ink", paper, ink],
  ["dark-surface sage / ink", token("sage-on-ink"), ink],
  ["ink / signal", ink, token("signal")],
  ["danger / paper", danger, paper],
  [
    "danger / 10% danger tint",
    danger,
    danger.map((c, i) => 0.1 * c + 0.9 * paper[i]),
  ],
  ["paper / solid danger", paper, danger],
];
for (const [name, foreground, background] of pairs) {
  const value = contrast(foreground, background);
  assert.ok(value >= 4.5, `${name}: ${value} is below 4.5`);
  console.log(`PASS ${name}: ${value.toFixed(2)}:1`);
}
for (const name of [
  "ink",
  "paper",
  "signal",
  "deep",
  "sage",
  "amber",
  "danger",
  "sage-on-ink",
  "sage-on-paper",
]) {
  const channels = css
    .match(new RegExp(`--${name}-rgb: ([0-9 ]+);`))[1]
    .trim()
    .split(/\s+/)
    .map(Number);
  assert.deepEqual(token(name), channels, `${name} hex/RGB token mismatch`);
}
const expected = [
  "dashboard-match-draw",
  "first-moment",
  "landing-route-draw",
  "skeleton-shimmer",
];
const keyframes = [...css.matchAll(/@keyframes ([\w-]+)/g)]
  .map((match) => match[1])
  .sort();
assert.deepEqual(keyframes, expected, "Unexpected decorative motion");
assert.match(
  css,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important;[\s\S]*?transition: none !important;[\s\S]*?scroll-behavior: auto !important;/,
);
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(resolve(directory, entry.name))
      : [resolve(directory, entry.name)],
  );
}
for (const file of [
  ...walk(resolve(root, "app")),
  ...walk(resolve(root, "components")),
].filter((file) => /\.tsx$/.test(file))) {
  const source = readFileSync(file, "utf8");
  assert.ok(!source.includes("\ufffd"), `Replacement glyph in ${file}`);
  assert.ok(
    !/\b(?:transition-(?:all|colors|opacity|transform)|animate-(?:bounce|pulse|ping)|hover:(?:scale|translate|rotate)-)/.test(
      source,
    ),
    `Incidental motion in ${file}`,
  );
}
console.log(
  "PASS token pairs stay synchronized; only allowlisted motion keyframes; reduced motion explicitly disables animation/transition.",
);
console.log(
  "STATIC AUDIT ONLY: browser viewport/keyboard evidence is recorded separately in DESIGN_REVIEW.md and tests/ui-preview/artifacts.",
);
