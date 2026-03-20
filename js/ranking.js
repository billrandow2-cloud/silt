// S.I.L.T. System - Ranking

const RANKING_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const RANKING_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const rankingClient = window.supabase.createClient(RANKING_URL, RANKING_KEY);

const PT_MONTHS  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_ORDER = ['Semana 1','Semana 2','Semana 3','Semana 4','Semana 5','Total do Mês'];

let allRankingData   = [];
let allPeriods       = [];
let currentPeriodIdx = 0;
let viewMode         = 'start'; // começa como start, muda para end automaticamente se tiver fim

function fmtDate(d) {
    if (!d) return null;
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
}

async function loadRanking() {
    const container = document.getElementById('ranking-chart');
    if (!container) return;

    const { data, error } = await rankingClient.from('rankings').select('*');

    if (error || !data || !data.length) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Nenhum dado de ranking disponível ainda.</p>';
        return;
    }

    allRankingData = data;

    // Períodos únicos, mais recente primeiro
    const seen = new Set();
    allPeriods = [];
    data.forEach(r => {
        const key = r.month + '||' + r.week;
        if (!seen.has(key)) {
            seen.add(key);
            allPeriods.push({ month: r.month, week: r.week, week_start: r.week_start, week_end: r.week_end });
        }
    });
    allPeriods.sort((a, b) => {
        const mi = PT_MONTHS.indexOf(b.month) - PT_MONTHS.indexOf(a.month);
        if (mi !== 0) return mi;
        return WEEK_ORDER.indexOf(b.week) - WEEK_ORDER.indexOf(a.week);
    });

    currentPeriodIdx = 0;
    buildHistorySelector();
    // Se o período mais recente tiver points_end > 0, mostrar fim como padrão
    const latestPeriod = allPeriods[0];
    if (latestPeriod && allRankingData.some(r =>
        r.month === latestPeriod.month && r.week === latestPeriod.week &&
        r.points_end !== null && r.points_end !== undefined && parseFloat(r.points_end) > 0
    )) {
        viewMode = 'end';
    } else {
        viewMode = 'start';
    }
    updateToggleButtons();
    renderPeriod(0);
    if (allPeriods.length > 1) renderEvolution();
}

function buildHistorySelector() {
    const sel = document.getElementById('ranking-period-select');
    if (!sel) return;
    sel.innerHTML = '';
    allPeriods.forEach((p, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        const ws = fmtDate(p.week_start), we = fmtDate(p.week_end);
        const dateRange = ws && we ? ` · ${ws}–${we}` : '';
        opt.textContent = `${p.month} — ${p.week}${dateRange}${i === 0 ? ' ★' : ''}`;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
        currentPeriodIdx = parseInt(sel.value);
        renderPeriod(currentPeriodIdx);
    });
}

// Verifica se o período tem pontos de fim preenchidos (> 0)
function periodHasEnd(month, week) {
    return allRankingData.some(r =>
        r.month === month &&
        r.week  === week  &&
        r.points_end !== null &&
        r.points_end !== undefined &&
        parseFloat(r.points_end) > 0
    );
}

