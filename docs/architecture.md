# Leafage architecture

Care app for a small balcony garden. Postgres is the core: types, invariants, transitions
and the event replay live in the database, and both clients consume them through
PostgREST. A React SPA and a per-user MCP server share one Cloudflare Worker; each user
connects a chat assistant to `/mcp`, and that assistant is the main write interface.

## Stack and deploy

| Piece | Where |
|---|---|
| SPA | Vite 8, React 19, TypeScript 7, Tailwind v4, Base UI, Hugeicons; built to `dist/client`, served as Worker static assets (`not_found_handling: single-page-application`). A second entry, `embed.html` (`src/embed.tsx`, `src/embed.css`), is the embedded app that MCP hosts render: the garden, plant and tasks screens themselves, flat on the host surface, on the host's style variables and fonts, padded by its safe-area insets, declaring `fullscreen` as its only display mode (Claude shows a card inline and opens the app in the side panel or full screen), with 10 s refreshes paused while the view is off screen (`src/hooks/use-query.ts`), switched by the same route store as the SPA (`src/router.ts`: the SPA feeds it from `hashchange`, the embed from intercepted `#/` link clicks and the tool input). `src/lib/core.ts` holds the `core` every screen uses; `src/main.tsx` sets the PostgREST one and the embed sets `src/lib/bridge.ts`, which calls the MCP tools through the host (`@modelcontextprotocol/ext-apps`), so the iframe never holds a token. Photo signing goes through `core.photo_urls` in both (`src/lib/photos.ts`); upload is SPA-only (`src/lib/upload.ts`, handed to the plant screen by `src/App.tsx`), so the embedded plant screen has no upload button |
| Worker | `worker/index.ts`: `/mcp`, the protected-resource metadata paths, a daily cron; everything else falls through to `ASSETS`. `worker/tools.ts` is the tool map and the embedded app resource, `worker/auth.ts` the bearer check. Vite bundles it to `dist/leafage/index.js` |
| Routing | `run_worker_first: ["/mcp", "/.well-known/oauth-protected-resource*"]` in `wrangler.jsonc` |
| Config | `wrangler.jsonc` vars `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (public by design). No secrets: the Worker never holds `service_role`, and `secrets.required: []` stops local dev and `dist/leafage/.dev.vars` from inheriting `.env` and `.env.local` |
| Domain | `app.leafage.garden`, one custom domain on the Worker declared in `wrangler.jsonc` routes; the SPA is at `/` and the MCP endpoint at `/mcp`. The apex `leafage.garden` is the landing (next row). The app host sends `X-Robots-Tag: noindex` from `public/_headers` so search and directory links land on the apex |
| Landing | `sites/landing`, a bun workspace: Astro 7 static output (`trailingSlash: never`), Tailwind v4 over a closed token set in `src/styles/global.css` (three colours through `light-dark()`, two text sizes, two weights, no radius), the Fonts API self-hosting Inter, `security.csp` hashes, `@astrojs/sitemap`; `public/` holds `robots.txt` (Content-Signal line), `llms.txt`, `_headers`, the icons and `og.png`. Deployed as the assets-only Worker `leafage-landing` (`sites/landing/wrangler.jsonc`: no `main`, `html_handling: drop-trailing-slash`, `not_found_handling: 404-page`) with the apex as its custom domain; `www` is a zone Redirect Rule |
| Commands | `bun run deploy` (build + `wrangler deploy`), `bun run preview` (build + `wrangler dev`), `bun run dev:mcp` (the tool surface on `localhost:8788/mcp` under the test account with no OAuth gate, serving the built embed, for a local MCP Apps host); `bun run dev:landing`, `bun run deploy:landing` (Astro build + `wrangler deploy -c sites/landing/wrangler.jsonc`). Deploys are manual, there is no CI |
| Cron | `17 6 * * *` hits `${SUPABASE_URL}/rest/v1/plants?select=id&limit=1` so the free-tier project does not pause (a paused project is NXDOMAIN, and a just-restored one returns empty result sets for a minute). Delete it on Supabase Pro |

## Layering

| Layer | Directory | Owns |
|---|---|---|
| db | `db/` | 25 enums, 6 catalog and 6 tenant tables plus `profiles`, RLS, `event_schema()`, the projections, 22 RPCs, 4 views; `db/migrations/` (applied over the Supabase MCP) and `db/checks/` |
| core | `core/` | generated from the live catalog by `bun run generate` (`schema.ts`, `rpc.ts`, `events.ts`); hand-written `client.ts` (typed reads, one verb per RPC, zod on every argument; every method takes one input object, and `schemas` holds the zod schema of each, which is also its tool's input schema), `transport.ts` (PostgREST over fetch, plus signed URLs from Storage), `errors.ts` |
| app | `src/` | four screens on `core` only: garden, plant, tasks, account. No direct table access, no hand-built queries |
| worker | `worker/` | `/mcp`: one tool per `core` read or verb; the SDK's bearer gate over a `jose` verifier |

## Data model

- **Catalog** (global rows, plus `substrate` and `supplement` rows an owner creates): `taxon`, `care_profile`, `substrate` + `substrate_part`, `supplement`, `programme`.
- **Tenant**: `plants`, `pots`, `events`, `pest_case`, `feed_override`, `tasks`; `profiles` carries `display_name` and `timezone`.
- **Events are the source of truth.** Ten typed payloads (`watering`, `feed`, `treatment`, `repot`, `prune`, `measure`, `diagnosis`, `move`, `photo`, `note`) validated on every row by `event_schema()` and a CHECK; `plant_id`, `type`, `ts`, `data` are immutable. `project_plant` and `project_pot` replay a plant's or pot's non-voided events in `ts, id` order after every insert or void, writing `condition`, `phase`, `symptoms`, `disorders`, `location`, `light`, `pot_id`, `height_cm`, the `pest_case` rows, and the pot's substrate. The replay locks the plant row, so concurrent verbs on one plant fold in turn. Corrections are `void_event`, never deletes.
- **Views**, all `security_invoker = on`, computed in the owner's timezone through `local_date(ts)`, the one place that reads `profiles.timezone`: `garden` (one row per active plant, 52 computed columns), `plant_feed` (the feeding plan and its status), `pots_view`, `due` (water, feed, pest, pot and task rows; a row with a `task_id` is a task).
- **Selectors**: every plant-scoped verb takes `plants`, a list of names or ids or a filter object, resolved by `select_plants(owner, selector)` from `plants where owner_id = …`. Bulk is one call and one transaction.
- **Progressive entry**: one field creates any entity; nothing gets a default the user did not state.

## Auth

- Users sign in with Google through Supabase Auth (the only provider, no password UI). The session lives in the SPA (PKCE, persisted).
- MCP clients authenticate through the Supabase OAuth server. Dynamic client registration is on. The consent page is the SPA route `/oauth/consent?authorization_id=…` (`src/screens/oauth-consent.tsx`, mounted from `src/main.tsx` behind `AuthGate`).
- Worker side (`worker/auth.ts`): RFC 9728 metadata at `/.well-known/oauth-protected-resource` and `…/mcp`; `/mcp` sits behind the SDK's `requireBearerAuth` gate, so a missing, invalid or expired bearer is a `401` with `WWW-Authenticate: Bearer error="invalid_token", resource_metadata=…/mcp`. The verifier checks ES256 JWTs with `jose` against the project JWKS, `iss = ${SUPABASE_URL}/auth/v1`, `aud = authenticated`, and a required `client_id` claim, so plain session JWTs are rejected.
- The verified token becomes the bearer of a `core` transport for that request (`worker/index.ts`), so `auth.uid()` and RLS bind the tenant. `events.source` records the `client_id` claim (`app` for the SPA).

## MCP tools (`worker/tools.ts`)

30 tools, each with a `title` and explicit `readOnlyHint`, `destructiveHint` and `openWorldHint`: 29 are 1:1 with `core` and registered from one table (`TOOLS`: title, description, annotations), and `show_garden` is the render tool: same input as `garden`, but it returns only `{ plants, need_water, attention }` (count and names), since the view fetches its own data; its `_meta` carries `ui.resourceUri` and `openai/ui` with a `global` entry point (Claude's artifacts page and sidebar, ChatGPT's sidebar app) and `availableDisplayModes: ["fullscreen"]`. `photo_urls` is visible to the embedded app only (`_meta.ui.visibility: ["app"]`). Input schemas are `core`'s own `schemas`, so argument names and validation match the SPA and the RPCs exactly. `garden` returns the 20 columns a plant card shows; `plant` returns the full row with the feeding plan, open tasks and events; `due` returns `{ today, rows }`. Server `instructions` carry the cross-tool rules (selectors, `at`, void instead of re-logging, when to render). The server advertises the Leafage title, website and icons, public one-hour cache hints on `tools/list` and `server/discover` (the list is the same for every user), and `listChanged: false` for tools and resources, since both lists are fixed per deploy.

| Kind | Tools |
|---|---|
| Reads (`readOnlyHint`) | `show_garden(filter?)`, `photo_urls(paths)`, `garden(filter?)`, `plant({plant, events?})`, `due({days?, ...filter})`, `tasks({status?})`, `pots`, `catalog` |
| Event verbs | `water`, `feed`, `treat`, `repot`, `diagnose`, `measure`, `prune`, `move`, `note`, `photo`, `void_event` (`destructiveHint`) |
| Entity verbs | `create_plant`, `update_plant`, `archive_plant` (`destructiveHint`), `create_pot`, `update_pot`, `retire_pot` (`destructiveHint`), `update_feed`, `create_substrate`, `create_supplement`, `create_task`, `complete_task` (the `update_*` and `complete_task` overwrite, so they carry `destructiveHint` and `idempotentHint`) |

A result is the value as JSON text plus `structuredContent: { result }`, with every `owner_id` key removed. A `LeafageError` is an `isError` result with `structuredContent: { error, detail, hint }` where `error` is `not_found`, `invalid_transition` or `invalid_value`. Malformed arguments are rejected by the SDK before `core` runs. Not tools: `wipe_garden`, `event_schema`, `local_date`.

The embedded app is one resource, `ui://leafage/garden-<build>` (`text/html;profile=mcp-app`): the Worker reads the built `embed.html` from `ASSETS`, makes its asset URLs absolute, allows only its own origin, the Supabase origin (signed photos) and `https://assets.claude.ai` (Claude's host fonts) in `_meta.ui.csp.resourceDomains`, and sets `prefersBorder: false`. `<build>` changes with every build, because hosts cache a resource by URI while the hashed assets it points at are replaced on deploy. It is registered as the template `ui://leafage/garden-{build}`, so a URI from a tool list cached before a deploy still reads the current shell. `public/_headers` sends `Access-Control-Allow-Origin: *` on `/assets/*`, since the sandboxed iframe loads modules cross-origin.

