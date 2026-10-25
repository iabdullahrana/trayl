# Performance audit — baseline

Production: https://trayl-ten.vercel.app (Tokyo functions). Mobile Lighthouse, single runs; no performance code changes yet. Raw reports: home-before.json and search-before.json. Scores are not authenticated results.

| Page | Score | LCP | TBT | CLS | Top three findings |
| --- | --- | --- | --- | --- | --- |
| Public Home | 93 | 2.6s | 220ms | 0 | Unattributed forced reflow (~113ms); legacy JS (~11KiB); render-blocking CSS |
| Search | 95 | 2.3s | 210ms | 0 | Unused JS (~50KiB); unattributed forced reflow (~40ms); legacy JS (~11KiB) |
| Dashboard | Pending manual login | — | — | — | Not measured: do not report the login redirect as Dashboard |
| Chat | Pending accepted-chat access | — | — | — | Not measured |

`npx next build` passes. First-load JS: Home 98kB, Search 101kB, Dashboard 102kB, Messages 168kB, Chat 180kB. Largest route is Chat, followed by Messages. Named Lucide imports are present; no full icon namespace import found.

## Source findings (not all experimentally verified)

- Search submits explicitly; typing does not query. It calls both router.push and router.refresh, and the results effect re-fetches when the server initialResult changes: redundant request opportunities.
- Dashboard journey and request list queries have no application pagination. Search RPC has no LIMIT. Inbox chunks requests into 200-row calls but loops through every page; this still scales with all conversations on each refresh. These need real pagination, not silent truncation.
- Media uses three plain img elements, deliberately bypassing Next's shared image proxy for private signed URLs and blob previews. Use unoptimized next/image if migrating; do not expose private media to an image cache. Thumbnails reserve aspect ratio; other images need verification.
- prepareMedia decodes the image, downsizes its longest side to 1600px, and calls canvas.toBlob with WebP quality 0.8. A real upload/Storage size comparison remains pending authenticated access.
- Signed URLs are batched by visible paths, up to 50 per call, separated into inline and download groups. Mixed document/image messages may require two calls; this preserves download behavior and is not an N-per-image loop. Cache expiry is 60 minutes, refreshed shortly before expiration.
- Each thread uses one request-scoped private channel for INSERT, UPDATE, typing and presence. Its cleanup disposes activity timers/listeners and releases the channel. There is also an intentional global inbox subscription; it currently restarts on pathname changes.
- Search, Dashboard and Messages already have loading.tsx with skeletons. Root layout still waits for inbox data before rendering them for authenticated users.
- Both Space Grotesk and IBM Plex Mono use next/font/google with swap. No direct Google Fonts link.

The original section above records the pre-change baseline; deployed after-results follow below.


## Implemented and deployed (2026-10-05)

- Passed production build, lint/type validation, all 110 regression tests and 57 responsive fixture cases (375/768/1280px).
- Initial route JS: Messages 168 → 100kB; Chat 180 → 117kB. The realtime SDK is deferred until needed, not removed; total session download still includes it.
- Bounded 20-row pages (21-row lookahead) for search, dashboard journeys/requests and inbox. Requests join their journey before pagination, so large journey-ID arrays are no longer fetched. Inbox unread counts cover its visible page; the nav dot separately checks for any unread conversation globally.
- Search remains explicit-submit. Removed redundant router.refresh and re-fetching server-provided results on every initialResult update. No debounce delay needed.
- Shared inbox subscription stays mounted across client route changes; refreshes do not recreate it. Thread initialization can finish asynchronously and still disposes safely if unmounted first.
- All former img elements use unoptimized next/image with explicit dimensions. Signed URLs/blob URLs bypass the public optimizer/cache. No new public media URL or bucket introduced.
- Export canvas code is loaded only for a delivery-card download. Chat safety-banner initial rendering reserves its ordinary space rather than inserting it after mount.
- No database schema/policy change and no new fonts or palette/layout changes. Pagination controls appear only where needed.

## Real upload verification

