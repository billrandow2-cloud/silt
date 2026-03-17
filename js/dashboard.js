// S.I.L.T. System - Dashboard Script
// Handles dashboard functionality

// Configuração do Supabase
const SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentUsername = '';
let userPoolData = [];
let userAaveData = null;

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sessão
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .select('username')
        .eq('id', currentUser.id)
        .single();

    if (userError) {
        console.error('Erro ao buscar usuário:', userError);
    }

    currentUsername = userData?.username || currentUser.email.split('@')[0];

    // Atualizar UI
    document.getElementById('user-name').textContent = currentUsername;
    document.getElementById('user-avatar').textContent = currentUsername.charAt(0).toUpperCase();

    // Carregar taxa de câmbio (usa função do main.js)
    await fetchExchangeRate();

    // Carregar dados
    await loadDashboardData();

    // Esconder loading
    document.getElementById('loading').style.display = 'none';

    // Inicializar currency
    const savedCurrency = localStorage.getItem('silt_currency') || 'USD';
    switchCurrency(savedCurrency);
});

// Carregar dados do dashboard
async function loadDashboardData() {
    // Carregar dados de pools
    const { data: pools, error: poolError } = await supabaseClient
        .from('pool_data')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (!poolError) {
        userPoolData = pools || [];
    }

    // Carregar dados AAVE
    const { data: aave, error: aaveError } = await supabaseClient
        .from('aave_data')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

    if (!aaveError) {
        userAaveData = aave;
    }

    // Calcular totais
    updateDashboardValues();

    // Inicializar charts
    initCharts();

    // Inicializar meses
    initMonthsGrid();
}

// Atualizar valores do dashboard
function updateDashboardValues() {
    let totalInvested = 0;
    let totalProfit = 0;

    userPoolData.forEach(pool => {
        totalInvested += parseFloat(pool.invested_value) || 0;
        totalProfit += parseFloat(pool.profit_value) || 0;
    });

    const poolsBalance = totalInvested + totalProfit;
    const aaveBalance = userAaveData ? (parseFloat(userAaveData.aave_balance) || 0) : 0;
    const borrowValue = userAaveData ? (parseFloat(userAaveData.borrow_value) || 0) : 0;
    const totalBalance = poolsBalance + aaveBalance - borrowValue;

    // Atualizar display
    document.getElementById('total-balance').dataset.value = totalBalance;
    document.getElementById('pools-balance').dataset.value = poolsBalance;
    document.getElementById('aave-balance').dataset.value = aaveBalance;

    document.getElementById('aave-display').dataset.value = aaveBalance;
    document.getElementById('borrow-display').dataset.value = borrowValue;
    document.getElementById('net-display').dataset.value = aaveBalance - borrowValue;

    // Atualizar valores formatados (usa função do main.js)
    updateDisplayedValues();
}

// Inicializar charts
function initCharts() {
    const poolsBalance = parseFloat(document.getElementById('pools-balance').dataset.value) || 0;
    const aaveBalance = parseFloat(document.getElementById('aave-balance').dataset.value) || 0;

    if (window.SILTCharts) {
        window.SILTCharts.createPortfolioChart('portfolio-chart', {
            pools: poolsBalance,
            aave: aaveBalance
        });

        const monthlyData = calculateMonthlyData();
        window.SILTCharts.createTrendChart('trend-chart', {
            labels: monthlyData.labels,
            values: monthlyData.values
        });

        window.SILTCharts.createTrendChart('aave-chart', {
            labels: ['Início', 'Atual'],
            values: [aaveBalance * 0.9, aaveBalance]
        });
    }
}

// Calcular dados mensais
function calculateMonthlyData() {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyTotals = {};

    userPoolData.forEach(pool => {
        const monthIndex = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                           'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
                           .indexOf(pool.month);
        if (monthIndex >= 0) {
            const monthKey = months[monthIndex];
            if (!monthlyTotals[monthKey]) monthlyTotals[monthKey] = 0;
            monthlyTotals[monthKey] += parseFloat(pool.invested_value) + parseFloat(pool.profit_value);
        }
    });

    const labels = [];
    const values = [];
    let runningTotal = 0;

    months.forEach(m => {
        labels.push(m);
        runningTotal += monthlyTotals[m] || 0;
        values.push(runningTotal);
    });

    return { labels, values };
}

// Inicializar grid de meses
function initMonthsGrid() {
    const grid = document.getElementById('months-grid');
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    grid.innerHTML = '';

    months.forEach(month => {
        const monthPools = userPoolData.filter(p => p.month === month);
        const hasData = monthPools.length > 0;
        const totalValue = hasData
            ? monthPools.reduce((sum, p) => sum + parseFloat(p.invested_value) + parseFloat(p.profit_value), 0)
            : 0;

        const card = document.createElement('div');
        card.className = 'glass-card month-card';
        card.onclick = () => showMonth(month);

        card.innerHTML = `
            <h3>${month}</h3>
            <p class="month-stats">${hasData ? formatCurrency(totalValue) : 'Sem dados'}</p>
            ${hasData ? '<span style="color: var(--success); font-size: 14px;">✓ Dados disponíveis</span>' : ''}
        `;

        grid.appendChild(card);
    });
}

// Mostrar mês
function showMonth(month) {
    document.getElementById('months-view').style.display = 'none';
    document.getElementById('weeks-view').classList.add('active');
    document.getElementById('selected-month-title').textContent = month;

    const weeksContainer = document.getElementById('weeks-container');
    weeksContainer.innerHTML = '';

    const monthPools = userPoolData.filter(p => p.month === month);

    if (monthPools.length === 0) {
        weeksContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Nenhum dado disponível para este mês.</p>';
        return;
    }

    const weeks = {};
    monthPools.forEach(pool => {
        if (!weeks[pool.week]) weeks[pool.week] = [];
        weeks[pool.week].push(pool);
    });

    Object.entries(weeks).forEach(([week, pools]) => {
        const weekCard = document.createElement('div');
        weekCard.className = 'glass-card week-card';

        let weekTotal = 0;
        let weekProfit = 0;

        const poolsHtml = pools.map(pool => {
            weekTotal += parseFloat(pool.invested_value) + parseFloat(pool.profit_value);
            weekProfit += parseFloat(pool.profit_value);
            return `
                <tr>
                    <td>${pool.pool_name}</td>
                    <td>${formatCurrency(parseFloat(pool.invested_value))}</td>
                    <td style="color: var(--success);">+${formatCurrency(parseFloat(pool.profit_value))}</td>
                    <td>${formatCurrency(parseFloat(pool.invested_value) + parseFloat(pool.profit_value))}</td>
                </tr>
            `;
        }).join('');

        weekCard.innerHTML = `
            <h4>${week}</h4>
            <table class="pools-table">
                <thead>
                    <tr>
                        <th>Pool</th>
                        <th>Investido</th>
                        <th>Lucro</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${poolsHtml}
                    <tr style="font-weight: bold; border-top: 2px solid var(--border-glass);">
                        <td>Total</td>
                        <td>-</td>
                        <td style="color: var(--success);">+${formatCurrency(weekProfit)}</td>
                        <td>${formatCurrency(weekTotal)}</td>
                    </tr>
                </tbody>
            </table>
        `;

        weeksContainer.appendChild(weekCard);
    });
}

function showMonths() {
    document.getElementById('months-view').style.display = 'block';
    document.getElementById('weeks-view').classList.remove('active');
}

function showSection(section) {
    document.querySelectorAll('.nav-tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `${section}-section`);
    });
}

// Logout
async function logout() {
    await supabaseClient.auth.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
}