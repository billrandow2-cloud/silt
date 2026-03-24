// S.I.L.T. System - Authentication Module

const SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

// Cria o cliente com nome diferente para não conflitar com window.supabase
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {

    // Se já está logado, redireciona direto
    try {
        const { data: { session } } = await supabaseAuth.auth.getSession();
        if (session) {
            await redirectBasedOnRole(session.user);
            return;
        }
    } catch (e) {
        console.error('Erro ao verificar sessão:', e);
    }

    // Listener do formulário de login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const usernameOrEmail = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const loginError = document.getElementById('login-error');

        loginError.textContent = '';
        loginError.classList.remove('visible');

        if (!usernameOrEmail || !password) {
            loginError.textContent = 'Por favor, preencha todos os campos';
            loginError.classList.add('visible');
            return;
        }

        document.getElementById('loading').style.display = 'flex';
        document.getElementById('login-btn').disabled = true;

        try {
            // Descobre se digitou email ou username
            const isEmail = usernameOrEmail.includes('@');
            let email = usernameOrEmail;

            if (!isEmail) {
                const { data: userData, error: userError } = await supabaseAuth
                    .from('users')
                    .select('email')
                    .eq('username', usernameOrEmail)
                    .single();

                if (userError || !userData) {
                    throw new Error('Usuário não encontrado');
                }
                email = userData.email;
            }

            // Faz o login
            const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

            if (error) throw new Error('Usuário ou senha incorretos');

            await redirectBasedOnRole(data.user);

        } catch (err) {
            console.error('Erro no login:', err);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('login-btn').disabled = false;
            loginError.textContent = err.message || 'Erro ao fazer login';
            loginError.classList.add('visible');
        }
    });
});

async function redirectBasedOnRole(user) {
    try {
        const { data: userData } = await supabaseAuth
            .from('users')
            .select('username')
            .eq('id', user.id)
            .single();

        const username = userData?.username || user.email.split('@')[0];

        const { data: permData } = await supabaseAuth
            .from('permissions')
            .select('role')
            .eq('username', username)
            .single();

        const isAdmin = permData?.role === 'admin';

        localStorage.setItem('silt_session', JSON.stringify({
            userId: user.id,
            email: user.email,
            username: username,
            isAdmin: isAdmin
        }));

        // Verificar se há mensagem de boas-vindas ativa para este usuário
        // Admins não veem mensagens de boas-vindas
        if (!isAdmin) {
            const { data: messageData } = await supabaseAuth
                .from('user_messages')
                .select('id')
                .eq('user_id', user.id)
                .eq('active', true)
                .single();

            // Se há mensagem ativa, redirecionar para welcome.html
            if (messageData) {
                window.location.href = 'welcome.html';
                return;
            }
        }

        window.location.href = isAdmin ? 'admin.html' : 'dashboard.html';

    } catch (err) {
        console.error('Erro ao redirecionar:', err);

        // Redireciona para dashboard mesmo com erro
        localStorage.setItem('silt_session', JSON.stringify({
            userId: user.id,
            email: user.email,
            username: user.email.split('@')[0],
            isAdmin: false
        }));
        window.location.href = 'dashboard.html';
    }
}