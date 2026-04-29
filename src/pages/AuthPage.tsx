import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { useAuth } from '@/src/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Calendar, 
  AlertTriangle, 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  Clock, 
  Users, 
  Zap, 
  ShieldCheck, 
  Layers, 
  CheckCircle2, 
  X,
  Play,
  ClipboardList,
  Target,
  Chrome
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

export default function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Por favor, digite seu e-mail primeiro para recuperar a senha.');
      return;
    }
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (error: any) {
      console.error('Reset password error:', error);
      let errorMsg = 'Erro ao enviar e-mail de recuperação.';
      if (error.code === 'auth/user-not-found') {
        errorMsg = 'Nenhum usuário encontrado com este e-mail.';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'O formato do e-mail é inválido.';
      }
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Login com Google realizado!');
      navigate('/');
    } catch (error: any) {
      console.error('Google Auth error:', error);
      toast.error(error.message || 'Erro ao entrar com Google');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    console.log('handleAuth triggered', { isSignUp, email: trimmedEmail });
    setLoading(true);
    try {
      if (isSignUp) {
        console.log('Attempting sign up...');
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        toast.success('Cadastro realizado com sucesso!');
      } else {
        console.log('Attempting sign in...');
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
        console.log('Sign in successful');
        toast.success('Login realizado!');
        navigate('/');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let errorMsg = error.message || 'Erro ao processar';
      
      if (error.code === 'auth/operation-not-allowed') {
        errorMsg = 'O login com E-mail/Senha não está habilitado no Console do Firebase. Use o Google ou peça ao administrador para habilitar o provedor.';
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMsg = isSignUp 
          ? 'Não foi possível criar a conta. Verifique os dados ou tente outro e-mail.'
          : 'E-mail ou senha incorretos. Se você ainda não tem uma conta, clique em "Cadastre-se grátis" abaixo.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'Este e-mail já possui uma conta. Tente fazer login em vez de cadastrar.';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'O formato do e-mail é inválido. Verifique se digitou corretamente.';
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'A senha é muito fraca. Ela deve ter pelo menos 6 caracteres.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMsg = 'O login foi cancelado porque a janela foi fechada.';
      }
      
      toast.error(errorMsg, { 
        duration: 8000,
        description: 'Dica: Tente entrar com sua conta Google se o erro persistir.'
      });
    } finally {
      setLoading(false);
    }
  };

  const FloatingCard = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={cn("bg-white dark:bg-zinc-900 border border-border shadow-xl rounded-3xl p-6", className)}
    >
      {children}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-white text-zinc-950 selection:bg-primary/10">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
               <Calendar className="text-white h-6 w-6" />
             </div>
             <span className="text-2xl font-black tracking-tighter">Agenda<span className="text-primary">Pro</span></span>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => { setIsSignUp(false); setShowAuthModal(true); }}
              className="text-sm font-black uppercase tracking-widest hover:text-primary transition-colors"
            >
              Login
            </button>
            <Button 
              onClick={() => { setIsSignUp(true); setShowAuthModal(true); }}
              className="rounded-full px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"
            >
              Começar Agora
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-32 overflow-hidden bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-white to-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-8">
             <motion.div 
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest"
             >
               <Sparkles size={14} fill="currentColor" />
               Redefina sua produtividade
             </motion.div>
             <motion.h1 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.1 }}
               className="text-6xl lg:text-8xl font-black tracking-tighter leading-[0.9] text-zinc-900"
             >
               Transforme reuniões <span className="text-primary">caóticas</span> em execuções perfeitas.
             </motion.h1>
             <motion.p 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.2 }}
               className="text-xl text-zinc-500 font-medium max-w-xl leading-relaxed"
             >
               A plataforma definitiva para planejar, gerenciar e executar agendas de alto impacto. 
               Diga adeus ao tempo perdido e receba a era da disciplina.
             </motion.p>
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.3 }}
               className="flex flex-col sm:flex-row gap-4 pt-4"
             >
               <Button 
                 onClick={() => { setIsSignUp(true); setShowAuthModal(true); }}
                 className="h-16 px-10 rounded-full text-lg font-black bg-zinc-900 text-white hover:bg-zinc-800 shadow-2xl transition-all"
               >
                 Criar Conta Grátis
                 <ArrowRight className="ml-2 h-6 w-6" />
               </Button>
               <Button 
                 variant="outline"
                 className="h-16 px-10 rounded-full text-lg font-black border-2 border-zinc-200 hover:bg-zinc-50 transition-all text-zinc-900"
               >
                 Assistir Demo
               </Button>
             </motion.div>
          </div>

          <div className="lg:col-span-5 relative">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative z-10 p-6 bg-white border border-zinc-200 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)]"
            >
              {/* Fake UI preview */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">A</div>
                    <span className="font-black text-sm uppercase tracking-widest opacity-40">Agenda Atual</span>
                  </div>
                  <Badge variant="outline" className="rounded-full bg-emerald-500/10 text-emerald-600 border-none px-3 font-black text-[9px]">ATIVO</Badge>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg"><Zap size={18} fill="white" /></div>
                      <div>
                        <div className="text-[10px] font-black uppercase text-zinc-400">Tópico 01</div>
                        <div className="text-sm font-black">Planejamento Q3</div>
                      </div>
                    </div>
                    <div className="text-primary font-mono font-black animate-pulse">15:00</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-50/50 border border-dashed border-zinc-200 flex items-center justify-between opacity-50">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-400"><Clock size={18} /></div>
                      <div className="font-black text-sm">Review de Design</div>
                    </div>
                    <div className="text-xs font-black font-mono">10:00</div>
                  </div>
                </div>
              </div>
            </motion.div>
            <div className="absolute -top-12 -right-12 h-64 w-64 bg-primary/10 rounded-full blur-[80px] -z-10" />
            <div className="absolute -bottom-12 -left-12 h-64 w-64 bg-purple-500/10 rounded-full blur-[80px] -z-10" />
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-12 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-8">Utilizado pelas equipes que valorizam o tempo</p>
          <div className="flex flex-wrap justify-center gap-12 opacity-30 grayscale contrast-125">
             <span className="text-2xl font-black italic tracking-tighter">STRIPE</span>
             <span className="text-2xl font-black tracking-tighter">LINEAR</span>
             <span className="text-2xl font-black tracking-tighter">NOTION</span>
             <span className="text-2xl font-black tracking-tighter">RAYCAST</span>
             <span className="text-2xl font-black tracking-tighter">APPLE</span>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-32 bg-zinc-50/50">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-4xl lg:text-6xl font-black tracking-tighter">A maioria das reuniões é um <span className="text-red-500 underline decoration-8 underline-offset-[12px] decoration-red-500/20">desperdício de tempo</span>.</h2>
            <p className="text-xl text-zinc-500 font-medium">Você já sentiu que as reuniões da sua equipe não têm foco, ultrapassam o tempo e não geram decisões?</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FloatingCard className="space-y-4 text-left border-red-500/10">
              <div className="h-12 w-12 rounded-2xl bg-red-500/5 flex items-center justify-center text-red-500"><Clock size={24} /></div>
              <h4 className="font-black text-lg">Atrasos Constantes</h4>
              <p className="text-zinc-500 text-sm font-medium">Reuniões que começam tarde e terminam pior ainda, destruindo o cronograma do dia.</p>
            </FloatingCard>
            <FloatingCard className="space-y-4 text-left border-red-500/10">
              <div className="h-12 w-12 rounded-2xl bg-red-500/5 flex items-center justify-center text-red-500"><AlertTriangle size={24} /></div>
              <h4 className="font-black text-lg">Falta de Pauta</h4>
              <p className="text-zinc-500 text-sm font-medium">Conversas sem rumo onde ninguém sabe exatamente o que precisa ser decidido.</p>
            </FloatingCard>
            <FloatingCard className="space-y-4 text-left border-red-500/10">
              <div className="h-12 w-12 rounded-2xl bg-red-500/5 flex items-center justify-center text-red-500"><Users size={24} /></div>
              <h4 className="font-black text-lg">Inércia Total</h4>
              <p className="text-zinc-500 text-sm font-medium">Fim da reunião sem responsáveis claros ou próximos passos definidos.</p>
            </FloatingCard>
          </div>
        </div>
      </section>

      {/* Solution Features */}
      <section className="py-32">
        <div className="max-w-7xl mx-auto px-6 space-y-24">
          <div className="text-center space-y-6 max-w-3xl mx-auto">
            <Badge className="rounded-full bg-primary/10 text-primary border-none font-black text-xs px-4 py-1.5 uppercase tracking-widest uppercase">Nossa Solução</Badge>
            <h2 className="text-5xl lg:text-7xl font-black tracking-tighter">Projetado para execução impecável.</h2>
            <p className="text-xl text-zinc-500 font-medium">Combinamos rituais de liderança com ferramentas de tempo real para garantir que cada minuto conte.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-12">
               <div className="flex gap-6 group">
                  <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10 group-hover:scale-110 transition-transform">
                    <Layers size={28} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black tracking-tight">Pautas Drag & Drop</h4>
                    <p className="text-zinc-500 font-medium leading-relaxed">Organize tópicos, defina apresentadores e prioridades visualmente em segundos. Flexibilidade total para mudanças de última hora.</p>
                  </div>
               </div>
               <div className="flex gap-6 group">
                  <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10 group-hover:scale-110 transition-transform">
                    <Zap size={28} fill="currentColor" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black tracking-tight">Timers Inteligentes</h4>
                    <p className="text-zinc-500 font-medium leading-relaxed">Controle o tempo de cada tópico em tempo real. Alertas visuais discretos garantem que ninguém domine a fala desnecessariamente.</p>
                  </div>
               </div>
               <div className="flex gap-6 group">
                  <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10 group-hover:scale-110 transition-transform">
                    <ShieldCheck size={28} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black tracking-tight">Controle de Participantes</h4>
                    <p className="text-zinc-500 font-medium leading-relaxed">Defina papéis claros (Acompanhantes, Responsáveis, Facilitadores) e garanta que todos saibam por que estão na sala.</p>
                  </div>
               </div>
            </div>
            
            <div className="relative">
               <div className="bg-zinc-900 rounded-[3rem] p-1 shadow-2xl overflow-hidden aspect-video relative group">
                  <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-10 shadow-[inner_0_0_100px_rgba(0,0,0,0.5)] transition-opacity" />
                  <div className="h-full w-full bg-zinc-800 rounded-[2.8rem] flex items-center justify-center overflow-hidden border border-white/5">
                    <div className="text-center space-y-4">
                      <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-white mx-auto shadow-2xl cursor-pointer hover:scale-110 transition-transform">
                        <Play fill="white" size={24} className="ml-1" />
                      </div>
                      <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">Modo Facilitador Ativo</span>
                    </div>
                  </div>
               </div>
               <div className="absolute -top-10 -right-10 bg-white border border-border shadow-2xl p-6 rounded-3xl animate-bounce duration-[3000ms]">
                  <div className="flex items-center gap-3">
                     <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                     <span className="font-black text-xs">REUNIÃO CRÍTICA</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-32 bg-primary text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 400 400" fill="none">
            <circle cx="400" cy="0" r="400" stroke="white" strokeWidth="2" strokeDasharray="20 20" />
            <circle cx="400" cy="0" r="300" stroke="white" strokeWidth="2" strokeDasharray="10 10" />
            <circle cx="400" cy="0" r="200" stroke="white" strokeWidth="2" />
          </svg>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
           <div className="space-y-4">
             <div className="text-6xl font-black tracking-tighter">45%</div>
             <p className="text-lg font-bold opacity-80 uppercase tracking-widest text-xs">Tempo médio economizado</p>
           </div>
           <div className="space-y-4 border-white/10 md:border-x px-12">
             <div className="text-6xl font-black tracking-tighter">100%</div>
             <p className="text-lg font-bold opacity-80 uppercase tracking-widest text-xs">Clareza nas Decisões</p>
           </div>
           <div className="space-y-4">
             <div className="text-6xl font-black tracking-tighter">Zero</div>
             <p className="text-lg font-bold opacity-80 uppercase tracking-widest text-xs">Reuniões inúteis</p>
           </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 text-center bg-white">
        <div className="max-w-4xl mx-auto px-6 space-y-12">
           <div className="space-y-6">
             <h2 className="text-5xl lg:text-8xl font-black tracking-tighter leading-[0.85]">Pronto para reuniões que realmente funcionam?</h2>
             <p className="text-xl text-zinc-500 font-medium max-w-2xl mx-auto">Junte-se a milhares de líderes que transformaram sua rotina. Comece hoje mesmo, sem custo.</p>
           </div>
           <Button 
             onClick={() => { setIsSignUp(true); setShowAuthModal(true); }}
             className="h-20 px-12 rounded-full text-2xl font-black shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
           >
             Começar Grátis agora
             <ArrowRight className="ml-3 h-8 w-8" strokeWidth={3} />
           </Button>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Setup em 30 segundos • Sem cartão de crédito</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-border/50 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-12">
           <div className="flex items-center gap-3">
             <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white"><Calendar size={18} /></div>
             <span className="text-xl font-black tracking-tighter">Agenda<span className="text-primary">Pro</span></span>
           </div>
           <div className="flex gap-12 text-[10px] font-black uppercase tracking-widest text-zinc-400">
             <a href="#" className="hover:text-primary transition-colors">Termos</a>
             <a href="#" className="hover:text-primary transition-colors">Privacidade</a>
             <a href="#" className="hover:text-primary transition-colors">Contato</a>
             <a href="#" className="hover:text-primary transition-colors">LinkedIn</a>
           </div>
           <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
             © 2026 AGENDA PRO. ALL RIGHTS RESERVED.
           </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowAuthModal(false)}
               className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden"
             >
                <button 
                  onClick={() => setShowAuthModal(false)}
                  className="absolute top-8 right-8 text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                  <X size={24} strokeWidth={3} />
                </button>

                <div className="space-y-12">
                   <div className="space-y-4">
                      <h2 className="text-4xl font-black tracking-tighter">
                        {isSignUp ? 'Experimente o futuro.' : 'Bem-vindo de volta.'}
                      </h2>
                      <p className="text-zinc-500 font-medium">
                        {isSignUp ? 'Crie sua conta e comece a liderar com clareza.' : 'Entre para gerenciar suas agendas críticas.'}
                      </p>
                   </div>

                   <form onSubmit={handleAuth} className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest ml-1" htmlFor="email">Email Empresarial</Label>
                        <div className="relative">
                          <Input 
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="exemplo@empresa.com"
                            className="h-16 px-6 rounded-2xl bg-zinc-50 border-none focus-visible:ring-primary shadow-inner text-base font-medium"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest" htmlFor="password">Senha Segura</Label>
                          {!isSignUp && (
                            <button 
                              type="button" 
                              onClick={handleForgotPassword}
                              className="text-[10px] font-black text-primary uppercase hover:underline"
                            >
                              Esqueceu?
                            </button>
                          )}
                        </div>
                        <Input 
                          id="password"
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-16 px-6 rounded-2xl bg-zinc-50 border-none focus-visible:ring-primary shadow-inner text-base font-medium"
                        />
                      </div>
                      <Button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "w-full h-16 rounded-2xl text-lg font-black shadow-xl transition-all active:scale-95",
                          isSignUp 
                            ? "bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-900/20" 
                            : "bg-primary text-white hover:bg-primary/90 shadow-primary/20"
                        )}
                      >
                        {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? 'Criar Minha Conta' : 'Acessar Plataforma')}
                      </Button>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-zinc-100" />
                        </div>
                        <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
                          <span className="bg-white px-4 text-zinc-400">Ou continue com</span>
                        </div>
                      </div>

                      <Button 
                        type="button"
                        variant="outline"
                        disabled={loading}
                        onClick={handleGoogleSignIn}
                        className="w-full h-16 rounded-2xl text-base font-black border-2 border-zinc-100 hover:bg-zinc-50 transition-all gap-3"
                      >
                        <Chrome size={20} />
                        Entrar com Google
                      </Button>
                   </form>

                   <div className="text-center">
                      <p className="text-sm font-bold text-zinc-400">
                        {isSignUp ? 'Já possui conta?' : 'Novo no AgendaPro?'}
                        <button 
                          onClick={() => setIsSignUp(!isSignUp)}
                          className="ml-2 text-primary hover:underline underline-offset-4"
                        >
                          {isSignUp ? 'Faça login' : 'Cadastre-se grátis'}
                        </button>
                      </p>
                   </div>
                </div>
                 
                {/* Visual Accent */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