## Security invariants

- `owner_id uuid not null references auth.users on delete cascade` on every tenant table; `unique (id, owner_id)` on `plants`, `pots` and `events`; child FKs are composite, so a cross-owner child is impossible even under `BYPASSRLS`.
- RLS enabled and forced on all 13 tables. Tenant policies: `owner_id = (select auth.uid())`. Catalog policies: `taxon`, `care_profile`, `programme` readable by `authenticated`; `substrate`, `supplement` and `substrate_part` readable when the row is global or the caller's.
- One write grant in `public`: `authenticated` may UPDATE its own `profiles` row (policy `profiles_self`), where a CHECK rejects an unknown `timezone`. Otherwise `authenticated` holds SELECT on the tables and the four views; `anon` holds nothing. Default privileges revoke everything from `anon`, `authenticated`, `service_role` and `PUBLIC`.
- Every write is an owner-scoped `security definer` RPC with `search_path = ''` and `auth.uid()` resolved in-body; EXECUTE goes to `authenticated` only. Helpers (`select_plants`, `project_plant`, `project_pot`, the resolvers, the event insert) have EXECUTE revoked from everyone. Because definer code bypasses RLS, resolvers filter owner-scoped catalog rows by `owner_id is null or owner_id = auth.uid()`, definer code never reads a view alone, and `photo` rejects a path outside `^<auth.uid()>/`.
- An MCP access token is an ordinary Supabase JWT (`aud: authenticated`, no resource binding) and the Worker forwards it to PostgREST, so a consented client can call any granted RPC directly. `wipe_garden`, the only hard delete, therefore refuses a token with a `client_id` claim. Never add a second resource server to this Supabase project.
- Views stay `security_invoker = on`; without it the catalog leaks to anyone who can call PostgREST.
- Storage: private bucket `plant-photos` (5 MB; jpeg, png, webp, heic, heif), one `storage.objects` policy `plant_photos_owner`: `name ~ '^<auth.uid()>/'` and no leading slash, double slash or `..`. Reads use signed URLs (`src/lib/photos.ts`, cache cleared on sign-out).
- Operator rule: `postgres` and `service_role` bypass RLS, so operator SQL always sets `owner_id` explicitly and asserts `select count(*) from <table> where owner_id <> :target` is 0.

