import { createClient } from '@supabase/supabase-js';

// Используем переменные окружения Vercel/Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Key is missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
