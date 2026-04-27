import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { Meeting } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Calendar, Copy, MoreVertical, Search, Clock, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
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
    if (!newMeetingTitle.trim() || !user) return;
    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert([{ title: newMeetingTitle, user_id: user.id }])
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

  const deleteMeeting = async (id: string) => {
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

  const duplicateMeeting = async (meeting: Meeting) => {
    if (!user) return;
    try {
      const { data: newMeeting, error: mError } = await supabase
        .from('meetings')
        .insert([{ title: `${meeting.title} (Cópia)`, user_id: user.id }])
        .select()
        .single();

      if (mError) throw mError;

      const { data: topics } = await supabase.from('topics').select('*').eq('meeting_id', meeting.id);
      const { data: breaks } = await supabase.from('breaks').select('*').eq('meeting_id', meeting.id);

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

  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas reuniões e agendas planejadas.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group overflow-hidden bg-card border rounded-xl flex items-center h-10 px-3 w-full md:w-64 transition-all focus-within:ring-2 focus-within:ring-primary/20">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <input 
              type="text" 
              placeholder="Buscar reunião..."
              className="bg-transparent border-none outline-none px-3 text-sm flex-1 placeholder:text-muted-foreground/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger
              className="rounded-xl px-5 gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform bg-primary text-primary-foreground h-10 inline-flex items-center justify-center text-sm font-medium whitespace-nowrap transition-all outline-none select-none active:translate-y-px"
            >
              <Plus size={18} />
              Nova Reunião
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-border bg-card">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Nova Reunião</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-6">
                <div className="space-y-3">
                  <Label htmlFor="title" className="text-sm font-medium">Título da Reunião</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Alinhamento Estratégico Q3"
                    className="rounded-xl h-12 bg-muted/30 border-border/50 focus:bg-background transition-all"
                    value={newMeetingTitle}
                    onChange={(e) => setNewMeetingTitle(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && createMeeting()}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" className="rounded-xl" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button className="rounded-xl px-8" onClick={createMeeting}>Criar Agora</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grid Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 bg-muted/50 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-32 bg-card/40 border border-dashed rounded-3xl space-y-6"
        >
          <div className="h-20 w-20 rounded-2xl bg-muted/30 flex items-center justify-center border border-border/50 shadow-inner">
            <Calendar size={32} className="text-muted-foreground/40" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-lg font-semibold">Nenhuma reunião encontrada</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              {searchQuery ? "Tente buscar por um termo diferente." : "Crie sua primeira reunião e comece a planejar seus tópicos."}
            </p>
          </div>
          {!searchQuery && (
            <Button variant="outline" onClick={() => setIsCreateOpen(true)} className="rounded-xl px-8 gap-2">
              <Plus size={18} /> Começar Agora
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredMeetings.map((meeting) => (
            <motion.div
              key={meeting.id}
              variants={itemVariants}
              whileHover={{ y: -4 }}
              className="group relative flex flex-col bg-card border rounded-2xl p-6 transition-all hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/[0.02] cursor-pointer"
              onClick={() => navigate(`/meeting/${meeting.id}`)}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger 
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
                  >
                    <MoreVertical size={16} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-border bg-card">
                    <DropdownMenuItem onClick={() => duplicateMeeting(meeting)} className="gap-2 rounded-lg cursor-pointer">
                      <Copy size={14} /> Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteMeeting(meeting.id)} className="gap-2 rounded-lg cursor-pointer text-destructive focus:text-destructive">
                      <Trash2 size={14} /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                  {meeting.title}
                </h3>
                
                <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>{new Date(meeting.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              <div className="absolute right-6 bottom-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white shadow-md shadow-primary/20">
                  <Plus size={16} />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
