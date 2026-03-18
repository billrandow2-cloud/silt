// S.I.L.T. System - Admin Script

const SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let allUsers    = [];

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseAdmin.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    currentUser = session.user;

    const { data: ud } = await supabaseAdmin.from('users').select('username').eq('id', currentUser.id).single();
    const username = ud?.username || currentUser.email.split('@')[0];

    const { data: pd, error: pe } = await supabaseAdmin.from('permissions').select('role').eq('username', username).single();
    if (pe || !pd || pd.role !== 'admin') {
        showToast('Acesso negado.', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 2000);
        return;
    }
    document.getElementById('admin-avatar').textContent = username.charAt(0).toUpperCase();
    await loadUsers();
    await loadRankingAdmin();
});

// =====================================================
// USUÁRIOS
// =====================================================
async function loadUsers() {
    showLoading(true);
    const { data: users, error } = await supabaseAdmin.from('users').select('*, permissions(role)').order('created_at', { ascending: false });
    if (error) { showToast('Erro: ' + error.message, 'error'); showLoading(false); return; }
    allUsers = users || [];
    renderUsersTable(); populateUserSelects(); showLoading(false);
}

function renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';
    if (!allUsers.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">Nenhum usuário</td></tr>'; return; }
    allUsers.forEach(user => {
        const role = user.permissions?.[0]?.role || 'user';
        const row  = document.createElement('tr');
        row.innerHTML = `<td>${user.username}</td><td>${user.email}</td>
            <td><span style="padding:4px 12px;border-radius:20px;font-size:12px;background:${role==='admin'?'rgba(239,68,68,0.2)':'rgba(168,85,247,0.2)'};color:${role==='admin'?'#ef4444':'#a855f7'};">${role==='admin'?'Admin':'Usuário'}</span></td>
            <td>${new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
            <td class="actions">
                <button class="edit"   onclick="openEditUser('${user.id}','${user.username}','${user.email}','${role}')">✏️</button>
                <button class="delete" onclick="deleteUser('${user.id}','${user.username}')">🗑️</button>
            </td>`;
        tbody.appendChild(row);
    });
}

function populateUserSelects() {
    ['pool-user','aave-user','pool-user-filter','aave-user-filter'].forEach(id => {
        const sel = document.getElementById(id); if (!sel) return;
        const first = sel.options[0]; sel.innerHTML = ''; sel.appendChild(first);
        allUsers.forEach(u => { const o = document.createElement('option'); o.value = u.id; o.textContent = u.username; sel.appendChild(o); });
    });
}

document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const email    = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    const role     = document.getElementById('new-role').value;
    showLoading(true);
    const { data: authData, error: ae } = await supabaseAdmin.auth.signUp({ email, password, options: { data: { username } } });
    if (ae) { showToast('Erro: '+ae.message,'error'); showLoading(false); return; }
    const { error: ue } = await supabaseAdmin.from('users').insert([{ id: authData.user.id, username, email }]);
    if (ue) { showToast('Erro: '+ue.message,'error'); showLoading(false); return; }
    const { error: pe } = await supabaseAdmin.from('permissions').insert([{ username, role }]);
    if (pe) { showToast('Erro: '+pe.message,'error'); showLoading(false); return; }
    showToast(`"${username}" criado!`,'success'); closeModal('create-user-modal'); await loadUsers(); showLoading(false);
});

function openEditUser(userId, username, email, role) {
    document.getElementById('edit-user-id').value  = userId;
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-email').value    = email;
    document.getElementById('edit-role').value     = role;
    openModal('edit-user-modal');
}

document.getElementById('edit-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('edit-username').value;
    const newRole  = document.getElementById('edit-role').value;
    showLoading(true);
    const { error } = await supabaseAdmin.from('permissions').update({ role: newRole }).eq('username', username);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Atualizado!','success'); closeModal('edit-user-modal'); await loadUsers(); showLoading(false);
});

async function deleteUser(userId, username) {
    if (!confirm(`Excluir "${username}"?`)) return;
    showLoading(true);
    await supabaseAdmin.from('permissions').delete().eq('username', username);
    await supabaseAdmin.from('pool_data').delete().eq('user_id', userId);
    await supabaseAdmin.from('aave_data').delete().eq('user_id', userId);
    await supabaseAdmin.from('users').delete().eq('id', userId);
    showToast('Excluído!','success'); await loadUsers(); showLoading(false);
}

