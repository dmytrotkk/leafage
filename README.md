# Leafage

Care app for a small balcony garden. Postgres is the core: the schema, the invariants and
the event replay live in the database, and both clients consume them through PostgREST.
A React SPA and a per-user MCP server share one Cloudflare Worker; each user connects
their chat assistant to `/mcp` and that assistant is the main write interface.

## Layering

| Layer | Directory | Owns |
|---|---|---|
| db | `db/` | enums, catalog and tenant tables, RLS, `event_schema()`, the projections, 22 RPCs, 4 views, migrations and SQL checks |
| core | `core/` | generated types and payload schemas from the live catalog, typed reads (`garden`, `plant`, `due`, `tasks`, `pots`, `catalog`, `profile`) and one verb per RPC; every method takes one input object, the same shape as its MCP tool |
| app | `src/` | four screens (garden, plant, tasks, account) on `core` only; garden, plant and tasks also run inside MCP hosts as the embedded app (`embed.html`) |
| worker | `worker/` | `/mcp`, one tool per `core` read or verb, Supabase OAuth for auth |
| landing | `sites/landing` | the `leafage.garden` apex: Astro 7 static, its own closed Tailwind theme, `robots.txt`, `llms.txt` |

`docs/architecture.md` holds the security invariants and the migration ledger.

## Stack

Bun, Vite 8, TypeScript 7, React 19, Tailwind v4, Base UI, Hugeicons, zod,
`@modelcontextprotocol/server`, `@modelcontextprotocol/ext-apps`, `jose`, Supabase (Postgres 17, Auth, Storage). Astro 7 for the landing.

## Run

```sh
bun install
cp .env.example .env
bun dev
```

The publishable key in `.env.example` is public by design: `anon` holds no grants.
`bunx tsc -b`, `bun run build` and `bun run test` must stay green. `bun run generate`
regenerates `core/` after a migration; `bun run sql <file>` runs a SQL check.

## Deploy

```sh
bun run deploy
bun run deploy:landing
```

One plain Worker with static assets (not Pages); the landing is a second, assets-only Worker on the apex (`sites/landing/wrangler.jsonc`). Worker vars live in `wrangler.jsonc`;
`app.leafage.garden` is declared as a custom domain there and created on deploy; the SPA is
served at `/` and the MCP endpoint at `/mcp`. The keepalive cron keeps the free-tier database
from pausing.

## Screens

| Route | Screen |
|---|---|
| `#/` | Garden: plants and need-water tiles, sortable and filterable wall, water all or one |
| `#/plant/:id` | Plant: hero, care, pot, nutrition, history, open tasks, timeline, notes, photos and cover |
| `#/tasks` | Agenda from `due`: overdue first, by day, grouped by plant; water, feed and tasks close in place |
| `#/account` | Display name, timezone (due dates are computed in it), assistant connection |
| `/oauth/consent` | OAuth consent for MCP connections |

## MCP

Endpoint `https://app.leafage.garden/mcp`, added in Claude or ChatGPT as a custom connector. The
tool surface is 1:1 with `core`: seven reads and 22 verbs with the same argument names and error codes
(`not_found`, `invalid_transition`, `invalid_value`), plus the `show_garden` render tool for the embedded app.
