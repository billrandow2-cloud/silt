// S.I.L.T. System - Goals Module (Metas)
// Gerencia metas do usuário e celebrações ao bater uma meta

const GOALS_SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const GOALS_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const goalsClient = window.supabase.createClient(GOALS_SUPABASE_URL, GOALS_SUPABASE_KEY);

// Estado local das metas
let currentGoals = null;
let goalsUserId  = null;

// Definição das metas com ícone, rótulo, campo e descrição
const GOAL_DEFINITIONS = [
    {
        key:   'goal_aporte_mensal',
        icon:  '💸',
        label: 'Aporte Mensal',
        desc:  'Quanto você quer aportar por mês',
        color: '#a855f7',
        unit:  'currency'
    },
    {
        key:   'goal_lucro_semanal',
        icon:  '⚡',
        label: 'Lucro Semanal',
        desc:  'Lucro mínimo que deseja ter por semana',
        color: '#22c55e',
        unit:  'currency'
    },
    {
        key:   'goal_lucro_mensal',
        icon:  '📈',
        label: 'Lucro Mensal',
        desc:  'Lucro total acumulado no mês',
        color: '#22c55e',
        unit:  'currency'
    },
    {
        key:   'goal_valor_pools',
        icon:  '💰',
        label: 'Valor Total nas Pools',
        desc:  'Valor acumulado nas pools de liquidez',
        color: '#3b82f6',
        unit:  'currency'
    },
    {
        key:   'goal_patrimonio_total',
        icon:  '🏆',
        label: 'Patrimônio Total',
        desc:  'Soma de Pools + AAVE (pagando empréstimo)',
        color: '#fbbf24',
        unit:  'currency'
    },
    {
        key:   'goal_rendimento_pct',
        icon:  '🎯',
        label: 'Rendimento Mensal (%)',
        desc:  '% de rendimento sobre o capital investido',
        color: '#f97316',
        unit:  'percent'
    },
    {
        key:   'goal_patrimonio_liquido',
        icon:  '🌟',
        label: 'Patrimônio Líquido (sem dívida)',
        desc:  'Pools + AAVE − empréstimo',
        color: '#06b6d4',
        unit:  'currency'
    }
];

// =====================================================
// INICIALIZAR
// =====================================================
async function initGoals(userId) {
    goalsUserId = userId;
    await loadGoals();
}

// =====================================================
// CARREGAR METAS DO SUPABASE
// =====================================================
async function loadGoals() {
    if (!goalsUserId) return;
    try {
        const { data, error } = await goalsClient
            .from('user_goals')
            .select('*')
            .eq('user_id', goalsUserId)
            .single();

        if (!error && data) {
            currentGoals = data;
        } else {
            currentGoals = null;
        }
    } catch (e) {
        console.warn('Goals load error:', e);
        currentGoals = null;
    }
}

// =====================================================
// SALVAR METAS
// =====================================================
async function saveGoals(goalsData) {
    if (!goalsUserId) return false;
    try {
        // Limpar valores vazios (viram null)
        const cleaned = { user_id: goalsUserId, updated_at: new Date().toISOString() };
        GOAL_DEFINITIONS.forEach(def => {
            const val = goalsData[def.key];
            cleaned[def.key] = (val !== '' && val !== null && val !== undefined && !isNaN(parseFloat(val)))
                ? parseFloat(val)
                : null;
        });

        if (currentGoals && currentGoals.id) {
            // UPDATE
            const { error } = await goalsClient
                .from('user_goals')
                .update(cleaned)
                .eq('user_id', goalsUserId);
            if (error) throw error;
        } else {
            // INSERT
            cleaned.created_at = new Date().toISOString();
            const { error } = await goalsClient
                .from('user_goals')
                .insert([cleaned]);
            if (error) throw error;
        }

        currentGoals = { ...currentGoals, ...cleaned };
        return true;
    } catch (e) {
        console.error('Goals save error:', e);
        return false;
    }
}

