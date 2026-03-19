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
// Busca users e permissions separadamente para garantir
// que o role é exibido corretamente (sem depender de join)
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
    if (!allUsers.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">Nenhum usuário</td></tr>';
        return;
    }
    allUsers.forEach(user => {
        const role    = user.role || 'user';
        const isAdmin = role === 'admin';
        const row     = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>
                <span style="padding:4px 12px;border-radius:20px;font-size:12px;
                    background:${isAdmin ? 'rgba(239,68,68,0.2)' : 'rgba(168,85,247,0.2)'};
                    color:${isAdmin ? '#ef4444' : '#a855f7'};">
                    ${isAdmin ? '👑 Admin' : 'Usuário'}
                </span>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
            <td class="actions" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                <button class="edit"
                    onclick="openEditUser('${user.id}','${user.username}','${user.email}','${role}')"
                    title="Editar função">✏️</button>
                <button
                    onclick="openEditCredentials('${user.id}','${user.username}','${user.email}')"
                    title="Editar credenciais"
                    style="background:rgba(59,130,246,0.15);color:#3b82f6;border-radius:6px;padding:6px;border:none;cursor:pointer;font-size:14px;">🔑</button>
                <button
                    onclick="viewUserDashboard('${user.id}','${user.username}')"
                    title="Ver dashboard"
                    style="background:rgba(34,197,94,0.15);color:#22c55e;border-radius:6px;padding:6px;border:none;cursor:pointer;font-size:14px;">👁️</button>
                <button class="delete"
                    onclick="deleteUser('${user.id}','${user.username}')"
                    title="Excluir">🗑️</button>
            </td>`;
        tbody.appendChild(row);
    });
}

function populateUserSelects() {
    ['pool-user','aave-user','pool-user-filter','aave-user-filter'].forEach(id => {
        const sel = document.getElementById(id); if (!sel) return;
        const first = sel.options[0]; sel.innerHTML = ''; sel.appendChild(first);
        allUsers.forEach(u => {
            const o = document.createElement('option');
            o.value = u.id; o.textContent = u.username;
            sel.appendChild(o);
        });
    });
}

// ─── CRIAR USUÁRIO ────────────────────────────────────
document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn      = document.getElementById('create-user-btn');
    const username = document.getElementById('new-username').value.trim();
    const email    = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    const role     = document.getElementById('new-role').value;

    btn.disabled = true; showLoading(true);

    const { data: authData, error: ae } = await supabaseAdmin.auth.signUp({
        email, password,
        options: { data: { username, role } }
    });
    if (ae) { showToast('Erro: ' + ae.message, 'error'); btn.disabled = false; showLoading(false); return; }

    await new Promise(r => setTimeout(r, 1500));

    await supabaseAdmin.from('users').upsert(
        [{ id: authData.user.id, username, email }], { onConflict: 'id' }
    );

    const { error: upe } = await supabaseAdmin.from('permissions').update({ role }).eq('username', username);
    if (upe) await supabaseAdmin.from('permissions').insert([{ username, role }]);

    showToast(`✅ "${username}" criado como ${role === 'admin' ? '👑 Admin' : 'Usuário'}!`, 'success');
    closeModal('create-user-modal'); await loadUsers(); btn.disabled = false; showLoading(false);
});

// ─── EDITAR FUNÇÃO ────────────────────────────────────
function openEditUser(userId, username, email, role) {
    document.getElementById('edit-user-id').value           = userId;
    document.getElementById('edit-username').value          = username;
    document.getElementById('edit-email').value             = email;
    document.getElementById('edit-user-email-hidden').value = email;
    document.getElementById('edit-role').value              = role;
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

// ─── EDITAR CREDENCIAIS ───────────────────────────────
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
        const { error: re } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/login.html'
        });
        showToast(re ? 'Erro ao enviar email.' : '📧 Email de redefinição enviado!', re ? 'error' : 'info');
        changed = true;
    }
    if (!changed) showToast('Nenhuma alteração.', 'info');
    closeModal('edit-credentials-modal'); await loadUsers(); showLoading(false);
});

// ─── VER DASHBOARD ────────────────────────────────────
// SOLUÇÃO DEFINITIVA: passa o userId diretamente na URL.
// Sem localStorage, sem sessionStorage — funciona sempre.
function viewUserDashboard(userId, username) {
    const url = `dashboard.html?uid=${encodeURIComponent(userId)}&name=${encodeURIComponent(username)}`;
    window.open(url, '_blank');
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

// =====================================================
// POOLS
// =====================================================
async function loadUserPools() {
    const userId = document.getElementById('pool-user-filter').value;
    const month  = document.getElementById('pool-month-filter').value;
    const week   = document.getElementById('pool-week-filter').value;
    const tbody  = document.getElementById('pools-table-body');
    showLoading(true);

    let query = supabaseAdmin.from('pool_data')
        .select('*, users(username)')
        .order('month').order('week').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    if (month)  query = query.eq('month', month);
    if (week)   query = query.eq('week', week);

    const { data: pools, error } = await query;
    if (error) { showToast('Erro: ' + error.message, 'error'); showLoading(false); return; }

    tbody.innerHTML = '';
    if (!pools?.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-secondary);">Nenhum dado</td></tr>';
        showLoading(false); return;
    }

    pools.forEach(pool => {
        const ini = parseFloat(pool.initial_value ?? pool.invested_value ?? 0);
        const y   = parseFloat(pool.yield_percent ?? 0);
        const c   = parseFloat(pool.contribution_value ?? 0);
        const p   = parseFloat(pool.profit_value ?? 0);
        const cu  = parseFloat(pool.current_value ?? 0);
        const d   = cu > 0 ? cu - ini : p;
        const tag = cu > 0 ? `<span style="color:${d>=0?'#22c55e':'#ef4444'};font-size:11px;">${d>=0?'▲':'▼'}$${Math.abs(d).toFixed(2)}</span>` : '';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${pool.users?.username||'-'}</td><td>${pool.month}</td><td>${pool.week}</td><td>${pool.pool_name}</td>
            <td>$${ini.toFixed(2)}</td><td>${y>0?y.toFixed(2)+'%':'-'}</td>
            <td>${c>0?'$'+c.toFixed(2):'-'}</td>
            <td style="color:var(--success);">+$${p.toFixed(2)}</td>
            <td>${cu>0?'$'+cu.toFixed(2)+' '+tag:'-'}</td>
            <td class="actions">
                <button class="edit"   onclick="openEditPool('${pool.id}','${pool.month}','${pool.week}','${pool.pool_name}',${ini},${y},${c},${p},${cu})">✏️</button>
                <button class="delete" onclick="deletePool('${pool.id}')">🗑️</button>
            </td>`;
        tbody.appendChild(row);
    });
    showLoading(false);
}

