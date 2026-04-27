import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar, AlertTriangle, Mail, Lock, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Cadastro realizado! Verifique seu email para confirmar.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Login realizado com sucesso!');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* Visual Section */}
      <div className="hidden lg:flex w-1/2 bg-[#0b1021] relative overflow-hidden flex-col items-center justify-center p-12 text-white">
        <div className="absolute top-0 left-0 w-full h-full opacity-30">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10 text-center space-y-8 max-w-md"
        >
          <div className="inline-flex p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl mb-6 shadow-2xl">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-5xl font-bold tracking-tight leading-[1.1]">Organize Reuniões como um Especialista</h2>
          <p className="text-slate-400 text-xl leading-relaxed">
            A plataforma definitiva para planejar, gerenciar e executar agendas de alto impacto.
          </p>

          <div className="pt-8 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm text-left">
              <div className="text-primary font-bold text-lg">10x</div>
              <div className="text-slate-500 text-xs uppercase tracking-widest font-bold">Mais Produtivo</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm text-left">
              <div className="text-primary font-bold text-lg">Zero</div>
              <div className="text-slate-500 text-xs uppercase tracking-widest font-bold">Distração</div>
            </div>
          </div>
        </motion.div>

        <div className="absolute bottom-12 left-12 flex items-center gap-3 text-sm text-slate-500 font-medium">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span>Usado por líderes globais</span>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative">
        <div className="w-full max-w-sm space-y-10">
          <div className="space-y-4">
            <div className="flex lg:hidden items-center gap-3 mb-10">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-2xl tracking-tight">Agenda<span className="text-primary">Pro</span></span>
            </div>
            
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                {isSignUp ? 'Criar sua conta' : 'Entrar no AgendaPro'}
              </h1>
              <p className="text-muted-foreground">
                {isSignUp ? 'Comece sua jornada rumo a reuniões impecáveis.' : 'O prazer é todo nosso em vê-lo novamente.'}
              </p>
            </motion.div>
          </div>


          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  className="pl-12 h-13 rounded-2xl bg-muted/40 border-border/50 focus:bg-background focus:ring-primary/20 transition-all text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <Label htmlFor="password">Senha</Label>
                {!isSignUp && <button type="button" className="text-xs font-semibold text-primary hover:underline underline-offset-4">Esqueceu a senha?</button>}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-12 h-13 rounded-2xl bg-muted/40 border-border/50 focus:bg-background focus:ring-primary/20 transition-all text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-13 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-2"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isSignUp ? 'Criar Conta Agora' : 'Acessar Painel'}
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
          </form>

          <div className="pt-8 text-center border-t border-border/40">
            <p className="text-sm text-muted-foreground">
              {isSignUp ? 'Já faz parte da elite?' : 'Novo por aqui?'}
              <button
                type="button"
                className="ml-2 font-bold text-primary hover:underline underline-offset-4 transition-all"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? 'Faça login' : 'Comece gratuitamente'}
              </button>
            </p>
          </div>
        </div>
        
        <div className="absolute bottom-8 left-0 w-full text-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/30 font-bold">
            Protocolo de Segurança Ativo • 256-bit AES
          </div>
        </div>
      </div>
    </div>
  );
}