// =====================================================
// CHECAR METAS X VALORES ATUAIS
// =====================================================
function checkGoalsAchieved(currentValues) {
    if (!currentGoals) return [];

    const achieved = [];

    // Mapear: chave da meta → valor atual correspondente
    const valueMap = {
        goal_lucro_mensal:      currentValues.lucroMensal,
        goal_lucro_semanal:     currentValues.lucroSemanal,
        goal_valor_pools:       currentValues.valorPools,
        goal_patrimonio_total:  currentValues.patrimonioTotal,
        goal_rendimento_pct:    currentValues.rendimentoPct,
        goal_patrimonio_liquido:currentValues.patrimonioLiquido
        // goal_aporte_mensal é manual, não tem valor calculado automaticamente
    };

    GOAL_DEFINITIONS.forEach(def => {
        const meta   = currentGoals[def.key];
        const atual  = valueMap[def.key];
        if (meta !== null && meta !== undefined && meta > 0 &&
            atual  !== null && atual !== undefined && !isNaN(atual) &&
            atual >= meta) {
            achieved.push({
                ...def,
                meta:  meta,
                atual: atual
            });
        }
    });

    return achieved;
}

// =====================================================
// MOSTRAR CELEBRAÇÃO
// =====================================================
function showGoalCelebration(achievedGoals) {
    if (!achievedGoals.length) return;

    // Remover celebração anterior se existir
    const existing = document.getElementById('goals-celebration-overlay');
    if (existing) existing.remove();

    // Criar overlay
    const overlay = document.createElement('div');
    overlay.id = 'goals-celebration-overlay';
    overlay.innerHTML = `
        <style>
            #goals-celebration-overlay {
                position: fixed; inset: 0; z-index: 9999;
                display: flex; align-items: center; justify-content: center;
                background: rgba(0,0,0,0.75);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                animation: goalsFadeIn 0.4s ease forwards;
                padding: 20px;
            }
            @keyframes goalsFadeIn { from { opacity:0; } to { opacity:1; } }
            @keyframes goalsPop {
                0%   { transform: scale(0.6) translateY(40px); opacity:0; }
                70%  { transform: scale(1.04) translateY(-4px); }
                100% { transform: scale(1) translateY(0); opacity:1; }
            }
            @keyframes confettiFall {
                0%   { transform: translateY(-20px) rotate(0deg); opacity:1; }
                100% { transform: translateY(110vh) rotate(720deg); opacity:0; }
            }
            @keyframes shimmer {
                0%,100% { opacity:0.7; }
                50%      { opacity:1; }
            }
            .goals-celebration-card {
                background: linear-gradient(135deg, rgba(20,20,35,0.98), rgba(30,20,50,0.98));
                border: 1px solid rgba(168,85,247,0.5);
                border-radius: 24px;
                padding: 40px 36px;
                max-width: 520px;
                width: 100%;
                text-align: center;
                box-shadow: 0 0 60px rgba(168,85,247,0.3), 0 0 120px rgba(168,85,247,0.1);
                animation: goalsPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
                position: relative;
                overflow: hidden;
            }
            .goals-celebration-card::before {
                content:'';
                position:absolute;inset:0;
                background: linear-gradient(135deg, rgba(168,85,247,0.07), transparent 60%);
                pointer-events:none;
            }
            .goals-confetti-piece {
                position: fixed;
                width: 10px; height: 10px;
                border-radius: 2px;
                animation: confettiFall linear forwards;
                pointer-events: none;
            }
            .goals-meta-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(168,85,247,0.12);
                border: 1px solid rgba(168,85,247,0.3);
                border-radius: 12px;
                padding: 10px 16px;
                margin: 6px 4px;
                font-size: 14px;
                transition: all 0.2s;
            }
            .goals-close-btn {
                background: linear-gradient(135deg, #a855f7, #7c3aed);
                border: none;
                color: white;
                padding: 14px 40px;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 700;
                cursor: pointer;
                margin-top: 28px;
                letter-spacing: 1px;
                transition: all 0.3s;
                text-transform: uppercase;
            }
            .goals-close-btn:hover {
                box-shadow: 0 0 30px rgba(168,85,247,0.5);
                transform: translateY(-2px);
            }
            .goals-trophy-ring {
                width: 100px; height: 100px;
                margin: 0 auto 20px;
                border-radius: 50%;
                background: linear-gradient(135deg, #a855f7, #fbbf24);
                display: flex; align-items: center; justify-content: center;
                font-size: 48px;
                box-shadow: 0 0 40px rgba(168,85,247,0.6), 0 0 80px rgba(251,191,36,0.2);
                animation: shimmer 2s ease infinite;
            }
        </style>

        <!-- Confetti -->
        <div id="goals-confetti-container"></div>

        <div class="goals-celebration-card">
            <div class="goals-trophy-ring">🏆</div>
            <h2 style="font-size:28px;font-weight:800;margin-bottom:8px;
                background:linear-gradient(135deg,#fbbf24,#a855f7,#22c55e);
                -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
                Parabéns! 🎉
            </h2>
            <p style="color:rgba(255,255,255,0.6);font-size:15px;margin-bottom:24px;line-height:1.5;">
                Você bateu ${achievedGoals.length === 1 ? 'uma meta' : achievedGoals.length + ' metas'}!<br>
                Seu esforço está valendo cada centavo. Continue assim! 🚀
            </p>

            <div style="margin-bottom:8px;">
                ${achievedGoals.map(g => `
                    <div class="goals-meta-badge">
                        <span style="font-size:20px;">${g.icon}</span>
                        <div style="text-align:left;">
                            <div style="font-weight:700;color:#fff;font-size:13px;">${g.label}</div>
                            <div style="font-size:11px;color:rgba(255,255,255,0.45);">
                                Meta: ${formatGoalValue(g.meta, g.unit)} · Atual: ${formatGoalValue(g.atual, g.unit)}
                            </div>
                        </div>
                        <span style="color:#22c55e;font-size:18px;">✓</span>
                    </div>
                `).join('')}
            </div>

            <button class="goals-close-btn" onclick="closeGoalCelebration()">
                Arrasou! 💎
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Gerar confetti
    spawnConfetti();

    // Fechar ao clicar fora do card
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeGoalCelebration();
    });
}

function closeGoalCelebration() {
    const el = document.getElementById('goals-celebration-overlay');
    if (el) {
        el.style.animation = 'goalsFadeIn 0.3s ease reverse forwards';
        setTimeout(() => el.remove(), 300);
    }
}

function spawnConfetti() {
    const colors = ['#a855f7','#fbbf24','#22c55e','#3b82f6','#f97316','#ec4899','#c084fc'];
    const container = document.getElementById('goals-confetti-container');
    if (!container) return;

    for (let i = 0; i < 80; i++) {
        const piece = document.createElement('div');
        piece.className = 'goals-confetti-piece';
        piece.style.left       = Math.random() * 100 + 'vw';
        piece.style.top        = '-20px';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration  = (1.5 + Math.random() * 2.5) + 's';
        piece.style.animationDelay     = (Math.random() * 1.2) + 's';
        piece.style.width  = (8 + Math.random() * 8) + 'px';
        piece.style.height = (8 + Math.random() * 8) + 'px';
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        piece.style.opacity = '0';
        container.appendChild(piece);

        // Força animação a iniciar
        setTimeout(() => { piece.style.opacity = '1'; }, 10);
    }

    // Limpar confetti após 5s
    setTimeout(() => {
        if (container) container.innerHTML = '';
    }, 5000);
}

// =====================================================
// ABRIR MODAL DE METAS
// =====================================================
function openGoalsModal() {
    const existing = document.getElementById('goals-modal-overlay');
    if (existing) { existing.remove(); }

    const overlay = document.createElement('div');
    overlay.id = 'goals-modal-overlay';

    // Formatar valores salvos nos campos
    function fv(key, unit) {
        const v = currentGoals && currentGoals[key];
        if (v === null || v === undefined) return '';
        return unit === 'percent' ? v : v;
    }

    overlay.innerHTML = `
        <style>
            #goals-modal-overlay {
                position: fixed; inset: 0; z-index: 8000;
                display: flex; align-items: center; justify-content: center;
                background: rgba(0,0,0,0.7);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                padding: 20px;
                animation: goalsFadeIn2 0.3s ease forwards;
            }
            @keyframes goalsFadeIn2 { from{opacity:0;} to{opacity:1;} }
            @keyframes goalsPop2 {
                0%  { transform:scale(0.85) translateY(20px); opacity:0; }
                100%{ transform:scale(1) translateY(0);       opacity:1; }
            }
            .goals-modal {
                background: linear-gradient(135deg, rgba(18,18,28,0.99), rgba(25,16,40,0.99));
                border: 1px solid rgba(168,85,247,0.35);
                border-radius: 20px;
                padding: 32px 28px;
                max-width: 600px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 0 60px rgba(168,85,247,0.2);
                animation: goalsPop2 0.4s cubic-bezier(0.34,1.2,0.64,1) forwards;
            }
            .goals-modal::-webkit-scrollbar { width:6px; }
            .goals-modal::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
            .goals-modal::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.4); border-radius:3px; }
            .goals-modal h2 {
                font-size:22px; font-weight:800; margin-bottom:6px;
                background:linear-gradient(135deg,#a855f7,#c084fc);
                -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
            }
            .goals-modal .subtitle {
                color:rgba(255,255,255,0.4); font-size:13px; margin-bottom:28px; line-height:1.5;
            }
            .goal-field {
                display: flex; flex-direction: column; gap: 6px;
                margin-bottom: 18px;
            }
            .goal-field label {
                display:flex; align-items:center; gap:8px;
                font-size:14px; font-weight:600; color:rgba(255,255,255,0.85);
            }
            .goal-field .goal-desc {
                font-size:12px; color:rgba(255,255,255,0.35); margin-left:28px;
            }
            .goal-field input {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(168,85,247,0.25);
                border-radius: 10px;
                padding: 12px 16px;
                color: #fff;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s, box-shadow 0.2s;
                width: 100%;
            }
            .goal-field input:focus {
                border-color: rgba(168,85,247,0.6);
                box-shadow: 0 0 0 3px rgba(168,85,247,0.12);
            }
            .goal-field input::placeholder { color:rgba(255,255,255,0.2); }
            .goals-divider {
                border: none; border-top: 1px solid rgba(168,85,247,0.12); margin: 22px 0;
            }
            .goals-actions {
                display:flex; gap:12px; justify-content:flex-end; margin-top:24px; flex-wrap:wrap;
            }
            .goals-cancel-btn {
                background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
                color:rgba(255,255,255,0.6); padding:12px 24px; border-radius:10px;
                font-size:14px; cursor:pointer; transition:all 0.2s;
            }
            .goals-cancel-btn:hover { background:rgba(255,255,255,0.12); color:#fff; }
            .goals-save-btn {
                background: linear-gradient(135deg,#a855f7,#7c3aed);
                border:none; color:#fff; padding:12px 32px; border-radius:10px;
                font-size:14px; font-weight:700; cursor:pointer; transition:all 0.3s;
                text-transform:uppercase; letter-spacing:1px;
            }
            .goals-save-btn:hover { box-shadow:0 0 24px rgba(168,85,247,0.5); transform:translateY(-1px); }
            .goals-save-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
            .goals-progress-section { margin-top:8px; }
            .goals-progress-row {
                display:flex; align-items:center; justify-content:space-between;
                padding:10px 14px; border-radius:10px; margin-bottom:8px;
                background:rgba(255,255,255,0.03); gap:12px;
            }
            .goals-progress-bar-wrap {
                flex:1; height:6px; background:rgba(255,255,255,0.07); border-radius:3px; overflow:hidden;
            }
            .goals-progress-bar-fill {
                height:100%; border-radius:3px; transition:width 0.8s ease;
            }
            .goals-badge-none {
                text-align:center; padding:20px; color:rgba(255,255,255,0.25); font-size:13px;
            }
        </style>

        <div class="goals-modal">
            <h2>🎯 Minhas Metas</h2>
            <p class="subtitle">
                Defina suas metas financeiras (todos os campos são opcionais).<br>
                Você será notificado quando atingir cada uma! 🚀
            </p>

            <!-- Progresso atual -->
            <div id="goals-progress-wrap"></div>
            <hr class="goals-divider">

            <!-- Formulário -->
            <form id="goals-form" autocomplete="off">
                ${GOAL_DEFINITIONS.map(def => `
                    <div class="goal-field">
                        <label>
                            <span style="font-size:20px;">${def.icon}</span>
                            ${def.label}
                            ${def.unit === 'percent' ? '<span style="font-size:11px;color:rgba(255,255,255,0.3);margin-left:4px;">(%)</span>' : ''}
                        </label>
                        <span class="goal-desc">${def.desc}</span>
                        <input
                            type="number"
                            id="goal-input-${def.key}"
                            name="${def.key}"
                            min="0"
                            step="${def.unit === 'percent' ? '0.01' : '0.01'}"
                            placeholder="${def.unit === 'percent' ? 'Ex: 5.5' : 'Ex: 1000.00'}"
                            value="${fv(def.key, def.unit)}"
                        >
                    </div>
                `).join('')}

                <div class="goals-actions">
                    <button type="button" class="goals-cancel-btn" onclick="closeGoalsModal()">Cancelar</button>
                    <button type="button" class="goals-save-btn" id="goals-save-btn" onclick="handleSaveGoals()">
                        💾 Salvar Metas
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    // Fechar ao clicar fora
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeGoalsModal();
    });

    // Renderizar progresso atual
    renderGoalsProgress();
}