document.getElementById('add-pool-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const i=parseFloat(document.getElementById('pool-initial').value)||0, y=parseFloat(document.getElementById('pool-yield').value)||0;
    const c=parseFloat(document.getElementById('pool-contribution').value)||0, p=parseFloat(document.getElementById('pool-profit').value)||0;
    const cu=parseFloat(document.getElementById('pool-current').value)||0;
    showLoading(true);
    const { error } = await supabaseAdmin.from('pool_data').insert([{
        user_id: document.getElementById('pool-user').value,
        month: document.getElementById('pool-month').value, week: document.getElementById('pool-week').value,
        pool_name: document.getElementById('pool-name').value,
        initial_value:i, yield_percent:y, contribution_value:c, profit_value:p, current_value:cu, invested_value:i+c
    }]);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Pool adicionada!','success'); closeModal('add-pool-modal'); await loadUserPools(); showLoading(false);
});

function openEditPool(id,month,week,name,ini,y,c,p,cu) {
    document.getElementById('edit-pool-id').value=id; document.getElementById('edit-pool-month').value=month;
    document.getElementById('edit-pool-week').value=week; document.getElementById('edit-pool-name').value=name;
    document.getElementById('edit-pool-initial').value=ini; document.getElementById('edit-pool-yield').value=y;
    document.getElementById('edit-pool-contribution').value=c; document.getElementById('edit-pool-profit').value=p;
    document.getElementById('edit-pool-current').value=cu; openModal('edit-pool-modal');
}

document.getElementById('edit-pool-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const i=parseFloat(document.getElementById('edit-pool-initial').value)||0, y=parseFloat(document.getElementById('edit-pool-yield').value)||0;
    const c=parseFloat(document.getElementById('edit-pool-contribution').value)||0, p=parseFloat(document.getElementById('edit-pool-profit').value)||0;
    const cu=parseFloat(document.getElementById('edit-pool-current').value)||0;
    showLoading(true);
    const { error } = await supabaseAdmin.from('pool_data').update({
        month:document.getElementById('edit-pool-month').value, week:document.getElementById('edit-pool-week').value,
        pool_name:document.getElementById('edit-pool-name').value,
        initial_value:i, yield_percent:y, contribution_value:c, profit_value:p, current_value:cu, invested_value:i+c
    }).eq('id', document.getElementById('edit-pool-id').value);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Pool atualizada!','success'); closeModal('edit-pool-modal'); await loadUserPools(); showLoading(false);
});

async function deletePool(poolId) {
    if (!confirm('Excluir?')) return; showLoading(true);
    const { error } = await supabaseAdmin.from('pool_data').delete().eq('id', poolId);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Excluída!','success'); await loadUserPools(); showLoading(false);
}

