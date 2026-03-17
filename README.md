# S.I.L.T. System

**Sistema Integrado de Lucros e Transações**

Um dashboard financeiro moderno e futurista para gestão de investimentos em pools e AAVE, com design glassmorphism e tema neon purple.

![S.I.L.T. System](assets/preview.png)

## ✨ Características

- 🎨 **Design Moderno**: Tema escuro com acentos neon purple e efeitos glassmorphism
- 📊 **Dashboard Completo**: Visualização de portfólio com gráficos interativos
- 💰 **Gestão de Pools**: Acompanhamento de investimentos em CES/USDT e DAI/sLGNS
- 🏦 **Integração AAVE**: Monitoramento de saldo e empréstimos
- 💱 **Conversão de Moeda**: Suporte a USD e BRL com taxas em tempo real
- 🔐 **Autenticação**: Sistema de login com Supabase
- 👥 **Painel Admin**: Gerenciamento completo de usuários e dados
- 📱 **Responsivo**: Funciona em desktop, tablet e mobile

## 🚀 Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Gráficos**: Chart.js
- **Design**: Glassmorphism, Neon Effects, CSS Animations

## 📁 Estrutura do Projeto

```
silt-system/
├── index.html          # Página inicial com animação
├── login.html          # Página de login
├── dashboard.html      # Dashboard do usuário
├── admin.html          # Painel administrativo
├── css/
│   └── style.css       # Estilos principais
├── js/
│   ├── main.js         # Utilitários e animações
│   ├── charts.js       # Configuração do Chart.js
│   └── supabase.js     # Integração com Supabase
└── assets/             # Imagens e recursos
```

## 🛠️ Configuração do Supabase

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Copie a **URL** e a **chave anônima (anon key)**

### 2. Configurar Variáveis

No arquivo `js/supabase.js`, substitua:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 3. Criar Tabelas

Execute os seguintes comandos SQL no Editor SQL do Supabase:

```sql
-- Tabela de usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de permissões
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT REFERENCES users(username) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'user')) DEFAULT 'user'
);

-- Tabela de dados de pools
CREATE TABLE pool_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    week TEXT NOT NULL,
    pool_name TEXT NOT NULL,
    invested_value DECIMAL(15, 2) DEFAULT 0,
    profit_value DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de dados AAVE
CREATE TABLE aave_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    aave_balance DECIMAL(15, 2) DEFAULT 0,
    borrow_value DECIMAL(15, 2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Configurar Row Level Security (RLS)

```sql
-- Habilitar RLS nas tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE aave_data ENABLE ROW LEVEL SECURITY;

-- Política para users (apenas admins podem ver todos)
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

-- Política para pool_data
CREATE POLICY "Users can view own pool data" ON pool_data
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all pool data" ON pool_data
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM permissions
            WHERE username = (SELECT username FROM users WHERE id = auth.uid())
            AND role = 'admin'
        )
    );

-- Política para aave_data
CREATE POLICY "Users can view own aave data" ON aave_data
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all aave data" ON aave_data
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM permissions
            WHERE username = (SELECT username FROM users WHERE id = auth.uid())
            AND role = 'admin'
        )
    );
```

### 5. Criar Usuário Admin Inicial

```sql
-- Criar usuário via autenticação do Supabase primeiro
-- Depois execute:
INSERT INTO users (id, username, email)
VALUES ('uuid-do-admin', 'admin', 'admin@seusite.com');

INSERT INTO permissions (username, role)
VALUES ('admin', 'admin');
```

## 🚀 Como Executar

### Opção 1: Servidor Local (Recomendado)

```bash
# Navegue até a pasta do projeto
cd silt-system

# Usando Python 3
python -m http.server 8000

# Ou usando Node.js (npx serve)
npx serve

# Ou usando PHP
php -S localhost:8000
```

Acesse: `http://localhost:8000`

### Opção 2: Abrir Diretamente

Abra o arquivo `index.html` diretamente no navegador (algumas funcionalidades podem ser limitadas).

## 🔑 Credenciais de Demonstração

Para testar o sistema sem configurar o Supabase:

- **Admin**: username: `admin` / password: `admin`
- **Usuário**: username: `user` / password: `user`

## 🎨 Personalização

### Cores

Edite as variáveis CSS em `css/style.css`:

```css
:root {
    --neon-purple: #a855f7;      /* Cor primária */
    --neon-purple-dark: #9333ea;  /* Cor secundária */
    --bg-primary: #0b0b0f;        /* Fundo principal */
}
```

### Pools

Para adicionar novos pools, edite o arquivo `dashboard.html` e atualize:

```javascript
const demoData = {
    pools: {
        'NovoPool': [
            { pool_name: 'NOVO/USDT', invested: 10000, profit: 500 }
        ]
    }
};
```

## 📱 Responsividade

O sistema é totalmente responsivo e funciona em:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🔒 Segurança

- Autenticação JWT via Supabase
- Row Level Security (RLS) no banco de dados
- Proteção contra SQL Injection
- Sanitização de inputs

## 📝 Licença

Este projeto é privado e de uso exclusivo.

## 🤝 Suporte

Para suporte ou dúvidas, entre em contato com o administrador do sistema.

---

**S.I.L.T. System** © 2025 - Todos os direitos reservados.
