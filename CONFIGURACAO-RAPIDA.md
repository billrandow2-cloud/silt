# Configuração Rápida do Supabase

## Credenciais Já Configuradas ✅

Seu arquivo `js/supabase.js` já contém as credenciais:

```javascript
const SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';
```

---

## Passos para Configurar o Admin

### 1. Acesse seu projeto Supabase

🔗 https://supabase.com/dashboard/project/upskwiyrdeowzzushwid

---

### 2. Execute o Script SQL

1. No menu lateral, clique em **"SQL Editor"**
2. Clique em **"New query"**
3. Cole TODO o conteúdo do arquivo `supabase-setup.sql`
4. Clique em **"Run"**

---

### 3. Crie o Usuário Admin (Método Rápido)

No SQL Editor, execute:

```sql
-- PASSO 1: Criar usuário na autenticação
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
VALUES (
    uuid_generate_v4(),
    'admin@silt.com',
    crypt('admin123', gen_salt('bf')),
    NOW()
)
RETURNING id;

-- Anote o UUID retornado! Você vai precisar no próximo passo.
```

Substitua `'UUID-AQUI'` pelo UUID retornado acima:

```sql
-- PASSO 2: Inserir na tabela users
INSERT INTO public.users (id, username, email)
VALUES ('UUID-AQUI', 'admin', 'admin@silt.com');

-- PASSO 3: Dar permissão de admin
INSERT INTO public.permissions (username, role)
VALUES ('admin', 'admin');
```

---

### 4. Verifique se Funcionou

Execute:

```sql
SELECT u.username, u.email, p.role
FROM public.users u
JOIN public.permissions p ON u.username = p.username
WHERE p.role = 'admin';
```

Você deve ver:
```
username | email           | role
---------|-----------------|-------
admin    | admin@silt.com  | admin
```

---

### 5. Teste o Login

1. Abra seu site: `http://localhost:8000/login.html`
2. Faça login com:
   - **Username**: `admin`
   - **Password**: `admin123`

---

## ⚠️ Importante

Se der erro de login, verifique no console do navegador (F12) e veja se:

1. O usuário existe em **Authentication > Users**
2. O usuário existe em **Table Editor > users**
3. A permissão existe em **Table Editor > permissions**

---

## 🆘 Solução de Problemas

### Erro: "User not found"

O usuário foi criado no auth mas não na tabela public.users. Execute:

```sql
-- Liste usuários do auth
SELECT id, email FROM auth.users WHERE email = 'admin@silt.com';

-- Pegue o UUID e insira na tabela users
INSERT INTO public.users (id, username, email)
SELECT id, 'admin', email
FROM auth.users
WHERE email = 'admin@silt.com';

-- Dê permissão de admin
INSERT INTO public.permissions (username, role)
VALUES ('admin', 'admin');
```

---

## 📋 Estrutura Final das Tabelas

Após executar o script, você terá:

| Tabela | Descrição |
|--------|-----------|
| `users` | Dados dos usuários |
| `permissions` | Roles (admin/user) |
| `pool_data` | Dados de investimentos |
| `aave_data` | Dados AAVE |

---

Pronto! Seu admin está configurado! 🎉
