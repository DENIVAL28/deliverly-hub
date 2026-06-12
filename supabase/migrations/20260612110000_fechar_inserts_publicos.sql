-- ═══════════════════════════════════════════════════════════════════════════════
-- Fecha INSERT direto em pedidos/pedido_itens para anon
-- Todo pedido deve passar pela RPC finalizar_pedido (SECURITY DEFINER)
-- ═══════════════════════════════════════════════════════════════════════════════

SET search_path = public;

-- Remove permissões de INSERT direto para anon
REVOKE INSERT ON public.pedidos      FROM anon;
REVOKE INSERT ON public.pedido_itens FROM anon;

-- Remove políticas que permitiam INSERT livre
DROP POLICY IF EXISTS "Qualquer um cria pedido" ON public.pedidos;
DROP POLICY IF EXISTS "Qualquer um cria itens"  ON public.pedido_itens;

-- Garante que a RPC continua acessível para anon
GRANT EXECUTE ON FUNCTION public.finalizar_pedido(uuid,text,text,text,text,text,text,text,uuid,jsonb,double precision,double precision,text,text,text,numeric) TO anon;
