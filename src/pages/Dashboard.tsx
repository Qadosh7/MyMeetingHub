import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { Meeting } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Calendar, Clock, ChevronRight, LogOut, Copy } from 'lucide-react';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar reuniões');
    } finally {
      setLoading(false);
    }
  };

  const createMeeting = async () => {
    if (!newMeetingTitle.trim()) return;

    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert([{ title: newMeetingTitle, user_id: user?.id }])
        .select()
        .single();

      if (error) throw error;
      toast.success('Reunião criada!');
      setMeetings([data, ...meetings]);
      setIsCreateOpen(false);
      setNewMeetingTitle('');
      navigate(`/meeting/${data.id}`);
    } catch (error: any) {
      toast.error('Erro ao criar reunião');
    }
  };

  const deleteMeeting = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir esta reunião?')) return;

    try {
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw error;
      setMeetings(meetings.filter((m) => m.id !== id));
      toast.success('Reunião excluída');
    } catch (error: any) {
      toast.error('Erro ao excluir reunião');
    }
  };

  const duplicateMeeting = async (meeting: Meeting, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // 1. Duplicate meeting
      const { data: newMeeting, error: mError } = await supabase
        .from('meetings')
        .insert([{ title: `${meeting.title} (Cópia)`, user_id: user?.id }])
        .select()
        .single();

      if (mError) throw mError;

      // 2. Fetch original topics and breaks
      const { data: topics } = await supabase.from('topics').select('*').eq('meeting_id', meeting.id);
      const { data: breaks } = await supabase.from('breaks').select('*').eq('meeting_id', meeting.id);

      // 3. Insert duplicated topics and breaks
      if (topics && topics.length > 0) {
        const topicsToInsert = topics.map(({ id, ...rest }) => ({ ...rest, meeting_id: newMeeting.id }));
        await supabase.from('topics').insert(topicsToInsert);
      }
      if (breaks && breaks.length > 0) {
        const breaksToInsert = breaks.map(({ id, ...rest }) => ({ ...rest, meeting_id: newMeeting.id }));
        await supabase.from('breaks').insert(breaksToInsert);
      }

      toast.success('Reunião duplicada!');
      fetchMeetings();
    } catch (error: any) {
      toast.error('Erro ao duplicar reunião');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary rounded-lg text-primary-foreground">
            <Calendar size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Agenda Inteligente</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 hidden sm:inline">{user?.email}</span>
          <Button variant="outline" size="icon" onClick={() => signOut()} title="Sair">
            <LogOut size={18} />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Minhas Reuniões</h2>
            <p className="text-slate-500 text-sm">Gerencie suas pautas e cronogramas aqui.</p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0">
                <Plus size={18} />
                Nova Reunião
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar nova reunião</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título da Reunião</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Planejamento Q3"
                    value={newMeetingTitle}
                    onChange={(e) => setNewMeetingTitle(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && createMeeting()}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button onClick={createMeeting}>Criar Reunião</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-slate-200 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed rounded-3xl space-y-4">
            <div className="inline-flex p-4 bg-slate-50 rounded-full text-slate-400">
              <Calendar size={48} />
            </div>
            <div>
              <h3 className="text-lg font-medium">Nenhuma reunião encontrada</h3>
              <p className="text-slate-500">Crie sua primeira reunião para começar!</p>
            </div>
            <Button variant="outline" onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus size={18} /> Começar Agora
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetings.map((meeting) => (
              <Card
                key={meeting.id}
                className="group hover:shadow-lg transition-all cursor-pointer border-slate-200 flex flex-col"
                onClick={() => navigate(`/meeting/${meeting.id}`)}
              >
                <CardHeader className="flex-1">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors leading-tight">
                      {meeting.title}
                    </CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-[-2px]">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-primary"
                        onClick={(e) => duplicateMeeting(meeting, e)}
                        title="Duplicar"
                      >
                        <Copy size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-destructive"
                        onClick={(e) => deleteMeeting(meeting.id, e)}
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-1.5 mt-2">
                    <Clock size={14} />
                    {new Date(meeting.created_at).toLocaleDateString('pt-BR')}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="pt-0 flex justify-between items-center text-slate-400">
                  <span className="text-xs font-medium">Clique para editar agenda</span>
                  <ChevronRight size={18} />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
