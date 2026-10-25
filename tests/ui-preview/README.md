# Isolated UI review after F8

Run from the repository root:

```sh
node node_modules/next/dist/bin/next dev tests/ui-preview --hostname 127.0.0.1 --port 3200
```

This separate Next app renders production components with the production Tailwind tokens/fonts and synthetic data. Module aliases replace Supabase and server actions **only in this preview**. It is excluded from the main TypeScript project and production routes; no real accounts or messages are touched. The frame shows bottom navigation only for authenticated fixtures. `/home` represents the signed-in branch of production `/`.

Browser runners:

```sh
node scripts/review-ui.mjs
node scripts/review-interactions.mjs
```

These scripts currently use this workstation's bundled Playwright and installed Chrome executable. Generated screenshots and JSON reports are under `tests/ui-preview/artifacts/`. They test 375/768/1280px layouts, actual Tab traversal, target dimensions, and keyboard activation/dialogs/reduced-motion behavior. This is not live multi-account Supabase verification or a physical phone keyboard test.

Pages: landing, signed-in home, login/signup, post journey, search/results/empty, dashboard/tabs/empty, both request pages, inbox/empty, chat, admin/all four tables/empty, style guide, error and 404. The `/motion` fixture isolates the real counter, Button and skeleton components for preference-toggle tests. `?empty=1` enables admin/inbox empty states; `/dashboard-empty` covers the dashboard's empty lists.

Mock acceptance succeeds after 2.5 seconds. Posting succeeds (including a first-post pulse) unless From city is `Error`. Chat handover is an already completed fixture; PNG download is real canvas output. Other mutations return controlled preview responses. No messages are broadcast or stored.
