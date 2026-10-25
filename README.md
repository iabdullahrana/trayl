# Trayl

Trayl connects travellers willing to carry documents or small packages with
people who need them sent along the same route. Built with Next.js 14 App Router,
TypeScript, Tailwind CSS 3, and Supabase SSR.

This scaffold keeps the requested Next.js 14 version. At setup, `npm audit`
reported five dependency vulnerabilities (four high, one critical), including
Next.js advisories whose fixes require a newer major version. Upgrade to a
patched, supported Next.js release before production deployment.

## Run locally

Use Node.js 22 or newer and npm.

1. Install dependencies: `npm install` (or `npm ci` with the committed lockfile).
2. Copy `.env.local.example` to `.env.local`:
   - PowerShell: `Copy-Item .env.local.example .env.local`
   - macOS/Linux: `cp .env.local.example .env.local`
3. Replace both placeholders with your Supabase project's URL and public anon key
   from the Supabase dashboard's project API settings. Never use a service-role
   key in a `NEXT_PUBLIC_` variable. `.env.local` is ignored by Git.
4. Run `npm run dev` and open <http://localhost:3000>.

## Environment variables

These are the only application environment variables. Browser and server clients
and middleware all read them through `lib/supabase/config.ts`, using direct
`process.env.NEXT_PUBLIC_...` references so Next.js can include browser values at
build time.

| Variable                        | Required value                                                         |
| ------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase Project URL, e.g. `https://YOUR_PROJECT_REF.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The same project's public `anon` API key                               |

Set them in `.env.local` locally and in Vercel's environment settings before
building. Restart local development or redeploy Vercel after changes. No
`DATABASE_URL`, service-role key, or application URL variable is required.
The public key intentionally reaches the browser; database RLS enforces access.
Never substitute a service-role or secret key. Keep real environment files out
of source control; `.env.local.example` contains placeholders only.

## Optional local Supabase

Hosted Supabase works with `npm run dev`; Docker is only needed for the optional
local backend. Install Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).
The checked-in `supabase/config.toml` already initializes this repository; do not
run `supabase init` over it. From the repository root:

```sh
supabase start
supabase migration up --local
supabase status
```

Copy the displayed local API URL and public anon key into `.env.local`, then run
`npm run dev`. Local Auth requires email confirmation; open the mail inbox URL
shown by the CLI (port 54324), confirm, and log in with your password. Studio is
on port 54323. PostgreSQL 17 is configured; match `db.major_version` to your hosted
project if needed. Use `supabase stop` when finished. `supabase db reset` is only
for deliberately erasing and recreating local data from migrations.

To apply migrations to a hosted project instead:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Replace `YOUR_PROJECT_REF` with the target project's reference. Local config does
not configure hosted Auth; set hosted email and URL settings in the dashboard.

## Authentication setup

For hosted setup, migration commands, and Vercel settings, follow
[DEPLOYMENT.md](DEPLOYMENT.md).

Before signing up, apply the SQL files in `supabase/migrations` in order using
the Supabase SQL editor, or `supabase db push` after linking your CLI project.
Existing projects should apply any remaining migrations, including
`0003_auth_profiles.sql`, `0004_journey_search.sql`, `0005_request_flow.sql`, and
`0006_admin.sql`, and `0007_request_insert_policy.sql`.

In Supabase Authentication, enable the Email provider and email/password signup.
Set Site URL to `http://localhost:3000/login` for local development (and your
deployed login URL in production). Set the minimum password length to at least
8 characters to match the form. No magic-link login is used.

- With Confirm email enabled, signup displays a check-your-inbox message.
  Follow the email verification link, then log in at `/login` with your password.
  The confirmation redirect does not need to establish a session: password
  login does that explicitly.
- With Confirm email disabled, signup signs the user in immediately.
- Both successful password login and immediate signup redirect to `/`.
- Duplicate-account errors are displayed when Supabase reports them (including
  obfuscated confirmed-user responses). Supabase may deliberately conceal some
  existing accounts; Trayl does not query private profiles to enumerate emails.

