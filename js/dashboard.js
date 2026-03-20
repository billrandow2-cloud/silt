// S.I.L.T. System - Dashboard Script

const SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser      = null;
let currentUsername  = '';
let targetUserId     = null;
let userPoolData     = [];
let allAaveData      = [];
let userAaveData     = null;
let dashExchangeRate = 5.0;
let currentMonth     = null;
let isAdminView      = false;

const PT_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    currentUser = session.user;

    // ── SOLUÇÃO DEFINITIVA: ler uid e name direto da URL ──────────────────
    // O admin abre: dashboard.html?uid=UUID&name=Matheus
    // Nada de localStorage, nada de sessionStorage.
    // A URL é a fonte da verdade — sempre disponível na aba.
    const params  = new URLSearchParams(window.location.search);
    const urlUid  = params.get('uid');
    const urlName = params.get('name');

    if (urlUid && urlUid !== currentUser.id) {
        // Modo admin view
        isAdminView     = true;
        targetUserId    = urlUid;
        currentUsername = urlName ? decodeURIComponent(urlName) : 'Usuário';
    } else {
        // Modo normal
        targetUserId = currentUser.id;
        const { data: ud } = await supabaseClient
            .from('users').select('username, profit_share').eq('id', currentUser.id).single();
        currentUsername = ud?.username || currentUser.email.split('@')[0];
        window.PROFIT_SHARE = ud?.profit_share !== null && ud?.profit_share !== undefined ? parseFloat(ud.profit_share) : 50;
    }

    document.getElementById('user-name').textContent   = currentUsername;
    document.getElementById('user-avatar').textContent = currentUsername.charAt(0).toUpperCase();

    // Banner modo visualização
    if (isAdminView) {
        const banner = document.createElement('div');
        banner.style.cssText = 'background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.35);border-radius:10px;padding:10px 18px;margin-bottom:20px;display:flex;align-items:center;gap:10px;color:#fbbf24;font-size:14px;flex-wrap:wrap;';
        banner.innerHTML = `👁️ Modo visualização admin — dashboard de <strong>${currentUsername}</strong><a href="admin.html" style="margin-left:auto;color:#fbbf24;font-size:13px;">← Voltar ao admin</a>`;
        const dh = document.querySelector('.dashboard-header');
        if (dh) dh.parentNode.insertBefore(banner, dh.nextSibling);
    }

    await loadExchangeRate();
    await loadDashboardData(targetUserId);

    document.getElementById('loading').style.display = 'none';
    switchCurrency(localStorage.getItem('silt_currency') || 'USD');
});

// =====================================================
// CÂMBIO
// =====================================================
async function loadExchangeRate() {
    try {
        const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const d = await r.json();
        if (d?.rates?.BRL) dashExchangeRate = d.rates.BRL;
    } catch(e) {}
}

function fmt(usd) {
    const cur = localStorage.getItem('silt_currency') || 'USD';
    const sym = cur === 'BRL' ? 'R$' : '$';
    const val = cur === 'BRL' ? usd * dashExchangeRate : usd;
    return sym + val.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

// =====================================================
// CARREGAR DADOS
// =====================================================
async function loadDashboardData(userId) {
    const { data: pools } = await supabaseClient
        .from('pool_data').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false });
    userPoolData = pools || [];

    const { data: aaveAll } = await supabaseClient
        .from('aave_data').select('*').eq('user_id', userId)
        .order('updated_at', { ascending: false });
    allAaveData  = aaveAll || [];
    userAaveData = allAaveData[0] || null;

    populateAaveMonthSelector();
    updateDashboardValues();
    initCharts();
    initMonthsGrid();
}

// =====================================================
// CÁLCULO
// =====================================================
function getLatestMonth() {
    const months = [...new Set(userPoolData.map(p => p.month))];
    if (!months.length) return null;
    return months.sort((a,b) => PT_MONTHS.indexOf(b) - PT_MONTHS.indexOf(a))[0];
}