function renderPeriod(idx) {
    if (!allPeriods.length) return;
    const period = allPeriods[idx];

    // Labels
    const monthLabel = document.getElementById('ranking-month-label');
    const weekLabel  = document.getElementById('ranking-week-label');
    const dateLabel  = document.getElementById('ranking-date-label');
    if (monthLabel) monthLabel.textContent = period.month;
    if (weekLabel)  weekLabel.textContent  = period.week + (idx === 0 ? ' · atual' : '');
    if (dateLabel) {
        const ws = fmtDate(period.week_start), we = fmtDate(period.week_end);
        if (ws && we) { dateLabel.textContent = `${ws} → ${we}`; dateLabel.style.display = 'inline'; }
        else dateLabel.style.display = 'none';
    }

    // Nav
    const btnPrev = document.getElementById('ranking-prev');
    const btnNext = document.getElementById('ranking-next');
    if (btnPrev) btnPrev.disabled = idx >= allPeriods.length - 1;
    if (btnNext) btnNext.disabled = idx <= 0;
    const sel = document.getElementById('ranking-period-select');
    if (sel) sel.value = idx;

    // Mostrar ou esconder botão de toggle conforme existência de points_end
    const hasEnd    = periodHasEnd(period.month, period.week);
    const toggleWrap = document.getElementById('ranking-toggle-wrap');
    if (toggleWrap) {
        toggleWrap.style.display = hasEnd ? 'flex' : 'none';
    }

    // Se não tem fim e estava em modo 'end', volta para 'start'
    if (!hasEnd && viewMode === 'end') {
        viewMode = 'start';
        updateToggleButtons();
    }

    // Montar entries com o ponto correto conforme modo
    const entries = allRankingData
        .filter(r => r.month === period.month && r.week === period.week)
        .map(r => ({
            ...r,
            displayPoints: viewMode === 'end' && hasEnd
                ? parseFloat(r.points_end ?? r.points ?? 0)
                : parseFloat(r.points_start ?? r.points ?? 0)
        }))
        .sort((a, b) => b.displayPoints - a.displayPoints);

    // Título do gráfico
    const chartTitle = document.getElementById('ranking-chart-title');
    if (chartTitle) {
        if (hasEnd && viewMode === 'end') {
            const we = fmtDate(period.week_end);
            chartTitle.textContent = '🏁 Fim da semana' + (we ? ` · ${we}` : '');
        } else {
            const ws = fmtDate(period.week_start);
            chartTitle.textContent = '📅 Início da semana' + (ws ? ` · ${ws}` : '');
        }
    }

    const container = document.getElementById('ranking-chart');
    if (container) renderCandles(container, entries);
}

function updateToggleButtons() {
    const btnStart = document.getElementById('btn-view-start');
    const btnEnd   = document.getElementById('btn-view-end');
    if (!btnStart || !btnEnd) return;
    btnStart.classList.toggle('toggle-active', viewMode === 'start');
    btnEnd.classList.toggle('toggle-active',   viewMode === 'end');
}

function setViewMode(mode) {
    viewMode = mode;
    updateToggleButtons();
    renderPeriod(currentPeriodIdx);
}

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