Signup sends name, optional phone, and adult confirmation as user metadata to
`auth.signUp`. Migration `0003` inserts the profile with `is_adult_confirmed = true`
in the same transaction as the auth user. This works without a session during
email confirmation and avoids partial account/profile creation. The trigger
rejects missing adult confirmation and invalid names/phone numbers, and always
sets role to `user`; metadata cannot grant admin access. Client profile INSERT
permissions stay disabled. Existing auth users are not backfilled automatically;
`getCurrentUser()` returns no authenticated app user if no active profile exists. Users created
through the dashboard/Admin API after this migration also need the required
name and adult-confirmation metadata.

Server Components can call `getCurrentUser()` from `@/lib/auth/user` to receive
the verified auth user and their own profile. `requireUser()` redirects guests
to `/login`; use it in future protected server operations as well. Middleware
protects every application route except `/`, `/login`, `/signup`, `/search`, and
the read-only `/api/journeys/search` endpoint, while
allowing framework assets and the favicon. Missing configuration fails closed
for protected routes.

Restart the dev server after changing environment variables. The landing
home page also runs without an environment file; authentication and navigation
remain inactive until both variables are configured.

For responsive UI and loading/error-state checks without a Supabase account,
see [the isolated UI review](tests/ui-preview/README.md). It uses synthetic data
and mock actions in a separate app; production authentication stays unchanged.

## Structure

```text
app/
  globals.css              Tailwind styles
  layout.tsx               Mobile-first shell and authenticated bottom navigation
  page.tsx                 Landing page with journey search
  login/page.tsx           Email/password login
  signup/page.tsx          Signup with adult confirmation
  auth-actions.ts          Validated server actions
components/auth-form.tsx   Shared accessible form
lib/auth/
  user.ts                  Verified current user/profile helpers
  validation.ts            Input validation and public error messages
lib/supabase/
  client.ts                Browser client for Client Components
  server.ts                Request-scoped client for Server Components/actions
  config.ts                Shared public environment configuration
middleware.ts              Refreshes cookies and protects application routes
supabase/migrations/       Schema, indexes, and atomic signup profile trigger
```

Import `createClient` from `@/lib/supabase/client` in Client Components, or from
`@/lib/supabase/server` in Server Components and Server Actions. Call the server
helper per request. The SSR package wraps `@supabase/supabase-js` and stores
sessions in cookies. Middleware persists refreshed cookies because Server
Components cannot write them.

The layout verifies the current user with `auth.getUser()` before showing Home,
Post Journey, Search, Messages, and Dashboard. `/dashboard` combines My Journeys, Requests
Received, and Requests Sent in client-side tabs. Tabs scroll horizontally on
small screens and support arrow, Home, and End keys. My Journeys shows upcoming
departures first and past departures in a collapsed History section. Owners can
cancel active future journeys; the update checks ownership, status, and the full
UTC departure time and refreshes dashboard/request/search views. Cancelling a
journey does not change existing request statuses or accepted contact access.
The standalone request pages remain available. Auth actions refresh the layout
before redirecting home. Row-level security still governs database access.

`/post-journey` requires a logged-in user and submits through a server action.
The action validates the fields, verifies the user again, and inserts an active
journey using that user's ID. Today is evaluated in UTC, matching Supabase's
default database timezone; the time field is stored as a timezone-free travel
time. Same-day times are allowed. The success state's “View my journeys” link
targets `/dashboard`; “Post another journey” resets the form.
Database permission failures are shown without exposing raw database errors.

`/search?from=Karachi&to=Lahore&date=2026-10-01` supports shareable filters.
The date defaults to today in UTC; blank city filters match all cities. City
matching is case-insensitive substring matching, with SQL wildcard characters
treated literally. Initial results are server-rendered; the client list fetches
fresh results on filter changes and cancels obsolete requests.

Migration `0004` exposes only active, unexpired journey details and traveller
names through a narrowly scoped database function. Guest search does not grant
direct access to profiles, contacts, or the journeys table. Date and time are
combined and compared to the database's current UTC time, ordered by departure
time. Guests requesting a connection go to `/login`; authenticated requests use
the current user's ID through a server action and existing request RLS policies.