function getPoolsValueForMonth(month) {
    const pos = {};
    userPoolData.filter(p => p.month === month).forEach(p => {
        const cur = parseFloat(p.current_value||0);
        const ini = parseFloat(p.initial_value||p.invested_value||0);
        const con = parseFloat(p.contribution_value||0);
        const pro = parseFloat(p.profit_value||0);
        if (!pos[p.pool_name]) pos[p.pool_name] = { current:0, fallback:0, capital:0, profit:0 };
        if (cur > 0) pos[p.pool_name].current = cur;
        pos[p.pool_name].fallback = ini + con + pro;
        pos[p.pool_name].capital  = Math.max(pos[p.pool_name].capital, ini + con);
        pos[p.pool_name].profit  += pro;
    });
    var total = 0;
    Object.values(pos).forEach(function(p) { total += p.current > 0 ? p.current : p.fallback; });
    return total;
}

// Retorna {capital, profit} separados para aplicar % só no lucro
function getPoolsBreakdownForMonth(month) {
    const pos = {};
    userPoolData.filter(p => p.month === month).forEach(p => {
        const cur = parseFloat(p.current_value||0);
        const ini = parseFloat(p.initial_value||p.invested_value||0);
        const con = parseFloat(p.contribution_value||0);
        const pro = parseFloat(p.profit_value||0);
        if (!pos[p.pool_name]) pos[p.pool_name] = { current:0, capital:0, profit:0 };
        if (cur > 0) pos[p.pool_name].current = cur;
        // Capital = valor investido (sem lucro)
        pos[p.pool_name].capital = Math.max(pos[p.pool_name].capital, ini + con);
        pos[p.pool_name].profit += pro;
    });
    var capital = 0, profit = 0;
    Object.values(pos).forEach(function(p) {
        // Se tiver current_value, estimar capital como current - profit acumulado
        if (p.current > 0) {
            capital += Math.max(0, p.current - p.profit);
            profit  += p.profit;
        } else {
            capital += p.capital;
            profit  += p.profit;
        }
    });
    return { capital, profit };
}

function updateDashboardValues() {
    const lm = getLatestMonth(); if (!lm) return;
    const weth   = parseFloat(userAaveData?.weth_value  || userAaveData?.aave_balance || 0);
    const borrow = parseFloat(userAaveData?.usdto_value || userAaveData?.borrow_value || 0);
    const share  = window.PROFIT_SHARE !== undefined ? window.PROFIT_SHARE : 50;
    const pct    = share / 100;

    // Separar capital (100% do usuário) e lucro (dividido pela %)
    const bd      = getPoolsBreakdownForMonth(lm);
    const poolsCapital = bd.capital;            // capital investido — 100% do usuário
    const poolsProfit  = bd.profit;             // lucro — dividido pela %
    const poolsUser    = poolsCapital + (poolsProfit * pct); // total real do usuário nas pools

    setVal('pools-balance',   poolsUser);
    setVal('aave-balance',    weth);
    setVal('aave-display',    weth);
    setVal('borrow-display',  borrow);
    setVal('net-display',     weth - borrow);
    setVal('total-balance',   weth + poolsUser);
    setVal('total-sem-pagar', weth - borrow + poolsUser);
    setVal('total-pagando',   weth + poolsUser);

    const label = document.getElementById('current-month-label');
    if (label) label.textContent = 'Referência: ' + lm + ' · ' + share.toFixed(0) + '% do lucro';
    updateCurrencyDisplay();
}

function setVal(id, v) { var el = document.getElementById(id); if (el) el.dataset.value = v; }
function updateCurrencyDisplay() {
    document.querySelectorAll('[data-value]').forEach(function(el) {
        el.textContent = fmt(parseFloat(el.dataset.value)||0);
    });
}

