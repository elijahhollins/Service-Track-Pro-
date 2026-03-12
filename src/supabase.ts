import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wmbvtjqymjmgcxhenvdo.supabase.co/';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtYnZ0anF5bWptZ2N4aGVudmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDc1MDMsImV4cCI6MjA4ODgyMzUwM30.oPj0SGYnRcDyFORf9yRvQOwgYOi5AWE5vXCnKVAOQ6c';

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('Using fallback Supabase URL. Please set VITE_SUPABASE_URL in your environment settings for production.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
