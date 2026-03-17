// S.I.L.T. System - Supabase Integration
// Handles authentication, database operations, and real-time updates

const SUPABASE_URL = 'https://upskwiyrdeowzzushwid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc2t3aXlyZGVvd3p6dXNod2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjE3ODIsImV4cCI6MjA4OTI5Nzc4Mn0.cS50hid0zeCkTGVCs45sb3nnM98U1RfOdaNbWsNg3UM';

// Initialize Supabase client
let supabaseLib = null;
let currentUser = null;
let currentSession = null;

// Initialize Supabase
function initSupabase() {
    if (typeof window.supabase !== 'undefined') {
        supabaseLib = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized');

        checkSession();

        supabaseLib.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                currentSession = session;
                currentUser = session.user;
            } else if (event === 'SIGNED_OUT') {
                currentSession = null;
                currentUser = null;
            }
        });
    } else {
        console.error('Supabase library not loaded');
    }
}

async function checkSession() {
    try {
        const { data: { session }, error } = await supabaseLib.auth.getSession();
        if (session) {
            currentSession = session;
            currentUser = session.user;
        }
    } catch (error) {
        console.error('Error checking session:', error);
    }
}

async function loginUser(username, password) {
    try {
        const { data: userData, error: userError } = await supabaseLib
            .from('users')
            .select('email, username')
            .eq('username', username)
            .single();

        if (userError || !userData) {
            return { success: false, error: 'Invalid username or password' };
        }

        const { data, error } = await supabaseLib.auth.signInWithPassword({
            email: userData.email,
            password: password
        });

        if (error) {
            return { success: false, error: error.message };
        }

        currentSession = data.session;
        currentUser = data.user;

        const { data: permData } = await supabaseLib
            .from('permissions')
            .select('role')
            .eq('username', username)
            .single();

        return {
            success: true,
            user: data.user,
            isAdmin: permData?.role === 'admin'
        };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'An error occurred during login' };
    }
}

async function logoutUser() {
    try {
        await supabaseLib.auth.signOut();
        currentSession = null;
        currentUser = null;
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

async function createUser(userData) {
    try {
        const { data: authData, error: authError } = await supabaseLib.auth.signUp({
            email: userData.email,
            password: userData.password
        });

        if (authError) throw authError;

        const { error: dbError } = await supabaseLib
            .from('users')
            .insert([{
                id: authData.user.id,
                username: userData.username,
                email: userData.email,
                created_at: new Date().toISOString()
            }]);

        if (dbError) throw dbError;

        const { error: permError } = await supabaseLib
            .from('permissions')
            .insert([{
                username: userData.username,
                role: userData.role || 'user'
            }]);

        if (permError) throw permError;

        return { success: true, user: authData.user };
    } catch (error) {
        console.error('Create user error:', error);
        return { success: false, error: error.message };
    }
}

async function getAllUsers() {
    try {
        const { data, error } = await supabaseLib
            .from('users')
            .select('*, permissions(role)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, users: data };
    } catch (error) {
        console.error('Get users error:', error);
        return { success: false, error: error.message };
    }
}

async function updateUser(userId, updates) {
    try {
        const { error: userError } = await supabaseLib
            .from('users')
            .update(updates)
            .eq('id', userId);

        if (userError) throw userError;

        if (updates.role) {
            const { error: permError } = await supabaseLib
                .from('permissions')
                .update({ role: updates.role })
                .eq('username', updates.username);

            if (permError) throw permError;
        }

        return { success: true };
    } catch (error) {
        console.error('Update user error:', error);
        return { success: false, error: error.message };
    }
}

async function deleteUser(userId, username) {
    try {
        await supabaseLib.from('permissions').delete().eq('username', username);
        await supabaseLib.from('users').delete().eq('id', userId);
        return { success: true };
    } catch (error) {
        console.error('Delete user error:', error);
        return { success: false, error: error.message };
    }
}

async function isAdmin() {
    try {
        if (!currentUser) return false;

        const { data: userData } = await supabaseLib
            .from('users')
            .select('username')
            .eq('id', currentUser.id)
            .single();

        if (!userData) return false;

        const { data: permData } = await supabaseLib
            .from('permissions')
            .select('role')
            .eq('username', userData.username)
            .single();

        return permData?.role === 'admin';
    } catch (error) {
        console.error('Check admin error:', error);
        return false;
    }
}

async function getPoolData(userId, month = null, week = null) {
    try {
        let query = supabaseLib.from('pool_data').select('*').eq('user_id', userId);
        if (month) query = query.eq('month', month);
        if (week) query = query.eq('week', week);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Get pool data error:', error);
        return { success: false, error: error.message };
    }
}

async function insertPoolData(poolData) {
    try {
        const { data, error } = await supabaseLib
            .from('pool_data')
            .insert([{
                user_id: poolData.user_id,
                month: poolData.month,
                week: poolData.week,
                pool_name: poolData.pool_name,
                invested_value: poolData.invested_value,
                profit_value: poolData.profit_value,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Insert pool data error:', error);
        return { success: false, error: error.message };
    }
}

async function updatePoolData(poolId, updates) {
    try {
        const { data, error } = await supabaseLib
            .from('pool_data').update(updates).eq('id', poolId);
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Update pool data error:', error);
        return { success: false, error: error.message };
    }
}

async function deletePoolData(poolId) {
    try {
        const { error } = await supabaseLib.from('pool_data').delete().eq('id', poolId);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Delete pool data error:', error);
        return { success: false, error: error.message };
    }
}

async function getAaveData(userId) {
    try {
        const { data, error } = await supabaseLib
            .from('aave_data')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return { success: true, data: data || { aave_balance: 0, borrow_value: 0 } };
    } catch (error) {
        console.error('Get AAVE data error:', error);
        return { success: false, error: error.message };
    }
}

async function upsertAaveData(aaveData) {
    try {
        const { data: existing } = await supabaseLib
            .from('aave_data').select('id').eq('user_id', aaveData.user_id).limit(1).single();

        let result;
        if (existing) {
            result = await supabaseLib
                .from('aave_data')
                .update({
                    aave_balance: aaveData.aave_balance,
                    borrow_value: aaveData.borrow_value,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', aaveData.user_id);
        } else {
            result = await supabaseLib
                .from('aave_data')
                .insert([{
                    user_id: aaveData.user_id,
                    aave_balance: aaveData.aave_balance,
                    borrow_value: aaveData.borrow_value,
                    updated_at: new Date().toISOString()
                }]);
        }

        if (result.error) throw result.error;
        return { success: true };
    } catch (error) {
        console.error('Upsert AAVE data error:', error);
        return { success: false, error: error.message };
    }
}

// Export
window.SILT = {
    initSupabase,
    loginUser,
    logoutUser,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    isAdmin,
    getPoolData,
    insertPoolData,
    updatePoolData,
    deletePoolData,
    getAaveData,
    upsertAaveData,
    get currentUser() { return currentUser; },
    get currentSession() { return currentSession; }
};

document.addEventListener('DOMContentLoaded', initSupabase);