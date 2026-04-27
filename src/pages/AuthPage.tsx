import React, { useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar } from 'lucide-react';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

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