// =====================================================
// POOLS
// =====================================================
async function loadUserPools() {
    const userId = document.getElementById('pool-user-filter').value;
    const tbody  = document.getElementById('pools-table-body');
    showLoading(true);
    let query = supabaseAdmin.from('pool_data').select('*, users(username)').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data: pools, error } = await query;
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    tbody.innerHTML = '';
    if (!pools?.length) { tbody.innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--text-secondary);">Nenhum dado</td></tr>'; showLoading(false); return; }
    pools.forEach(pool => {
        const initial  = parseFloat(pool.initial_value ?? pool.invested_value ?? 0);
        const yieldPct = parseFloat(pool.yield_percent ?? 0);
        const contrib  = parseFloat(pool.contribution_value ?? 0);
        const profit   = parseFloat(pool.profit_value ?? 0);
        const current  = parseFloat(pool.current_value ?? 0);
        const diff     = current>0 ? current-initial : profit;
        const tag      = current>0 ? `<span style="color:${diff>=0?'#22c55e':'#ef4444'};font-size:11px;">${diff>=0?'▲':'▼'}$${Math.abs(diff).toFixed(2)}</span>` : '';
        const row = document.createElement('tr');
        row.innerHTML = `<td>${pool.users?.username||'-'}</td><td>${pool.month}</td><td>${pool.week}</td><td>${pool.pool_name}</td>
            <td>$${initial.toFixed(2)}</td><td>${yieldPct>0?yieldPct.toFixed(2)+'%':'-'}</td>
            <td>${contrib>0?'$'+contrib.toFixed(2):'-'}</td>
            <td style="color:var(--success);">+$${profit.toFixed(2)}</td>
            <td>${current>0?'$'+current.toFixed(2)+' '+tag:'-'}</td>
            <td class="actions">
                <button class="edit"   onclick="openEditPool('${pool.id}','${pool.month}','${pool.week}','${pool.pool_name}',${initial},${yieldPct},${contrib},${profit},${current})">✏️</button>
                <button class="delete" onclick="deletePool('${pool.id}')">🗑️</button>
            </td>`;
        tbody.appendChild(row);
    });
    showLoading(false);
}

document.getElementById('add-pool-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const initial  = parseFloat(document.getElementById('pool-initial').value)      || 0;
    const yieldPct = parseFloat(document.getElementById('pool-yield').value)        || 0;
    const contrib  = parseFloat(document.getElementById('pool-contribution').value) || 0;
    const profit   = parseFloat(document.getElementById('pool-profit').value)       || 0;
    const current  = parseFloat(document.getElementById('pool-current').value)      || 0;
    showLoading(true);
    const { error } = await supabaseAdmin.from('pool_data').insert([{
        user_id: document.getElementById('pool-user').value,
        month: document.getElementById('pool-month').value,
        week:  document.getElementById('pool-week').value,
        pool_name: document.getElementById('pool-name').value,
        initial_value: initial, yield_percent: yieldPct,
        contribution_value: contrib, profit_value: profit,
        current_value: current, invested_value: initial+contrib
    }]);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Pool adicionada!','success'); closeModal('add-pool-modal'); await loadUserPools(); showLoading(false);
});

function openEditPool(id,month,week,name,initial,yieldPct,contrib,profit,current) {
    document.getElementById('edit-pool-id').value           = id;
    document.getElementById('edit-pool-month').value        = month;
    document.getElementById('edit-pool-week').value         = week;
    document.getElementById('edit-pool-name').value         = name;
    document.getElementById('edit-pool-initial').value      = initial;
    document.getElementById('edit-pool-yield').value        = yieldPct;
    document.getElementById('edit-pool-contribution').value = contrib;
    document.getElementById('edit-pool-profit').value       = profit;
    document.getElementById('edit-pool-current').value      = current;
    openModal('edit-pool-modal');
}

