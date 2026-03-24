// S.I.L.T. System - Welcome Page Script

const SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const supabaseWelcome = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthAndLoadMessage();
});

async function checkAuthAndLoadMessage() {
    const loadingEl = document.getElementById('welcome-loading');
    const containerEl = document.getElementById('welcome-container');
    const errorEl = document.getElementById('welcome-error');

    try {
        // Verificar sessão do Supabase
        const { data: { session }, error: sessionError } = await supabaseWelcome.auth.getSession();

        if (sessionError || !session) {
            // Verificar localStorage como fallback
            const localSession = localStorage.getItem('silt_session');
            if (!localSession) {
                throw new Error('Sessão não encontrada');
            }

            const sessionData = JSON.parse(localSession);

            // Buscar mensagem com user_id do localStorage
            await loadWelcomeMessage(sessionData.userId, sessionData.username);
        } else {
            // Usar sessão do Supabase
            const userId = session.user.id;

            // Buscar username
            const { data: userData } = await supabaseWelcome
                .from('users')
                .select('username')
                .eq('id', userId)
                .single();

            const username = userData?.username || session.user.email.split('@')[0];

            await loadWelcomeMessage(userId, username);
        }

    } catch (err) {
        console.error('Erro:', err);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'flex';
        document.getElementById('error-message').textContent = err.message || 'Erro ao carregar. Tente fazer login novamente.';
    }
}

async function loadWelcomeMessage(userId, username) {
    const loadingEl = document.getElementById('welcome-loading');
    const containerEl = document.getElementById('welcome-container');
    const errorEl = document.getElementById('welcome-error');

    try {
        // Buscar mensagem ativa para este usuário
        const { data: messageData, error: msgError } = await supabaseWelcome
            .from('user_messages')
            .select('message')
            .eq('user_id', userId)
            .eq('active', true)
            .single();

        // Se não há mensagem ativa, redirecionar para dashboard
        if (msgError || !messageData) {
            window.location.href = 'dashboard.html';
            return;
        }

        // Atualizar nome do usuário
        document.getElementById('user-display-name').textContent = username;

        // Atualizar mensagem
        document.getElementById('admin-message').textContent = messageData.message;

        // Mostrar container principal
        loadingEl.style.display = 'none';
        containerEl.style.display = 'flex';

        // Inicializar partículas
        initParticles();

        // Mostrar botão após 2 segundos
        setTimeout(() => {
            document.getElementById('btn-container').classList.add('visible');
        }, 2000);

        // Salvar flag indicando que já mostrou a mensagem nesta sessão
        sessionStorage.setItem('silt_welcome_shown', 'true');

    } catch (err) {
        console.error('Erro ao carregar mensagem:', err);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'flex';
        document.getElementById('error-message').textContent = 'Erro ao carregar mensagem.';
    }
}

function handleStart() {
    // Marcar mensagem como lida (opcional - pode implementar depois)
    // Por agora, apenas redireciona para dashboard
    window.location.href = 'dashboard.html';
}

function initParticles() {
    const container = document.querySelector('.particles');
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        container.appendChild(particle);
    }
}