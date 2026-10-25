BEGIN;

-- Profile provisioning is part of signUp's transaction, including when email
-- confirmation is enabled and the new user has no authenticated session yet.
CREATE FUNCTION public.create_signup_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    profile_name text := btrim(NEW.raw_user_meta_data ->> 'name');
    profile_phone text := nullif(btrim(NEW.raw_user_meta_data ->> 'phone'), '');
BEGIN
    IF profile_name IS NULL OR length(profile_name) NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'A name of 1 to 100 characters is required';
    END IF;

    IF (NEW.raw_user_meta_data -> 'is_adult_confirmed') IS DISTINCT FROM 'true'::jsonb THEN
        RAISE EXCEPTION 'Adult confirmation is required';
    END IF;

    IF profile_phone IS NOT NULL AND (
        length(profile_phone) > 30
        OR profile_phone !~ '^[+0-9 ().-]+$'
        OR length(regexp_replace(profile_phone, '[^0-9]', '', 'g')) < 7
    ) THEN
        RAISE EXCEPTION 'Invalid phone number';
    END IF;

    INSERT INTO public.profiles (id, name, phone, email, is_adult_confirmed, role)
    VALUES (NEW.id, profile_name, profile_phone, NEW.email, true, 'user');
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_signup_profile()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_signup_profile();

COMMIT;
