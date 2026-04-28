import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { Meeting } from '@/src/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Calendar, Copy, MoreVertical, Search, Clock, Users, User, Play, Star, Tag, Filter, X, ChevronDown, ListFilter, SortAsc, LayoutGrid, CheckCircle2, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';
import { cn } from '@/src/lib/utils';

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
  const [newMeetingDate, setNewMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  
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
      // Prioritize event_date
      const dateA = a.event_date ? new Date(a.event_date).getTime() : Infinity;
      const dateB = b.event_date ? new Date(b.event_date).getTime() : Infinity;
      
      if (dateA !== dateB) return dateA - dateB;

      // Then start_time
      const timeA = a.start_time ? new Date(a.start_time).getTime() : Infinity;
      const timeB = b.start_time ? new Date(b.start_time).getTime() : Infinity;

      if (timeA !== timeB) return timeA - timeB;

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

  const toggleFavorite = async (e: React.MouseEvent, meetingId: string, currentStatus: boolean) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ is_favorite: !currentStatus })
        .eq('id', meetingId);

      if (error) throw error;
      setMeetings(meetings.map(m => m.id === meetingId ? { ...m, is_favorite: !currentStatus } : m));
      toast.success(!currentStatus ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
    } catch (error: any) {
      toast.error('Erro ao atualizar favorito');
    }
  };

  const updateLastAccessed = async (meetingId: string) => {
    try {
      await supabase
        .from('meetings')
        .update({ last_accessed: new Date().toISOString() })
        .eq('id', meetingId);
    } catch (error) {
      console.error('Error updating last accessed:', error);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setIsFavoriteOnly(false);
    setDateFilter('all');
    setDurationFilter('all');
    setStatusFilter('all');
    setSelectedTags([]);
  };

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
            presenter_name,
            presenter_id,
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
    if (!newMeetingTitle.trim() || !user || !newMeetingDate) {
      if (!newMeetingDate) toast.error('A data da reunião é obrigatória');
      return;
    }
    try {
      const basicPayload = { 
        title: newMeetingTitle, 
        user_id: user.id
      };
      
      const fullPayload = {
        ...basicPayload,
        status: 'planning',
        event_date: newMeetingDate,
        start_time: new Date(`${newMeetingDate}T09:00:00`).toISOString(), // Default to 9am on that day
        updated_at: new Date().toISOString()
      };

      // Try full professional schema first
      let { data, error } = await supabase
        .from('meetings')
        .insert([fullPayload])
        .select()
        .single();

      // If missing columns, fallback to basic schema
      if (error && error.message.includes('column') && error.message.includes('not found')) {
        console.warn('Advanced schema columns missing, falling back to basic schema');
        const fallback = await supabase
          .from('meetings')
          .insert([basicPayload])
          .select()
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error('Supabase error creating meeting:', error);
        throw error;
      }
      toast.success('Reunião criada!');
      setMeetings([data, ...meetings]);
      setIsCreateOpen(false);
      setNewMeetingTitle('');
      setNewMeetingDate(new Date().toISOString().split('T')[0]);
      navigate(`/meeting/${data.id}`);
    } catch (error: any) {
      console.error('Catch error creating meeting:', error);
      toast.error(`Erro ao criar reunião: ${error.message || 'Erro desconhecido'}`);
      toast.info('Dica: Verifique se as novas tabelas foram criadas no Supabase (veja supabase_schema.sql)');
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
          status: 'planning',
          start_time: meeting.start_time || new Date().toISOString(),
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
    <div className="space-y-8 pb-20 max-w-7xl mx-auto">
      {/* Header Area */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              Minhas Reuniões
            </h1>
            <p className="text-muted-foreground font-medium">Encontre, organize e gerencie suas agendas.</p>
          </div>

          <div className="flex items-center gap-3">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger className={cn(buttonVariants({ variant: "default", size: "lg" }), "rounded-full px-6 gap-2 h-11 bg-primary shadow-xl shadow-primary/20 hover:scale-105 transition-all font-bold")}>
                <Plus size={20} strokeWidth={3} />
                <span>Nova Reunião</span>
              </DialogTrigger>
              <DialogContent className="rounded-[2rem] p-8">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black">Começar Planejamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título da Reunião</Label>
                    <Input
                      id="title"
                      placeholder="Ex: Weekly Team Sync"
                      className="rounded-2xl h-12 bg-muted/30 border-none px-6 text-base font-medium focus:bg-background shadow-inner transition-all"
                      value={newMeetingTitle}
                      onChange={(e) => setNewMeetingTitle(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="date" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data da Reunião</Label>
                    <Input
                      id="date"
                      type="date"
                      className="rounded-2xl h-12 bg-muted/30 border-none px-6 text-base font-medium focus:bg-background shadow-inner transition-all"
                      value={newMeetingDate}
                      onChange={(e) => setNewMeetingDate(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createMeeting()}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" className="rounded-xl h-12 px-6 font-bold" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button className="rounded-xl h-12 px-10 font-bold bg-primary" onClick={createMeeting}>Criar Reunião</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and Quick Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
            <Input 
              type="text" 
              placeholder="Pesquisar por título, participante ou apresentador..."
              className="pl-12 h-14 rounded-2xl bg-card border-border/50 shadow-sm focus:ring-2 focus:ring-primary/20 font-medium transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant={showFilters ? 'default' : 'outline'}
              className="h-14 px-6 rounded-2xl gap-2 font-bold transition-all border-border/50"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={18} />
              Filtros
              {(dateFilter !== 'all' || durationFilter !== 'all' || statusFilter !== 'all' || selectedTags.length > 0 || isFavoriteOnly) && (
                <Badge className="ml-1 bg-primary-foreground text-primary h-5 w-5 p-0 flex items-center justify-center rounded-full">
                  !
                </Badge>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline" }), "h-14 px-6 rounded-2xl gap-2 font-bold border-border/50 transition-all")}>
                <SortAsc size={18} />
                {sortBy === 'recent' && 'Mais recentes'}
                {sortBy === 'oldest' && 'Mais antigas'}
                {sortBy === 'longest' && 'Maior duração'}
                {sortBy === 'shortest' && 'Menor duração'}
                {sortBy === 'participants' && 'Participantes'}
                <ChevronDown size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[200px]">
                <DropdownMenuItem onClick={() => setSortBy('recent')} className="rounded-xl py-3 gap-3">
                  <History size={16} /> Mais recentes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('oldest')} className="rounded-xl py-3 gap-3">
                  <Calendar size={16} /> Mais antigas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('longest')} className="rounded-xl py-3 gap-3">
                  <Clock size={16} /> Maior duração
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('shortest')} className="rounded-xl py-3 gap-3">
                  <Clock size={16} /> Menor duração
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('participants')} className="rounded-xl py-3 gap-3">
                  <Users size={16} /> Mais participantes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-6 bg-muted/20 border border-border/50 rounded-[2rem] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Calendar size={12} /> Período
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'today', 'week', 'month'] as DateFilter[]).map((f) => (
                      <Badge 
                        key={f}
                        variant={dateFilter === f ? 'default' : 'outline'}
                        className="cursor-pointer px-4 py-2 rounded-xl border-border/50 font-bold capitalize"
                        onClick={() => setDateFilter(f)}
                      >
                        {f === 'all' ? 'Tudo' : f === 'today' ? 'Hoje' : f === 'week' ? 'Esta Semana' : 'Este Mês'}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Clock size={12} /> Duração
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'short', 'medium', 'long'] as DurationFilter[]).map((f) => (
                      <Badge 
                        key={f}
                        variant={durationFilter === f ? 'default' : 'outline'}
                        className="cursor-pointer px-4 py-2 rounded-xl border-border/50 font-bold capitalize"
                        onClick={() => setDurationFilter(f)}
                      >
                        {f === 'all' ? 'Tudo' : f === 'short' ? '< 30m' : f === 'medium' ? '30-90m' : '> 90m'}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 size={12} /> Status
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'completed', 'planning'] as StatusFilter[]).map((f) => (
                      <Badge 
                        key={f}
                        variant={statusFilter === f ? 'default' : 'outline'}
                        className="cursor-pointer px-4 py-2 rounded-xl border-border/50 font-bold capitalize"
                        onClick={() => setStatusFilter(f)}
                      >
                        {f === 'all' ? 'Tudo' : f === 'completed' ? 'Completa' : 'Planejando'}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Star size={12} /> Outros
                    </Label>
                    <button 
                      onClick={clearFilters}
                      className="text-[10px] font-black text-primary hover:underline transition-all"
                    >
                      Limpar filtros
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant={isFavoriteOnly ? 'default' : 'outline'}
                      className="cursor-pointer px-4 py-2 rounded-xl border-border/50 font-bold flex items-center gap-2"
                      onClick={() => setIsFavoriteOnly(!isFavoriteOnly)}
                    >
                      <Star size={12} className={isFavoriteOnly ? 'fill-current' : ''} />
                      Favoritos
                    </Badge>
                  </div>
                </div>

                {allTags.length > 0 && (
                  <div className="col-span-full space-y-3 pt-4 border-t border-border/50">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Tag size={12} /> Tags
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((tag) => (
                        <Badge 
                          key={tag}
                          variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                          className="cursor-pointer px-4 py-2 rounded-xl border-border/50 font-bold"
                          onClick={() => {
                            setSelectedTags(prev => 
                              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                            );
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recentes Section */}
      {!searchQuery && !showFilters && recentMeetings.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Acessados Recentemente</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentMeetings.map((meeting) => (
              <motion.div
                key={meeting.id}
                whileHover={{ y: -4, scale: 1.02 }}
                className="p-5 bg-card border border-border/50 rounded-2xl hover:shadow-xl transition-all cursor-pointer group"
                onClick={() => {
                  updateLastAccessed(meeting.id);
                  navigate(`/meeting/${meeting.id}`);
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-white transition-colors">
                    <Calendar size={18} />
                  </div>
                  {meeting.is_favorite && <Star size={14} className="fill-primary text-primary" />}
                </div>
                <h3 className="font-bold text-sm line-clamp-1 mb-1 group-hover:text-primary transition-colors">{meeting.title}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {new Date(meeting.updated_at || meeting.created_at).toLocaleDateString('pt-BR')}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Main List Area */}
      <div className="space-y-6 pt-4 border-t border-border/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
              {searchQuery || showFilters ? `Resultados (${filteredAndSortedMeetings.length})` : `Todas as Reuniões (${meetings.length})`}
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 bg-muted/40 animate-pulse rounded-[2.5rem]" />
            ))}
          </div>
        ) : filteredAndSortedMeetings.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-32 bg-card/40 border border-dashed rounded-[3rem] space-y-6"
          >
            <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center border border-border/50 shadow-inner">
              <Search size={32} className="text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold">Nenhum resultado encontrado</h3>
              <p className="text-muted-foreground text-sm font-medium">
                Tente ajustar seus filtros ou termos de pesquisa para encontrar o que procura.
              </p>
            </div>
            <Button variant="outline" onClick={clearFilters} className="rounded-full px-8 gap-2 border-border/50 font-bold">
              Limpar Filtros
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredAndSortedMeetings.map((meeting) => {
              const totalDuration = (meeting.topics?.reduce((acc, t) => acc + t.duration_minutes, 0) || 0) +
                                   (meeting.breaks?.reduce((acc, b) => acc + b.duration_minutes, 0) || 0);
              
              const participantsSet = new Set<string>();
              meeting.topics?.forEach(t => {
                t.topic_participants?.forEach(p => participantsSet.add(p.participant_name));
              });
              const participantsList = Array.from(participantsSet);
              const participantCount = participantsList.length;

              const presentersSet = new Set<string>();
              meeting.topics?.forEach(t => {
                if (t.presenter) presentersSet.add(t.presenter);
                if (t.presenter_name) presentersSet.add(t.presenter_name);
              });
              const presentersList = Array.from(presentersSet);

              const isComplete = meeting.status === 'completed';

              // Date & Time Logic
              const meetingStart = meeting.start_time ? new Date(meeting.start_time) : null;
              const meetingEnd = meetingStart ? new Date(meetingStart.getTime() + totalDuration * 60000) : null;

              const formatTime = (date: Date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              const formatDate = (dateStr: string) => {
                const date = new Date(dateStr + 'T12:00:00'); 
                const day = date.getDate().toString().padStart(2, '0');
                const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
                const year = date.getFullYear();
                return `${day} ${capitalizedMonth} ${year}`;
              };

              const getStatusIndicator = () => {
                if (!meeting.event_date) return { color: 'bg-muted-foreground/30', label: 'Sem data' };
                const date = new Date(meeting.event_date + 'T00:00:00');
                const today = new Date();
                today.setHours(0,0,0,0);
                
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);

                if (date.getTime() === today.getTime()) return { color: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]', label: 'Hoje' };
                if (date.getTime() === tomorrow.getTime()) return { color: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]', label: 'Amanhã' };
                if (date.getTime() < today.getTime()) return { color: 'bg-neutral-800', label: 'Passada' };
                return { color: 'bg-neutral-200 border border-neutral-300', label: 'Futura' };
              };

              const indicator = getStatusIndicator();

              const getRelativeTime = (dateStr: string) => {
                const date = new Date(dateStr);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - date.getTime());
                const diffMins = Math.floor(diffTime / (1000 * 60));
                const diffHours = Math.floor(diffMins / 60);
                const diffDays = Math.floor(diffHours / 24);
                
                if (diffMins < 60) return `há ${diffMins}m`;
                if (diffHours < 24) return `há ${diffHours}h`;
                if (diffDays === 1) return 'ontem';
                return `há ${diffDays} dias`;
              };

              return (
                <motion.div
                  key={meeting.id}
                  variants={itemVariants}
                  whileHover={{ y: -6, scale: 1.01 }}
                  className="group relative flex flex-col bg-card border border-border/40 rounded-[2rem] p-6 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer overflow-hidden h-full"
                  onClick={() => {
                    updateLastAccessed(meeting.id);
                    navigate(`/meeting/${meeting.id}`);
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                       <div className="flex items-center gap-2">
                         <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", indicator.color)} title={indicator.label} />
                         <h3 className="font-black text-lg leading-tight group-hover:text-primary transition-colors truncate">
                           {meeting.title}
                         </h3>
                       </div>
                       <div className="flex flex-wrap gap-1.5">
                         {isComplete ? (
                           <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 text-[9px] h-5 uppercase font-black tracking-tight rounded-lg">Completa</Badge>
                         ) : (
                           <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-500/20 text-[9px] h-5 uppercase font-black tracking-tight rounded-lg">Pendente</Badge>
                         )}
                         {meeting.tags?.slice(0, 3).map(tag => (
                           <Badge key={tag} variant="secondary" className="text-[9px] h-5 uppercase font-bold tracking-tight rounded-lg px-2 bg-muted/50 border-none">{tag}</Badge>
                         ))}
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {meeting.is_favorite && <Star size={14} className="fill-amber-500 text-amber-500" strokeWidth={2.5} />}
                      <DropdownMenu>
                        <DropdownMenuTrigger 
                          onClick={(e) => e.stopPropagation()}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground/40 transition-all")}
                        >
                          <MoreVertical size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl border-border bg-card p-1.5 shadow-2xl">
                          <DropdownMenuItem onClick={() => navigate(`/meeting/${meeting.id}`)} className="gap-2 rounded-lg cursor-pointer py-2 text-sm font-semibold">
                            <Calendar size={14} className="text-primary" /> Abrir Agenda
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMeeting(meeting)} className="gap-2 rounded-lg cursor-pointer py-2 text-sm">
                            <Copy size={14} /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteMeeting(meeting.id)} className="gap-2 rounded-lg cursor-pointer py-2 text-sm text-destructive focus:text-destructive">
                            <Trash2 size={14} /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="bg-muted/30 rounded-2xl p-4 space-y-2 mb-4 group-hover:bg-muted/50 transition-colors">
                     <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                       <div className="flex items-center gap-2 text-muted-foreground">
                         <Calendar size={14} className="text-primary/70" />
                         <span>{meeting.event_date ? formatDate(meeting.event_date) : 'Sem data definida'}</span>
                       </div>
                       <div className="flex items-center gap-2 text-muted-foreground">
                         <Clock size={14} className="text-primary/70" />
                         <span>{meetingStart && meetingEnd ? `${formatTime(meetingStart)} - ${formatTime(meetingEnd)}` : '--:--'}</span>
                       </div>
                     </div>
                  </div>

                  <div className="flex items-center justify-between mb-4 px-1">
                     <div className="flex items-center gap-4">
                       <div className="flex flex-col">
                         <span className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Duração</span>
                         <span className="text-sm font-black font-mono leading-none mt-1">{totalDuration}m</span>
                       </div>
                       <div className="w-[1px] h-6 bg-border/40" />
                       <div className="flex flex-col">
                         <span className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Tópicos</span>
                         <span className="text-sm font-black font-mono leading-none mt-1">{meeting.topics?.length || 0}</span>
                       </div>
                     </div>
                     
                     <div className="flex -space-x-2 mr-1">
                       {participantsList.slice(0, 3).map((name, i) => (
                         <div key={i} className="h-7 w-7 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary shadow-sm uppercase" title={name}>
                           {name.charAt(0)}
                         </div>
                       ))}
                       {participantCount > 3 && (
                         <div className="h-7 w-7 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-[9px] font-black text-muted-foreground shadow-sm">
                           +{participantCount - 3}
                         </div>
                       )}
                     </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                       {presentersList.length > 0 && (
                         <div className="flex items-center gap-1.5 overflow-hidden">
                           <User size={10} className="text-muted-foreground/40 shrink-0" />
                           <span className="text-[10px] font-bold text-muted-foreground truncate">
                             {presentersList.slice(0, 2).join(', ')}{presentersList.length > 2 ? ` +${presentersList.length - 2}` : ''}
                           </span>
                         </div>
                       )}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 whitespace-nowrap">
                      {getRelativeTime(meeting.updated_at || meeting.created_at)}
                    </span>
                  </div>

                  <div className="absolute bottom-4 right-4 h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
                    <Play size={14} className="ml-0.5 fill-current" />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
