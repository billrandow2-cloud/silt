-- S.I.L.T. System - Setup do Supabase
-- Execute estes comandos no Editor SQL do Supabase

-- =====================================================
-- 1. CRIAR TABELAS
-- =====================================================

-- Tabela de usuários (extendida do auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de permissões/roles
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT REFERENCES public.users(username) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de dados de pools
CREATE TABLE IF NOT EXISTS public.pool_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    week TEXT NOT NULL,
    pool_name TEXT NOT NULL,
    invested_value DECIMAL(15, 2) DEFAULT 0,
    profit_value DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de dados AAVE
CREATE TABLE IF NOT EXISTS public.aave_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    aave_balance DECIMAL(15, 2) DEFAULT 0,
    borrow_value DECIMAL(15, 2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aave_data ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. CRIAR POLÍTICAS DE SEGURANÇA
-- =====================================================

-- Políticas para tabela users
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.permissions
            WHERE username = (SELECT username FROM public.users WHERE id = auth.uid())
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can insert users" ON public.users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.permissions
            WHERE username = (SELECT username FROM public.users WHERE id = auth.uid())
            AND role = 'admin'
        )
    );

-- Políticas para tabela permissions
CREATE POLICY "Users can view own permissions" ON public.permissions
    FOR SELECT USING (
        username = (SELECT username FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "Admins can manage permissions" ON public.permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.permissions
            WHERE username = (SELECT username FROM public.users WHERE id = auth.uid())
            AND role = 'admin'
        )
    );

-- Políticas para pool_data
CREATE POLICY "Users can view own pool data" ON public.pool_data
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all pool data" ON public.pool_data
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.permissions
            WHERE username = (SELECT username FROM public.users WHERE id = auth.uid())
            AND role = 'admin'
        )
    );

-- Políticas para aave_data
CREATE POLICY "Users can view own aave data" ON public.aave_data
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all aave data" ON public.aave_data
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.permissions
            WHERE username = (SELECT username FROM public.users WHERE id = auth.uid())
            AND role = 'admin'
        )
    );

-- =====================================================
-- 4. CRIAR FUNÇÕES AUXILIARES
-- =====================================================

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.permissions p
        JOIN public.users u ON p.username = u.username
        WHERE u.id = user_uuid AND p.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar usuário (chamada via RPC)
CREATE OR REPLACE FUNCTION public.create_new_user(
    new_username TEXT,
    new_email TEXT,
    new_password TEXT,
    new_role TEXT DEFAULT 'user'
)
RETURNS JSONB AS $$
DECLARE
    new_user_id UUID;
    result JSONB;
BEGIN
    -- Verificar se quem está chamando é admin
    IF NOT public.is_admin(auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas admins podem criar usuários');
    END IF;

    -- Criar usuário no auth
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
    VALUES (
        uuid_generate_v4(),
        new_email,
        crypt(new_password, gen_salt('bf')),
        NOW()
    )
    RETURNING id INTO new_user_id;

    -- Inserir na tabela users
    INSERT INTO public.users (id, username, email)
    VALUES (new_user_id, new_username, new_email);

    -- Inserir permissão
    INSERT INTO public.permissions (username, role)
    VALUES (new_username, new_role);

    RETURN jsonb_build_object('success', true, 'user_id', new_user_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. CRIAR USUÁRIO ADMIN INICIAL
-- Substitua 'admin' e 'sua-senha-segura' abaixo
-- =====================================================

-- Primeiro, crie um usuário manualmente na interface do Supabase (Authentication > Users)
-- Depois pegue o UUID do usuário criado e execute:

-- INSERT INTO public.users (id, username, email)
-- VALUES ('uuid-do-usuario-admin', 'admin', 'admin@seudominio.com');

-- INSERT INTO public.permissions (username, role)
-- VALUES ('admin', 'admin');

-- =====================================================
-- 6. CRIAR TRIGGER PARA NOVOS USUÁRIOS
-- =====================================================

-- Função para adicionar usuário na tabela users após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, username, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email
    );

    -- Adicionar permissão de usuário padrão
    INSERT INTO public.permissions (username, role)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        'user'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 7. ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pool_data_user_id ON public.pool_data(user_id);
CREATE INDEX IF NOT EXISTS idx_pool_data_month ON public.pool_data(month);
CREATE INDEX IF NOT EXISTS idx_aave_data_user_id ON public.aave_data(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_username ON public.permissions(username);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
