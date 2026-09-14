-- Supabase installs this SECURITY DEFINER event-trigger function to enable RLS
-- on newly created public tables. It only needs to be invoked by its event
-- trigger, so browser-facing roles must not be able to call it through RPC.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC, anon, authenticated;';
  END IF;
END $$;
