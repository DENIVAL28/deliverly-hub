-- Adiciona transição aceito → entrega para pedidos sem preparo.
-- NEXT_SEM_PREPARO em pedidos.tsx pula diretamente aceito→entrega quando
-- todos os itens do pedido têm requer_preparo = false. A migration anterior
-- (20260622202000) não incluiu essa linha, bloqueando o fluxo sem preparo.

SET search_path = public;

INSERT INTO public.pedido_status_transitions (status_de, status_para)
VALUES ('aceito', 'entrega')
ON CONFLICT DO NOTHING;
