# Audit Report: Outpost deep scan (2026-11-21)

## Context
You asked for a security, bug and dead-code deep scan with a stop before any fixes. This is the Phase 1 report. Plan mode allows read-only work only, so the branch `chore/deep-scan-cleanup` and the repo's `AUDIT_REPORT.md` are created first thing after approval (the report becomes the branch's first commit). The working tree is clean on `main` at `341a6f6`.

## Phase 0: project summary
- **Stack:**
  - Next.js 16.3.4 (App Router, Turbopack, `proxy.ts` middleware), React 19.2, TypeScript 5, Tailwind v4 with shadcn/radix.
  - Clerk 7 for auth, orgs and billing. Prisma 7.10 with `@prisma/adapter-pg` on Postgres (client generated to `lib/generated/prisma`, one migration `20261112090615_init`).
  - Editors: tldraw 5.6.1 and `@tldraw/sync` (canvas), BlockNote 0.54 with Yjs over Supabase Realtime broadcast (doc).
  - Agent: AI SDK v7 with Gemini, client-side tools.
- **Entry points:**
  - `proxy.ts` (Clerk; protects `/dashboard(.*)` and `/workspace(.*)`).
  - Pages: `/`, `/dashboard`, `/workspaces`, `/workspace/[id]`, `/shared/[token]`.
  - API: `/api/agent` (POST).
  - Server actions: `actions/{workspace,doc,canvas,usage,check-user}.ts`.
- **Commands:** `npm run dev | build | start | lint | test | seed`.
- **Deploy:** nothing in the repo says how it's deployed. There's no `vercel.json`, Dockerfile or CI, and the README is the create-next-app default. Required env vars, with no `.env.example`:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the `.env` currently uses the misspelled `…_URL` name)
  - `NEXT_PUBLIC_TLDRAW_SYNC_URL`
  - `NEXT_PUBLIC_TLDRAW_LICENSE_KEY`
  - Clerk keys
  - `GOOGLE_GENERATIVE_AI_API_KEY`

### Baseline (2026-11-21)
| Check | Result |
|---|---|
| `tsc --noEmit` | **pass** (0 errors) |
| `eslint` | **0 errors, 2 warnings**: `app/(main)/workspace/[id]/_components/DocEditor.tsx` 16:7 `'SAVE_DEBOUNCE_MS' is assigned a value but never used`, 18:22 `'workspaceId' is defined but never used` |
| `npm test` (vitest) | **35/35 pass**, 5 files |
| `next build` | **pass** (last run after `341a6f6`) |
| `npm audit` | **30 vulnerabilities: 3 critical, 3 high, 24 moderate, 0 low** |
| Secrets | **none** in tracked files or git history. `.env` is gitignored and never committed. |

## Phase 1: findings
Severity is my judgment; "Risk of fix" is the chance the fix breaks something.

