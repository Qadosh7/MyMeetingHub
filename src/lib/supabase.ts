import { createClient } from '@supabase/supabase-js';

// No Vite, as variáveis devem começar com VITE_ para serem expostas ao cliente
let supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// Sanitize URL: Remove /rest/v1/ if user accidentally provided the full API path
if (supabaseUrl && supabaseUrl.includes('/rest/v1')) {
  supabaseUrl = supabaseUrl.split('/rest/v1')[0];
}

const isConfigured = 
  supabaseUrl && 
  supabaseUrl.startsWith('https://') && 
  supabaseUrl !== 'https://your-project-url.supabase.co';

if (!isConfigured) {
  console.error('Supabase não configurado! Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nos Secrets do projeto.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = isConfigured;
