-- 1. Unique constraint em user_roles para evitar duplicatas e permitir ON CONFLICT
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

-- 2. Garante que só pode existir UM master no sistema
CREATE OR REPLACE FUNCTION public.enforce_single_master()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'master' THEN
    IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'master' AND user_id != NEW.user_id) > 0 THEN
      RAISE EXCEPTION 'Já existe um master cadastrado. Remova o atual antes de adicionar outro.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_master
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_master();