## Checks and tests

- `bun run sql db/checks/schema.sql` dumps enums, constraints, indexes, RLS, policies, grants, view options, `@notNull` view comments, function security and default ACLs; diff it against `db/checks/schema.expected.json` after `jq -S`.
- `bun run sql db/checks/isolation.sql`: 51 cases in one rolled-back transaction with claims injected for two test users, covering cross-owner reads, writes, views, RPC arguments, the composite FK, replay semantics, error codes and the no-anon-EXECUTE rule. Storage cases need a real client and stay manual: signed URLs and uploads under another uid, a leading slash, a traversal path.
- `bun run test`: `test/care.test.ts` replays the week of care through `core` under the test account, wiping it before and after; `test/events.test.ts` diffs the generated payload schemas against `event_schema()`; `test/mcp.test.ts` drives the real `createMcpHandler` with the v2 client over an in-process fetch, once as a 2026-07-28 client and once as a 2025-era one. Test account credentials live in `.env.local`.
- The owner's garden is read-only for tests and checks. No fixtures, no seed data, no mocks of PostgREST.

## Migrations ledger (`db/migrations/`, applied over the Supabase MCP)

| Migration | Effect |
|---|---|
| `v2_001_schema` | Builds v2: enums, tables, RLS, `event_schema()`, projections, RPCs, views, grants. The file is patched in place with every later migration and is the schema of record; its one-time v1 teardown preamble was removed on 2026-10-04 |
| `v2_002_load` | The one-time load of the v1 export (26 plants, 26 pots, 342 events, 15 tasks). File deleted after `v2_004_cleanup`; the export JSON is kept outside the repo |
| `v2_003_view_nulls` | `@notNull` column comments on the views, which drive generated view nullability |
| `v2_004_cleanup` | Drops the `v1_export` staging table |
| `v2_005_event_schema` | Rewrites the `event_schema()` literals in the shape zod 4.6 emits (`type: [x, "null"]` for plain nullable fields); same constraints, so every row still validates |
| `v2_006_correctness` | `project_plant` takes `for no key update` on the plant row; a repot can only extend a feed hold; `archive_plant` skips the plant's open tasks; `void_event` requires a reason and unpins a voided cover; `wipe_garden` refuses OAuth client tokens; CHECKs for a valid `profiles.timezone`, the repot plan pair, photo events and their path, void and reason, and the two `pest_case` invariants; `measure` and `create_plant` reject sizes of zero or less; a diagnosis payload no longer accepts `treating` |
| `v2_007_simplify` | `local_date(ts)` replaces `local_today()` and the five inline timezone lookups; `emit` also writes garden-level events, so `note`, `photo`, `treat` and `feed` share it; `due` loses `source` (and the `due_source` type) and reads `garden` once; treatment payloads lose `round` and repot payloads `from_pot_id` (existing rows rewritten, both were call-time snapshots the replay never read); `diagnose` and `create_supplement` take typed enum arrays and `check_enums` is gone; `create_task(due)` is `create_task(due_on)`; `plants.updated_at` and its trigger are dropped |

`v2_006` and `v2_007` were applied on 2026-10-04 with `bun run sql <file>` (one transaction per file), so Supabase's own migration list ends at `v2_005`. The pre-v2 ledger (`mt_01` to `mt_11`) was truncated at cut-over. Run `bun run generate` after every migration; `core/` is generated from the live catalog.

## Environment

Supabase project `gwxcfwwihrowaetnxuvt` (Postgres 17, `pg_jsonschema` in `extensions`). `.env.local` holds `DATABASE_URL` (session pooler, used by `tools/`), the test account and its uid. `profiles.timezone` defaults to `UTC`.

## Open items

1. Supabase Pro: delete the keepalive cron and the `scheduled` handler.
2. Account deletion and data export: `wipe_garden()` is the tenant primitive; the auth user and storage objects still need a `service_role` Edge Function.
3. Dashboard before signups open: Google consent screen published, Email provider off, Site URL and redirect allow-list limited to the production origin, signups on last.
