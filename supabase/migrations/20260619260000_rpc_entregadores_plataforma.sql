-- RPC segura para lojista listar entregadores da plataforma
-- Usa SECURITY DEFINER para contornar a complexidade de RLS
-- entre políticas de entregadores fixos e de plataforma

SET search_path = public;

CREATE OR REPLACE FUNCTION public.empresa_listar_entregadores_plataforma()
RETURNS TABLE (
  id           UUID,
  nome         TEXT,
  veiculo      TEXT,
  foto_rosto_url TEXT,
  status       TEXT,
  verificado   BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_empresa UUID;
BEGIN
  v_empresa := public.get_user_empresa_id(auth.uid());
  IF v_empresa IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT e.id, e.nome, e.veiculo, e.foto_rosto_url,
           COALESCE(e.status, 'indisponivel'), e.verificado
      FROM public.entregadores e
     WHERE e.empresa_id IS NULL
       AND e.status_cadastro = 'aprovado'
     ORDER BY
       CASE WHEN e.status = 'disponivel' THEN 0
            WHEN e.status = 'em_rota'    THEN 1
            ELSE 2 END,
       e.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.empresa_listar_entregadores_plataforma() TO authenticated;