// =====================================================
// SELETOR MÊS AAVE
// =====================================================
function populateAaveMonthSelector() {
    var sel = document.getElementById('aave-month-selector'); if (!sel) return;
    var months = [];
    var seen = {};
    allAaveData.forEach(function(a) { if (a.month && !seen[a.month]) { seen[a.month]=1; months.push(a.month); } });
    userPoolData.forEach(function(p) { if (p.month && !seen[p.month]) { seen[p.month]=1; months.push(p.month); } });
    months.sort(function(a,b) { return PT_MONTHS.indexOf(a) - PT_MONTHS.indexOf(b); });
    sel.innerHTML = '';
    months.forEach(function(m) { var o = document.createElement('option'); o.value=m; o.textContent=m; sel.appendChild(o); });
    if (months.length) { sel.value = months[months.length-1]; onAaveMonthChange(); }
}

function onAaveMonthChange() {
    var sel = document.getElementById('aave-month-selector'); if (!sel) return;
    var month = sel.value;
    userAaveData = allAaveData.find(function(a) { return a.month === month; }) || null;
    var weth   = parseFloat(userAaveData && userAaveData.weth_value  || userAaveData && userAaveData.aave_balance || 0);
    var borrow = parseFloat(userAaveData && userAaveData.usdto_value || userAaveData && userAaveData.borrow_value || 0);
    setVal('aave-display', weth); setVal('borrow-display', borrow); setVal('net-display', weth-borrow);
    updateDashboardValues(); updateCurrencyDisplay();
}

// =====================================================
// MOEDA
// =====================================================
function switchCurrency(currency) {
    localStorage.setItem('silt_currency', currency); window.CURRENCY = currency;
    document.querySelectorAll('.currency-switcher button').forEach(function(b) {
        b.classList.toggle('active', b.dataset.currency === currency);
    });
    updateCurrencyDisplay(); initMonthsGrid(); refreshWeeksView();
    if (window.SILTCharts) window.SILTCharts.updateChartsCurrency(dashExchangeRate);
}

// =====================================================
// CHARTS
// =====================================================
function initCharts() {
    var pools = parseFloat((document.getElementById('pools-balance')||{}).dataset.value)||0;
    var aave  = parseFloat((document.getElementById('aave-balance')||{}).dataset.value)||0;
    if (window.SILTCharts) {
        window.SILTCharts.createPortfolioChart('portfolio-chart', { pools: pools, aave: aave });
        var md = calculateMonthlyData();
        window.SILTCharts.createTrendChart('trend-chart', { labels: md.labels, values: md.values });
        window.SILTCharts.createTrendChart('aave-chart',  { labels: ['Início','Atual'], values: [aave*0.9, aave] });
    }
}

function calculateMonthlyData() {
    var labels=[], values=[];
    PT_MONTHS.forEach(function(m) {
        if (!userPoolData.some(function(p) { return p.month===m; })) return;
        labels.push(m.substring(0,3)); values.push(getPoolsValueForMonth(m));
    });
    return { labels: labels, values: values };
}

// =====================================================
// GRID DE MESES
// =====================================================
function initMonthsGrid() {
    var grid = document.getElementById('months-grid'); grid.innerHTML = '';
    PT_MONTHS.forEach(function(month) {
        var mp = userPoolData.filter(function(p) { return p.month===month; });
        var card = document.createElement('div'); card.className = 'glass-card month-card';
        if (!mp.length) {
            card.style.opacity='0.35';
            card.innerHTML='<h3>'+month+'</h3><p class="month-stats" style="color:var(--text-muted);">Sem dados</p>';
            grid.appendChild(card); return;
        }
        var totalProfit=0; mp.forEach(function(p){ totalProfit+=parseFloat(p.profit_value||0); });
        card.onclick = function() { showMonth(month); };
        card.innerHTML = '<h3>'+month+'</h3><p class="month-stats">'+fmt(getPoolsValueForMonth(month))+'</p><span style="color:var(--success);font-size:14px;">✓ Lucro: '+fmt(totalProfit)+'</span>';
        grid.appendChild(card);
    });
}

