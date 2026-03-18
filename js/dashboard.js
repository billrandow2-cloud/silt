// S.I.L.T. System - Dashboard Script

const SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser      = null;
let currentUsername  = '';
let userPoolData     = [];   // todos os registros de pool
let allAaveData      = [];   // todos os registros AAVE
let userAaveData     = null; // AAVE do mês selecionado/mais recente
let dashExchangeRate = 5.0;
let currentMonth     = null; // mês aberto na view de semanas

const PT_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// =====================================================
// INICIALIZAR
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    currentUser = session.user;

    const { data: userData } = await supabaseClient
        .from('users').select('username').eq('id', currentUser.id).single();
    currentUsername = userData?.username || currentUser.email.split('@')[0];

    document.getElementById('user-name').textContent   = currentUsername;
    document.getElementById('user-avatar').textContent = currentUsername.charAt(0).toUpperCase();

    await loadExchangeRate();
    await loadDashboardData();

    document.getElementById('loading').style.display = 'none';

    const saved = localStorage.getItem('silt_currency') || 'USD';
    switchCurrency(saved);
});

// =====================================================
// CÂMBIO
// =====================================================

async function loadExchangeRate() {
    try {
        const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const d = await r.json();
        if (d?.rates?.BRL) dashExchangeRate = d.rates.BRL;
    } catch(e) { console.warn('Taxa padrão:', e); }
}

function fmt(usd) {
    const cur = localStorage.getItem('silt_currency') || 'USD';
    const sym = cur === 'BRL' ? 'R$' : '$';
    const val = cur === 'BRL' ? usd * dashExchangeRate : usd;
    return sym + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// =====================================================
// CARREGAR DADOS
// =====================================================

async function loadDashboardData() {
    // Todos os registros de pool
    const { data: pools } = await supabaseClient
        .from('pool_data').select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    userPoolData = pools || [];

    // Todos os registros AAVE
    const { data: aaveAll } = await supabaseClient
        .from('aave_data').select('*')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });
    allAaveData = aaveAll || [];

    // AAVE mais recente por padrão
    userAaveData = allAaveData[0] || null;

    // Preencher selector de mês do AAVE
    populateAaveMonthSelector();

    // Overview usa SOMENTE o mês mais recente com dados
    updateDashboardValues();
    initCharts();
    initMonthsGrid();
}

// =====================================================
// LÓGICA PRINCIPAL — usa só o mês mais recente
// =====================================================

function getLatestMonth() {
    // Descobre qual é o mês mais recente com dados de pool
    const months = [...new Set(userPoolData.map(p => p.month))];
    if (months.length === 0) return null;
    // Ordena pelos meses do calendário
    return months.sort((a, b) => PT_MONTHS.indexOf(b) - PT_MONTHS.indexOf(a))[0];
}

function getPoolsValueForMonth(month) {
    // Para um mês, pega o current_value mais recente de cada pool distinta
    const positions = {};
    userPoolData.filter(p => p.month === month).forEach(p => {
        const current = parseFloat(p.current_value || 0);
        const initial = parseFloat(p.initial_value || p.invested_value || 0);
        const contrib = parseFloat(p.contribution_value || 0);
        const profit  = parseFloat(p.profit_value || 0);
        if (!positions[p.pool_name]) positions[p.pool_name] = { current: 0, fallback: 0 };
        if (current > 0) positions[p.pool_name].current = current;
        positions[p.pool_name].fallback = initial + contrib + profit;
    });

    let total = 0;
    Object.values(positions).forEach(pos => {
        total += pos.current > 0 ? pos.current : pos.fallback;
    });
    return total;
}

function updateDashboardValues() {
    const latestMonth = getLatestMonth();
    if (!latestMonth) return;

    const poolsBalance = getPoolsValueForMonth(latestMonth);

    // WETH = ativo AAVE | usdto_value = empréstimo
    const weth  = parseFloat(userAaveData?.weth_value  || userAaveData?.aave_balance || 0);
    const borrow= parseFloat(userAaveData?.usdto_value || userAaveData?.borrow_value || 0);

    // Igual à planilha
    const totalSemPagar = weth - borrow + poolsBalance;
    const totalPagando  = weth + poolsBalance;

    setVal('total-balance',   totalPagando);
    setVal('pools-balance',   poolsBalance);
    setVal('aave-balance',    weth);
    setVal('aave-display',    weth);
    setVal('borrow-display',  borrow);
    setVal('net-display',     weth - borrow);
    setVal('total-sem-pagar', totalSemPagar);
    setVal('total-pagando',   totalPagando);

    // Atualizar label do mês atual no overview
    const label = document.getElementById('current-month-label');
    if (label) label.textContent = `Referência: ${latestMonth}`;

    updateCurrencyDisplay();
}

