-- Corrige trigger de push: verifica tipo_operacao_entrega da empresa ANTES de
-- sinalizar notificar_entregador. Isso garante que lojas em modo "fixos" nunca
-- disparem push para entregadores da plataforma, mesmo que a Edge Function falhe.

CREATE OR REPLACE FUNCTION public.trigger_push_novo_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_id              BIGINT;
  v_notif_loja          BOOLEAN;
  v_notif_entregador    BOOLEAN;
  v_tipo_op_entrega     TEXT;
BEGIN
  v_notif_loja := (TG_OP = 'INSERT');

  -- Só consulta a empresa se o pedido é candidato a notificar entregador
  IF NEW.status = 'aceito' AND NEW.entregador_id IS NULL AND NEW.tipo = 'delivery' THEN
    SELECT tipo_operacao_entrega INTO v_tipo_op_entrega
    FROM public.empresas
    WHERE id = NEW.empresa_id;
  END IF;

  v_notif_entregador := (
    NEW.status = 'aceito'
    AND NEW.entregador_id IS NULL
    AND NEW.tipo = 'delivery'
    -- Só notifica se empresa realmente usa modo plataforma
    AND v_tipo_op_entrega = 'plataforma'
    AND (
      TG_OP = 'INSERT'
      OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'aceito')
    )
  );

  IF v_notif_loja OR v_notif_entregador THEN
    SELECT net.http_post(
      url     := 'https://ilgzvcfisrhrfmpcgtcx.supabase.co/functions/v1/push-pedido',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := jsonb_build_object(
        'record',               row_to_json(NEW),
        'op',                   TG_OP,
        'notificar_loja',       v_notif_loja,
        'notificar_entregador', v_notif_entregador
      )
    ) INTO v_req_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;