function closeGoalsModal() {
    const el = document.getElementById('goals-modal-overlay');
    if (el) {
        el.style.animation = 'goalsFadeIn2 0.25s ease reverse forwards';
        setTimeout(() => el.remove(), 250);
    }
}

// =====================================================
// RENDERIZAR BARRA DE PROGRESSO
// =====================================================
function renderGoalsProgress() {
    const wrap = document.getElementById('goals-progress-wrap');
    if (!wrap || !currentGoals) {
        if (wrap) wrap.innerHTML = '<p class="goals-badge-none">Nenhuma meta definida ainda — configure abaixo!</p>';
        return;
    }

    // Coletar valores atuais do dashboard
    const cv = getCurrentDashboardValues();
    const valueMap = {
        goal_lucro_mensal:       cv.lucroMensal,
        goal_lucro_semanal:      cv.lucroSemanal,
        goal_valor_pools:        cv.valorPools,
        goal_patrimonio_total:   cv.patrimonioTotal,
        goal_rendimento_pct:     cv.rendimentoPct,
        goal_patrimonio_liquido: cv.patrimonioLiquido
    };

    const rows = GOAL_DEFINITIONS
        .filter(def => currentGoals[def.key] !== null && currentGoals[def.key] !== undefined && currentGoals[def.key] > 0)
        .map(def => {
            const meta  = currentGoals[def.key];
            const atual = valueMap[def.key];
            const hasCurrent = atual !== null && atual !== undefined && !isNaN(atual);
            const pct   = hasCurrent ? Math.min(100, Math.round((atual / meta) * 100)) : null;
            const done  = pct !== null && pct >= 100;
            const barColor = done ? '#22c55e' : def.color;

            return `
                <div class="goals-progress-row">
                    <span style="font-size:18px;min-width:22px;">${def.icon}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                            <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${def.label}</span>
                            <span style="font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap;margin-left:8px;">
                                ${hasCurrent ? formatGoalValue(atual, def.unit) : '—'} / ${formatGoalValue(meta, def.unit)}
                            </span>
                        </div>
                        ${def.key !== 'goal_aporte_mensal' ? `
                        <div class="goals-progress-bar-wrap">
                            <div class="goals-progress-bar-fill"
                                style="width:${pct ?? 0}%;background:${barColor};
                                ${done ? 'box-shadow:0 0 8px '+barColor+'88;' : ''}">
                            </div>
                        </div>
                        ` : '<div style="font-size:11px;color:rgba(255,255,255,0.25);">Controle manual</div>'}
                    </div>
                    ${done ? '<span style="color:#22c55e;font-size:18px;min-width:20px;">✓</span>' :
                              pct !== null ? '<span style="font-size:11px;color:rgba(255,255,255,0.35);min-width:30px;text-align:right;">'+pct+'%</span>' :
                              '<span style="font-size:11px;color:rgba(255,255,255,0.2);min-width:30px;text-align:right;">N/A</span>'}
                </div>
            `;
        });

    if (!rows.length) {
        wrap.innerHTML = '<p class="goals-badge-none">Nenhuma meta definida ainda — configure abaixo!</p>';
        return;
    }

    wrap.innerHTML = `
        <h4 style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;">
            📊 Progresso Atual
        </h4>
        <div class="goals-progress-section">${rows.join('')}</div>
    `;
}