| ID | Cat | Sev | File:Line | Description | Proposed fix | Risk |
|---|---|---|---|---|---|---|
| S1 | Sec (dep) | **Critical** | package.json `next@16.3.4` | Next.js 16.0.0–16.4.4 advisories: unauthenticated RCE in the image optimizer and `use cache`, SSRF in the image optimizer, cache poisoning, HttpOnly cookie exposure, Server Action DoS, and more. | Upgrade `next` and `eslint-config-next` to **16.4.6**. This is a patch/minor bump within 16.x; read the 16.4 notes in `node_modules/next/dist/docs` per AGENTS.md. | Low–Med |
| S2 | Sec (dep) | Critical (dev only) | `vitest@^3.2.4`, with `@vitest/mocker` and `tinypool` | Path traversal, file read and mock-registry code injection when the Vitest UI or browser server runs, plus tinypool prototype pollution leading to RCE. Affects dev/test machines, not production. | **Major** upgrade to vitest 4.x in its own commit after reading the changelog. Re-run the 35 tests. | Med |
| S3 | Sec | **High** | `lib/supabase-yjs-provider.tsx:39-44` | Doc sync uses a **public** broadcast channel `doc:<workspaceId>`, and incoming payloads are applied with no checks. Anyone with the public anon key and a workspace id can: (a) send junk, so `Y.applyUpdate` throws in every open editor (DoS); (b) send a valid Yjs update that rewrites or deletes content, which collaborators then persist on their next save; (c) read live edits. This also bypasses the viewer read-only rule. | **Code part (now):** validate payloads (`typeof update === "string"`), wrap apply in try/catch, drop bad messages. **Real fix (needs you):** Supabase private channels with RLS on `realtime.messages`, authorized by the Clerk JWT. | Low (guard); High (private channels, needs Supabase dashboard config) |
| S4 | Sec | Medium | `app/(main)/workspace/[id]/_components/CanvasEditor.tsx:38-56` | If `NEXT_PUBLIC_TLDRAW_SYNC_URL` is unset, the canvas uses tldraw's **public demo** sync server, where rooms are public and get wiped. | In production builds, refuse the demo fallback (show an error panel instead). Dev keeps the fallback. Needs your OK because it changes behavior when the env var is missing. | Low |
| S5 | Sec | Medium | `next.config.ts` | No security headers: no `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`. Clickjacking risk on the workspace and share pages. | Add `headers()` with `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and `Permissions-Policy` (allowing `microphone=(self)` for MicButton). No full CSP yet, since tldraw, Clerk and Supabase need a tuned policy; that's listed for later. | Low |
| S6 | Sec | Medium | `app/api/agent/route.ts` | No rate limit. The quota caps typed prompts, but automatic tool follow-ups are uncounted, and each one costs a Gemini call plus Clerk billing lookups. | Cap automatic follow-ups per prompt (count consecutive assistant tool steps in `messages`; reject over 25 with 429). In-process, no new dependency. A real per-user rate limit needs a store such as Upstash, which is a new dependency, so I'd ask first. | Low |
| S7 | Sec | Medium | `actions/workspace.ts:23-60` | `createWorkspace` doesn't apply the viewer rule: an `org:viewer` can create workspaces in the active org. | Reject when the active `orgRole === "org:viewer"`. | Low |
| S8 | Sec (input) | Medium | `actions/workspace.ts:30,58,78,85` | Name and description have no server-side length or type limits. The UI caps names at 80 and 48 characters, but a direct action call can store megabytes. Non-string input throws a 500. | Validate with zod: name 1–80 characters after trim; description up to a cap. | Low |
| S9 | Sec (dep) | High (dev only) | `prisma@7.10.1`, then `@prisma/config`, then `effect@3.20.0` | ReDoS in Effect `Schema.TemplateLiteral`. It only runs inside the Prisma CLI config loader. npm's "fix" is a downgrade to Prisma 6.12, and the latest `@prisma/config` still pins `effect@3.20.0`. | **Skip and document.** No safe fix exists; wait for upstream. | — |
| S10 | Sec (dep) | Moderate (×24) | transitive | `@clerk/ui@1.32.3` pulls in a Solana wallet stack (jayson, uuid, stream-json advisories). Also: `typescript-eslint`/`minimatch` (dev), and `shadcn` → `ts-morph` → `minimatch` (npm's fix is a downgrade to 1.0.0). | Minor bumps: `@clerk/ui` to 1.44.x (latest no longer lists the Solana deps; verify), and `npm update` for the in-range eslint and typescript-eslint fixes. Leave shadcn (downgrade only). | Med (Clerk UI minor) |
| B1 | Bug | Medium | `lib/supabase-yjs-provider.tsx:39-47` | Same root cause as S3: any malformed broadcast throws an uncaught error inside the Supabase callback. | Fixed by S3's guard. Add a unit test with junk payloads. | Low |
| B2 | Bug | Low | `package.json:11` | The `seed` script runs `prisma/seed.ts`, which doesn't exist, so `npm run seed` fails. | Remove the script, or tell me if a seed file should exist. | Low |
| B3 | Bug | Low | `app/(main)/dashboard/_components/DashboardPrompt.tsx:48` | The whole prompt goes into the URL (`?prompt=`). Long prompts can exceed URL limits, and prompt text lands in browser history and server logs. | Pass it through `sessionStorage` under a one-time key and read it once in `AgentToggleButton`. The URL becomes `?prompt=1`. | Low–Med |
| B4 | Bug | Low | app-wide | There's no `error.tsx`, `not-found.tsx` or `loading.tsx`, so a failed DB or Clerk call shows Next's bare error page, and slow pages show nothing. | Add a root `app/error.tsx` and `app/not-found.tsx` styled like the app, plus `loading.tsx` for the dashboard, board and workspace. | Low |
| B5 | Bug | Low | `actions/doc.ts:37`, `actions/workspace.ts` (transactions) | Interactive transactions use Prisma's default `maxWait` of 2 s. On a cold or sleeping database the first save fails with P2028 (reproduced on 2026-11-19). | Pass `{ maxWait: 10_000 }` on both transactions. | Low |
| P1 | Perf | Low | `app/(main)/dashboard/page.tsx:21` | The dashboard loads **every** workspace to show 6 recent ones (sorted in JS by the latest of 3 timestamps). | Leave the logic. Add `take` only if lists get large. Report only for now. | — |
| D1 | Dead | Low | `components/CanvasEditor.tsx`, `app/_components/CanvasEditor.tsx` | Empty files (0 lines); nothing imports them. | Delete. | None |
| D2 | Dead | Low | `components/DocEditorLoader.tsx` | Byte-for-byte duplicate of `app/_components/DocEditorLoader.tsx`; nothing imports it (pages import the `app/_components` one). | Delete. | None |
| D3 | Dead | Low | `app/(main)/workspace/[id]/_components/DocEditor.tsx` | Old, non-collaborative editor; nothing imports it; source of both lint warnings. | Delete, which brings lint to 0 warnings. | None |
| D4 | Dead | Low | `lib/agent/client-tools.ts` (372 lines), `lib/agent/tools.ts` (136 lines) | The old agent, replaced by `lib/agent-tools.ts`, `agent-canvas.ts` and `agent-doc.ts`. They only import each other; the route and hooks import the new modules. You edited `client-tools.ts` in `b9af197`, so I'm asking before deleting. | Delete (decision below). | None |
| D5 | Dead | Low | `hooks/use-collaborative-doc.ts` | Not imported; `components/DocEditor.tsx` sets up its own provider. | Delete. | None |
| D6 | Dead | Low | `components/ui/badge.tsx`, `components/ui/sonner.tsx` | Not imported (the layout uses `Toaster` from `sonner` directly). `ui/sonner.tsx` is the only user of `next-themes`. | Delete both, then remove `next-themes`. | None |
| D7 | Dead dep | Low | `react-spinners`, `next-themes` | `react-spinners` has 0 imports; `next-themes` becomes unused after D6. | `npm uninstall`. | None |
| D8 | Dead asset | Low | `public/manifest.json`, `public/social/og-image.png`, `public/icon.png`, `public/apple-icon.png` | Never referenced. The layout metadata has no `manifest`, `openGraph` or `icons`, and `public/icon.png` isn't Next's icon convention (that's `app/icon.png`). | **Decision below:** wire them into metadata (a visible change: OG previews and icons start working) or delete them. | Low |
| D9 | Stray | Low | `public/LICENSE` | Full GPL-3.0 text served publicly at `/LICENSE`; there's no root LICENSE. Probably a template leftover, but it's a licensing question. | **Your call.** I won't touch it without an answer. | — |
| Q1 | Quality | Low | `app/(main)/layout.tsx:3` | Exports a named `MainLayout` besides the default export (non-standard for layout files), and has a stray leading space. | Make it default-only. Trivial. | None |
| Q2 | Quality | Low | `README.md` | Still the create-next-app template. There's no `.env.example`, though `.gitignore`'s `.env*` would also ignore one. | Add `.env.example` with names only (and a `!.env.example` gitignore exception), plus a short README with setup, env vars and scripts. | None |
| Q3 | Quality | Low | `lib/agent-canvas.ts` (236 lines), `components/EntityTable/EntityTableShapeUtil.tsx` (336) | Large, but cohesive. | Report only. | — |

### Corrections to my previous health pass
- `y-prosemirror` **is needed**: it's a required peer of `@blocknote/core`. Keep it.
- `shadcn` **is needed at build time**: `app/globals.css` does `@import "shadcn/tailwind.css"`. Keep it in `dependencies`.

### Proposed deletions, with evidence
I searched imports, dynamic `import()`, string references, config files and package.json scripts across `app components lib hooks actions proxy.ts *.config.*`:

| Path | Evidence |
|---|---|
| `components/CanvasEditor.tsx`, `app/_components/CanvasEditor.tsx` | 0 bytes; the only `CanvasEditor` import is `./_components/CanvasEditor` from the workspace page, which resolves to the `(main)/workspace/[id]` file. |
| `components/DocEditorLoader.tsx` | The only import of `DocEditorLoader` is `@/app/_components/DocEditorLoader` (workspace page and shared page). |
| `app/(main)/workspace/[id]/_components/DocEditor.tsx` | No `_components/DocEditor` import anywhere; the page imports `DocEditor` from `@/app/_components/DocEditorLoader`, which dynamically imports `@/components/DocEditor`. |
| `lib/agent/client-tools.ts`, `lib/agent/tools.ts` | No import of `lib/agent/` anywhere outside the folder; `tools.ts` is referenced only by a comment in `client-tools.ts`. |
| `hooks/use-collaborative-doc.ts` | `useCollaborativeDoc` appears only in its own file. |
| `components/ui/badge.tsx`, `components/ui/sonner.tsx` | No `ui/badge` or `ui/sonner` import; `Toaster` comes from `"sonner"`. |
| deps `react-spinners`, `next-themes` | 0 imports of `react-spinners`; `next-themes` is imported only by `ui/sonner.tsx`. |

`@prisma/client`, `react-dom`, `dotenv`, `tsx` and the `@types/*` packages look unused to a grep but are used: by the generated client, Next itself, `prisma.config.ts`, the scripts, and tsc respectively.

### Known items kept as-is
- The `/shared/[token]` page couldn't be tested against the DB on 2026-11-19 because the DB hung; it gets a smoke test in Phase 3.
- `canEditWorkspace` is still used by `setWorkspaceSharing`, as decided earlier.

## Your decisions (2026-11-21)
- **D1–D7:** delete everything listed, including `lib/agent/*`, and uninstall `react-spinners` and `next-themes`.
- **D8:** wire up the assets in the root `metadata`:
  - `manifest: "/manifest.json"`
  - `openGraph.images` and `twitter.images` → `/social/og-image.png`
  - `icons: { icon: "/icon.png", apple: "/apple-icon.png" }`
  - `metadataBase`, read from an env var when set
- **D9:** not GPL, so delete `public/LICENSE`.
- **S4:** include it (production refuses the demo sync server).
- **B2:** keep the seed script as is and note it in the report.

## Phase 2: fix plan (after approval), in priority order
1. `git switch -c chore/deep-scan-cleanup`, write `AUDIT_REPORT.md` (this report), and commit: `docs: add deep-scan audit report`.
2. **S1** `fix(deps): upgrade next and eslint-config-next to 16.4.6` (patch/minor).
3. **S10** `fix(deps): minor upgrades for transitive advisories` (`@clerk/ui` 1.44.x plus in-range `npm update`). Check the Clerk UI changelog first.
4. **S2** `fix(deps): upgrade vitest to 4.x` (major, own commit, changelog read first).
5. **S3/B1** `fix(realtime): validate and guard incoming Yjs broadcasts`, plus a unit test with junk and valid payloads (mock `@/lib/supabase`).
6. **S7 + S8** `fix(workspace): block viewers from creating workspaces and validate name/description`, with tests.
7. **S6** `fix(agent): cap automatic tool follow-ups per prompt`, with a test on the counting helper in `lib/agent-request.ts`.
8. **S5** `fix(security): add baseline security headers`, verified by requesting pages with `curl -I`.
9. **S4** (if approved) `fix(canvas): don't fall back to the public tldraw demo server in production`.
10. **B5** `fix(db): allow slower transaction starts on cold databases`.
11. **B3** `fix(dashboard): hand the first prompt over without putting it in the URL`.
12. **B4** `feat(ui): add root error, not-found and loading states` (flagged: new UI, but it only replaces Next's bare defaults).
13. **B2** `chore: remove broken seed script` (or keep it, per your answer).
14. Deletions, one commit per batch with a rebuild after each: D1+D2, D3, D4, D5, D6+D7, D8 (per your answer).
15. **Q1, Q2**: trivial cleanups and docs.

After every commit: `tsc`, `eslint`, `npm test`, `next build`. Anything that passed at baseline and now fails gets fixed or reverted.

## Phase 3: verification
- Re-run the build, lint, type check, tests and `npm audit`; compare against the baseline table above.
- Smoke-test the main flows with `next start`:
  - Signed out: `/`, `/shared/<bad>` gives 404, `/workspace/x` redirects to sign-in, and the security headers are present.
  - Signed in (you'll need to sign in; I won't enter credentials): dashboard prompt to workspace, doc and canvas save and reload, rename, board move, share link on, `/shared/<token>` renders, PDF export.
- Add a "Results" section to `AUDIT_REPORT.md`: each finding marked Fixed, Skipped or Needs decision; before and after counts (audit vulnerabilities, lint, types, files and lines removed, dependencies removed); and manual tasks for you:
  - Supabase private channels (S3)
  - rename `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL` to `_KEY` in your hosting env
  - set `NEXT_PUBLIC_TLDRAW_SYNC_URL` on the host

---

## Results (Phase 3, 2026-11-21)

### Findings status
| ID | Status | Commit / note |
|---|---|---|
| S1 | **Fixed** | `bf5d89f`: next and eslint-config-next 16.3.4 → 16.4.6 |
| S2 | **Fixed** | `3959d5b`: vitest 3.2 → 4.1.12 (not 5.x, which would also require `@types/node` ≥22) |
| S3 | **Fixed in code and database; dashboard steps pending** | `56678c9` (payload guard), `824857b` (private channels + Clerk token). Policies applied to the database on 2026-11-21. Live sync needs the Clerk/Supabase dashboard steps below before this ships. |
| S11 | **Fixed (applied)** | `7ee0bf2`: **Critical, found after the main audit.** RLS was off on every app table and the `anon`/`authenticated` roles had full privileges, so the publishable key could read and modify all data via `/rest/v1` (confirmed). RLS is now on and the API roles are revoked; anonymous REST requests get 401, and the app (owner role) is unaffected. |
| S4 | **Fixed** | `e0363e0`: production refuses tldraw's public demo server |
| S5 | **Fixed** | `51942e7`: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy (checked with `curl -I`). The CSP is still to do. |
| S6 | **Fixed** | `ede16e9`: max 50 automatic steps per prompt, then 429 |
| S7, S8 | **Fixed** | `da749aa`: viewers can't create workspaces; zod validation (name ≤80, description ≤2000) |
| S9 | **Skipped** | No safe fix: npm's fix is a downgrade to Prisma 6.12, and the latest `@prisma/config` still pins `effect@3.20.0`. Affects the Prisma CLI only. |
| S10 | **Fixed** (mostly) | `6094575`: `@clerk/ui` 1.44.2 (drops the Solana stack) plus in-range `npm audit fix`. The `shadcn` → `ts-morph` → `minimatch` chain stays: the only fix is a downgrade, and shadcn is imported by `globals.css`. |
| B1 | **Fixed** | with S3 (`56678c9`) |
| B2 | **Skipped** (your choice) | `npm run seed` still points at a missing `prisma/seed.ts` |
| B3 | **Fixed** | `e7bbab7`: prompt is handed over through sessionStorage, falling back to the URL if storage is blocked |
| B4 | **Fixed** | `2ab6e8d`: `app/error.tsx`, `app/not-found.tsx`, `app/(main)/loading.tsx` |
| B5 | **Fixed** | `1e9804b`: transactions get `maxWait: 10s` |
| P1 | Skipped | report only (dashboard loads every workspace to show 6) |
| D1–D7 | **Fixed** | `ccf8638`, `de1c8df`, `69d2b7e`, `7062e98`, `d509caa` |
| D8 | **Fixed** | `afa8438`: manifest, icons, OG/Twitter image wired into metadata |
| D9 | **Fixed** | `1e4ac38`: removed `public/LICENSE` |
| Q1, Q2 | **Fixed** | `acd325a`, `8a44155` |
| Q3 | Skipped | report only |

### Before and after
| Metric | Baseline (`main` @ 341a6f6) | Now |
|---|---|---|
| `npm audit` | 30 (3 critical, 3 high, 24 moderate) | **7 (0 critical, 3 high, 4 moderate)**; all 7 are the S9/S10 downgrade-only chains |
| Type errors | 0 | 0 |
| Lint | 0 errors, 2 warnings | **0 errors, 0 warnings** |
| Tests | 35 passing (5 files) | **55 passing (8 files)** |
| Build | pass | pass |
| Files removed | | 10 files, 1,358 lines |
| Source diff (excluding lockfile and this report) | | +514 / −1,439 lines |
| `package-lock.json` | | +1,190 / −9,354 lines |
| Dependencies removed | | `react-spinners`, `next-themes`; none added |

### Smoke test (production build, signed out)
`/` 200 · `/shared/<unknown token>` 404 (app 404 page; DB lookup ran) · `/shared/x` 404 · `/workspace/abc`, `/dashboard`, `/workspaces` 307 to Clerk sign-in · `/nope` 404 · `/manifest.json` 200 · `POST /api/agent` 401 · all 4 security headers present.
**Not run:** signed-in flows (dashboard prompt, doc/canvas save, rename, board move, share link, PDF export). They need you to sign in; I don't enter credentials.

### Manual tasks for you
1. **Finish the private doc channels (S3), in this order:** (a) Clerk Dashboard → activate the Supabase integration (adds `role: authenticated` to session tokens) and copy the Clerk domain; (b) Supabase Dashboard → Authentication → Sign In / Providers → add Clerk with that domain; (c) deploy this branch; (d) Supabase → Realtime → Settings → turn off **Allow public access**. Until (a) and (b) are done, the branch's private channels are refused: docs still open and save, but without live collaboration. Known limit: Realtime only sees the *active* org, so opening an org workspace while a different org is selected gives no live sync (the page itself still loads).
2. **Set `NEXT_PUBLIC_TLDRAW_SYNC_URL`** on your host. Without it, production builds now disable the canvas (S4). Your local `.env` doesn't have it either, so `next start` locally shows the "canvas isn't available" panel; `npm run dev` still works.
3. **Rename `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** in `.env` and on the host (the code reads both for now).
4. **Set `NEXT_PUBLIC_APP_URL`** (new, optional) to your public URL, so link-preview images use absolute URLs instead of `localhost:3000`.
5. No secrets were found in the repo or its history, so nothing needs rotating.
6. Later: add a Content-Security-Policy, tuned for Clerk, tldraw, Supabase and the sync server, and tested.