document.getElementById('edit-pool-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const initial  = parseFloat(document.getElementById('edit-pool-initial').value)      || 0;
    const yieldPct = parseFloat(document.getElementById('edit-pool-yield').value)        || 0;
    const contrib  = parseFloat(document.getElementById('edit-pool-contribution').value) || 0;
    const profit   = parseFloat(document.getElementById('edit-pool-profit').value)       || 0;
    const current  = parseFloat(document.getElementById('edit-pool-current').value)      || 0;
    showLoading(true);
    const { error } = await supabaseAdmin.from('pool_data').update({
        month: document.getElementById('edit-pool-month').value,
        week:  document.getElementById('edit-pool-week').value,
        pool_name: document.getElementById('edit-pool-name').value,
        initial_value: initial, yield_percent: yieldPct,
        contribution_value: contrib, profit_value: profit,
        current_value: current, invested_value: initial+contrib
    }).eq('id', document.getElementById('edit-pool-id').value);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Atualizado!','success'); closeModal('edit-pool-modal'); await loadUserPools(); showLoading(false);
});

async function deletePool(poolId) {
    if (!confirm('Excluir esta pool?')) return;
    showLoading(true);
    const { error } = await supabaseAdmin.from('pool_data').delete().eq('id', poolId);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Excluída!','success'); await loadUserPools(); showLoading(false);
}

// =====================================================
// AAVE
// =====================================================
async function loadUserAave() {
    const userId  = document.getElementById('aave-user-filter').value;
    const display = document.getElementById('aave-data-display');
    const noData  = document.getElementById('aave-no-data');
    if (!userId) { display.style.display='none'; if(noData) noData.style.display='none'; return; }
    showLoading(true);
    const { data, error } = await supabaseAdmin.from('aave_data').select('*').eq('user_id', userId)
        .order('updated_at', { ascending: false }).limit(1).single();
    showLoading(false);
    if (error || !data) { display.style.display='none'; if(noData) noData.style.display='block'; return; }
    display.style.display='block'; if(noData) noData.style.display='none';
    const f = v => '$'+(parseFloat(v)||0).toLocaleString('en-US',{minimumFractionDigits:2});
    const bal = parseFloat(data.aave_balance)||0, bor = parseFloat(data.borrow_value)||0;
    document.getElementById('admin-aave-balance').textContent  = f(bal);
    document.getElementById('admin-borrow-value').textContent  = f(bor);
    document.getElementById('admin-net-value').textContent     = f(bal-bor);
    document.getElementById('admin-weth-value').textContent    = f(data.weth_value);
    document.getElementById('admin-usdto-value').textContent   = f(data.usdto_value);
    document.getElementById('admin-loan-reduction').textContent= f(data.loan_reduction);
    document.getElementById('aave-last-updated').textContent   = new Date(data.updated_at).toLocaleString('pt-BR');
}

document.getElementById('add-aave-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId  = document.getElementById('aave-user').value;
    const month   = document.getElementById('aave-month').value;
    const weth    = parseFloat(document.getElementById('aave-weth').value)          || 0;
    const usdto   = parseFloat(document.getElementById('aave-usdto').value)         || 0;
    const loanRed = parseFloat(document.getElementById('aave-loan-reduction').value)|| 0;
    const borrow  = parseFloat(document.getElementById('aave-borrow-input').value)  || 0;
    const balance = weth + loanRed;
    showLoading(true);
    const { data: ex } = await supabaseAdmin.from('aave_data').select('id').eq('user_id', userId).eq('month', month).limit(1).single();
    const payload = { aave_balance: balance, borrow_value: borrow, weth_value: weth, usdto_value: usdto, loan_reduction: loanRed, month, updated_at: new Date().toISOString() };
    const result = ex
        ? await supabaseAdmin.from('aave_data').update(payload).eq('user_id', userId).eq('month', month)
        : await supabaseAdmin.from('aave_data').insert([{ user_id: userId, ...payload }]);
    if (result.error) { showToast('Erro: '+result.error.message,'error'); showLoading(false); return; }
    showToast('AAVE salvo!','success'); closeModal('add-aave-modal');
    if (document.getElementById('aave-user-filter').value === userId) await loadUserAave();
    showLoading(false);
});