// =====================================================
// SALVAR VIA FORMULÁRIO
// =====================================================
async function handleSaveGoals() {
    const btn = document.getElementById('goals-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    const goalsData = {};
    GOAL_DEFINITIONS.forEach(def => {
        const input = document.getElementById('goal-input-' + def.key);
        goalsData[def.key] = input ? input.value : '';
    });

    const ok = await saveGoals(goalsData);

    if (btn) { btn.disabled = false; btn.innerHTML = '💾 Salvar Metas'; }

    if (ok) {
        closeGoalsModal();
        showGoalsToast('✅ Metas salvas com sucesso!', 'success');
        // Verificar conquistas com os novos valores
        await checkAndCelebrate();
    } else {
        showGoalsToast('❌ Erro ao salvar. Verifique o console.', 'error');
    }
}

// =====================================================
// VERIFICAR E CELEBRAR
// =====================================================
async function checkAndCelebrate() {
    const cv       = getCurrentDashboardValues();
    const achieved = checkGoalsAchieved(cv);
    if (achieved.length > 0) {
        // Pequeno delay para UX
        setTimeout(() => showGoalCelebration(achieved), 400);
    }
}

// =====================================================
// PEGAR VALORES ATUAIS DO DASHBOARD
// =====================================================
function getCurrentDashboardValues() {
    function gv(id) {
        const el = document.getElementById(id);
        return el ? parseFloat(el.dataset.value || 0) : 0;
    }

    // Lucro da semana/mês: extrair da tabela de pools se disponível
    let lucroSemanal = 0;
    let lucroMensal  = 0;
    let capitalTotal = 0;

    // Tentar pegar de userPoolData (variável global do dashboard.js)
    if (typeof userPoolData !== 'undefined' && userPoolData.length) {
        // Mês mais recente
        const latestM = typeof getLatestMonth === 'function' ? getLatestMonth() : null;
        if (latestM) {
            // Lucro mensal: soma de todo profit_value do mês
            userPoolData
                .filter(p => p.month === latestM)
                .forEach(p => {
                    const pr = parseFloat(p.profit_value || 0);
                    lucroMensal += pr;

                    // Capital
                    const ini = parseFloat(p.initial_value || p.invested_value || 0);
                    const con = parseFloat(p.contribution_value || 0);
                    capitalTotal += ini + con;
                });

            // Lucro semanal: semana mais recente
            const latestW = typeof getLatestWeekForMonth === 'function' ? getLatestWeekForMonth(latestM) : null;
            if (latestW) {
                userPoolData
                    .filter(p => p.month === latestM && p.week === latestW)
                    .forEach(p => { lucroSemanal += parseFloat(p.profit_value || 0); });
            }
        }
    }

    const valorPools        = gv('pools-balance');
    const aaveWeth          = gv('aave-balance');
    const patrimonioTotal   = gv('total-pagando');
    const patrimonioLiquido = gv('total-sem-pagar');

    // Rendimento % = lucroMensal / capitalTotal * 100
    const rendimentoPct = capitalTotal > 0 ? (lucroMensal / capitalTotal) * 100 : 0;

    return {
        valorPools,
        aaveWeth,
        patrimonioTotal,
        patrimonioLiquido,
        lucroMensal,
        lucroSemanal,
        rendimentoPct
    };
}

// =====================================================
// TOAST SIMPLES PARA METAS
// =====================================================
function showGoalsToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.style.cssText = 'display:flex;align-items:center;gap:10px;';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// =====================================================
// FORMATAR VALOR DA META
// =====================================================
function formatGoalValue(value, unit) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    if (unit === 'percent') {
        return parseFloat(value).toFixed(2) + '%';
    }
    const cur = localStorage.getItem('silt_currency') || 'USD';
    const sym = cur === 'BRL' ? 'R$' : '$';
    const rate = typeof dashExchangeRate !== 'undefined' ? dashExchangeRate : 5.0;
    const val  = cur === 'BRL' ? value * rate : value;
    return sym + val.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

// =====================================================
// BOTÃO FLUTUANTE DE METAS (adiciona ao DOM)
// =====================================================
function injectGoalsButton() {
    // Evitar duplicatas
    if (document.getElementById('goals-fab')) return;

    const fab = document.createElement('button');
    fab.id = 'goals-fab';
    fab.innerHTML = '🎯 Metas';
    fab.title = 'Ver e definir suas metas';
    fab.style.cssText = `
        position: fixed;
        bottom: 32px;
        right: 32px;
        z-index: 1000;
        background: linear-gradient(135deg, #a855f7, #7c3aed);
        color: white;
        border: none;
        padding: 14px 22px;
        border-radius: 50px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 24px rgba(168,85,247,0.45), 0 0 0 0 rgba(168,85,247,0.4);
        transition: all 0.3s;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 6px;
        animation: goalsFabPulse 3s ease infinite;
    `;
    fab.onclick = openGoalsModal;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes goalsFabPulse {
            0%,100% { box-shadow:0 4px 24px rgba(168,85,247,0.45),0 0 0 0 rgba(168,85,247,0.35); }
            50%      { box-shadow:0 4px 32px rgba(168,85,247,0.65),0 0 0 8px rgba(168,85,247,0); }
        }
        #goals-fab:hover {
            transform: translateY(-3px) scale(1.05) !important;
            box-shadow: 0 8px 32px rgba(168,85,247,0.6) !important;
        }
        #goals-fab:active { transform: translateY(0) scale(0.98) !important; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(fab);
}

// =====================================================
// ENTRY POINT — chamado pelo dashboard.js após carregar dados
// =====================================================
async function initGoalsSystem(userId) {
    await initGoals(userId);
    injectGoalsButton();
    // Verificar conquistas ao entrar na página
    await checkAndCelebrate();
}

// Expor globalmente
window.SILTGoals = {
    initGoalsSystem,
    openGoalsModal,
    closeGoalsModal,
    checkAndCelebrate,
    getCurrentDashboardValues
};