// =====================================================
// SEMANAS
// =====================================================
function showMonth(month) {
    currentMonth = month;
    document.getElementById('months-view').style.display='none';
    document.getElementById('weeks-view').classList.add('active');
    document.getElementById('selected-month-title').textContent = month;
    renderWeeks(month);
}

function renderWeeks(month) {
    var container = document.getElementById('weeks-container'); container.innerHTML='';
    var mp = userPoolData.filter(function(p) { return p.month===month; });
    if (!mp.length) {
        container.innerHTML='<p style="text-align:center;color:var(--text-secondary);padding:40px;">Nenhum dado.</p>';
        return;
    }

    var weeks={};
    mp.forEach(function(p) { var w=p.week||'Sem semana'; if(!weeks[w]) weeks[w]=[]; weeks[w].push(p); });
    var wo=['Semana 1','Semana 2','Semana 3','Semana 4','Semana 5','Total do Mês'];
    var sw=Object.keys(weeks).sort(function(a,b) {
        var ia=wo.indexOf(a), ib=wo.indexOf(b);
        return (ia===-1?99:ia)-(ib===-1?99:ib);
    });

    var mPos={}, monthTotalProfit=0;

    sw.forEach(function(week) {
        var pools=weeks[week], wCard=document.createElement('div'); wCard.className='glass-card week-card';
        var wProfit=0;
        var rows=pools.map(function(p) {
            var ini=parseFloat(p.initial_value||p.invested_value||0);
            var con=parseFloat(p.contribution_value||0);
            var yp=parseFloat(p.yield_percent||0);
            var pro=parseFloat(p.profit_value||0);
            var cur=parseFloat(p.current_value||0);
            wProfit+=pro; monthTotalProfit+=pro;
            if (!mPos[p.pool_name]) mPos[p.pool_name]={current:0,fallback:0,capital:0,profit:0};
            if (cur>0) mPos[p.pool_name].current=cur;
            mPos[p.pool_name].fallback=ini+con+pro;
            mPos[p.pool_name].capital=Math.max(mPos[p.pool_name].capital,ini+con);
            mPos[p.pool_name].profit+=pro;
            var diff=cur>0?cur-(ini+con):pro;
            var dt=cur>0?'<span style="color:'+(diff>=0?'#22c55e':'#ef4444')+';font-size:12px;">'+(diff>=0?'▲':'▼')+fmt(Math.abs(diff))+'</span>':'';
            return '<tr><td>'+p.pool_name+'</td><td>'+fmt(ini+con)+'</td><td>'+(yp>0?yp.toFixed(2)+'%':'-')+'</td><td style="color:var(--success);">+'+fmt(pro)+'</td><td>'+(cur>0?fmt(cur)+' '+dt:fmt(ini+con+pro))+'</td></tr>';
        }).join('');
        wCard.innerHTML='<h4 style="margin-bottom:12px;">'+week+'</h4><table class="pools-table"><thead><tr><th>Pool</th><th>Investido</th><th>Rend.%</th><th>Lucro</th><th>Valor Atual</th></tr></thead><tbody>'+rows+'<tr style="font-weight:bold;border-top:2px solid var(--border-glass);"><td colspan="3">Total</td><td style="color:var(--success);">+'+fmt(wProfit)+'</td><td>-</td></tr></tbody></table>';
        container.appendChild(wCard);
    });

    // Resumo do mês
    var aaveMes=allAaveData.find(function(a){return a.month===month;})||null;
    var weth=parseFloat(aaveMes&&(aaveMes.weth_value||aaveMes.aave_balance)||0);
    var usdto=parseFloat(aaveMes&&(aaveMes.usdto_value||aaveMes.borrow_value)||0);
    var mpv=0;
    var mpvCapital=0; // capital investido (100% do usuário)
    Object.values(mPos).forEach(function(p){
        var val = p.current>0 ? p.current : p.fallback;
        mpv += val;
        // Estimar capital: valor total menos lucro acumulado (ou fallback - profit)
        mpvCapital += p.current>0 ? Math.max(0, p.current - p.profit) : (p.capital||0);
    });

        var profitShare   = window.PROFIT_SHARE !== undefined ? window.PROFIT_SHARE : 50;
    var mpvProfit     = mpv - mpvCapital;                        // lucro total das pools no mês
    var myShareProfit = mpvProfit * (profitShare / 100);         // parte do usuário no lucro
    var myShareValue  = mpvCapital + myShareProfit;              // capital 100% + lucro proporcional

var sum=document.createElement('div'); sum.className='glass-card';
    sum.style.cssText='margin-top:24px;border:1px solid rgba(168,85,247,0.3);';
    sum.innerHTML='<h3 style="margin-bottom:20px;color:var(--neon-purple,#a855f7);">📊 Resumo — '+month+'</h3>'
        +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:'+(weth>0?'20px':'0')+';">'
        +'<div<div style="text-align:center;padding:12px;background:rgba(168,85,247,0.1);border-radius:12px;"><p style="color:var(--text-muted);font-size:12px;margin-bottom:4px;">Valor Atual Pools</p><p style="font-size:20px;font-weight:700;">'+fmt(mpv)+'</p></div>'
        +'<div style="text-align:center;padding:12px;background:rgba(34,197,94,0.1);border-radius:12px;"><p style="color:var(--text-muted);font-size:12px;margin-bottom:4px;">Lucro Total</p><p style="font-size:20px;font-weight:700;color:#22c55e;">+'+fmt(monthTotalProfit)+'</p><div style="margin-top:10px;padding:8px 12px;background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.35);border-radius:8px;"><p style="font-size:11px;color:rgba(34,197,94,0.7);margin-bottom:2px;">Sua parte ('+profitShare.toFixed(0)+'%)</p><p style="font-size:18px;font-weight:700;color:#22c55e;">+'+fmt(myShareProfit)+'</p></div></div>'
        +'</div>'
        +(weth>0
            ?'<div style="padding-top:16px;border-top:1px solid var(--border-glass);"><h4 style="margin-bottom:12px;color:var(--text-secondary);">Total com AAVE ('+month+')</h4>'
              +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
              +'<div style="padding:14px;background:rgba(239,68,68,0.08);border-radius:12px;border:1px solid rgba(239,68,68,0.2);"><p style="color:var(--text-muted);font-size:12px;margin-bottom:6px;">SEM pagar empréstimo</p><p style="font-size:22px;font-weight:700;">'+fmt(weth-usdto+myShareValue)+'</p><p style="font-size:12px;color:var(--text-muted);margin-top:4px;">'+profitShare.toFixed(0)+'% das pools</p></div>'
              +'<div style="padding:14px;background:rgba(34,197,94,0.08);border-radius:12px;border:1px solid rgba(34,197,94,0.2);"><p style="color:var(--text-muted);font-size:12px;margin-bottom:6px;">PAGANDO empréstimo</p><p style="font-size:22px;font-weight:700;">'+fmt(weth+myShareValue)+'</p><p style="font-size:12px;color:var(--text-muted);margin-top:4px;">'+profitShare.toFixed(0)+'% das pools</p></div>'
              +'</div></div>'
            :'');
    container.appendChild(sum);
}

function refreshWeeksView() {
    if (currentMonth && document.getElementById('weeks-view') && document.getElementById('weeks-view').classList.contains('active')) {
        renderWeeks(currentMonth);
    }
}
function showMonths() { currentMonth=null; document.getElementById('months-view').style.display='block'; document.getElementById('weeks-view').classList.remove('active'); }
function showSection(s) {
    document.querySelectorAll('.nav-tabs button').forEach(function(b){b.classList.toggle('active',b.dataset.section===s);});
    document.querySelectorAll('.section').forEach(function(x){x.classList.toggle('active',x.id===s+'-section');});
}
async function logout() { await supabaseClient.auth.signOut(); localStorage.clear(); window.location.href='login.html'; }
