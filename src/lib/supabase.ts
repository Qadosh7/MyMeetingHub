import { createClient } from '@supabase/supabase-js';

// No Vite, as variáveis devem começar com VITE_ para serem expostas ao cliente
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sanitize URL: Remove /rest/v1/ se o usuário forneceu o caminho completo da API
if (supabaseUrl && supabaseUrl.includes('/rest/v1')) {
  supabaseUrl = supabaseUrl.split('/rest/v1')[0];
}

const isConfigured = 
  Boolean(supabaseUrl) && 
  supabaseUrl.startsWith('https://') && 
  supabaseUrl !== 'https://your-project-url.supabase.co' &&
  Boolean(supabaseAnonKey);

if (!isConfigured) {
  console.warn('Supabase não detectado ou chaves inválidas.');
  console.log('URL detectada:', supabaseUrl ? 'Sim' : 'Não');
  console.log('Chave Anon detectada:', supabaseAnonKey ? 'Sim' : 'Não');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = isConfigured;
