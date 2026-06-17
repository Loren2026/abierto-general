import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vgpophemyygawgnrhzer.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MoMFH5_XsSg4ArU_aeVQpA_40JHiO18';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
