-- Página de tracking do pedido (/pedido/:id) falhava com "Pedido não encontrado"
-- quando o cliente abria o link em nova sessão (auth.uid() diferente do que fez o pedido).
-- A UUID do pedido tem 128 bits de entropia — acesso por ID é seguro por obscuridade.

CREATE OR REPLACE FUNCTION public.buscar_pedido_tracking(p_pedido_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id',              p.id,
    'numero',          p.numero,
    'status',          p.status::text,
    'tipo',            p.tipo,
    'fluxo_pedido',    p.fluxo_pedido,
    'subtotal',        p.subtotal,
    'taxa_entrega',    p.taxa_entrega,
    'desconto',        p.desconto,
    'total',           p.total,
    'forma_pagamento', p.forma_pagamento,
    'cliente_nome',    p.cliente_nome,
    'cliente_endereco',p.cliente_endereco,
    'cliente_lat',     p.cliente_lat,
    'cliente_lng',     p.cliente_lng,
    'mesa',            p.mesa,
    'observacao',      p.observacao,
    'entregador_id',   p.entregador_id,
    'entregador_nome', p.entregador_nome,
    'empresa_id',      p.empresa_id,
    'created_at',      p.created_at,
    'pedido_itens', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',             pi.id,
        'nome',           pi.nome,
        'quantidade',     pi.quantidade,
        'preco_unitario', pi.preco_unitario,
        'subtotal',       pi.subtotal,
        'observacao',     pi.observacao
      )), '[]'::jsonb)
      FROM public.pedido_itens pi
      WHERE pi.pedido_id = p.id
    ),
    'empresas', jsonb_build_object(
      'nome_fantasia',   e.nome_fantasia,
      'whatsapp',        e.whatsapp,
      'logo_url',        e.logo_url,
      'chave_pix',       e.chave_pix,
      'tipo_chave_pix',  e.tipo_chave_pix,
      'nome_recebedor',  e.nome_recebedor,
      'cidade_recebedor',e.cidade_recebedor,
      'slug',            e.slug
    )
  )
  INTO v_result
  FROM public.pedidos p
  JOIN public.empresas e ON e.id = p.empresa_id
  WHERE p.id = p_pedido_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_pedido_tracking(uuid) TO anon, authenticated;
