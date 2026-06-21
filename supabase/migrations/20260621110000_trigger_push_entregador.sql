-- Atualiza trigger de push para disparar também em UPDATE de status.
-- A função agora passa flags notificar_loja e notificar_entregador para a
-- Edge Function decidir o que enviar, evitando chamadas desnecessárias.
--
-- Regras:
--   notificar_loja      = true somente no INSERT (pedido novo)
--   notificar_entregador = true quando status torna-se 'aceito', tipo = 'delivery'
--                          e ainda sem entregador atribuído
--
-- Para entregadores de plataforma, a RPC entregador_pedidos_disponiveis() usa
-- p.tipo = 'delivery' (sem NULL), então o trigger segue o mesmo critério.

CREATE OR REPLACE FUNCTION public.trigger_push_novo_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_id           BIGINT;
  v_notif_loja       BOOLEAN;
  v_notif_entregador BOOLEAN;
BEGIN
  -- Loja: somente no INSERT (pedido criado)
  v_notif_loja := (TG_OP = 'INSERT');

  -- Entregador: quando o status transiciona para 'aceito' pela primeira vez
  -- e o pedido é delivery sem entregador atribuído.
  -- TG_OP = 'INSERT': OLD não existe, então OLD.status IS DISTINCT FROM 'aceito' = true.
  -- TG_OP = 'UPDATE': só dispara se o status mudou para 'aceito' agora.
  v_notif_entregador := (
    NEW.status = 'aceito'
    AND NEW.entregador_id IS NULL
    AND NEW.tipo = 'delivery'
    AND (
      TG_OP = 'INSERT'
      OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'aceito')
    )
  );

  -- Só chama a Edge Function se houver algo a notificar
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

-- Recria o trigger para disparar em INSERT e UPDATE de status/entregador_id
DROP TRIGGER IF EXISTS on_new_order_push ON public.pedidos;

CREATE TRIGGER on_new_order_push
  AFTER INSERT OR UPDATE OF status, entregador_id
  ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_novo_pedido();
