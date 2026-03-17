// S.I.L.T. System - Admin Script

const SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let allUsers = [];

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sessão
    const { data: { session } } = await supabaseAdmin.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;

    // Buscar username
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('username')
        .eq('id', currentUser.id)
        .single();

    const username = userData?.username || currentUser.email.split('@')[0];

    // Verificar se é admin
    const { data: permData, error: permError } = await supabaseAdmin
        .from('permissions')
        .select('role')
        .eq('username', username)
        .single();

    if (permError || !permData || permData.role !== 'admin') {
        showToast('Acesso negado. Apenas administradores.', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 2000);
        return;
    }

    document.getElementById('admin-avatar').textContent = username.charAt(0).toUpperCase();

    await loadUsers();
});

// =====================================================
// USUÁRIOS
// =====================================================

async function loadUsers() {
    showLoading(true);

    const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('*, permissions(role)')
        .order('created_at', { ascending: false });

    if (error) {
        showToast('Erro ao carregar usuários: ' + error.message, 'error');
        showLoading(false);
        return;
    }

    allUsers = users || [];
    renderUsersTable();
    populateUserSelects();
    showLoading(false);
}

function renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';

    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">Nenhum usuário encontrado</td></tr>';
        return;
    }

    allUsers.forEach(user => {
        const role = user.permissions?.[0]?.role || 'user';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>
                <span style="padding:4px 12px;border-radius:20px;font-size:12px;
                    background:${role === 'admin' ? 'rgba(239,68,68,0.2)' : 'rgba(168,85,247,0.2)'};
                    color:${role === 'admin' ? '#ef4444' : '#a855f7'};">
                    ${role === 'admin' ? 'Admin' : 'Usuário'}
                </span>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
            <td class="actions">
                <button class="edit" onclick="openEditUser('${user.id}','${user.username}','${user.email}','${role}')" title="Editar">✏️</button>
                <button class="delete" onclick="deleteUser('${user.id}','${user.username}')" title="Excluir">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function populateUserSelects() {
    const selects = ['pool-user', 'aave-user', 'pool-user-filter', 'aave-user-filter'];

    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;

        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);

        allUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.username;
            select.appendChild(option);
        });
    });
}

// Criar usuário
document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('new-username').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;

    showLoading(true);

    // 1. Criar no auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: { data: { username } }
    });

    if (authError) {
        showToast('Erro ao criar usuário: ' + authError.message, 'error');
        showLoading(false);
        return;
    }

    // 2. Inserir na tabela users
    const { error: userError } = await supabaseAdmin
        .from('users')
        .insert([{ id: authData.user.id, username, email }]);

    if (userError) {
        showToast('Erro ao salvar usuário: ' + userError.message, 'error');
        showLoading(false);
        return;
    }

    // 3. Confirmar email automaticamente via SQL (se não tiver email confirm desabilitado)
    // 4. Inserir permissão
    const { error: permError } = await supabaseAdmin
        .from('permissions')
        .insert([{ username, role }]);

    if (permError) {
        showToast('Erro ao definir permissão: ' + permError.message, 'error');
        showLoading(false);
        return;
    }

    showToast(`Usuário "${username}" criado! Confirme o email no Supabase se necessário.`, 'success');
    closeModal('create-user-modal');
    await loadUsers();
    showLoading(false);
});

function openEditUser(userId, username, email, role) {
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-email').value = email;
    document.getElementById('edit-role').value = role;
    openModal('edit-user-modal');
}

document.getElementById('edit-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('edit-user-id').value;
    const username = document.getElementById('edit-username').value;
    const newRole = document.getElementById('edit-role').value;

    showLoading(true);

    const { error } = await supabaseAdmin
        .from('permissions')
        .update({ role: newRole })
        .eq('username', username);

    if (error) {
        showToast('Erro ao atualizar: ' + error.message, 'error');
        showLoading(false);
        return;
    }

    showToast('Usuário atualizado com sucesso!', 'success');
    closeModal('edit-user-modal');
    await loadUsers();
    showLoading(false);
});

async function deleteUser(userId, username) {
    if (!confirm(`Tem certeza que deseja excluir "${username}"?`)) return;

    showLoading(true);

    await supabaseAdmin.from('permissions').delete().eq('username', username);
    await supabaseAdmin.from('pool_data').delete().eq('user_id', userId);
    await supabaseAdmin.from('aave_data').delete().eq('user_id', userId);
    await supabaseAdmin.from('users').delete().eq('id', userId);

    showToast('Usuário excluído com sucesso!', 'success');
    await loadUsers();
    showLoading(false);
}

// =====================================================
// POOLS
// =====================================================

