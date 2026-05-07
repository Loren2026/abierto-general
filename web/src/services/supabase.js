import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vgpophemyygawgnrhzer.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncG9waGVteXlnYXduZ3JoemVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjEwMDk5MDcsImV4cCI6MjAzNjU4NTkwN30.A0sRd6E3f7F8G0fJ8Q0H8R0L8P9X9K8H8J8Q0H8R0L8P9X9K8H8J8Q0H8R0L8P';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