function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.dataset.value = value;
}

function updateCurrencyDisplay() {
    document.querySelectorAll('[data-value]').forEach(el => {
        el.textContent = fmt(parseFloat(el.dataset.value) || 0);
    });
}

// =====================================================
// SELETOR DE MÊS DO AAVE
// =====================================================

function populateAaveMonthSelector() {
    const sel = document.getElementById('aave-month-selector');
    if (!sel) return;

    // Meses com dados AAVE
    const aaveMonths = allAaveData.map(a => a.month).filter(Boolean);
    // Meses com dados de pool
    const poolMonths = [...new Set(userPoolData.map(p => p.month))];
    // União de todos os meses com dados
    const allMonths  = [...new Set([...aaveMonths, ...poolMonths])]
        .sort((a, b) => PT_MONTHS.indexOf(a) - PT_MONTHS.indexOf(b));

    sel.innerHTML = '';
    allMonths.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        sel.appendChild(opt);
    });

    // Selecionar o mais recente por padrão
    if (allMonths.length > 0) {
        sel.value = allMonths[allMonths.length - 1];
        onAaveMonthChange();
    }
}

function onAaveMonthChange() {
    const sel   = document.getElementById('aave-month-selector');
    if (!sel) return;
    const month = sel.value;

    // Buscar AAVE do mês selecionado
    userAaveData = allAaveData.find(a => a.month === month) || null;

    // Atualizar cards AAVE
    const weth  = parseFloat(userAaveData?.weth_value  || userAaveData?.aave_balance || 0);
    const borrow= parseFloat(userAaveData?.usdto_value || userAaveData?.borrow_value || 0);

    setVal('aave-display',   weth);
    setVal('borrow-display', borrow);
    setVal('net-display',    weth - borrow);

    // Atualizar detalhes se existirem
    const elWeth  = document.getElementById('weth-display');
    const elUsdto = document.getElementById('usdto-display');
    if (elWeth)  { elWeth.dataset.value  = weth;   elWeth.textContent  = fmt(weth); }
    if (elUsdto) { elUsdto.dataset.value = borrow; elUsdto.textContent = fmt(borrow); }

    // Recalcular totais do overview com o AAVE do mês selecionado
    updateDashboardValues();
    updateCurrencyDisplay();
}

// =====================================================
// TROCAR MOEDA
// =====================================================

function switchCurrency(currency) {
    localStorage.setItem('silt_currency', currency);
    window.CURRENCY = currency;
    document.querySelectorAll('.currency-switcher button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.currency === currency);
    });
    updateCurrencyDisplay();
    initMonthsGrid();
    refreshWeeksView();
    if (window.SILTCharts) window.SILTCharts.updateChartsCurrency(dashExchangeRate);
}

// =====================================================
// CHARTS — mostra evolução mês a mês
// =====================================================

function initCharts() {
    const pools = parseFloat(document.getElementById('pools-balance')?.dataset.value) || 0;
    const aave  = parseFloat(document.getElementById('aave-balance')?.dataset.value)  || 0;

    if (window.SILTCharts) {
        window.SILTCharts.createPortfolioChart('portfolio-chart', { pools, aave });

        // Trend: valor de pools por mês (cada mês independente)
        const md = calculateMonthlyData();
        window.SILTCharts.createTrendChart('trend-chart', { labels: md.labels, values: md.values });
        window.SILTCharts.createTrendChart('aave-chart',  { labels: ['Início','Atual'], values: [aave * 0.9, aave] });
    }
}

function calculateMonthlyData() {
    // Valor atual de pools por mês — cada mês é independente
    const labels = [], values = [];

    PT_MONTHS.forEach(month => {
        const mp = userPoolData.filter(p => p.month === month);
        if (mp.length === 0) return;

        labels.push(month.substring(0, 3));
        values.push(getPoolsValueForMonth(month));
    });

    return { labels, values };
}