// =====================================================
// RANKING — por semana, lançado manualmente
// =====================================================
async function loadRankingAdmin() {
    const monthFilter = document.getElementById('ranking-month-filter')?.value;
    const weekFilter  = document.getElementById('ranking-week-filter')?.value;
    const tbody = document.getElementById('ranking-table-body');
    showLoading(true);

    let query = supabaseAdmin.from('rankings').select('*')
        .order('month').order('week').order('value', { ascending: false });
    if (monthFilter) query = query.eq('month', monthFilter);
    if (weekFilter)  query = query.eq('week',  weekFilter);

    const { data, error } = await query;
    showLoading(false);

    if (error) { showToast('Erro: '+error.message,'error'); return; }
    tbody.innerHTML = '';
    if (!data?.length) { tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">Nenhum dado de ranking</td></tr>'; return; }

    // Identificar líder por semana
    const leaders = {};
    data.forEach(r => {
        const key = r.month+'||'+r.week;
        if (!leaders[key] || r.value > leaders[key]) leaders[key] = r.value;
    });

    data.forEach(r => {
        const key      = r.month+'||'+r.week;
        const isLeader = r.value === leaders[key];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${r.month}</td>
            <td>${r.week}</td>
            <td style="font-weight:${isLeader?700:400};color:${isLeader?'#fbbf24':'inherit'};">
                ${isLeader?'🏆 ':''}${r.username}
            </td>
            <td>$${parseFloat(r.value).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
            <td class="actions">
                <button class="edit"   onclick="openEditRanking('${r.id}','${r.month}','${r.week}','${r.username}',${r.value})">✏️</button>
                <button class="delete" onclick="deleteRanking('${r.id}')">🗑️</button>
            </td>`;
        tbody.appendChild(row);
    });
}

document.getElementById('add-ranking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const month    = document.getElementById('ranking-month').value;
    const week     = document.getElementById('ranking-week').value;
    const username = document.getElementById('ranking-username').value.trim();
    const value    = parseFloat(document.getElementById('ranking-value').value) || 0;

    showLoading(true);
    // Se já existe esse membro nessa semana+mês, atualiza
    const { data: existing } = await supabaseAdmin.from('rankings')
        .select('id').eq('month', month).eq('week', week).eq('username', username).limit(1).single();

    const result = existing
        ? await supabaseAdmin.from('rankings').update({ value }).eq('id', existing.id)
        : await supabaseAdmin.from('rankings').insert([{ month, week, username, value }]);

    if (result.error) { showToast('Erro: '+result.error.message,'error'); showLoading(false); return; }
    showToast(`"${username}" lançado em ${week}!`,'success');
    closeModal('add-ranking-modal'); await loadRankingAdmin(); showLoading(false);
});

function openEditRanking(id, month, week, username, value) {
    document.getElementById('edit-ranking-id').value       = id;
    document.getElementById('edit-ranking-month').value    = month;
    document.getElementById('edit-ranking-week').value     = week;
    document.getElementById('edit-ranking-username').value = username;
    document.getElementById('edit-ranking-value').value    = value;
    openModal('edit-ranking-modal');
}

document.getElementById('edit-ranking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id    = document.getElementById('edit-ranking-id').value;
    const value = parseFloat(document.getElementById('edit-ranking-value').value) || 0;
    showLoading(true);
    const { error } = await supabaseAdmin.from('rankings').update({ value }).eq('id', id);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Atualizado!','success'); closeModal('edit-ranking-modal'); await loadRankingAdmin(); showLoading(false);
});

async function deleteRanking(id) {
    if (!confirm('Remover este registro?')) return;
    showLoading(true);
    const { error } = await supabaseAdmin.from('rankings').delete().eq('id', id);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Removido!','success'); await loadRankingAdmin(); showLoading(false);
}

// =====================================================
// UTILITÁRIOS
// =====================================================
function showAdminSection(section) {
    document.querySelectorAll('.admin-menu button').forEach(b => b.classList.toggle('active', b.dataset.section === section));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.toggle('active', s.id === `admin-${section}`));
    if (section === 'ranking') loadRankingAdmin();
}
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); document.getElementById(id)?.querySelector('form')?.reset(); }
function showLoading(s) { document.getElementById('loading').style.display = s ? 'flex' : 'none'; }
function showToast(msg, type='info') {
    const c = document.querySelector('.toast-container');
    const t = document.createElement('div'); t.className=`toast ${type}`;
    t.innerHTML=`<span style="font-size:18px;">${{success:'✓',error:'✕',info:'ℹ'}[type]||'ℹ'}</span><span>${msg}</span>`;
    c.appendChild(t); setTimeout(()=>t.remove(),4000);
}
function logout() { supabaseAdmin.auth.signOut(); localStorage.clear(); window.location.href='login.html'; }
document.addEventListener('click', e=>{ if(e.target.classList.contains('modal-overlay')) e.target.classList.remove('active'); });