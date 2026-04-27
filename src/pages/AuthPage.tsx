import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar, AlertTriangle } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSupabaseConfigured) {
      toast.error('Supabase não configurado. Adicione as chaves VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nos Secrets.');
      return;
    }

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
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4 text-primary-foreground">
            <Calendar size={28} />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isSignUp ? 'Criar nova conta' : 'Acessar Agenda Inteligente'}
          </CardTitle>
          <CardDescription>
            {isSignUp ? 'Preencha os dados abaixo para começar' : 'Entre com seu email e senha'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4">
            {!isSupabaseConfigured && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 text-amber-800 text-sm">
                <AlertTriangle className="shrink-0" size={18} />
                <p>
                  <strong>Atenção:</strong> Supabase não configurado. Adicione 
                  <code className="mx-1 bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> 
                  e 
                  <code className="mx-1 bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> 
                  nos Secrets do projeto.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Processando...' : isSignUp ? 'Cadastrar' : 'Entrar'}
            </Button>
            <Button
              variant="link"
              type="button"
              className="px-0 font-normal"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Ainda não tem conta? Cadastre-se'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
