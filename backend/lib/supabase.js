const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    logger.error('FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
}

// Create a Supabase client with the service_role key to bypass RLS and perform admin actions
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

module.exports = supabaseAdmin;
