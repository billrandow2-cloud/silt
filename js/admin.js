// S.I.L.T. System - Admin Script

const SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let allUsers    = [];

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
    const { data: users, error: ue } = await supabaseAdmin
        .from('users').select('*').order('created_at', { ascending: false });
    if (ue) { showToast('Erro: ' + ue.message, 'error'); showLoading(false); return; }

    const { data: perms } = await supabaseAdmin.from('permissions').select('username, role');
    const permMap = {};
    (perms || []).forEach(p => { permMap[p.username] = p.role; });

    allUsers = (users || []).map(u => ({ ...u, role: permMap[u.username] || 'user' }));
    renderUsersTable();
    populateUserSelects();
    showLoading(false);
}

function renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';
    if (!allUsers.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">Nenhum usuário</td></tr>'; return; }
    allUsers.forEach(user => {
        const role    = user.role || 'user';
        const isAdmin = role === 'admin';
        const row     = document.createElement('tr');
        const share = user.profit_share !== undefined && user.profit_share !== null ? parseFloat(user.profit_share) : 50;
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td><span style="padding:4px 12px;border-radius:20px;font-size:12px;
                background:${isAdmin?'rgba(239,68,68,0.2)':'rgba(168,85,247,0.2)'};
                color:${isAdmin?'#ef4444':'#a855f7'};">
                ${isAdmin?'👑 Admin':'Usuário'}</span></td>
            <td><span style="font-weight:700;color:var(--neon-purple,#a855f7);">${share.toFixed(0)}%</span>
                <button onclick="openEditShare('${user.id}','${user.username}',${share})" style="background:none;border:none;cursor:pointer;font-size:12px;opacity:0.6;" title="Alterar %">✏️</button>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
            <td class="actions" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                <button class="edit" onclick="openEditUser('${user.id}','${user.username}','${user.email}','${role}')" title="Editar função">✏️</button>
                <button onclick="openEditCredentials('${user.id}','${user.username}','${user.email}')" title="Credenciais"
                    style="background:rgba(59,130,246,0.15);color:#3b82f6;border-radius:6px;padding:6px;border:none;cursor:pointer;font-size:14px;">🔑</button>
                <button onclick="viewUserDashboard('${user.id}','${user.username}')" title="Ver dashboard"
                    style="background:rgba(34,197,94,0.15);color:#22c55e;border-radius:6px;padding:6px;border:none;cursor:pointer;font-size:14px;">👁️</button>
                <button class="delete" onclick="deleteUser('${user.id}','${user.username}')" title="Excluir">🗑️</button>
            </td>`;
        tbody.appendChild(row);
    });
}

function populateUserSelects() {
    ['pool-user','aave-user','pool-user-filter','aave-user-filter','message-user','msg-user-filter'].forEach(id => {
        const sel = document.getElementById(id); if (!sel) return;
        const first = sel.options[0]; sel.innerHTML = ''; sel.appendChild(first);
        allUsers.forEach(u => { const o = document.createElement('option'); o.value = u.id; o.textContent = u.username; sel.appendChild(o); });
    });
}

document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn      = document.getElementById('create-user-btn');
    const username = document.getElementById('new-username').value.trim();
    const email    = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    const role     = document.getElementById('new-role').value;
    btn.disabled = true; showLoading(true);
    const { data: authData, error: ae } = await supabaseAdmin.auth.signUp({ email, password, options: { data: { username, role } } });
    if (ae) { showToast('Erro: ' + ae.message, 'error'); btn.disabled = false; showLoading(false); return; }
    await new Promise(r => setTimeout(r, 1500));
    await supabaseAdmin.from('users').upsert([{ id: authData.user.id, username, email }], { onConflict: 'id' });
    const { error: upe } = await supabaseAdmin.from('permissions').update({ role }).eq('username', username);
    if (upe) await supabaseAdmin.from('permissions').insert([{ username, role }]);
    showToast(`✅ "${username}" criado como ${role === 'admin' ? '👑 Admin' : 'Usuário'}!`, 'success');
    closeModal('create-user-modal'); await loadUsers(); btn.disabled = false; showLoading(false);
});

function openEditUser(userId, username, email, role) {
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-email').value = email;
    document.getElementById('edit-user-email-hidden').value = email;
    document.getElementById('edit-role').value = role;
    openModal('edit-user-modal');
}

document.getElementById('edit-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('edit-username').value;
    const newRole  = document.getElementById('edit-role').value;
    showLoading(true);
    const { error: ue } = await supabaseAdmin.from('permissions').update({ role: newRole }).eq('username', username);
    if (ue) await supabaseAdmin.from('permissions').insert([{ username, role: newRole }]);
    showToast(`"${username}" → ${newRole === 'admin' ? '👑 Admin' : 'Usuário'}!`, 'success');
    closeModal('edit-user-modal'); await loadUsers(); showLoading(false);
});

function openEditCredentials(userId, username, email) {
    document.getElementById('cred-user-id').value      = userId;
    document.getElementById('cred-user-email').value   = email;
    document.getElementById('cred-username-old').value = username;
    document.getElementById('cred-username-new').value = '';
    document.getElementById('cred-password').value     = '';
    openModal('edit-credentials-modal');
}

document.getElementById('edit-credentials-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId      = document.getElementById('cred-user-id').value;
    const oldUsername = document.getElementById('cred-username-old').value;
    const newUsername = document.getElementById('cred-username-new').value.trim();
    const newPassword = document.getElementById('cred-password').value;
    let changed = false; showLoading(true);
    if (newUsername && newUsername !== oldUsername) {
        const { data: exists } = await supabaseAdmin.from('users').select('id').eq('username', newUsername).single();
        if (exists) { showToast('Username já em uso.', 'error'); showLoading(false); return; }
        const { data: oldPerm } = await supabaseAdmin.from('permissions').select('role').eq('username', oldUsername).single();
        await supabaseAdmin.from('users').update({ username: newUsername }).eq('id', userId);
        if (oldPerm) {
            await supabaseAdmin.from('permissions').delete().eq('username', oldUsername);
            await supabaseAdmin.from('permissions').insert([{ username: newUsername, role: oldPerm.role }]);
        }
        showToast(`Username → "${newUsername}"`, 'success'); changed = true;
    }
    if (newPassword && newPassword.length >= 6) {
        const email = document.getElementById('cred-user-email').value;
        const { error: re } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/login.html' });
        showToast(re ? 'Erro ao enviar.' : '📧 Email de redefinição enviado!', re ? 'error' : 'info');
        changed = true;
    }
    if (!changed) showToast('Nenhuma alteração.', 'info');
    closeModal('edit-credentials-modal'); await loadUsers(); showLoading(false);
});

function viewUserDashboard(userId, username) {
    window.open(`dashboard.html?uid=${encodeURIComponent(userId)}&name=${encodeURIComponent(username)}`, '_blank');
}

async function deleteUser(userId, username) {
    if (!confirm(`Excluir "${username}"?`)) return;
    showLoading(true);
    await supabaseAdmin.from('permissions').delete().eq('username', username);
    await supabaseAdmin.from('pool_data').delete().eq('user_id', userId);
    await supabaseAdmin.from('aave_data').delete().eq('user_id', userId);
    await supabaseAdmin.from('users').delete().eq('id', userId);
    showToast('Excluído!', 'success'); await loadUsers(); showLoading(false);
}

// ─── EDITAR % DE LUCRO ───────────────────────────────
function openEditShare(userId, username, currentShare) {
    document.getElementById('share-user-id').value             = userId;
    document.getElementById('share-username-label').textContent = username;
    document.getElementById('share-percent').value             = currentShare;
    openModal('edit-share-modal');
}

document.getElementById('edit-share-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('share-user-id').value;
    const share  = Math.min(100, Math.max(0, parseFloat(document.getElementById('share-percent').value)||50));
    showLoading(true);
    const { error } = await supabaseAdmin.from('users').update({ profit_share: share }).eq('id', userId);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Porcentagem atualizada para '+share.toFixed(0)+'%!','success');
    closeModal('edit-share-modal'); await loadUsers(); showLoading(false);
});

// =====================================================
// POOLS
// =====================================================
async function loadUserPools() {
    const userId = document.getElementById('pool-user-filter').value;
    const month  = document.getElementById('pool-month-filter').value;
    const week   = document.getElementById('pool-week-filter').value;
    const tbody  = document.getElementById('pools-table-body');
    showLoading(true);
    let query = supabaseAdmin.from('pool_data').select('*, users(username)').order('month').order('week').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    if (month)  query = query.eq('month', month);
    if (week)   query = query.eq('week', week);
    const { data: pools, error } = await query;
    if (error) { showToast('Erro: ' + error.message, 'error'); showLoading(false); return; }
    tbody.innerHTML = '';
    if (!pools?.length) { tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-secondary);">Nenhum dado</td></tr>'; showLoading(false); return; }
    pools.forEach(pool => {
        const ini = parseFloat(pool.initial_value ?? pool.invested_value ?? 0);
        const y   = parseFloat(pool.yield_percent ?? 0);
        const c   = parseFloat(pool.contribution_value ?? 0);
        const p   = parseFloat(pool.profit_value ?? 0);
        const cu  = parseFloat(pool.current_value ?? 0);
        const d   = cu > 0 ? cu - ini : p;
        const tag = cu > 0 ? `<span style="color:${d>=0?'#22c55e':'#ef4444'};font-size:11px;">${d>=0?'▲':'▼'}$${Math.abs(d).toFixed(2)}</span>` : '';
        const row = document.createElement('tr');
        row.innerHTML = `<td>${pool.users?.username||'-'}</td><td>${pool.month}</td><td>${pool.week}</td><td>${pool.pool_name}</td><td>$${ini.toFixed(2)}</td><td>${y>0?y.toFixed(2)+'%':'-'}</td><td>${c>0?'$'+c.toFixed(2):'-'}</td><td style="color:var(--success);">+$${p.toFixed(2)}</td><td>${cu>0?'$'+cu.toFixed(2)+' '+tag:'-'}</td><td class="actions"><button onclick="copyPool('${pool.id}')" title="Copiar pool" style="background:rgba(59,130,246,0.15);color:#3b82f6;border-radius:6px;padding:6px;border:none;cursor:pointer;font-size:14px;">📋</button><button class="edit" onclick="openEditPool('${pool.id}','${pool.month}','${pool.week}','${pool.pool_name}',${ini},${y},${c},${p},${cu})">✏️</button><button class="delete" onclick="deletePool('${pool.id}')">🗑️</button></td>`;
        tbody.appendChild(row);
    });
    showLoading(false);
}

document.getElementById('add-pool-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const i=parseFloat(document.getElementById('pool-initial').value)||0, y=parseFloat(document.getElementById('pool-yield').value)||0;
    const c=parseFloat(document.getElementById('pool-contribution').value)||0, p=parseFloat(document.getElementById('pool-profit').value)||0, cu=parseFloat(document.getElementById('pool-current').value)||0;
    showLoading(true);
    const { error } = await supabaseAdmin.from('pool_data').insert([{ user_id:document.getElementById('pool-user').value, month:document.getElementById('pool-month').value, week:document.getElementById('pool-week').value, pool_name:document.getElementById('pool-name').value, initial_value:i, yield_percent:y, contribution_value:c, profit_value:p, current_value:cu, invested_value:i+c }]);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Pool adicionada!','success'); closeModal('add-pool-modal'); await loadUserPools(); showLoading(false);
});

function openEditPool(id,month,week,name,ini,y,c,p,cu) {
    document.getElementById('edit-pool-id').value=id; document.getElementById('edit-pool-month').value=month; document.getElementById('edit-pool-week').value=week; document.getElementById('edit-pool-name').value=name; document.getElementById('edit-pool-initial').value=ini; document.getElementById('edit-pool-yield').value=y; document.getElementById('edit-pool-contribution').value=c; document.getElementById('edit-pool-profit').value=p; document.getElementById('edit-pool-current').value=cu;
    openModal('edit-pool-modal');
}

document.getElementById('edit-pool-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const i=parseFloat(document.getElementById('edit-pool-initial').value)||0, y=parseFloat(document.getElementById('edit-pool-yield').value)||0;
    const c=parseFloat(document.getElementById('edit-pool-contribution').value)||0, p=parseFloat(document.getElementById('edit-pool-profit').value)||0, cu=parseFloat(document.getElementById('edit-pool-current').value)||0;
    showLoading(true);
    const { error } = await supabaseAdmin.from('pool_data').update({ month:document.getElementById('edit-pool-month').value, week:document.getElementById('edit-pool-week').value, pool_name:document.getElementById('edit-pool-name').value, initial_value:i, yield_percent:y, contribution_value:c, profit_value:p, current_value:cu, invested_value:i+c }).eq('id', document.getElementById('edit-pool-id').value);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Pool atualizada!','success'); closeModal('edit-pool-modal'); await loadUserPools(); showLoading(false);
});

async function deletePool(poolId) {
    if (!confirm('Excluir?')) return; showLoading(true);
    const { error } = await supabaseAdmin.from('pool_data').delete().eq('id', poolId);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Excluída!','success'); await loadUserPools(); showLoading(false);
}

// ─── COPIAR POOL ───────────────────────────────────────
async function copyPool(poolId) {
    showLoading(true);
    const { data: pool, error } = await supabaseAdmin.from('pool_data').select('*').eq('id', poolId).single();
    if (error || !pool) { showToast('Erro ao carregar pool.', 'error'); showLoading(false); return; }

    // Criar cópia com "(cópia)" no nome da pool
    const newPool = {
        user_id: pool.user_id,
        month: pool.month,
        week: pool.week,
        pool_name: pool.pool_name + ' (cópia)',
        initial_value: pool.initial_value,
        yield_percent: pool.yield_percent,
        contribution_value: pool.contribution_value,
        profit_value: pool.profit_value,
        current_value: pool.current_value,
        invested_value: pool.invested_value
    };

    const { error: insertError } = await supabaseAdmin.from('pool_data').insert([newPool]);
    if (insertError) { showToast('Erro ao copiar: ' + insertError.message, 'error'); showLoading(false); return; }

    showToast('Pool copiada! Edite conforme necessário.', 'success');
    await loadUserPools();
    showLoading(false);
}

// =====================================================
// AAVE
// =====================================================
let allAaveDataAdmin = []; // armazenar todos os dados AAVE do usuário selecionado

async function loadUserAave() {
    const userId  = document.getElementById('aave-user-filter').value;
    const month   = document.getElementById('aave-month-filter-admin').value;
    const display = document.getElementById('aave-data-display');
    const noData  = document.getElementById('aave-no-data');
    if (!userId) { display.style.display='none'; if(noData) noData.style.display='none'; return; }
    showLoading(true);
    let query = supabaseAdmin.from('aave_data').select('*, users(username)').eq('user_id', userId).order('updated_at', { ascending: false });
    if (month) query = query.eq('month', month); else query = query.limit(20);
    const { data: rows, error } = await query; showLoading(false);

    allAaveDataAdmin = rows || [];
    const data = rows?.[0] || null;

    if (error || !data) {
        display.style.display='none';
        if(noData) { noData.style.display='block'; noData.textContent='Nenhum dado AAVE encontrado para este usuário.'; }
        renderAaveHistoryTable([]);
        return;
    }

    display.style.display='block'; if(noData) noData.style.display='none';

    // Armazenar dados para edição
    display.dataset.currentId = data.id;
    display.dataset.currentUserId = userId;
    display.dataset.currentUsername = data.users?.username || '';

    const f=v=>'$'+(parseFloat(v)||0).toLocaleString('en-US',{minimumFractionDigits:2});
    const bal=parseFloat(data.aave_balance)||0, bor=parseFloat(data.borrow_value)||0;
    document.getElementById('admin-aave-balance').textContent=f(bal);
    document.getElementById('admin-borrow-value').textContent=f(bor);
    document.getElementById('admin-net-value').textContent=f(bal-bor);
    document.getElementById('admin-weth-value').textContent=f(data.weth_value);
    document.getElementById('admin-usdto-value').textContent=f(data.usdto_value);
    document.getElementById('admin-loan-reduction').textContent=f(data.loan_reduction);
    document.getElementById('aave-last-updated').textContent=new Date(data.updated_at).toLocaleString('pt-BR')+(data.month?` — ${data.month}`:'');

    // Renderizar tabela de histórico
    renderAaveHistoryTable(allAaveDataAdmin);
}

function renderAaveHistoryTable(data) {
    const tbody = document.getElementById('aave-history-table');
    tbody.innerHTML = '';

    if (!data?.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);">Nenhum dado encontrado</td></tr>';
        return;
    }

    data.forEach(row => {
        const weth = parseFloat(row.weth_value || 0);
        const usdto = parseFloat(row.usdto_value || 0);
        const net = weth - usdto;
        const f = v => '$' + (parseFloat(v)||0).toLocaleString('en-US', {minimumFractionDigits: 2});
        const ff = v => v.toLocaleString('en-US', {minimumFractionDigits: 2});
        const updated = row.updated_at ? new Date(row.updated_at).toLocaleDateString('pt-BR') : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span style="font-weight:600;">${row.month || '-'}</span></td>
            <td>${f(weth)}</td>
            <td style="color:#ef4444;">${f(usdto)}</td>
            <td style="color:${net>=0?'#22c55e':'#ef4444'};font-weight:600;">${f(net)}</td>
            <td style="font-size:12px;color:var(--text-muted);">${updated}</td>
            <td class="actions" style="display:flex;gap:6px;align-items:center;">
                <button class="edit" onclick="openEditAaveModalById('${row.id}')" title="Editar">✏️</button>
                <button class="delete" onclick="deleteAaveData('${row.id}')" title="Excluir">🗑️</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function openEditAaveModal() {
    const display = document.getElementById('aave-data-display');
    const id = display.dataset.currentId;
    if (!id) { showToast('Selecione um registro primeiro.', 'error'); return; }
    openEditAaveModalById(id);
}

async function openEditAaveModalById(recordId) {
    showLoading(true);
    const { data: row, error } = await supabaseAdmin.from('aave_data').select('*, users(username)').eq('id', recordId).single();
    showLoading(false);
    if (error || !row) { showToast('Erro ao carregar dados.', 'error'); return; }

    document.getElementById('edit-aave-id').value = row.id;
    document.getElementById('edit-aave-user-id').value = row.user_id;
    document.getElementById('edit-aave-username').value = row.users?.username || '-';
    document.getElementById('edit-aave-month').value = row.month || '-';
    document.getElementById('edit-aave-weth').value = parseFloat(row.weth_value || 0).toFixed(2);
    document.getElementById('edit-aave-usdto').value = parseFloat(row.usdto_value || 0).toFixed(2);
    document.getElementById('edit-aave-loan-reduction').value = parseFloat(row.loan_reduction || 0).toFixed(2);
    document.getElementById('edit-aave-borrow').value = parseFloat(row.borrow_value || 0).toFixed(2);

    openModal('edit-aave-modal');
}

document.getElementById('edit-aave-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-aave-id').value;
    const userId = document.getElementById('edit-aave-user-id').value;
    const weth = parseFloat(document.getElementById('edit-aave-weth').value) || 0;
    const usdto = parseFloat(document.getElementById('edit-aave-usdto').value) || 0;
    const loanRed = parseFloat(document.getElementById('edit-aave-loan-reduction').value) || 0;
    const borrow = parseFloat(document.getElementById('edit-aave-borrow').value) || 0;

    showLoading(true);
    const payload = {
        aave_balance: weth + loanRed,
        borrow_value: borrow,
        weth_value: weth,
        usdto_value: usdto,
        loan_reduction: loanRed,
        updated_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('aave_data').update(payload).eq('id', id);
    if (error) { showToast('Erro: ' + error.message, 'error'); showLoading(false); return; }

    showToast('AAVE atualizado!', 'success');
    closeModal('edit-aave-modal');

    if (document.getElementById('aave-user-filter').value === userId) {
        await loadUserAave();
    }
    showLoading(false);
});

async function deleteAaveData(recordId) {
    if (!confirm('Excluir este registro AAVE?')) return;
    showLoading(true);

    const { data: row } = await supabaseAdmin.from('aave_data').select('user_id').eq('id', recordId).single();
    const userId = row?.user_id;

    const { error } = await supabaseAdmin.from('aave_data').delete().eq('id', recordId);
    if (error) { showToast('Erro: ' + error.message, 'error'); showLoading(false); return; }

    showToast('Registro excluído!', 'success');

    if (userId && document.getElementById('aave-user-filter').value === userId) {
        await loadUserAave();
    } else {
        showLoading(false);
    }
}

document.getElementById('add-aave-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId=document.getElementById('aave-user').value, month=document.getElementById('aave-month').value;
    const weth=parseFloat(document.getElementById('aave-weth').value)||0, usdto=parseFloat(document.getElementById('aave-usdto').value)||0, loanRed=parseFloat(document.getElementById('aave-loan-reduction').value)||0, borrow=parseFloat(document.getElementById('aave-borrow-input').value)||0;
    showLoading(true);
    const { data: ex } = await supabaseAdmin.from('aave_data').select('id').eq('user_id',userId).eq('month',month).limit(1).single();
    const payload={ aave_balance:weth+loanRed, borrow_value:borrow, weth_value:weth, usdto_value:usdto, loan_reduction:loanRed, month, updated_at:new Date().toISOString() };
    const result=ex ? await supabaseAdmin.from('aave_data').update(payload).eq('user_id',userId).eq('month',month) : await supabaseAdmin.from('aave_data').insert([{user_id:userId,...payload}]);
    if (result.error) { showToast('Erro: '+result.error.message,'error'); showLoading(false); return; }
    showToast('AAVE salvo!','success'); closeModal('add-aave-modal');
    if (document.getElementById('aave-user-filter').value===userId) await loadUserAave();
    showLoading(false);
});

// =====================================================
// RANKING — sistema de pontuação 0 a 10
// =====================================================
async function loadRankingAdmin() {
    const mf=document.getElementById('ranking-month-filter')?.value;
    const wf=document.getElementById('ranking-week-filter')?.value;
    const tbody=document.getElementById('ranking-table-body');
    showLoading(true);
    let query=supabaseAdmin.from('rankings').select('*').order('month').order('week').order('points',{ascending:false});
    if (mf) query=query.eq('month',mf); if (wf) query=query.eq('week',wf);
    const { data, error }=await query; showLoading(false);
    if (error) { showToast('Erro: '+error.message,'error'); return; }
    tbody.innerHTML='';
    if (!data?.length) { tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">Nenhum dado</td></tr>'; return; }

    // Líder por semana = maior pontuação
    const leaders={};
    data.forEach(r=>{ const k=r.month+'||'+r.week; if(!leaders[k]||r.points>leaders[k]) leaders[k]=r.points; });

    data.forEach(r=>{
        const pts = parseFloat(r.points || 0);
        const isL = pts === leaders[r.month+'||'+r.week];

        // Cor visual conforme faixa
        const color = pts>=8?'#22c55e' : pts>=6?'#3b82f6' : pts>=4?'#a855f7' : pts>=2?'#f59e0b' : '#ef4444';

        // Formatar datas do período
        const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : null;
        const ws = fmtDate(r.week_start), we = fmtDate(r.week_end);
        const periodo = ws && we ? `<span style="font-size:11px;color:var(--text-muted);display:block;margin-top:2px;">${ws} → ${we}</span>` : '';
        const row=document.createElement('tr');
        row.innerHTML=`
            <td><span style="font-weight:500;">${r.month}</span>${periodo}</td>
            <td>${r.week}</td>
            <td style="font-weight:${isL?700:400};color:${isL?'#fbbf24':'inherit'};">${isL?'🏆 ':''}${r.username}</td>
            <td>
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="flex:1;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
                        <div style="height:100%;width:${pts*10}%;background:${color};border-radius:4px;transition:width 0.5s ease;"></div>
                    </div>
                    <span style="font-size:16px;font-weight:700;color:${color};min-width:40px;">${pts.toFixed(1)}</span>
                    <span style="font-size:11px;color:var(--text-muted);">/10</span>
                </div>
            </td>
            <td class="actions" style="vertical-align:middle;white-space:nowrap;">
                <button class="edit"   onclick="openEditRanking('${r.id}','${r.month}','${r.week}','${r.username}',${parseFloat(r.points_start||0)},${parseFloat(r.points_end||pts)},'${r.week_start||''}','${r.week_end||''}')">✏️</button>
                <button class="delete" onclick="deleteRanking('${r.id}')">🗑️</button>
            </td>`;
        tbody.appendChild(row);
    });
}

document.getElementById('add-ranking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const month        = document.getElementById('ranking-month').value;
    const week         = document.getElementById('ranking-week').value;
    const week_start   = document.getElementById('ranking-week-start').value || null;
    const week_end     = document.getElementById('ranking-week-end').value   || null;
    const username     = document.getElementById('ranking-username').value.trim();
    const points_start   = Math.min(10, Math.max(0, parseFloat(document.getElementById('ranking-points-start').value)||0));
    const _endRaw          = document.getElementById('ranking-points-end').value;
    const points_end       = _endRaw !== '' ? Math.min(10, Math.max(0, parseFloat(_endRaw)||0)) : null;
    const points           = points_end !== null ? points_end : points_start;
    showLoading(true);
    const { data: ex } = await supabaseAdmin.from('rankings').select('id').eq('month',month).eq('week',week).eq('username',username).limit(1).single();
    const result = ex
        ? await supabaseAdmin.from('rankings').update({points, points_start, points_end, week_start, week_end}).eq('id',ex.id)
        : await supabaseAdmin.from('rankings').insert([{month,week,username,points,points_start,points_end,week_start,week_end}]);
    if (result.error) { showToast('Erro: '+result.error.message,'error'); showLoading(false); return; }
    showToast(`"${username}" → ${points.toFixed(1)} pontos!`,'success');
    closeModal('add-ranking-modal'); await loadRankingAdmin(); showLoading(false);
});

function openEditRanking(id,month,week,username,pStart,pEnd,weekStart,weekEnd) {
    document.getElementById('edit-ranking-id').value              = id;
    document.getElementById('edit-ranking-month').value           = month;
    document.getElementById('edit-ranking-week').value            = week;
    document.getElementById('edit-ranking-username').value        = username;
    document.getElementById('edit-ranking-points-start').value    = pStart;
    document.getElementById('edit-ranking-points-end').value      = pEnd;
    document.getElementById('edit-ranking-week-start').value      = weekStart || '';
    document.getElementById('edit-ranking-week-end').value        = weekEnd   || '';
    openModal('edit-ranking-modal');
}

document.getElementById('edit-ranking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id           = document.getElementById('edit-ranking-id').value;
    const points_start    = Math.min(10, Math.max(0, parseFloat(document.getElementById('edit-ranking-points-start').value)||0));
    const _endRawE         = document.getElementById('edit-ranking-points-end').value;
    const points_end       = _endRawE !== '' ? Math.min(10, Math.max(0, parseFloat(_endRawE)||0)) : null;
    const points           = points_end !== null ? points_end : points_start;
    const week_start   = document.getElementById('edit-ranking-week-start').value || null;
    const week_end     = document.getElementById('edit-ranking-week-end').value   || null;
    showLoading(true);
    const { error } = await supabaseAdmin.from('rankings').update({points, points_start, points_end, week_start, week_end}).eq('id',id);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast(`Pontuação → ${points.toFixed(1)}!`,'success'); closeModal('edit-ranking-modal'); await loadRankingAdmin(); showLoading(false);
});

async function deleteRanking(id) {
    if (!confirm('Remover?')) return; showLoading(true);
    const { error } = await supabaseAdmin.from('rankings').delete().eq('id',id);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Removido!','success'); await loadRankingAdmin(); showLoading(false);
}

// =====================================================
// MENSAGENS DE BOAS-VINDAS
// =====================================================
let currentMessageData = null;

async function loadUserMessage() {
    const userId    = document.getElementById('msg-user-filter').value;
    const display   = document.getElementById('msg-display');
    const empty     = document.getElementById('msg-empty');
    const placeholder = document.getElementById('msg-placeholder');

    display.style.display     = 'none';
    empty.style.display       = 'none';
    placeholder.style.display = 'block';

    if (!userId) return;

    placeholder.style.display = 'none';
    showLoading(true);

    const { data, error } = await supabaseAdmin
        .from('user_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    showLoading(false);
    currentMessageData = data || null;

    if (error || !data) {
        empty.style.display = 'block';
        // Pré-selecionar o usuário no modal de criação
        const msgUserSel = document.getElementById('message-user');
        if (msgUserSel) msgUserSel.value = userId;
        return;
    }

    // Exibir mensagem existente
    display.style.display = 'block';
    document.getElementById('msg-preview').textContent = data.message;

    const badge  = document.getElementById('msg-status-badge');
    const toggleBtn = document.getElementById('msg-toggle-btn');
    if (data.active) {
        badge.textContent = '● Ativa';
        badge.style.cssText = 'padding:4px 14px;border-radius:20px;font-size:12px;white-space:nowrap;background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);';
        toggleBtn.textContent = '⏸ Desativar';
    } else {
        badge.textContent = '○ Inativa';
        badge.style.cssText = 'padding:4px 14px;border-radius:20px;font-size:12px;white-space:nowrap;background:rgba(255,255,255,0.05);color:var(--text-muted);border:1px solid var(--border-glass);';
        toggleBtn.textContent = '▶ Ativar';
    }
}

async function toggleCurrentMessage() {
    if (!currentMessageData) return;
    showLoading(true);
    const newActive = !currentMessageData.active;
    const { error } = await supabaseAdmin
        .from('user_messages')
        .update({ active: newActive })
        .eq('id', currentMessageData.id);
    if (error) { showToast('Erro: ' + error.message, 'error'); showLoading(false); return; }
    showToast(newActive ? 'Mensagem ativada!' : 'Mensagem desativada!', 'success');
    await loadUserMessage();
    showLoading(false);
}

function openEditCurrentMessage() {
    if (!currentMessageData) return;
    document.getElementById('edit-message-id').value       = currentMessageData.id;
    document.getElementById('edit-message-username').value = allUsers.find(u => u.id === currentMessageData.user_id)?.username || '';
    document.getElementById('edit-message-text').value     = currentMessageData.message;
    document.getElementById('edit-message-active').checked = currentMessageData.active;
    openModal('edit-message-modal');
}

async function deleteCurrentMessage() {
    if (!currentMessageData) return;
    if (!confirm('Excluir esta mensagem?')) return;
    showLoading(true);
    const { error } = await supabaseAdmin
        .from('user_messages')
        .delete()
        .eq('id', currentMessageData.id);
    if (error) { showToast('Erro: ' + error.message, 'error'); showLoading(false); return; }
    showToast('Mensagem excluída!', 'success');
    currentMessageData = null;
    await loadUserMessage();
    showLoading(false);
}

document.getElementById('add-message-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId  = document.getElementById('message-user').value;
    const message = document.getElementById('message-text').value.trim();
    const active  = document.getElementById('message-active').checked;
    if (!userId || !message) { showToast('Preencha todos os campos.', 'error'); return; }
    showLoading(true);
    // Desativar mensagens anteriores do usuário
    await supabaseAdmin.from('user_messages').update({ active: false }).eq('user_id', userId);
    const { error } = await supabaseAdmin.from('user_messages').insert([{ user_id: userId, message, active }]);
    if (error) { showToast('Erro: ' + error.message, 'error'); showLoading(false); return; }
    showToast('Mensagem criada!', 'success');
    closeModal('add-message-modal');
    // Atualizar o filtro de usuário para mostrar a nova mensagem
    const msgFilter = document.getElementById('msg-user-filter');
    if (msgFilter) { msgFilter.value = userId; await loadUserMessage(); }
    showLoading(false);
});

document.getElementById('edit-message-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id      = document.getElementById('edit-message-id').value;
    const message = document.getElementById('edit-message-text').value.trim();
    const active  = document.getElementById('edit-message-active').checked;
    showLoading(true);
    const { error } = await supabaseAdmin.from('user_messages').update({ message, active }).eq('id', id);
    if (error) { showToast('Erro: ' + error.message, 'error'); showLoading(false); return; }
    showToast('Mensagem atualizada!', 'success');
    closeModal('edit-message-modal');
    await loadUserMessage();
    showLoading(false);
});

// =====================================================
// UTILITÁRIOS
// =====================================================
function showAdminSection(s) {
    document.querySelectorAll('.admin-menu button').forEach(b=>b.classList.toggle('active',b.dataset.section===s));
    document.querySelectorAll('.admin-section').forEach(x=>x.classList.toggle('active',x.id===`admin-${s}`));
    if (s==='ranking') loadRankingAdmin();
}
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); document.getElementById(id)?.querySelector('form')?.reset(); }
function showLoading(s) { document.getElementById('loading').style.display=s?'flex':'none'; }
function showToast(msg,type='info') {
    const c=document.querySelector('.toast-container'), t=document.createElement('div'); t.className=`toast ${type}`;
    t.innerHTML=`<span style="font-size:18px;">${{success:'✓',error:'✕',info:'ℹ'}[type]||'ℹ'}</span><span>${msg}</span>`;
    c.appendChild(t); setTimeout(()=>t.remove(),4000);
}
function logout() { supabaseAdmin.auth.signOut(); localStorage.clear(); window.location.href='login.html'; }
document.addEventListener('click',e=>{ if(e.target.classList.contains('modal-overlay')) e.target.classList.remove('active'); });