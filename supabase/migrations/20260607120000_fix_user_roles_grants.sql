-- Allow authenticated masters to manage user_roles via UI client
-- Previously only SELECT was granted, so RLS policies for master had no effect on writes
GRANT INSERT, DELETE ON public.user_roles TO authenticated;