// =====================================================
// AAVE
// =====================================================
async function loadUserAave() {
    const userId  = document.getElementById('aave-user-filter').value;
    const month   = document.getElementById('aave-month-filter-admin').value;
    const display = document.getElementById('aave-data-display');
    const noData  = document.getElementById('aave-no-data');
    if (!userId) { display.style.display='none'; if(noData) noData.style.display='none'; return; }
    showLoading(true);
    let query = supabaseAdmin.from('aave_data').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (month) query = query.eq('month', month); else query = query.limit(1);
    const { data: rows, error } = await query;
    showLoading(false);
    const data = rows?.[0] || null;
    if (error || !data) { display.style.display='none'; if(noData) noData.style.display='block'; return; }
    display.style.display='block'; if(noData) noData.style.display='none';
    const f=v=>'$'+(parseFloat(v)||0).toLocaleString('en-US',{minimumFractionDigits:2});
    const bal=parseFloat(data.aave_balance)||0, bor=parseFloat(data.borrow_value)||0;
    document.getElementById('admin-aave-balance').textContent=f(bal);
    document.getElementById('admin-borrow-value').textContent=f(bor);
    document.getElementById('admin-net-value').textContent=f(bal-bor);
    document.getElementById('admin-weth-value').textContent=f(data.weth_value);
    document.getElementById('admin-usdto-value').textContent=f(data.usdto_value);
    document.getElementById('admin-loan-reduction').textContent=f(data.loan_reduction);
    document.getElementById('aave-last-updated').textContent=new Date(data.updated_at).toLocaleString('pt-BR')+(data.month?` — ${data.month}`:'');
}

document.getElementById('add-aave-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId=document.getElementById('aave-user').value, month=document.getElementById('aave-month').value;
    const weth=parseFloat(document.getElementById('aave-weth').value)||0;
    const usdto=parseFloat(document.getElementById('aave-usdto').value)||0;
    const loanRed=parseFloat(document.getElementById('aave-loan-reduction').value)||0;
    const borrow=parseFloat(document.getElementById('aave-borrow-input').value)||0;
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
// RANKING
// =====================================================
async function loadRankingAdmin() {
    const mf=document.getElementById('ranking-month-filter')?.value, wf=document.getElementById('ranking-week-filter')?.value;
    const tbody=document.getElementById('ranking-table-body');
    showLoading(true);
    let query=supabaseAdmin.from('rankings').select('*').order('month').order('week').order('value',{ascending:false});
    if (mf) query=query.eq('month',mf); if (wf) query=query.eq('week',wf);
    const { data, error }=await query; showLoading(false);
    if (error) { showToast('Erro: '+error.message,'error'); return; }
    tbody.innerHTML='';
    if (!data?.length) { tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">Nenhum dado</td></tr>'; return; }
    const leaders={};
    data.forEach(r=>{ const k=r.month+'||'+r.week; if(!leaders[k]||r.value>leaders[k]) leaders[k]=r.value; });
    data.forEach(r=>{
        const isL=r.value===leaders[r.month+'||'+r.week];
        const row=document.createElement('tr');
        row.innerHTML=`<td>${r.month}</td><td>${r.week}</td><td style="font-weight:${isL?700:400};color:${isL?'#fbbf24':'inherit'};">${isL?'🏆 ':''}${r.username}</td><td>$${parseFloat(r.value).toLocaleString('en-US',{minimumFractionDigits:2})}</td><td class="actions"><button class="edit" onclick="openEditRanking('${r.id}','${r.month}','${r.week}','${r.username}',${r.value})">✏️</button><button class="delete" onclick="deleteRanking('${r.id}')">🗑️</button></td>`;
        tbody.appendChild(row);
    });
}

document.getElementById('add-ranking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const month=document.getElementById('ranking-month').value, week=document.getElementById('ranking-week').value;
    const username=document.getElementById('ranking-username').value.trim(), value=parseFloat(document.getElementById('ranking-value').value)||0;
    showLoading(true);
    const { data: ex }=await supabaseAdmin.from('rankings').select('id').eq('month',month).eq('week',week).eq('username',username).limit(1).single();
    const result=ex ? await supabaseAdmin.from('rankings').update({value}).eq('id',ex.id) : await supabaseAdmin.from('rankings').insert([{month,week,username,value}]);
    if (result.error) { showToast('Erro: '+result.error.message,'error'); showLoading(false); return; }
    showToast(`"${username}" lançado!`,'success'); closeModal('add-ranking-modal'); await loadRankingAdmin(); showLoading(false);
});

function openEditRanking(id,month,week,username,value) {
    document.getElementById('edit-ranking-id').value=id; document.getElementById('edit-ranking-month').value=month;
    document.getElementById('edit-ranking-week').value=week; document.getElementById('edit-ranking-username').value=username;
    document.getElementById('edit-ranking-value').value=value; openModal('edit-ranking-modal');
}
document.getElementById('edit-ranking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id=document.getElementById('edit-ranking-id').value, value=parseFloat(document.getElementById('edit-ranking-value').value)||0;
    showLoading(true);
    const { error }=await supabaseAdmin.from('rankings').update({value}).eq('id',id);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Atualizado!','success'); closeModal('edit-ranking-modal'); await loadRankingAdmin(); showLoading(false);
});
async function deleteRanking(id) {
    if (!confirm('Remover?')) return; showLoading(true);
    const { error }=await supabaseAdmin.from('rankings').delete().eq('id',id);
    if (error) { showToast('Erro: '+error.message,'error'); showLoading(false); return; }
    showToast('Removido!','success'); await loadRankingAdmin(); showLoading(false);
}

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
