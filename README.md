# Outpost

An agentic workspace: each workspace pairs a collaborative doc (BlockNote + Yjs) with an infinite
canvas (tldraw, with an ERD table shape), and an AI agent (Gemini via the AI SDK) that edits both.

## Stack

- Next.js 16 (App Router, `proxy.ts` middleware), React 19, Tailwind v4, shadcn/ui
- Clerk for auth, organizations and billing
- Postgres with Prisma 7 (`@prisma/adapter-pg`, client generated to `lib/generated/prisma`)
- Supabase Realtime for live doc sync; a tldraw sync server for the canvas
- Vitest for unit tests

## Setup

```bash
npm install
cp .env.example .env    # fill in the values
npx prisma migrate deploy
npx prisma generate
npm run dev             # http://localhost:3000
```

See `.env.example` for every variable. In production, `NEXT_PUBLIC_TLDRAW_SYNC_URL` is required
(the canvas is disabled without it), and `NEXT_PUBLIC_APP_URL` should be your public URL.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |

## Layout

- `app/`: routes: landing, `(main)/dashboard`, `(main)/workspaces` (board), `(main)/workspace/[id]`,
  `shared/[token]` (public read-only view), `api/agent`
- `actions/`: server actions (workspaces, doc and canvas saves, usage)
- `components/`: UI, editors, the ERD shape (`components/EntityTable`)
- `lib/`: access checks, billing and plan limits, agent tools, Realtime provider, validation
- `prisma/`: schema and migrations

`AUDIT_REPORT.md` has the latest security and code-health audit.
