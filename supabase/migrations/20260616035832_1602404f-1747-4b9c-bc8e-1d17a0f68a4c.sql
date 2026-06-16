DROP POLICY IF EXISTS "Anyone can insert wallet profiles" ON public.wallet_profiles;
DROP POLICY IF EXISTS "Anyone can update wallet profiles" ON public.wallet_profiles;
-- Reads remain public (usernames are intentionally public). Writes now go exclusively through the
-- `update-wallet-username` edge function, which verifies a wallet signature and uses the
-- service role to bypass RLS. No client (anon or authenticated) can directly insert or update.
REVOKE INSERT, UPDATE, DELETE ON public.wallet_profiles FROM anon, authenticated;
GRANT ALL ON public.wallet_profiles TO service_role;