async function loadUserPools() {
    const userId = document.getElementById('pool-user-filter').value;
    const tbody = document.getElementById('pools-table-body');

    showLoading(true);

    let query = supabaseAdmin
        .from('pool_data')
        .select('*, users(username)')
        .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);

    const { data: pools, error } = await query;

    if (error) {
        showToast('Erro ao carregar pools: ' + error.message, 'error');
        showLoading(false);
        return;
    }

    tbody.innerHTML = '';

    if (!pools || pools.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);">Nenhum dado encontrado</td></tr>';
        showLoading(false);
        return;
    }

    pools.forEach(pool => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${pool.users?.username || '-'}</td>
            <td>${pool.month}</td>
            <td>${pool.week}</td>
            <td>${pool.pool_name}</td>
            <td>$${parseFloat(pool.invested_value).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td style="color:var(--success);">+$${parseFloat(pool.profit_value).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td class="actions">
                <button class="edit" onclick="openEditPool('${pool.id}','${pool.month}','${pool.week}','${pool.pool_name}',${pool.invested_value},${pool.profit_value})" title="Editar">✏️</button>
                <button class="delete" onclick="deletePool('${pool.id}')" title="Excluir">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    showLoading(false);
}

document.getElementById('add-pool-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const poolData = {
        user_id: document.getElementById('pool-user').value,
        month: document.getElementById('pool-month').value,
        week: document.getElementById('pool-week').value,
        pool_name: document.getElementById('pool-name').value,
        invested_value: parseFloat(document.getElementById('pool-invested').value),
        profit_value: parseFloat(document.getElementById('pool-profit').value)
    };

    showLoading(true);

    const { error } = await supabaseAdmin.from('pool_data').insert([poolData]);

    if (error) {
        showToast('Erro ao adicionar: ' + error.message, 'error');
        showLoading(false);
        return;
    }

    showToast('Dados de pool adicionados com sucesso!', 'success');
    closeModal('add-pool-modal');
    await loadUserPools();
    showLoading(false);
});

function openEditPool(id, month, week, poolName, invested, profit) {
    document.getElementById('edit-pool-id').value = id;
    document.getElementById('edit-pool-month').value = month;
    document.getElementById('edit-pool-week').value = week;
    document.getElementById('edit-pool-name').value = poolName;
    document.getElementById('edit-pool-invested').value = invested;
    document.getElementById('edit-pool-profit').value = profit;
    openModal('edit-pool-modal');
}

document.getElementById('edit-pool-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const poolId = document.getElementById('edit-pool-id').value;
    const updates = {
        month: document.getElementById('edit-pool-month').value,
        week: document.getElementById('edit-pool-week').value,
        pool_name: document.getElementById('edit-pool-name').value,
        invested_value: parseFloat(document.getElementById('edit-pool-invested').value),
        profit_value: parseFloat(document.getElementById('edit-pool-profit').value)
    };

    showLoading(true);

    const { error } = await supabaseAdmin.from('pool_data').update(updates).eq('id', poolId);

    if (error) {
        showToast('Erro ao atualizar: ' + error.message, 'error');
        showLoading(false);
        return;
    }

    showToast('Dados atualizados com sucesso!', 'success');
    closeModal('edit-pool-modal');
    await loadUserPools();
    showLoading(false);
});

async function deletePool(poolId) {
    if (!confirm('Tem certeza que deseja excluir estes dados?')) return;

    showLoading(true);

    const { error } = await supabaseAdmin.from('pool_data').delete().eq('id', poolId);

    if (error) {
        showToast('Erro ao excluir: ' + error.message, 'error');
        showLoading(false);
        return;
    }

    showToast('Dados excluídos com sucesso!', 'success');
    await loadUserPools();
    showLoading(false);
}

// =====================================================
// AAVE
// =====================================================

async function loadUserAave() {
    const userId = document.getElementById('aave-user-filter').value;
    const dataDisplay = document.getElementById('aave-data-display');
    const noData = document.getElementById('aave-no-data');

    if (!userId) {
        dataDisplay.style.display = 'none';
        if (noData) noData.style.display = 'none';
        return;
    }

    showLoading(true);

    const { data: aaveData, error } = await supabaseAdmin
        .from('aave_data')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

    showLoading(false);

    if (error || !aaveData) {
        dataDisplay.style.display = 'none';
        if (noData) noData.style.display = 'block';
        return;
    }

    dataDisplay.style.display = 'block';
    if (noData) noData.style.display = 'none';

    const balance = parseFloat(aaveData.aave_balance) || 0;
    const borrow = parseFloat(aaveData.borrow_value) || 0;

    document.getElementById('admin-aave-balance').textContent = '$' + balance.toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('admin-borrow-value').textContent = '$' + borrow.toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('admin-net-value').textContent = '$' + (balance - borrow).toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('aave-last-updated').textContent = new Date(aaveData.updated_at).toLocaleString('pt-BR');
}

document.getElementById('add-aave-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('aave-user').value;
    const balance = parseFloat(document.getElementById('aave-balance-input').value);
    const borrow = parseFloat(document.getElementById('aave-borrow-input').value);

    showLoading(true);

    const { data: existing } = await supabaseAdmin
        .from('aave_data')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();

    let result;
    if (existing) {
        result = await supabaseAdmin
            .from('aave_data')
            .update({ aave_balance: balance, borrow_value: borrow, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
    } else {
        result = await supabaseAdmin
            .from('aave_data')
            .insert([{ user_id: userId, aave_balance: balance, borrow_value: borrow }]);
    }

    if (result.error) {
        showToast('Erro ao salvar: ' + result.error.message, 'error');
        showLoading(false);
        return;
    }

    showToast('Dados AAVE atualizados com sucesso!', 'success');
    closeModal('add-aave-modal');

    if (document.getElementById('aave-user-filter').value === userId) {
        await loadUserAave();
    }

    showLoading(false);
});

// =====================================================
// UTILITÁRIOS
// =====================================================

function showAdminSection(section) {
    document.querySelectorAll('.admin-menu button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `admin-${section}`);
    });
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    const form = document.getElementById(modalId)?.querySelector('form');
    if (form) form.reset();
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span style="font-size:18px;">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function logout() {
    supabaseAdmin.auth.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});