function renderCandles(container, entries) {
    if (!entries.length) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">Sem dados para este período.</p>';
        return;
    }

    const CANDLE_H = 260;
    const medals   = ['🥇','🥈','🥉'];

    const gridLines = [2,4,6,8,10].map(pt => {
        const y = CANDLE_H - Math.round((pt/10)*CANDLE_H);
        return `<div style="position:absolute;left:0;right:0;top:${y}px;border-top:1px dashed rgba(168,85,247,0.12);">
            <span style="font-size:9px;color:rgba(168,85,247,0.3);margin-left:4px;">${pt}</span>
        </div>`;
    }).join('');

    const candles = entries.map((entry, i) => {
        const pts      = Math.min(10, Math.max(0, entry.displayPoints));
        const height   = Math.max(6, Math.round((pts/10)*CANDLE_H));
        const isWinner = i === 0;
        const medal    = i < 3 ? medals[i] : '';
        const wickH    = Math.round(height*0.12)+6;
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
                animation:candleGrow 1s cubic-bezier(0.34,1.56,0.64,1) ${i*0.13}s both;
                position:relative;">
                ${isWinner?'<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:20px;">👑</div>':''}
            </div>
            <div style="width:3px;height:6px;background:${wick};border-radius:2px;opacity:0.4;"></div>
            <div style="margin-top:10px;font-size:13px;text-align:center;word-break:break-word;max-width:80px;
                font-weight:${isWinner?700:500};
                color:${isWinner?'#fbbf24':'var(--text-secondary)'};">${entry.username}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <style>@keyframes candleGrow{from{transform:scaleY(0);transform-origin:bottom;opacity:0;}to{transform:scaleY(1);transform-origin:bottom;opacity:1;}}</style>
        <div style="position:relative;">
            <div style="position:absolute;top:24px;left:0;right:0;height:${CANDLE_H}px;pointer-events:none;">${gridLines}</div>
            <div style="display:flex;align-items:flex-end;justify-content:center;gap:24px;padding:24px 24px 0;min-height:${CANDLE_H+100}px;flex-wrap:wrap;position:relative;z-index:1;">
                ${candles}
            </div>
        </div>`;
}

// ── Gráfico de evolução ─────────────────────────────
function renderEvolution() {
    const wrap = document.getElementById('ranking-evolution');
    if (!wrap) return;

    const members    = [...new Set(allRankingData.map(r => r.username))];
    const periodsAsc = [...allPeriods].reverse();
    const palette    = ['#a855f7','#22c55e','#3b82f6','#fbbf24','#ef4444','#c084fc','#34d399'];
    const W=580,H=200,PL=36,PR=20,PT=16,PB=50;
    const chartW=W-PL-PR, chartH=H-PT-PB;
    const stepX=periodsAsc.length>1?chartW/(periodsAsc.length-1):chartW;

    const gridY=[0,2,4,6,8,10].map(v=>{
        const y=PT+chartH-(v/10)*chartH;
        return `<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="rgba(168,85,247,0.1)" stroke-width="1"/>
                 <text x="${PL-4}" y="${y+4}" fill="rgba(168,85,247,0.35)" font-size="9" text-anchor="end">${v}</text>`;
    }).join('');

    const labelsX=periodsAsc.map((p,i)=>{
        const x=PL+i*stepX;
        const ws=fmtDate(p.week_start),we=fmtDate(p.week_end);
        const l1=`${p.week.replace('Semana ','S')} ${p.month.substring(0,3)}`;
        const l2=ws&&we?`${ws}–${we}`:'';
        return `<text x="${x}" y="${PT+chartH+14}" fill="rgba(255,255,255,0.4)" font-size="9" text-anchor="middle">${l1}</text>
                 ${l2?`<text x="${x}" y="${PT+chartH+24}" fill="rgba(255,255,255,0.25)" font-size="8" text-anchor="middle">${l2}</text>`:''}`;
    }).join('');

    const memberSVG=members.map((member,mi)=>{
        const col=palette[mi%palette.length];
        const pts=periodsAsc.map(p=>{
            const row=allRankingData.find(r=>r.username===member&&r.month===p.month&&r.week===p.week);
            if(!row)return null;
            const v=parseFloat(row.points_end??row.points_start??row.points??0);
            return Math.min(10,Math.max(0,v));
        });
        const pp=[]; let in_=false;
        pts.forEach((v,i)=>{
            if(v===null){in_=false;return;}
            const x=PL+i*stepX,y=PT+chartH-(v/10)*chartH;
            pp.push(in_?`L ${x},${y}`:`M ${x},${y}`); in_=true;
        });
        const dots=pts.map((v,i)=>{
            if(v===null)return'';
            const x=PL+i*stepX,y=PT+chartH-(v/10)*chartH;
            return `<circle cx="${x}" cy="${y}" r="4" fill="${col}" stroke="#0b0b0f" stroke-width="2"><title>${member}: ${v.toFixed(1)}</title></circle>`;
        }).join('');
        return `<path d="${pp.join(' ')}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
    }).join('');

    const legend=members.map((m,mi)=>{
        const col=palette[mi%palette.length];
        return `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;">
            <span style="display:inline-block;width:18px;height:3px;background:${col};border-radius:2px;"></span>
            <span style="font-size:12px;color:var(--text-secondary);">${m}</span></span>`;
    }).join('');

    wrap.innerHTML=`
        <h3 style="margin-bottom:8px;font-size:15px;color:var(--text-secondary);font-weight:600;">📈 Evolução por Semana</h3>
        <div style="margin-bottom:12px;display:flex;flex-wrap:wrap;">${legend}</div>
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;overflow:visible;">
            ${gridY}${memberSVG}${labelsX}
        </svg>`;
    wrap.style.display='block';
}

// ── Init ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadRanking();

    document.getElementById('ranking-prev')?.addEventListener('click', () => {
        if (currentPeriodIdx < allPeriods.length-1) { currentPeriodIdx++; renderPeriod(currentPeriodIdx); }
    });
    document.getElementById('ranking-next')?.addEventListener('click', () => {
        if (currentPeriodIdx > 0) { currentPeriodIdx--; renderPeriod(currentPeriodIdx); }
    });
    document.getElementById('btn-view-start')?.addEventListener('click', () => setViewMode('start'));
    document.getElementById('btn-view-end')?.addEventListener('click',   () => setViewMode('end'));
});
