// S.I.L.T. System - Ranking

const RANKING_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const RANKING_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const rankingClient = window.supabase.createClient(RANKING_URL, RANKING_KEY);

const PT_MONTHS  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_ORDER = ['Semana 1','Semana 2','Semana 3','Semana 4','Semana 5','Total do Mês'];

// ── Cores ──────────────────────────────────────────
function getColor(pos) {
    if (pos === 0) return 'linear-gradient(180deg,#fbbf24,#f59e0b)'; // ouro
    if (pos === 1) return 'linear-gradient(180deg,#94a3b8,#64748b)'; // prata
    if (pos === 2) return 'linear-gradient(180deg,#c2844a,#a0522d)'; // bronze
    return 'linear-gradient(180deg,#a855f7,#7c3aed)';                // roxo demais
}
function getWick(pos) {
    if (pos === 0) return '#fbbf24';
    if (pos === 1) return '#94a3b8';
    if (pos === 2) return '#c2844a';
    return '#a855f7';
}

function renderCandles(container, entries, maxPts) {
    if (!entries.length) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Sem dados para este período.</p>';
        return;
    }

    const CANDLE_H = 260;
    const medals   = ['🥇','🥈','🥉'];

    const maxPoints = maxPts || Math.max(10, Math.ceil(Math.max(...entries.map(e => e.displayPoints)) / 10) * 10);

    const gridSteps = [];
    const step = Math.max(2, Math.floor(maxPoints / 5));
    for (let i = 0; i <= maxPoints; i += step) gridSteps.push(i);

    const gridLines = gridSteps.map(pt => {
        const y = CANDLE_H - Math.round((pt / maxPoints) * CANDLE_H);
        return `<div style="position:absolute;left:0;right:0;top:${y}px;border-top:1px dashed rgba(168,85,247,0.12);"></div>`;
    }).join('');

    const candles = entries.map((entry, i) => {
        const pts      = Math.max(0, entry.displayPoints);
        const height   = Math.max(6, Math.round((pts / maxPoints) * CANDLE_H));
        const isWinner = i === 0;
        const medal    = i < 3 ? medals[i] : '';
        const wickH    = Math.round(height * 0.12) + 6;
        const color    = getColor(i);
        const wick     = getWick(i);
        const glow     = isWinner
            ? '0 0 28px rgba(251,191,36,.8),0 0 56px rgba(251,191,36,.3)'
            : `0 0 12px ${wick}55`;

        return `
        <div style="display:flex;flex-direction:column;align-items:center;min-width:60px;max-width:90px;flex:1;">
            <div style="font-size:22px;margin-bottom:6px;min-height:28px;">${medal}</div>
            <div style="width:3px;height:${wickH}px;background:${wick};border-radius:2px;opacity:0.6;"></div>
            <div style="width:52px;height:${height}px;background:${color};border-radius:7px 7px 3px 3px;
                box-shadow:${glow};
                animation:candleGrow 1s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.13}s both;
                position:relative;">
                ${isWinner ? '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:20px;">👑</div>' : ''}
            </div>
            <div style="width:3px;height:6px;background:${wick};border-radius:2px;opacity:0.4;"></div>
            <div style="margin-top:8px;font-size:13px;text-align:center;word-break:break-word;max-width:80px;
                font-weight:${isWinner ? 700 : 500};
                color:${isWinner ? '#fbbf24' : 'var(--text-secondary)'};">${entry.username}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <style>@keyframes candleGrow{from{transform:scaleY(0);transform-origin:bottom;opacity:0;}to{transform:scaleY(1);transform-origin:bottom;opacity:1;}}</style>
        <div style="position:relative;">
            <div style="position:absolute;top:24px;left:0;right:0;height:${CANDLE_H}px;pointer-events:none;">${gridLines}</div>
            <div style="display:flex;align-items:flex-end;justify-content:center;gap:24px;padding:24px 24px 0;min-height:${CANDLE_H + 100}px;flex-wrap:wrap;position:relative;z-index:1;">
                ${candles}
            </div>
        </div>`;
}

// ── Ranking de Patrimônio ───────────────────────────
async function renderPatrimonioRanking() {
    const container  = document.getElementById('ranking-chart');
    const monthLabel = document.getElementById('ranking-month-label');
    const weekLabel  = document.getElementById('ranking-week-label');
    const dateLabel  = document.getElementById('ranking-date-label');
    const chartTitle = document.getElementById('ranking-chart-title');

    if (monthLabel) monthLabel.textContent  = 'Patrimônio';
    if (weekLabel)  weekLabel.textContent   = 'Atual';
    if (dateLabel)  dateLabel.style.display = 'none';
    if (chartTitle) chartTitle.textContent  = '💎 Ranking Patrimonial';

    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:280px;color:var(--text-muted);">
        <div class="spinner" style="width:28px;height:28px;margin-right:10px;"></div>Calculando patrimônio...
    </div>`;

    try {
        const { data: users, error: usersError } = await rankingClient
            .from('users')
            .select('id, username, profit_share');

        if (usersError || !users || !users.length) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Nenhum usuário encontrado.</p>';
            return;
        }

        const patrimonios = await Promise.all(users.map(async (user) => {
            const profitShare = (user.profit_share !== null && user.profit_share !== undefined)
                ? parseFloat(user.profit_share) : 50;
            const pct = profitShare / 100;

            const { data: pools } = await rankingClient
                .from('pool_data').select('*').eq('user_id', user.id);

            const { data: aaveRows } = await rankingClient
                .from('aave_data').select('*').eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            const aaveData = aaveRows?.[0] || null;
            const weth = parseFloat(aaveData?.weth_value || aaveData?.aave_balance || 0);

            let poolsCapital = 0, poolsProfit = 0;
            if (pools && pools.length) {
                const months = [...new Set(pools.map(p => p.month))];
                const latestMonth = months.sort((a, b) =>
                    PT_MONTHS.indexOf(b) - PT_MONTHS.indexOf(a))[0];

                const monthPools = pools.filter(p => p.month === latestMonth);
                const weeks = [...new Set(monthPools.map(p => p.week))];
                const latestWeek = weeks.sort((a, b) => {
                    const ia = WEEK_ORDER.indexOf(a); const ib = WEEK_ORDER.indexOf(b);
                    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                }).pop();

                const latestPools = monthPools.filter(p => p.week === latestWeek);
                const pos = {};
                latestPools.forEach(p => {
                    const cur = parseFloat(p.current_value  || 0);
                    const ini = parseFloat(p.initial_value  || p.invested_value || 0);
                    const con = parseFloat(p.contribution_value || 0);
                    const pro = parseFloat(p.profit_value   || 0);
                    if (!pos[p.pool_name]) pos[p.pool_name] = { current: 0, capital: 0, profit: 0 };
                    if (cur > 0) pos[p.pool_name].current = cur;
                    pos[p.pool_name].capital = ini + con;
                    pos[p.pool_name].profit  = pro;
                });
                Object.values(pos).forEach(p => {
                    if (p.current > 0) {
                        poolsCapital += Math.max(0, p.current - p.profit);
                        poolsProfit  += p.profit;
                    } else {
                        poolsCapital += p.capital;
                        poolsProfit  += p.profit;
                    }
                });
            }

            const total = weth + poolsCapital + (poolsProfit * pct);
            return { username: user.username, total };
        }));

        const valid = patrimonios
            .filter(p => p.total > 0)
            .sort((a, b) => b.total - a.total);

        if (!valid.length) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Nenhum dado de patrimônio disponível.</p>';
            return;
        }

        // Normalizar para escala 0-100 (sem exibir valores reais)
        const maxTotal = Math.max(...valid.map(p => p.total));
        const entries = valid.map(p => ({
            username:      p.username,
            displayPoints: maxTotal > 0 ? (p.total / maxTotal) * 100 : 0
        }));

        renderCandles(container, entries, 100);

    } catch (err) {
        console.error('Erro ao carregar patrimônio:', err);
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Erro ao carregar dados.</p>';
    }
}

// ── Init ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderPatrimonioRanking();
});