// =====================================================
// GRID DE MESES
// =====================================================

function initMonthsGrid() {
    const grid = document.getElementById('months-grid');
    grid.innerHTML = '';

    PT_MONTHS.forEach(month => {
        const mp      = userPoolData.filter(p => p.month === month);
        const hasData = mp.length > 0;
        if (!hasData) {
            // Mês vazio: mostrar mesmo assim para referência visual
            const card = document.createElement('div');
            card.className = 'glass-card month-card';
            card.style.opacity = '0.4';
            card.innerHTML = `<h3>${month}</h3><p class="month-stats" style="color:var(--text-muted);">Sem dados</p>`;
            grid.appendChild(card);
            return;
        }

        let totalProfit = 0;
        mp.forEach(p => { totalProfit += parseFloat(p.profit_value || 0); });
        const totalUSD = getPoolsValueForMonth(month);

        const card = document.createElement('div');
        card.className = 'glass-card month-card';
        card.onclick = () => showMonth(month);
        card.innerHTML = `
            <h3>${month}</h3>
            <p class="month-stats">${fmt(totalUSD)}</p>
            <span style="color:var(--success);font-size:14px;">✓ Lucro: ${fmt(totalProfit)}</span>
        `;
        grid.appendChild(card);
    });
}

// =====================================================
// SEMANAS
// =====================================================

function showMonth(month) {
    currentMonth = month;
    document.getElementById('months-view').style.display = 'none';
    document.getElementById('weeks-view').classList.add('active');
    document.getElementById('selected-month-title').textContent = month;
    renderWeeks(month);
}

