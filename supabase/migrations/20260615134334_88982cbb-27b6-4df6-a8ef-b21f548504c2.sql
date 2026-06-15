
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.wallet_profiles (
  wallet_address text PRIMARY KEY,
  username citext UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.wallet_profiles TO anon, authenticated;
GRANT ALL ON public.wallet_profiles TO service_role;

ALTER TABLE public.wallet_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read wallet profiles" ON public.wallet_profiles;
CREATE POLICY "Anyone can read wallet profiles"
  ON public.wallet_profiles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can insert wallet profiles" ON public.wallet_profiles;
CREATE POLICY "Anyone can insert wallet profiles"
  ON public.wallet_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update wallet profiles" ON public.wallet_profiles;
CREATE POLICY "Anyone can update wallet profiles"
  ON public.wallet_profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.validate_wallet_username()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    IF length(NEW.username::text) < 3 OR length(NEW.username::text) > 20 THEN
      RAISE EXCEPTION 'Username must be 3-20 characters';
    END IF;
    IF NEW.username::text !~ '^[A-Za-z0-9_]+$' THEN
      RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_wallet_username_trigger ON public.wallet_profiles;
CREATE TRIGGER validate_wallet_username_trigger
  BEFORE INSERT OR UPDATE ON public.wallet_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_wallet_username();