Uploaded a clearly labeled **generated JPEG test fixture**, not a user's personal photograph, through the existing production chat UI. Source: 4000×3000, 10,459,558 bytes. Compressed preview and downloaded private Storage object: 1600×1200, 734,848 bytes. 93% size reduction; actual Storage bytes equal preview bytes. This test attachment remains in the test conversation (message deletion is not a supported feature).

The attachment changes the audited chat content. Original Chat baseline was 75; repeating the unchanged-production baseline with the same test attachment gave **57**, LCP 6.4s, CLS 0.121. Use the latter for an honest same-content after comparison. Raw signed URLs and private report content are ignored by Git and excluded from Vercel uploads.

Dashboard authenticated baseline: **90**, LCP 1.3s, TBT 420ms, CLS 0. Top flags: main-thread blocking, legacy JavaScript (~14KiB), render-blocking CSS. Original Chat: **75**, LCP 3.1s, TBT 590ms, CLS 0.121; main flags: blocking, layout shifts, oversized image delivery (~22KiB savings).

Remaining measurement caveats: single-run Lighthouse numbers vary; do not claim statistical significance. Unoptimized private thumbnails still download the original compressed asset to preserve privacy, so responsive-image savings are not claimed. Next 14 framework legacy-code/CSS flags remain; a major framework upgrade is outside this performance-only pass.


## Production after-results

Deployment: https://trayl-ten.vercel.app (deployment `dpl_D5F1HFVuTWXruhMK6diFapRWLohg`). Build succeeded. No Supabase schema/policy changes. A first deployment attempt returned Not authorized; explicitly selecting `--scope noob-308b` succeeded.

| Page | Before performance | After performance | After LCP | After TBT | After CLS |
| --- | --- | --- | --- | --- | --- |
| Home | 93 | 98 | 2.3 s | 80 ms | 0 |
| Search | 95 | 99 | 1.8 s | 90 ms | 0 |
| Dashboard | 90 | 89 | 1.1 s | 440 ms | 0 |
| Chat | 57 | 62 | 6.6 s | 470 ms | 0.04 |

Chat's comparable before score is **57**, including the exact same generated attachment used for the after run; the original pre-upload score was 75. Chat CLS improved from 0.121 to 0.040. Dashboard 90→89 is not a demonstrated improvement; the 20ms TBT difference is small and these are single lab runs, not a statistical claim.

### Live behavioral checks

The production probe confirmed one distinct request-scoped chat subscription, one unsubscribe on navigation away, and one global inbox subscription retained across Messages → Dashboard → Search. The first diagnostic run observed a retry join, not accumulating subscriptions; a subsequent complete navigation run recorded exactly one join and one leave. Server join status was successful and PostgreSQL subscription status was OK.

Search typing caused zero query requests; submitting navigated with the server result and zero duplicate `/api/journeys/search` fetches. Dashboard, its received-request tab, inbox and chat rendered without runtime errors using the authorized test account.

### Remaining measured issues

- Home/Search: framework legacy JavaScript (~11KiB), render-blocking styles and their dependency chain. No font-CDN request or image CLS was introduced.
- Dashboard: main-thread blocking remains; the measured score did not improve. Pagination bounds work as data grows but is not claimed to speed up this tiny test dataset.
- Chat: the deliberately high-entropy test image dominates transfer/LCP (Lighthouse estimates ~715KiB image-delivery savings). The original compressed private asset remains the thumbnail source. Generating separate private thumbnail variants would require a separate media-pipeline change; a shared public Next image cache was deliberately not enabled.
- Signed URLs remain memory-only and batched by inline/download type, with batches of at most 50 and 60-minute expiry. Browser cache TTL for private media was not increased merely to raise the score.
- The existing root layout still awaits authenticated inbox initialization; route-level streaming skeletons exist on all three requested routes. Removing that initial wait would require changing inbox initialization behavior, and is not claimed here.

All production after-audits completed without Lighthouse runtime errors. The two public runs used fresh headless Chrome; authenticated runs reused the manually signed-in audit browser with storage reset disabled. All used default mobile Lighthouse performance settings and ran sequentially.