function renderWeeks(month) {
    const container = document.getElementById('weeks-container');
    container.innerHTML = '';

    const mp = userPoolData.filter(p => p.month === month);
    if (mp.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:40px;">Nenhum dado para este mês.</p>';
        return;
    }

    // Agrupar por semana
    const weeks = {};
    mp.forEach(p => {
        const w = p.week || 'Sem semana';
        if (!weeks[w]) weeks[w] = [];
        weeks[w].push(p);
    });

    const weekOrder   = ['Semana 1','Semana 2','Semana 3','Semana 4','Semana 5','Total do Mês'];
    const sortedWeeks = Object.keys(weeks).sort((a, b) => {
        const ia = weekOrder.indexOf(a), ib = weekOrder.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const monthPositions = {};
    let monthTotalProfit = 0;

    sortedWeeks.forEach(week => {
        const pools    = weeks[week];
        const weekCard = document.createElement('div');
        weekCard.className = 'glass-card week-card';
        let weekProfit = 0;

        const rows = pools.map(p => {
            const initial  = parseFloat(p.initial_value || p.invested_value || 0);
            const contrib  = parseFloat(p.contribution_value || 0);
            const yieldPct = parseFloat(p.yield_percent || 0);
            const profit   = parseFloat(p.profit_value  || 0);
            const current  = parseFloat(p.current_value || 0);

            weekProfit       += profit;
            monthTotalProfit += profit;

            if (!monthPositions[p.pool_name]) monthPositions[p.pool_name] = { current: 0, fallback: 0 };
            if (current > 0) monthPositions[p.pool_name].current = current;
            monthPositions[p.pool_name].fallback = initial + contrib + profit;

            const diff    = current > 0 ? current - (initial + contrib) : profit;
            const diffTag = current > 0
                ? `<span style="color:${diff>=0?'#22c55e':'#ef4444'};font-size:12px;">${diff>=0?'▲':'▼'}${fmt(Math.abs(diff))}</span>`
                : '';

            return `<tr>
                <td>${p.pool_name}</td>
                <td>${fmt(initial + contrib)}</td>
                <td>${yieldPct > 0 ? yieldPct.toFixed(2)+'%' : '-'}</td>
                <td style="color:var(--success);">+${fmt(profit)}</td>
                <td>${current > 0 ? fmt(current)+' '+diffTag : fmt(initial+contrib+profit)}</td>
            </tr>`;
        }).join('');

        weekCard.innerHTML = `
            <h4 style="margin-bottom:12px;">${week}</h4>
            <table class="pools-table">
                <thead><tr><th>Pool</th><th>Investido</th><th>Rend.%</th><th>Lucro</th><th>Valor Atual</th></tr></thead>
                <tbody>
                    ${rows}
                    <tr style="font-weight:bold;border-top:2px solid var(--border-glass);">
                        <td colspan="3">Total da semana</td>
                        <td style="color:var(--success);">+${fmt(weekProfit)}</td>
                        <td>-</td>
                    </tr>
                </tbody>
            </table>`;
        container.appendChild(weekCard);
    });

    // Resumo do mês — busca AAVE do mesmo mês
    const aaveMes = allAaveData.find(a => a.month === month) || null;
    const weth    = parseFloat(aaveMes?.weth_value  || aaveMes?.aave_balance || 0);
    const usdto   = parseFloat(aaveMes?.usdto_value || aaveMes?.borrow_value || 0);

    let monthPoolsValue = 0;
    Object.values(monthPositions).forEach(pos => {
        monthPoolsValue += pos.current > 0 ? pos.current : pos.fallback;
    });

    const semPagar = weth - usdto + monthPoolsValue;
    const pagando  = weth + monthPoolsValue;

    const summary = document.createElement('div');
    summary.className = 'glass-card';
    summary.style.cssText = 'margin-top:24px;border:1px solid rgba(168,85,247,0.3);';
    summary.innerHTML = `
        <h3 style="margin-bottom:20px;color:var(--neon-purple,#a855f7);">📊 Resumo — ${month}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:${weth > 0 ? '20px' : '0'};">
            <div style="text-align:center;padding:12px;background:rgba(168,85,247,0.1);border-radius:12px;">
                <p style="color:var(--text-muted);font-size:12px;margin-bottom:4px;">Valor Atual Pools</p>
                <p style="font-size:20px;font-weight:700;">${fmt(monthPoolsValue)}</p>
            </div>
            <div style="text-align:center;padding:12px;background:rgba(34,197,94,0.1);border-radius:12px;">
                <p style="color:var(--text-muted);font-size:12px;margin-bottom:4px;">Lucro Total</p>
                <p style="font-size:20px;font-weight:700;color:#22c55e;">+${fmt(monthTotalProfit)}</p>
            </div>
        </div>
        ${weth > 0 ? `
        <div style="padding-top:16px;border-top:1px solid var(--border-glass);">
            <h4 style="margin-bottom:12px;color:var(--text-secondary);">Total com AAVE (${month})</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div style="padding:14px;background:rgba(239,68,68,0.08);border-radius:12px;border:1px solid rgba(239,68,68,0.2);">
                    <p style="color:var(--text-muted);font-size:12px;margin-bottom:6px;">SEM pagar empréstimo</p>
                    <p style="font-size:22px;font-weight:700;">${fmt(semPagar)}</p>
                    <p style="color:var(--text-muted);font-size:11px;margin-top:4px;">WETH(${fmt(weth)}) − Emprést.(${fmt(usdto)}) + Pools</p>
                </div>
                <div style="padding:14px;background:rgba(34,197,94,0.08);border-radius:12px;border:1px solid rgba(34,197,94,0.2);">
                    <p style="color:var(--text-muted);font-size:12px;margin-bottom:6px;">PAGANDO empréstimo</p>
                    <p style="font-size:22px;font-weight:700;">${fmt(pagando)}</p>
                    <p style="color:var(--text-muted);font-size:11px;margin-top:4px;">WETH(${fmt(weth)}) + Pools</p>
                </div>
            </div>
        </div>` : ''}`;
    container.appendChild(summary);
}

function refreshWeeksView() {
    if (currentMonth && document.getElementById('weeks-view')?.classList.contains('active')) {
        renderWeeks(currentMonth);
    }
}

function showMonths() {
    currentMonth = null;
    document.getElementById('months-view').style.display = 'block';
    document.getElementById('weeks-view').classList.remove('active');
}

function showSection(section) {
    document.querySelectorAll('.nav-tabs button').forEach(b => b.classList.toggle('active', b.dataset.section === section));
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === `${section}-section`));
}

async function logout() {
    await supabaseClient.auth.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
}