import { createClient } from '@supabase/supabase-js';

// No Vite, as variáveis devem começar com VITE_ para serem expostas ao cliente
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Sanitização robusta da URL
const sanitizeUrl = (url: string) => {
  if (!url) return '';
  let sanitized = url.trim();
  // Remove /rest/v1/ ou caminhos adicionais
  if (sanitized.includes('/rest/v1')) {
    sanitized = sanitized.split('/rest/v1')[0];
  }
  // Remove barra no final
  if (sanitized.endsWith('/')) {
    sanitized = sanitized.slice(0, -1);
  }
  return sanitized;
};

supabaseUrl = sanitizeUrl(supabaseUrl);
supabaseAnonKey = supabaseAnonKey.trim();

const isConfigured = 
  Boolean(supabaseUrl) && 
  supabaseUrl.startsWith('https://') && 
  supabaseUrl.includes('.supabase.co') &&
  supabaseUrl !== 'https://your-project-url.supabase.co' &&
  Boolean(supabaseAnonKey) &&
  supabaseAnonKey.length > 10; // Chaves reais são longas

if (!isConfigured) {
  console.warn('Supabase: Configuração incompleta ou inválida.');
  if (import.meta.env.DEV) {
    console.log('Ambiente de desenvolvimento detectado.');
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = isConfigured;
