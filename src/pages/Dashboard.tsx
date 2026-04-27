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
import { Plus, Trash2, Calendar, Copy, MoreVertical, Search, Clock, Users, User, Play, Star, Tag, Filter, X, ChevronDown, ListFilter, SortAsc, LayoutGrid, CheckCircle2, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';

type SortOption = 'recent' | 'oldest' | 'longest' | 'shortest' | 'participants';
type DateFilter = 'all' | 'today' | 'week' | 'month';
type DurationFilter = 'all' | 'short' | 'medium' | 'long';
type StatusFilter = 'all' | 'completed' | 'planning';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  
  // Search and Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [isFavoriteOnly, setIsFavoriteOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    meetings.forEach(m => m.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [meetings]);

  const filteredAndSortedMeetings = useMemo(() => {
    let result = meetings.filter(meeting => {
      // Search
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        meeting.title.toLowerCase().includes(searchLower) ||
        meeting.topics?.some(t => 
          t.presenter?.toLowerCase().includes(searchLower) ||
          t.topic_participants?.some(p => p.participant_name.toLowerCase().includes(searchLower))
        );
      
      if (!matchesSearch) return false;

      // Favorites
      if (isFavoriteOnly && !meeting.is_favorite) return false;

      // Status
      if (statusFilter !== 'all' && meeting.status !== statusFilter) return false;

      // Date
      if (dateFilter !== 'all') {
        const date = new Date(meeting.created_at);
        const now = new Date();
        if (dateFilter === 'today') {
          if (date.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          if (date < weekAgo) return false;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date();
          monthAgo.setMonth(now.getMonth() - 1);
          if (date < monthAgo) return false;
        }
      }

      // Duration
      const totalDuration = (meeting.topics?.reduce((acc, t) => acc + t.duration_minutes, 0) || 0) +
                           (meeting.breaks?.reduce((acc, b) => acc + b.duration_minutes, 0) || 0);
      
      if (durationFilter === 'short' && totalDuration >= 30) return false;
      if (durationFilter === 'medium' && (totalDuration < 30 || totalDuration > 90)) return false;
      if (durationFilter === 'long' && totalDuration <= 90) return false;

      // Tags
      if (selectedTags.length > 0) {
        if (!meeting.tags?.some(tag => selectedTags.includes(tag))) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      
      const durationA = (a.topics?.reduce((acc, t) => acc + t.duration_minutes, 0) || 0) + (a.breaks?.reduce((acc, b) => acc + b.duration_minutes, 0) || 0);
      const durationB = (b.topics?.reduce((acc, t) => acc + t.duration_minutes, 0) || 0) + (b.breaks?.reduce((acc, b) => acc + b.duration_minutes, 0) || 0);
      
      if (sortBy === 'longest') return durationB - durationA;
      if (sortBy === 'shortest') return durationA - durationB;
      
      const participantsA = new Set(a.topics?.flatMap(t => t.topic_participants?.map(p => p.participant_name) || [])).size;
      const participantsB = new Set(b.topics?.flatMap(t => t.topic_participants?.map(p => p.participant_name) || [])).size;
      
      if (sortBy === 'participants') return participantsB - participantsA;
      
      return 0;
    });

    return result;
  }, [meetings, searchQuery, isFavoriteOnly, dateFilter, durationFilter, statusFilter, sortBy, selectedTags]);

  const recentMeetings = useMemo(() => {
    return [...meetings]
      .sort((a, b) => new Date(b.last_accessed || b.created_at).getTime() - new Date(a.last_accessed || a.created_at).getTime())
      .slice(0, 4);
  }, [meetings]);

  const fetchMeetings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          topics (
            id,
            duration_minutes,
            presenter,
            topic_participants (
              participant_name
            )
          ),
          breaks (
            duration_minutes
          )
        `)
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
        .insert([{ 
          title: newMeetingTitle, 
          user_id: user.id,
          updated_at: new Date().toISOString()
        }])
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
        .insert([{ 
          title: `${meeting.title} (Cópia)`, 
          user_id: user.id,
          updated_at: new Date().toISOString()
        }])
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
          {filteredMeetings.map((meeting) => {
            const totalDuration = (meeting.topics?.reduce((acc, t) => acc + t.duration_minutes, 0) || 0) +
                                 (meeting.breaks?.reduce((acc, b) => acc + b.duration_minutes, 0) || 0);
            
            const participantsSet = new Set<string>();
            meeting.topics?.forEach(t => {
              t.topic_participants?.forEach(p => participantsSet.add(p.participant_name));
            });
            const participantCount = participantsSet.size;

            const presentersSet = new Set<string>();
            meeting.topics?.forEach(t => {
              if (t.presenter) presentersSet.add(t.presenter);
            });
            const presenterCount = presentersSet.size;

            const isLong = totalDuration > 120;
            const isShort = totalDuration < 30 && totalDuration > 0;
            const isComplete = meeting.status === 'completed';
            const isInProgress = meeting.status === 'in_progress';

            const getRelativeTime = (dateStr: string) => {
              const date = new Date(dateStr);
              const now = new Date();
              const diffTime = Math.abs(now.getTime() - date.getTime());
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays === 0) return 'Hoje';
              if (diffDays === 1) return 'Ontem';
              return `Há ${diffDays} dias`;
            };

            return (
              <motion.div
                key={meeting.id}
                variants={itemVariants}
                whileHover={{ y: -8, scale: 1.01 }}
                className="group relative flex flex-col bg-card border border-border/50 rounded-[2rem] p-7 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer overflow-hidden"
                onClick={() => navigate(`/meeting/${meeting.id}`)}
              >
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="flex flex-wrap gap-2">
                    {isComplete && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                        Completa
                      </span>
                    )}
                    {isInProgress && (
                      <span className="px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 text-[10px] font-black uppercase tracking-wider border border-sky-500/20">
                        Em progresso
                      </span>
                    )}
                    {isShort && (
                      <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-wider border border-amber-500/20">
                        Rápida
                      </span>
                    )}
                    {isLong && (
                      <span className="px-3 py-1 rounded-full bg-violet-500/10 text-violet-600 text-[10px] font-black uppercase tracking-wider border border-violet-500/20">
                        Longa
                      </span>
                    )}
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger 
                      onClick={(e) => e.stopPropagation()}
                      className="h-10 w-10 rounded-xl flex items-center justify-center hover:bg-muted text-muted-foreground transition-all hover:rotate-90"
                    >
                      <MoreVertical size={18} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl border-border bg-card p-2 min-w-[160px] shadow-xl">
                      <DropdownMenuItem onClick={() => navigate(`/meeting/${meeting.id}`)} className="gap-3 rounded-xl cursor-pointer py-3">
                        <Calendar size={16} className="text-primary" /> Editar pauta
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateMeeting(meeting)} className="gap-3 rounded-xl cursor-pointer py-3">
                        <Copy size={16} /> Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteMeeting(meeting.id)} className="gap-3 rounded-xl cursor-pointer py-3 text-destructive focus:text-destructive">
                        <Trash2 size={16} /> Excluir permanentemente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-6 relative z-10 flex-1">
                  <div className="space-y-2">
                    <h3 className="font-black text-2xl leading-tight group-hover:text-primary transition-colors line-clamp-2">
                      {meeting.title}
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      Atualizado {getRelativeTime(meeting.updated_at || meeting.created_at)}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock size={14} className="text-primary/60" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Duração</span>
                      </div>
                      <p className="font-mono font-bold text-lg">{totalDuration}m</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users size={14} className="text-primary/60" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Membros</span>
                      </div>
                      <p className="font-mono font-bold text-lg">{participantCount}</p>
                    </div>
                  </div>

                  {presenterCount > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 rounded-xl w-fit">
                      <User size={12} className="text-muted-foreground" />
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {presenterCount} {presenterCount === 1 ? 'Apresentador' : 'Apresentadores'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex items-center justify-between relative z-10">
                  <div className="flex -space-x-2">
                    {Array.from(participantsSet).slice(0, 4).map((name, i) => (
                      <div 
                        key={i} 
                        className="h-8 w-8 rounded-full border-2 border-card bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary ring-1 ring-border/20"
                        title={name}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {participantCount > 4 && (
                      <div className="h-8 w-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground ring-1 ring-border/20">
                        +{participantCount - 4}
                      </div>
                    )}
                  </div>

                  <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                    <Play size={18} className="ml-0.5 fill-current" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
