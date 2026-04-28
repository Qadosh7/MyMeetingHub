import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { Meeting, AgendaItem, TopicParticipant, Participant, Topic } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Play, Pause, SkipForward, SkipBack, 
  RotateCcw, Clock, User, Coffee, Users, 
  Mic, Presentation, MessageCircle, CheckCircle2,
  AlertCircle, Maximize2, Minimize2, Loader2, Info,
  Settings2, Edit3, Save, X
} from 'lucide-react';
import { format, addMinutes, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MeetingRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [participants, setParticipants] = useState<TopicParticipant[]>([]);
  const [globalParticipants, setGlobalParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Inline editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const fetchMeetingData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: meetingData, error: mError } = await supabase.from('meetings').select('*').eq('id', id).single();
      if (mError) throw mError;
      setMeeting(meetingData);

      if (meetingData.status !== 'in_progress' && meetingData.status !== 'completed') {
        await supabase.from('meetings').update({ status: 'in_progress' }).eq('id', id);
      }

      const { data: gParts } = await supabase.from('participants').select('*');
      if (gParts) setGlobalParticipants(gParts);

      const { data: topics, error: tError } = await supabase.from('topics').select('*').eq('meeting_id', id);
      if (tError) throw tError;

      const { data: breaks, error: bError } = await supabase.from('breaks').select('*').eq('meeting_id', id);
      if (bError) throw bError;

      const topicIds = topics?.map(t => t.id) || [];
      const { data: parts, error: pError } = await supabase
        .from('topic_participants')
        .select('*')
        .in('topic_id', topicIds);
      if (pError) throw pError;
      setParticipants(parts || []);

      const merged: AgendaItem[] = [
        ...(topics || []).map(t => ({ ...t, type: 'topic' as const })),
        ...(breaks || []).map(b => ({ ...b, type: 'break' as const }))
      ].sort((a, b) => a.order_index - b.order_index);

      setItems(merged);
      
      if (merged.length > 0) {
        setTimeLeft(merged[0].duration_minutes * 60);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar reunião');
      navigate(`/meeting/${id}`);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchMeetingData();
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [fetchMeetingData]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      toast.info('Tempo esgotado!');
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const handleTogglePlay = () => {
    if (items.length === 0) return;
    setIsActive(!isActive);
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setTimeLeft(items[nextIdx].duration_minutes * 60);
      setIsActive(true);
    } else {
      setIsActive(false);
      supabase.from('meetings').update({ status: 'completed' }).eq('id', id).then(() => {
        toast.success('Reunião finalizada!');
      });
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setTimeLeft(items[prevIdx].duration_minutes * 60);
      setIsActive(true);
    }
  };

  const startEditing = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = async () => {
    if (!editingField || !currentItem) return;
    
    try {
      const updates: any = {};
      const currentItemType = currentItem.type;
      const table = currentItemType === 'topic' ? 'topics' : 'breaks';

      if (editingField === 'title') updates.title = editValue;
      if (editingField === 'time') updates.duration_minutes = parseInt(editValue);
      if (editingField === 'presenter') {
        const p = globalParticipants.find(gp => gp.name === editValue);
        updates.presenter_id = p?.id || null;
        updates.presenter_name = editValue;
      }

      const { error } = await supabase.from(table).update(updates).eq('id', currentItem.id);
      
      // Resilience fallback for schema updates
      if (error && error.message.includes('column') && error.message.includes('not found')) {
        const fallback = { ...updates };
        if (table === 'topics') {
          delete fallback.presenter_id;
          delete fallback.presenter_name;
        }
        await supabase.from(table).update(fallback).eq('id', currentItem.id);
      } else if (error) throw error;

      setItems(prev => prev.map((item, idx) => 
        idx === currentIndex ? { ...item, ...updates } : item
      ));

      if (editingField === 'time') {
        setTimeLeft(parseInt(editValue) * 60);
      }

      setEditingField(null);
      toast.success('Atualizado');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const currentItem = items[currentIndex];
  if (loading || !currentItem) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b1021] text-white p-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-6" />
        <p className="text-slate-400 font-mono text-xs uppercase tracking-[0.3em]">Carregando Execução...</p>
      </div>
    );
  }

  const overallProgress = ((currentIndex) / items.length) * 100;
  const isCritical = timeLeft > 0 && timeLeft < 60;
  const currentParticipants = participants.filter(p => p.topic_id === currentItem.id);

  return (
    <div className="min-h-screen bg-[#0b1021] text-white flex flex-col overflow-hidden">
      <header className="h-20 bg-white/5 border-b border-white/10 px-8 flex items-center justify-between backdrop-blur-xl relative z-20">
        <div className="flex items-center gap-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(`/meeting/${id}`)}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold truncate max-w-[200px]">{meeting?.title}</h1>
            <span className="text-[10px] text-primary uppercase font-black tracking-widest leading-none">
              {format(currentTime, 'HH:mm')} • {format(currentTime, 'EEEE, d MMM', { locale: ptBR })}
            </span>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-8 hidden md:block">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Progresso Geral</span>
            <span className="text-[10px] font-bold text-primary">{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-1.5 bg-white/5" />
        </div>

        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-slate-500 hover:text-white hover:bg-white/10">
             {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
           </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-80 bg-black/40 border-r border-white/10 p-6 overflow-y-auto hidden lg:flex flex-col gap-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Próximos Passos</h3>
          <div className="space-y-3">
            {items.map((item, idx) => {
              const isCurrent = idx === currentIndex;
              return (
                <div 
                  key={item.id}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setTimeLeft(item.duration_minutes * 60);
                    setIsActive(false);
                  }}
                  className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                    isCurrent 
                      ? 'bg-primary border-primary text-[#0b1021] shadow-lg shadow-primary/20' 
                      : 'bg-white/5 border-transparent opacity-40 hover:opacity-100 hover:bg-white/10'
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">
                    {idx + 1}. {item.type === 'topic' ? 'Tópico' : 'Pausa'}
                  </div>
                  <div className="text-sm font-bold truncate leading-tight">{item.title}</div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="flex-1 flex flex-col p-8 lg:p-12 relative items-center justify-center">
          {/* Main Display */}
          <div className="max-w-4xl w-full space-y-12 text-center items-center flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 w-full"
              >
                {/* Topic Info */}
                <div className="space-y-4">
                  {editingField === 'title' ? (
                    <div className="flex items-center justify-center gap-2">
                       <Input 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                        className="h-20 text-5xl font-black tracking-tight text-center bg-transparent border-none focus-visible:ring-0"
                      />
                      <Button size="icon" variant="ghost" onClick={saveEdit}><Save size={24}/></Button>
                    </div>
                  ) : (
                    <h2 
                      className="text-6xl lg:text-8xl font-black tracking-tighter leading-tight cursor-pointer hover:text-primary transition-colors"
                      onClick={() => startEditing('title', currentItem.title)}
                    >
                      {currentItem.title}
                    </h2>
                  )}

                  {currentItem.type === 'topic' && (
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                      <div 
                        className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 hover:bg-white/10 transition-all cursor-pointer group"
                        onClick={() => startEditing('presenter', (currentItem as Topic).presenter_name || '')}
                      >
                        <User size={16} className="text-primary" />
                        <div className="text-left">
                          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Apresentador</div>
                          {editingField === 'presenter' ? (
                            <input 
                              value={editValue} 
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={saveEdit}
                              autoFocus
                              className="bg-transparent border-none text-sm font-bold focus:ring-0 outline-none w-32"
                              list="run-presenters"
                            />
                          ) : (
                            <div className="text-sm font-bold">{(currentItem as Topic).presenter_name || 'Ninguém'}</div>
                          )}
                          <datalist id="run-presenters">
                             {globalParticipants.map(gp => <option key={gp.id} value={gp.name} />)}
                          </datalist>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                        <Users size={16} className="text-primary" />
                        <div className="text-left">
                          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Participantes</div>
                          <div className="text-sm font-bold truncate max-w-[150px]">
                            {currentParticipants.length > 0 ? (
                              currentParticipants.map(p => p.participant_name).join(', ')
                            ) : 'Apenas apresentador'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Timer Section */}
                <div className="flex flex-col items-center">
                  <div 
                    className={`text-[12rem] lg:text-[16rem] font-mono leading-none tracking-tighter tabular-nums cursor-pointer transition-colors ${
                      isCritical ? 'text-destructive animate-pulse' : isActive ? 'text-white' : 'text-slate-500'
                    }`}
                    onClick={() => startEditing('time', Math.ceil(timeLeft / 60).toString())}
                  >
                    {editingField === 'time' ? (
                      <input 
                        type="number"
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        autoFocus
                        className="bg-transparent border-none text-center focus:ring-0 outline-none w-full"
                      />
                    ) : formatTime(timeLeft)}
                  </div>
                  
                  <div className="w-full max-w-2xl mt-4">
                    <Progress value={((currentItem.duration_minutes * 60 - timeLeft) / (currentItem.duration_minutes * 60)) * 100} className="h-1.5 bg-white/5" />
                    <div className="flex justify-between mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span>Início</span>
                      <span className="text-primary">{currentItem.duration_minutes} min total</span>
                      <span>Final</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls Bar */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 bg-white/5 border border-white/10 rounded-[2.5rem] backdrop-blur-xl shadow-2xl">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              disabled={currentIndex === 0}
              className="h-14 w-14 rounded-full hover:bg-white/10 disabled:opacity-20"
            >
              <SkipBack size={24} />
            </Button>

            <Button 
              onClick={handleTogglePlay}
              className={`h-20 w-20 rounded-full shadow-lg ${
                isActive ? 'bg-white text-[#0b1021]' : 'bg-primary text-white'
              }`}
            >
              {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleNext}
              disabled={currentIndex === items.length - 1}
              className="h-14 w-14 rounded-full hover:bg-white/10 disabled:opacity-20"
            >
              <SkipForward size={24} />
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

