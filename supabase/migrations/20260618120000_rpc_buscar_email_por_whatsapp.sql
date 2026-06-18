-- RPC pública: busca o e-mail de login mascarado pelo WhatsApp da empresa.
-- Acessível por anon (SECURITY DEFINER bypassa RLS de profiles).
-- Retorna ex: "jo***@gmail.com" — nunca o e-mail completo.

CREATE OR REPLACE FUNCTION public.buscar_email_por_whatsapp(p_whatsapp TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email  TEXT;
  v_local  TEXT;
  v_domain TEXT;
BEGIN
  SELECT p.email INTO v_email
  FROM public.profiles p
  JOIN public.empresas e ON e.id = p.empresa_id
  WHERE regexp_replace(COALESCE(e.whatsapp, ''), '\D', '', 'g')
      = regexp_replace(p_whatsapp, '\D', '', 'g')
  LIMIT 1;

  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Mascara: mantém 2 primeiros chars + *** + domínio completo
  v_local  := split_part(v_email, '@', 1);
  v_domain := '@' || split_part(v_email, '@', 2);

  RETURN substring(v_local FROM 1 FOR LEAST(2, length(v_local)))
      || '***'
      || v_domain;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_email_por_whatsapp(TEXT) TO anon, authenticated;
