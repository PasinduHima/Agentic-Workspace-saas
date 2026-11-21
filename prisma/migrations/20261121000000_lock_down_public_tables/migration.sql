-- Supabase exposes the public schema through its Data API (PostgREST), and by default grants the
-- anon and authenticated roles full access to new tables. With RLS off, anyone holding the
-- publishable key (it ships in the browser bundle) could read and change every row.
--
-- The app reaches these tables only through Prisma, as the owning "postgres" role, which bypasses
-- RLS, so enabling RLS with no policies and revoking the API roles changes nothing for the app.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Doc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Canvas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentPrompt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- The API roles only exist on Supabase; skip this part on a plain Postgres (e.g. local dev).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    -- Tables created by later migrations shouldn't be exposed either.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END
$$;
