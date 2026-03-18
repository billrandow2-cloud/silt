// S.I.L.T. System - Ranking (velas por semana)

const RANKING_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const RANKING_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const rankingClient = window.supabase.createClient(RANKING_URL, RANKING_KEY);

const PT_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const WEEK_ORDER = ['Semana 1','Semana 2','Semana 3','Semana 4','Semana 5','Total do Mês'];

function rankingSort(a, b) {
    const mi = PT_MONTHS.indexOf(a.month) - PT_MONTHS.indexOf(b.month);
    if (mi !== 0) return mi;
    return WEEK_ORDER.indexOf(a.week) - WEEK_ORDER.indexOf(b.week);
}

async function loadRanking() {
    const container  = document.getElementById('ranking-chart');
    const weekLabel  = document.getElementById('ranking-week-label');
    const monthLabel = document.getElementById('ranking-month-label');
    if (!container) return;

    const { data, error } = await rankingClient
        .from('rankings').select('*');

    if (error || !data || data.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Nenhum dado de ranking disponível ainda.</p>';
        return;
    }

    // Encontrar o mês + semana mais recentes
    const sorted = [...data].sort(rankingSort);
    const latest = sorted[sorted.length - 1];
    const latestMonth = latest.month;
    const latestWeek  = latest.week;

    // Filtrar só essa semana
    const entries = data
        .filter(r => r.month === latestMonth && r.week === latestWeek)
        .sort((a, b) => b.value - a.value);

    if (monthLabel) monthLabel.textContent = latestMonth;
    if (weekLabel)  weekLabel.textContent  = latestWeek;

    if (!entries.length) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Sem dados para esta semana.</p>';
        return;
    }

    renderCandles(container, entries);
}

function renderCandles(container, entries) {
    const maxVal   = Math.max(...entries.map(e => e.value));
    const CANDLE_H = 280;
    const medals   = ['🥇','🥈','🥉'];

    const candles = entries.map((entry, i) => {
        const height   = Math.max(20, Math.round((entry.value / maxVal) * CANDLE_H));
        const isWinner = i === 0;
        const medal    = i < 3 ? medals[i] : '';
        const wickH    = Math.round(height * 0.15) + 8;

        const bodyColor = isWinner
            ? 'linear-gradient(180deg,#fbbf24,#f59e0b)'
            : i === 1 ? 'linear-gradient(180deg,#94a3b8,#64748b)'
            : i === 2 ? 'linear-gradient(180deg,#c2844a,#a0522d)'
            :           'linear-gradient(180deg,#a855f7,#7c3aed)';

        const wickColor = isWinner ? '#fbbf24' : i===1 ? '#94a3b8' : i===2 ? '#c2844a' : '#a855f7';
        const glow      = isWinner
            ? '0 0 24px rgba(251,191,36,0.7),0 0 48px rgba(251,191,36,0.3)'
            : '0 0 12px rgba(168,85,247,0.3)';

        return `
        <div style="display:flex;flex-direction:column;align-items:center;min-width:60px;max-width:90px;flex:1;">
            <div style="font-size:20px;margin-bottom:6px;min-height:28px;">${medal}</div>
            <div style="width:3px;height:${wickH}px;background:${wickColor};border-radius:2px;opacity:0.7;"></div>
            <div style="
                width:48px;height:${height}px;
                background:${bodyColor};
                border-radius:6px 6px 3px 3px;
                box-shadow:${glow};
                animation:candleGrow 0.9s cubic-bezier(0.34,1.56,0.64,1) ${i*0.12}s both;
                position:relative;
            ">${isWinner?'<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:18px;">👑</div>':''}</div>
            <div style="width:3px;height:6px;background:${wickColor};border-radius:2px;opacity:0.5;"></div>
            <div style="
                margin-top:10px;font-size:13px;text-align:center;word-break:break-word;max-width:80px;
                font-weight:${isWinner?700:500};
                color:${isWinner?'#fbbf24':'var(--text-secondary)'};
            ">${entry.username}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <style>
            @keyframes candleGrow {
                from { transform:scaleY(0); transform-origin:bottom; opacity:0; }
                to   { transform:scaleY(1); transform-origin:bottom; opacity:1; }
            }
        </style>
        <div style="display:flex;align-items:flex-end;justify-content:center;gap:20px;padding:40px 24px 0;min-height:${CANDLE_H+120}px;flex-wrap:wrap;">
            ${candles}
        </div>`;
}

document.addEventListener('DOMContentLoaded', loadRanking);
