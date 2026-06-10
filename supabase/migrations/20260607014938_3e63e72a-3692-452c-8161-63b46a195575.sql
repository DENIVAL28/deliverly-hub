
-- =========================
-- ROLES
-- =========================
CREATE TYPE public.app_role AS ENUM ('master', 'empresa_owner', 'empresa_staff');
CREATE TYPE public.empresa_status AS ENUM ('ativa', 'vencida', 'bloqueada');
CREATE TYPE public.pedido_status AS ENUM ('novo', 'aceito', 'preparo', 'entrega', 'finalizado', 'cancelado');

-- =========================
-- PLANOS
-- =========================
CREATE TABLE public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  limite_produtos INT,
  limite_usuarios INT,
  limite_pedidos INT,
  recursos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.planos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.planos TO authenticated;
GRANT ALL ON public.planos TO service_role;

-- =========================
-- EMPRESAS
-- =========================
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  cpf_cnpj TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  logo_url TEXT,
  banner_url TEXT,
  cor_primaria TEXT DEFAULT '#F97316',
  cor_secundaria TEXT DEFAULT '#111827',
  plano_id UUID REFERENCES public.planos(id),
  status public.empresa_status NOT NULL DEFAULT 'ativa',
  vencimento DATE,
  taxa_entrega NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.empresas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;

-- =========================
-- PROFILES + USER_ROLES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, empresa_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- =========================
-- SECURITY DEFINER HELPERS
-- =========================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_master(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'master');
$$;

CREATE OR REPLACE FUNCTION public.get_user_empresa_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- =========================
-- CATEGORIAS
-- =========================
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categorias TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;
CREATE INDEX idx_categorias_empresa ON public.categorias(empresa_id);

-- =========================
-- PRODUTOS
-- =========================
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  foto_url TEXT,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_promocional NUMERIC(10,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.produtos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
CREATE INDEX idx_produtos_empresa ON public.produtos(empresa_id);

-- =========================
-- CLIENTES
-- =========================
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
CREATE INDEX idx_clientes_empresa ON public.clientes(empresa_id);

-- =========================
-- PEDIDOS
-- =========================
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero SERIAL,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  cliente_endereco TEXT,
  observacao TEXT,
  forma_pagamento TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxa_entrega NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.pedido_status NOT NULL DEFAULT 'novo',
  tipo TEXT DEFAULT 'entrega',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT INSERT ON public.pedidos TO anon;
GRANT ALL ON public.pedidos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE pedidos_numero_seq TO anon, authenticated, service_role;
CREATE INDEX idx_pedidos_empresa ON public.pedidos(empresa_id);

CREATE TABLE public.pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  observacao TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO authenticated;
GRANT INSERT ON public.pedido_itens TO anon;
GRANT ALL ON public.pedido_itens TO service_role;

-- =========================
-- RLS
-- =========================
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Planos visíveis publicamente" ON public.planos FOR SELECT USING (true);
CREATE POLICY "Master gerencia planos" ON public.planos FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresas visíveis publicamente" ON public.empresas FOR SELECT USING (true);
CREATE POLICY "Master gerencia empresas" ON public.empresas FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "Dono edita sua empresa" ON public.empresas FOR UPDATE TO authenticated
  USING (id = public.get_user_empresa_id(auth.uid()))
  WITH CHECK (id = public.get_user_empresa_id(auth.uid()));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seu profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "Usuário atualiza seu profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Usuário cria seu profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Master gerencia profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seus papéis" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "Master gerencia papéis" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categorias públicas" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Empresa gerencia categorias" ON public.categorias FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()));

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Produtos públicos" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "Empresa gerencia produtos" ON public.produtos FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()));

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa gerencia clientes" ON public.clientes FOR ALL TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()));

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa vê seus pedidos" ON public.pedidos FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()));
CREATE POLICY "Empresa atualiza seus pedidos" ON public.pedidos FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()))
  WITH CHECK (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()));
CREATE POLICY "Empresa deleta seus pedidos" ON public.pedidos FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()));
CREATE POLICY "Qualquer um cria pedido" ON public.pedidos FOR INSERT
  WITH CHECK (true);

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vê itens de pedidos visíveis" ON public.pedido_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
    AND (p.empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()))));
CREATE POLICY "Qualquer um cria itens" ON public.pedido_itens FOR INSERT WITH CHECK (true);
CREATE POLICY "Empresa gerencia itens" ON public.pedido_itens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
    AND (p.empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()))));
CREATE POLICY "Empresa deleta itens" ON public.pedido_itens FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
    AND (p.empresa_id = public.get_user_empresa_id(auth.uid()) OR public.is_master(auth.uid()))));

-- =========================
-- TRIGGERS
-- =========================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_empresas_updated BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_produtos_updated BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_pedidos_updated BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_planos_updated BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- SEED PLANOS
-- =========================
INSERT INTO public.planos (nome, slug, valor, limite_produtos, limite_usuarios, limite_pedidos, recursos) VALUES
  ('Básico', 'basico', 99.00, 50, 2, 500, '["Cardápio digital","Pedidos via WhatsApp","Suporte por e-mail"]'::jsonb),
  ('Profissional', 'profissional', 199.00, 500, 5, NULL, '["Tudo do Básico","Pedidos ilimitados","Gestão de entregadores","Relatórios"]'::jsonb),
  ('Premium', 'premium', 349.00, NULL, NULL, NULL, '["Tudo do Profissional","Multi-loja","Suporte prioritário","Gerente de conta"]'::jsonb);
