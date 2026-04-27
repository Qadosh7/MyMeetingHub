import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { Meeting, AgendaItem, TopicParticipant } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Play, Pause, SkipForward, SkipBack, 
  RotateCcw, Clock, User, Coffee, Users, 
  Mic, Presentation, MessageCircle, CheckCircle2,
  AlertCircle, Maximize2, Minimize2, Loader2, Info
} from 'lucide-react';

export default function MeetingRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [participants, setParticipants] = useState<TopicParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchMeetingData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: meetingData, error: mError } = await supabase.from('meetings').select('*').eq('id', id).single();
      if (mError) throw mError;
      setMeeting(meetingData);

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
  }, [fetchMeetingData]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      toast.info('Tempo esgotado!', {
        description: 'Deseja avançar para o próximo item?',
        action: { label: 'Avançar', onClick: () => handleNext() }
      });
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
      toast.success('Reunião finalizada com sucesso!');
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

  const handleRestart = () => {
    if (confirm('Deseja realmente reiniciar a reunião do início?')) {
      setCurrentIndex(0);
      setTimeLeft(items[0].duration_minutes * 60);
      setIsActive(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b1021] text-white p-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-6" />
        <p className="text-slate-400 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Sincronizando Sessão...</p>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  if (!currentItem) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progress = ((currentItem.duration_minutes * 60 - timeLeft) / (currentItem.duration_minutes * 60)) * 100;
  const isCrtitcal = timeLeft > 0 && timeLeft < 60;
  const currentParticipants = participants.filter(p => p.topic_id === currentItem.id);

  return (
    <div className="min-h-screen bg-[#0b1021] text-white flex flex-col selection:bg-primary/30 selection:text-primary overflow-hidden">
      {/* Dynamic Background Gradient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ scale: isActive ? [1, 1.1, 1] : 1, opacity: isCrtitcal ? [0.1, 0.2, 0.1] : 0.1 }}
          transition={{ duration: 10, repeat: Infinity }}
          className={`absolute -top-1/2 -left-1/2 w-full h-full rounded-full blur-[160px] transition-colors duration-1000 ${isCrtitcal ? 'bg-destructive' : 'bg-primary'}`} 
        />
      </div>

      <header className="h-20 bg-white/5 border-b border-white/10 px-8 flex items-center justify-between backdrop-blur-xl relative z-20">
        <div className="flex items-center gap-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(`/meeting/${id}`)}
            className="text-slate-400 hover:text-white hover:bg-white/10 rounded-xl"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-bold tracking-tight max-w-[200px] sm:max-w-md truncate">{meeting?.title}</h1>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-none">Modo Executivo</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
             <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:block">Progresso</div>
             <div className="text-sm font-mono font-bold text-primary">
               {currentIndex + 1} <span className="text-slate-600 mx-1">/</span> {items.length}
             </div>
           </div>
           <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-slate-500 hover:text-white hover:bg-white/10 rounded-xl">
             {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
           </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative z-10">
        <div className="flex-1 flex flex-col p-8 lg:p-16">
          <div className="max-w-5xl mx-auto w-full h-full flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 flex flex-col justify-center items-center text-center space-y-12"
              >
                <div className="space-y-6 max-w-4xl">
                  <div className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border shadow-sm ${
                    currentItem.type === 'topic' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                  }`}>
                    {currentItem.type === 'topic' ? <Mic size={14} /> : <Coffee size={14} />}
                    <span className="text-[10px] font-black uppercase tracking-[0.25em]">
                      {currentItem.type === 'topic' ? 'Tópico em Foco' : 'Intervalo Programado'}
                    </span>
                  </div>
                  
                  <h2 className="text-5xl lg:text-8xl font-black tracking-tighter leading-[1.05] drop-shadow-2xl">
                    {currentItem.title}
                  </h2>

                  {currentItem.type === 'topic' && (
                    <div className="flex items-center justify-center gap-8 pt-4">
                      <div className="flex items-center gap-4 bg-white/5 border border-white/5 rounded-2xl px-6 py-4 backdrop-blur-md shadow-2xl">
                        <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-xl font-black text-[#0b1021] shadow-lg shadow-primary/20">
                          {((currentItem as any).presenter?.[0]?.toUpperCase()) || '?'}
                        </div>
                        <div className="text-left">
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Responsável</div>
                          <div className="text-xl font-bold tracking-tight">{(currentItem as any).presenter || 'Não Definido'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-12 w-full">
                   <div className={`text-[12rem] lg:text-[18rem] font-mono leading-none tracking-tighter tabular-nums ${isCrtitcal ? 'text-destructive font-black animate-[pulse_1s_infinite]' : 'font-bold text-white shadow-primary/10'}`}>
                      {formatTime(timeLeft)}
                   </div>

                   <div className="w-full max-w-3xl space-y-6">
                     <Progress value={progress} className={`h-2.5 bg-white/5 ${isCrtitcal ? 'text-destructive' : 'text-primary'}`} />
                     <div className="flex justify-between px-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                        <span>Ponto Zero</span>
                        <span className={`transition-colors ${isCrtitcal ? 'text-destructive' : 'text-primary'}`}>
                          {currentItem.duration_minutes}m Progamados
                        </span>
                        <span>Checkpoint</span>
                     </div>
                   </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Float Controls */}
            <div className="mt-auto py-12 flex flex-col items-center gap-8">
              <div className="flex items-center gap-8">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleBack}
                  disabled={currentIndex === 0}
                  className="h-16 w-16 rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all disabled:opacity-20"
                >
                  <SkipBack size={28} />
                </Button>

                <Button 
                  onClick={handleTogglePlay}
                  className={`h-28 w-28 rounded-full shadow-2xl transition-all active:scale-95 group relative overflow-hidden ${
                    isActive 
                      ? 'bg-white text-[#0b1021] hover:bg-slate-200' 
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                   <div className="relative z-10">
                    {isActive ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="ml-2" />}
                   </div>
                   {isActive && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 0.1, scale: 1.5 }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-primary rounded-full"
                      />
                   )}
                </Button>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleNext}
                  disabled={currentIndex === items.length - 1}
                  className="h-16 w-16 rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all disabled:opacity-20"
                >
                  <SkipForward size={28} />
                </Button>
              </div>

              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={handleRestart} className="text-slate-600 hover:text-white text-[10px] uppercase font-black tracking-widest gap-2">
                  <RotateCcw size={14} /> Reiniciar
                </Button>
                <div className="h-1 w-1 rounded-full bg-slate-800" />
                <Button variant="ghost" size="sm" onClick={() => navigate(`/meeting/${id}`)} className="text-slate-600 hover:text-white text-[10px] uppercase font-black tracking-widest gap-2">
                  <Settings2 size={14} /> Editar Agenda
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Visual Context */}
        <aside className="w-[400px] bg-black/20 border-l border-white/10 p-12 overflow-y-auto hidden 2xl:flex flex-col gap-10">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Fluxo da Agenda</h3>
              <div className="h-px flex-1 mx-4 bg-white/5" />
            </div>
            
            <div className="space-y-4">
              {items.map((item, idx) => {
                const isCurrent = idx === currentIndex;
                const isPassed = idx < currentIndex;
                
                return (
                  <motion.div 
                    key={item.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setTimeLeft(item.duration_minutes * 60);
                      setIsActive(false);
                    }}
                    className={`relative flex items-center gap-5 p-5 rounded-[1.25rem] transition-all cursor-pointer border group overflow-hidden ${
                      isCurrent 
                        ? 'bg-primary border-primary shadow-2xl shadow-primary/20 scale-[1.03] z-10' 
                        : isPassed
                          ? 'bg-white/2 border-transparent opacity-25 hover:opacity-50'
                          : 'bg-white/5 border-white/5 hover:border-white/20'
                    }`}
                  >
                    {isCurrent && (
                      <motion.div 
                        layoutId="active-bg"
                        className="absolute inset-0 bg-primary"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    
                    <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      isCurrent ? 'bg-white text-primary' : 'bg-white/10 text-slate-400'
                    }`}>
                      {isPassed ? <CheckCircle2 size={18} /> : String(idx + 1).padStart(2, '0')}
                    </div>
                    
                    <div className="relative z-10 flex-1 min-w-0">
                      <h4 className={`text-sm font-bold truncate tracking-tight ${isCurrent ? 'text-[#0b1021]' : 'text-slate-300'}`}>
                        {item.title}
                      </h4>
                      <p className={`text-[9px] font-black uppercase tracking-[0.15em] mt-1.5 ${isCurrent ? 'text-[#0b1021]/60' : 'text-slate-500'}`}>
                        {item.duration_minutes}m • {item.type === 'topic' ? 'Tópico' : 'Intervalo'}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="mt-auto space-y-8">
            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 text-white/5 group-hover:text-primary/10 transition-colors">
                  <Users size={80} />
               </div>
               <div className="relative z-10 space-y-6">
                 <h4 className="text-xs font-black uppercase tracking-[0.25em] text-slate-500 flex items-center gap-3">
                   <Users size={16} /> Painel de Voz
                 </h4>
                 {currentParticipants.length > 0 ? (
                   <div className="flex flex-wrap gap-2.5">
                     {currentParticipants.map(p => (
                       <div key={p.id} className="px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] text-slate-300 hover:border-primary/30 transition-colors">
                         {p.participant_name}
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="flex flex-col items-center py-6 border border-dashed border-white/10 rounded-3xl text-slate-600 gap-3">
                      <div className="p-3 bg-white/5 rounded-2xl">
                         <Info size={20} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-center">Nenhum participante <br/> extra definido</p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Settings2(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  );
}