The request flow uses `sendRequest(journeyId)` in
`app/dashboard/request-actions.ts`. Pending duplicates are checked before
insertion and prevented by a partial unique index in migration `0005`.
Historical accepted/declined requests do not block a new pending request.
If your existing database already has duplicate pending rows, reconcile those
rows before applying `0005`; the migration does not delete request history.

`/dashboard/requests-received` groups incoming requests by journey and lets only
the journey owner accept or decline pending requests. `/dashboard/requests-sent`
shows outgoing requests and their current status. Both pages obtain names from
the name-only view and accepted phone/email exclusively from `contact_reveal`.
The mutation actions invalidate both pages; another user's browser sees changes
on refresh. There are no email/SMS notifications. Request status changes are refreshed on navigation; accepted chats use Realtime for messages.
Migration `0005` keeps journey details visible to owners and request senders
after departure, cancellation, or completion.

The cookie integration follows the [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
using Next.js 14's synchronous cookies API and `middleware.ts` convention.

## Admin setup

Apply migration `0006_admin.sql` before using this version of Trayl. It adds
`profiles.is_active` (default true), admin-only database functions, and active
account restrictions on private table access. Promote your first admin through
trusted SQL in Supabase, replacing the UUID with that account's auth user ID:

```sql
UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR-USER-UUID';
```

`/admin` redirects guests, non-admins, and inactive admins to `/`. Each of the
Users, Journeys, Requests, and Reports tables has its own status filter and pagination
(20 rows per page). Admin RPCs check the caller's current database role and
activity status; no service-role key is used. Users can be deactivated and
journeys force-cancelled. Self-deactivation is blocked. Reactivation, if needed,
is a trusted SQL operation: set `profiles.is_active = true` for that user.

Deactivation is enforced by Trayl's password-login check and middleware,
which signs out inactive sessions on their next request. Restrictive RLS blocks
existing tokens from reading private table data or making changes, and
`contact_reveal` also checks account activity. This does not ban/delete the
Supabase Auth identity: the Auth API can still issue tokens, but Trayl rejects
them and private database permissions remain denied. Public journey search and
name-only data remain public as before. Deactivation does not cancel journeys
or erase request history. Force cancellation leaves request statuses unchanged.

## Commands

- `npm run dev` — development server
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript checks
- `npm test` — validation, auth-action, and middleware tests with mocked Supabase
- `npm run format` — format source files
- `npm run format:check` — verify formatting

## Chat threads

Accepted requests include an **Open chat** link to `/chat/<requestId>`. Only
active authenticated participants in an accepted request can open or send in
that chat. The server loads the latest 50 messages; older pages use timestamp/ID
cursors. Text sends appear immediately and may be retried safely with the same
message ID. Realtime INSERT events merge with confirmed messages, and the
client catches up on reconnection. While reading older messages, use the New
messages pill to return to the bottom. Times and day separators use UTC.
Photos, videos, and PDFs can be attached using the paperclip.

The previously unpushed `0003_chat.sql` is now `0008_chat.sql` to avoid colliding
with `0003_auth_profiles.sql`. Apply `0008` and `0009_chat_retry_ids.sql` with
`supabase db push` before opening chats. The latter grants INSERT on the message
ID for idempotent retries; sender and accepted-participant RLS checks still apply.

Manual check: accept a request between two accounts, open its chat in separate
browser sessions, and send in both directions. Test Enter/Shift+Enter, retry after
a connection failure, older pagination with more than 50 messages, and the New
messages pill while scrolled up. Check at 375, 768, and 1280 pixels. Pending
requests and unrelated accounts must redirect to the dashboard.

### Chat attachments

Apply `0010_chat_media_cleanup.sql` after the chat migrations. No new environment
variables or service-role key is needed. The bucket stays private with a 15 MiB
limit (shown as 15 MB in the UI). The picker accepts JPEG, PNG, WebP, GIF, MP4,
MOV, and PDF; validation runs before any upload. Images become WebP (PNG fallback)
at up to 1600px on the long side using canvas quality 0.8. Animated images become
still frames, as noted in the preview. MOV playback depends on browser codecs;
the bubble also offers an Open file fallback if playback fails.

Preview a file, optionally add a caption, then send. Pending bubbles show actual
upload progress; failures offer Retry while keeping the file in memory. Keep the
chat open when retrying an offline upload; pending files are not persisted across
reloads. Unused uploads are removed through the Storage API after a failed insert.
Cleanup claims prevent a late message insert from attaching a deleted file and
prevent sent attachments from being removed. If the network blocks cleanup, the
bubble retains that cleanup task and completes it before a retry uploads again.
Cleanup claims are small metadata records retained to reject late retries.

Signed URLs last one hour and are cached only in memory for the mounted thread.
Visible/near-visible messages are signed in batches (up to 50); PDFs request a
download disposition. URLs refresh shortly before expiry and on returning to the
chat. No public Storage URL is created or stored. The private URL handling follows
[Supabase signed URL access](https://supabase.com/docs/guides/storage/buckets/fundamentals);
cleanup uses [Storage ownership](https://supabase.com/docs/guides/storage/security/ownership).

Verify photo preview/cancel, image zoom/close, video controls, PDF download,
rejected types and oversized files, offline upload retry, and expiry refresh in
two participant sessions. `supabase/tests/chat_media_access.sql` checks media
ownership/metadata and cleanup guards against an existing accepted chat inside a
rolled-back transaction. Browser interaction tests are separate from `npm test`.

### Inbox and read receipts

`/messages` lists accepted chats with their latest message and unread counts.
Apply `0011_chat_inbox.sql` with `supabase db push` before using this module.
The inbox RPC uses caller RLS and only exposes names from `profile_directory`.
The Messages navigation badge refreshes on message INSERT/UPDATE events and
when returning online or to the tab. Counts come from `unread_counts()`.
Open, visible chat threads batch-mark incoming messages read; background tabs
never mark messages read. A single check means sent, two checks mean read.
Missed receipt updates reconcile on visibility changes and periodic refresh.
No new environment variables are required.

### Typing and online hints

Chat threads share their existing `chat:<requestId>` channel with ephemeral
[Broadcast](https://supabase.com/docs/guides/realtime/broadcast) typing events
and [Presence](https://supabase.com/docs/guides/realtime/presence). Typing activity
is throttled to one update per two seconds, with an explicit stop after three
seconds idle (also on clearing, sending, blur, or hiding the tab). Stop signals
are immediate; receivers expire missed stop signals after three seconds.
Online means another participant has a connected tab in this chat, not that
they are reading it. Multiple tabs are handled independently. No draft content,
typing state, or last-seen timestamp is persisted.

Apply `0012_chat_realtime_authorization.sql` before using this version. It adds
only [private-channel authorization](https://supabase.com/docs/guides/realtime/authorization)
policies for accepted participants, not activity storage. No new keys are needed.

### Chat safety and moderation

Apply `0013_chat_safety.sql` with `supabase db push`. Version `0004` already
belongs to journey search, so chat safety follows the existing chat migrations.
The header menu reports an entire conversation (including an empty one) or
blocks the other participant. Each confirmed message has a Report message menu.
Report reasons are private to the reporter and the admin moderation RPCs.

Blocks prevent sending in both directions across all chats between the two
users. The composer updates immediately for the blocker and refreshes its
availability every 10 seconds while visible, on focus, and after a send; the
database enforces blocks immediately. Existing history and attachments remain
readable. New messages and uploads also close at **00:00 UTC seven calendar days
after the journey date**. This feature does not add an unblock flow.

A transactional sliding window permits at most **30 messages per sender per
minute**, across chats, tabs, text and media. Rejected sends do not consume a
slot. The safety reminder can be dismissed once per user/chat in this browser;
clearing browser storage shows it again.

Admins can filter and paginate Reports in `/admin`, mark them reviewed, or
deactivate the reported user. The content RPC returns only a message attached
to an **open** report. Conversation reports grant no whole-transcript access.
Attachment links re-check the admin session and open report, then sign that
exact private object for **60 seconds** with no response caching. Already-issued
signed links can remain valid until expiry after review; no new links or content
are issued for reviewed reports. No service-role key is needed.

`supabase db query --linked --file supabase/tests/chat_safety_access.sql` runs
rollback-only database checks with isolated temporary accounts. No test data is
retained. Application tests: `npm test`.

## Chat database and migration map

The module names **0003_chat.sql** and **0004_chat_safety.sql** in the original
requirements are numbered **0008_chat.sql** and **0013_chat_safety.sql** here.
`0003_auth_profiles.sql` and `0004_journey_search.sql` already occupy those
versions. Do not rename, duplicate, or re-run migrations to match module numbers.

| Resource                            | Purpose                                                                  | Migration                              |
| ----------------------------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| `public.messages`                   | Accepted-chat text/media messages and read receipts; participant RLS     | `0008_chat.sql`                        |
| `chat-media` private Storage bucket | 15 MiB maximum; JPEG/PNG/WebP/GIF, MP4/MOV and PDF; request UUID folder  | `0008_chat.sql`                        |
| Message IDs                         | Idempotent retry INSERT grant                                            | `0009_chat_retry_ids.sql`              |
| `public.chat_media_cleanup`         | Private unused-upload cleanup claims and metadata validation             | `0010_chat_media_cleanup.sql`          |
| `chat_inbox()`, `unread_counts()`   | RLS-filtered inbox and unread totals                                     | `0011_chat_inbox.sql`, `0008_chat.sql` |
| Realtime authorization policies     | Private `chat:<requestId>` Broadcast/Presence; no saved typing/last-seen | `0012_chat_realtime_authorization.sql` |
| `public.message_reports`            | Own reports; message or conversation reports; narrow admin RPCs          | `0013_chat_safety.sql`                 |
| `public.user_blocks`                | Blocker-owned records; sending denied in both directions                 | `0013_chat_safety.sql`                 |
| `public.message_rate_limits`        | Private transactional rolling-window counters; no client access          | `0013_chat_safety.sql`                 |

For both new and existing hosted projects, apply all pending files in order:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
supabase migration list
```

Log in with `supabase login` first if needed. Chat requires migrations through
`0013`; the CLI applies only missing versions. In the SQL editor, run the same
unapplied files in filename order, including intermediate `0009`–`0012` files.
Do not mix SQL-editor changes and CLI migration history without reconciling
which migrations were already applied. No additional app keys are needed.

## Chat review and test checklist

See [CHAT_TEST_PLAN.md](CHAT_TEST_PLAN.md) for A/B/C access checks, actual Storage
API probes, 375px/keyboard steps, bidirectional Realtime/deduplication, error
feedback and teardown checks. It distinguishes automated evidence from browser
checks that still need to be run. No new product features were added in this pass.

Run `npm test`, `npm run format:check`, and `npm run build`. Database checks use
isolated fixtures and end with ROLLBACK:

```sh
supabase db query --linked --file supabase/tests/chat_review_access.sql
supabase db query --linked --file supabase/tests/chat_safety_access.sql
```

`node scripts/check-chat-api.mjs --uploads` independently checks the actual
Storage list/sign/upload endpoints with three regular test-account tokens;
setup and cleanup details are in the test plan. These tokens are test inputs,
not application environment variables. Do not use service-role credentials.

### Admin date filters

Apply `0014_admin_date_filters.sql` with `supabase db push` before using the redesigned admin page. Each table has independent status and inclusive date filters. Journeys use travel dates; Users, Requests and Reports use creation dates in UTC. Filtering occurs in admin-only RPCs before counts and 20-row pagination. Existing moderation and reported-media authorization are unchanged.

### Final design review

See [DESIGN_REVIEW.md](DESIGN_REVIEW.md) for measured token contrast, the motion inventory, code-level refinements, outstanding visual decisions, and the post-F8 375/768/1280px Chrome fixture and keyboard test matrix (including its live-account/device limitations). `node scripts/audit-design.mjs` reruns the automated contrast/motion checks; it does not perform browser testing.

### Delivery moments and quiet UI feedback

Apply `0015_delivery_moments.sql` before using handover confirmations or first-post celebrations:

```sh
supabase db push
npm run dev
```

No new environment variables, storage buckets, tracking codes, or dependencies are required. The migration adds `handovers` (one record per accepted request) and private `user_milestones`. Two participants independently confirm the final delivery in the chat's **Confirm a handover** panel; only then can they download the route/date PNG. Completion leaves the overall journey available for other requests. Confirmation retries are idempotent, blocked/inactive accounts cannot confirm, and users cannot directly edit either table. The panel refreshes while the tab is visible every 15 seconds and on returning to the tab.

The downloadable card is generated locally on canvas with Trayl’s fonts. It includes the route, journey date and “Delivered via Trayl”; no names, contact details, account IDs or uploaded images. Sharing is manual: downloading does not publish anywhere. Dashboard's invite card copies a public route-search link (or the public landing URL when no journey exists); it does not track referrals or expose a user ID.

First post/first handover celebrations are claimed atomically once per account per milestone, across devices. Existing posters are backfilled as already celebrated. A failed optional milestone sync never makes a successfully posted journey look failed. Handovers claim the pulse only when the completed panel is open, in view and the tab is visible. Motion respects reduced-motion preferences, including count transitions and skeletons.

Automated checks: `npm test`, `npm run typecheck`, `node scripts/audit-design.mjs`, `npm run build`. Database assertions (isolated fixtures, rollback):

```sh
supabase db query --linked --file supabase/tests/delivery_moments.sql
```

See [DELIVERY_MOMENTS_TEST_PLAN.md](DELIVERY_MOMENTS_TEST_PLAN.md) for the remaining browser/device checks.


## Vercel CLI deployment

Production URL: **https://trayl-ten.vercel.app** (Vercel project: `noob-308b/trayl`).

Run these commands from the project root, not `tests/ui-preview`:

1. Run `npm ci` and `npm run build`; resolve build errors before deploying.
2. Install the CLI if needed: `npm install -g vercel`.
3. Run `vercel login` yourself and complete browser authentication.
4. Run `vercel link`. Create a new project named `trayl` unless linking an existing
   project intentionally. Choose the correct personal/team scope and Next.js.
5. In Vercel **Project Settings → Environment Variables**, add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production,
   Preview, and Development. Use the corresponding Supabase project URL and public
   anon key. Do not paste keys into chat or commit `.env.local`. Realtime and private
   Storage use these same two variables; no service-role key is needed.
   Alternatively, run `vercel env add NEXT_PUBLIC_SUPABASE_URL` and
   `vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY`, selecting each environment when
   prompted. Only confirm completion after both variables are set.
6. Run `vercel --prod` and record the successful production URL above.
7. Verify the landing page, signup/email confirmation/login, posting and searching
   for a future journey, and two-user realtime chat on an accepted request using
   separate browser sessions. Report any failed step, including RLS or missing
   migration errors; deployment does not apply Supabase migrations or change Auth
   settings. Confirmation-email redirects depend on the existing Supabase Site URL.

For subsequent deployments, run `npm run build` and `vercel --prod` after confirming
any environment changes. Public environment variables are bundled at build time,
so changes require redeployment. `vercel.json` selects the single function region `hnd1` (Tokyo), matching
Supabase `ap-northeast-1`. Redeploy after changing this configuration.


## Performance audit

See [the performance audit](performance/AUDIT.md) for measured production scores,
bundle changes, the real Storage compression check, pagination behavior and
remaining bottlenecks. Raw Lighthouse JSON can include private chat content and
short-lived signed media URLs; it is ignored by Git and excluded from Vercel uploads.
List queries use 20-row pages with a one-row lookahead. Existing auth/RLS and
private-media access rules remain unchanged. Realtime code initializes after
initial rendering and still unsubscribes when a thread is left.
