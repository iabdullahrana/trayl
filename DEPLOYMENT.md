# Deploy Trayl to Vercel + Supabase

Before public production launch, address the Next.js dependency advisories
described in README. This deployment setup retains the requested Next.js 14;
it does not upgrade dependencies or deploy any resources.

## 1. Create the backend

Create a Supabase project, choose a region near your users, and save its database
password. Copy the project reference, Project URL, and public `anon` API key from
the dashboard. The reference is the project identifier, not its display name.

In Authentication, enable Email/password signup, set minimum password length to
8, and enable Confirm email. Configure production SMTP so confirmation emails
can reach users outside your project team. Keep the default confirmation template
using `{{ .ConfirmationURL }}`. After confirming, users log in with their password;
this app does not use a magic-link login or an auth callback route.

## 2. Apply migrations

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).
From this repository's root, replace `YOUR_PROJECT_REF` and run:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
supabase migration list
```

Enter the database password when prompted. All thirteen checked-in migrations,
`0001_init.sql` through `0013_chat_safety.sql`, must run before signup or app use.
`db push` applies pending migrations in order and records their history; run it
again before deploying future code that requires new migrations. Do not run
migrations during the Vercel build. See [Supabase migrations](https://supabase.com/docs/guides/local-development/database-migrations).

Use a fresh project for initial deployment. If SQL was already applied manually,
reconcile migration history before using the CLI; do not blindly replay it.
`db push` applies database migrations, not the local Auth settings in config.toml.

## 3. Configure Vercel and deploy

Push this project to a Git repository and import it in Vercel. Select **Next.js**,
repository root `./` (not `tests/ui-preview`), Node.js **22.x**, install command
`npm ci`, build command `npm run build`, and the default Next.js output settings.
`vercel.json` selects one function region, `hnd1` (Tokyo), matching Supabase
`ap-northeast-1`. The App Router and middleware handle routing.
See [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

Set these variables in Vercel Project Settings → Environment Variables before
building, using values from the same Supabase project:

| Name                            | Value                                              |
| ------------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://YOUR_PROJECT_REF.supabase.co`             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public `anon` key; never a service-role/secret key |

Select **Production**. Configure **Preview** separately, preferably with a separate
Supabase project containing the same migrations; preview writes affect whichever
database its variables point to. Neither a database password nor a service-role
key is required by Trayl. CLI credentials belong on your workstation, not in
Vercel application variables. Public variables are included in the browser build;
redeploy after changing them. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

In Supabase Authentication → URL Configuration, set **Site URL** to
`https://YOUR_PRODUCTION_DOMAIN/login`. Use the final custom domain if applicable.
For local development use `http://localhost:3000/login`; for an isolated preview
backend use that preview's `/login` URL. Signup does not pass `emailRedirectTo`,
so confirmation uses Site URL; adding an allowed redirect alone will not change
the destination. Update Site URL when the production domain changes.

Click **Deploy** in Vercel. Subsequent pushes to the production branch redeploy
Trayl. Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`
locally before release.

## 4. Verify the deployment

Open `/`, search, and confirm guests are redirected from `/dashboard` to `/login`.
Sign up through Trayl, confirm the email, log in, and post a future journey.
Use a second account to request it, accept with the traveller account, and verify
contacts appear only after acceptance. Check both request views after refresh.
Promote an app-created account using the trusted SQL in README's Admin setup,
then verify `/admin`; an ordinary account should be redirected home.

Local-only backend instructions are in [README](README.md#optional-local-supabase).
