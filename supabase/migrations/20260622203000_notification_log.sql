-- Tabela de log de notificações push + trigger atualizado para registrar tentativas.
-- O trigger não falha silenciosamente: registra status 'pending', e em caso de erro
-- salva o motivo em 'failed'. Um job externo (pg_cron ou Edge Function agendada)
-- pode reprocessar entradas com status='failed' AND tentativas < 3.

SET search_path = public;

-- ── 1. Tabela de log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id     UUID        REFERENCES public.pedidos(id) ON DELETE CASCADE,
  canal         TEXT        NOT NULL DEFAULT 'push',
  status        TEXT        NOT NULL DEFAULT 'pending',  -- pending | delivered | failed
  tentativas    INT         NOT NULL DEFAULT 0,
  erro          TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Apenas service_role acessa diretamente; o trigger roda como SECURITY DEFINER
CREATE POLICY "nenhum_acesso_direto" ON public.notification_log
  FOR ALL TO authenticated, anon USING (false);

-- ── 2. Trigger atualizado: registra tentativa e captura falha ────────────────────
CREATE OR REPLACE FUNCTION public.trigger_push_novo_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_id           BIGINT;
  v_log_id           UUID;
  v_notif_loja       BOOLEAN;
  v_notif_entregador BOOLEAN;
  v_tipo_op_entrega  TEXT;
BEGIN
  v_notif_loja := (TG_OP = 'INSERT');

  IF NEW.status = 'aceito' AND NEW.entregador_id IS NULL AND NEW.tipo = 'delivery' THEN
    SELECT tipo_operacao_entrega INTO v_tipo_op_entrega
      FROM public.empresas
     WHERE id = NEW.empresa_id;
  END IF;

  v_notif_entregador := (
    NEW.status = 'aceito'
    AND NEW.entregador_id IS NULL
    AND NEW.tipo = 'delivery'
    AND v_tipo_op_entrega = 'plataforma'
    AND (
      TG_OP = 'INSERT'
      OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'aceito')
    )
  );

  IF v_notif_loja OR v_notif_entregador THEN
    -- Registra tentativa de notificação antes de chamar o Edge Function
    INSERT INTO public.notification_log (pedido_id, canal, status)
    VALUES (NEW.id, 'push', 'pending')
    RETURNING id INTO v_log_id;

    BEGIN
      SELECT net.http_post(
        url     := 'https://ilgzvcfisrhrfmpcgtcx.supabase.co/functions/v1/push-pedido',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object(
          'record',               row_to_json(NEW),
          'op',                   TG_OP,
          'notificar_loja',       v_notif_loja,
          'notificar_entregador', v_notif_entregador,
          'log_id',               v_log_id
        )
      ) INTO v_req_id;

      -- Atualiza log: a Edge Function confirmará 'delivered' quando concluir
      UPDATE public.notification_log
         SET tentativas = tentativas + 1,
             atualizado_em = now()
       WHERE id = v_log_id;

    EXCEPTION WHEN OTHERS THEN
      -- Registra falha sem bloquear a transação do pedido
      UPDATE public.notification_log
         SET status = 'failed',
             erro   = SQLERRM,
             tentativas = tentativas + 1,
             atualizado_em = now()
       WHERE id = v_log_id;

      RAISE WARNING 'push trigger error (log_id=%): %', v_log_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
