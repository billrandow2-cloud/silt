# Guia de Configuração do Admin no Supabase

## 📋 Passo a Passo

### 1️⃣ Acessar o Dashboard do Supabase

1. Acesse: https://supabase.com/dashboard
2. Faça login com sua conta
3. Selecione o projeto: `upskwiyrdeowzzushwid`

---

### 2️⃣ Criar as Tabelas (SQL Editor)

1. No menu lateral, clique em **"SQL Editor"**
2. Clique em **"New query"**
3. Cole TODO o conteúdo do arquivo `supabase-setup.sql`
4. Clique em **"Run"** ▶️

---

### 3️⃣ Criar o Primeiro Usuário Admin

#### Opção A - Pelo Dashboard (Recomendado):

1. Vá em **Authentication > Users**
2. Clique em **"Add user"** ou **"Invite"**
3. Preencha:
   - **Email**: `admin@silt.com`
   - **Password**: `admin123` (ou uma senha segura)
4. Clique em **"Create user"**
5. Copie o **UUID** do usuário criado (clique no usuário para ver)

#### Opção B - Pelo SQL:

```sql
-- Criar usuário admin diretamente
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
    uuid_generate_v4(),
    'admin@silt.com',
    crypt('admin123', gen_salt('bf')),
    NOW()
);
```

---

### 4️⃣ Transformar o Usuário em Admin

1. No **SQL Editor**, crie uma nova query
2. Execute:

```sql
-- Pegue o UUID do usuário admin criado
-- Substitua 'AQUI-O-UUID' pelo UUID real

INSERT INTO public.users (id, username, email)
VALUES (
    'AQUI-O-UUID',
    'admin',
    'admin@silt.com'
);

INSERT INTO public.permissions (username, role)
VALUES ('admin', 'admin');
```

---

### 5️⃣ Verificar se Funcionou

Execute esta query para confirmar:

```sql
SELECT u.id, u.username, u.email, p.role
FROM public.users u
JOIN public.permissions p ON u.username = p.username
WHERE p.role = 'admin';
```

Você deve ver o usuário admin listado.

---

### 6️⃣ Configurar Políticas de Autenticação

1. Vá em **Authentication > Policies**
2. Verifique se as tabelas `users`, `pool_data`, `aave_data` e `permissions` aparecem
3. Clique em cada uma para verificar se as RLS (Row Level Security) estão ativas

---

### 7️⃣ Configurar URL de Redirecionamento (Opcional)

Se quiser que o login redirecione corretamente:

1. Vá em **Authentication > URL Configuration**
2. Em **Site URL**, coloque: `http://localhost:8000/dashboard.html`
3. Em **Redirect URLs**, adicione:
   - `http://localhost:8000/dashboard.html`
   - `http://localhost:8000/admin.html`

---

### 8️⃣ Testar o Login

1. Abra o projeto: `http://localhost:8000`
2. Clique em **"Acessar Dashboard"**
3. Faça login com:
   - **Username**: `admin`
   - **Password**: `admin123` (ou a senha que você definiu)
4. Você deve ser redirecionado para `admin.html`

---

## 🔧 Solução de Problemas

### Erro: "Invalid login credentials"

**Causa**: O usuário existe no `auth.users` mas não na tabela `public.users`

**Solução**:
```sql
-- Verifique se o usuário existe
SELECT * FROM auth.users WHERE email = 'admin@silt.com';

-- Se existir, pegue o UUID e insira na tabela users
INSERT INTO public.users (id, username, email)
SELECT id, split_part(email, '@', 1), email
FROM auth.users
WHERE email = 'admin@silt.com'
ON CONFLICT DO NOTHING;

-- Dê permissão de admin
INSERT INTO public.permissions (username, role)
VALUES ('admin', 'admin')
ON CONFLICT DO NOTHING;
```

### Erro: "new row violates row-level security policy"

**Causa**: As políticas RLS não estão configuradas corretamente

**Solução**: Execute novamente a parte das políticas do arquivo SQL.

### Erro: "relation does not exist"

**Causa**: As tabelas não foram criadas

**Solução**: Execute todo o script `supabase-setup.sql` novamente.

---

## 📝 Comandos Úteis

### Listar todos os usuários:
```sql
SELECT * FROM public.users;
```

### Ver permissões:
```sql
SELECT * FROM public.permissions;
```

### Promover usuário para admin:
```sql
UPDATE public.permissions
SET role = 'admin'
WHERE username = 'nome-do-usuario';
```

### Rebaixar admin para user:
```sql
UPDATE public.permissions
SET role = 'user'
WHERE username = 'nome-do-usuario';
```

### Deletar usuário:
```sql
-- Primeiro delete das tabelas public
DELETE FROM public.permissions WHERE username = 'admin';
DELETE FROM public.users WHERE username = 'admin';

-- Depois delete do auth
DELETE FROM auth.users WHERE email = 'admin@silt.com';
```

---

## ✅ Checklist de Configuração

- [ ] Tabelas criadas (`users`, `permissions`, `pool_data`, `aave_data`)
- [ ] RLS habilitado em todas as tabelas
- [ ] Políticas criadas
- [ ] Usuário admin criado em `auth.users`
- [ ] Usuário admin inserido em `public.users`
- [ ] Permissão admin inserida em `public.permissions`
- [ ] Teste de login realizado
- [ ] Redirecionamento funcionando

---

## 🚀 Próximos Passos

1. **Criar usuários de teste** usando o painel admin
2. **Inserir dados de pools** para testar o dashboard
3. **Configurar domínio** se for hospedar online
4. **Ativar email confirmation** se quiser verificação por email

---

**Precisa de ajuda?** Verifique o console do navegador (F12) para ver erros específicos.
