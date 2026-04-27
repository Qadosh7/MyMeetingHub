import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { Meeting, AgendaItem, TopicParticipant } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  ArrowLeft, Play, Pause, SkipForward, SkipBack, 
  RotateCcw, Clock, User, Coffee, Users, 
  Mic, Presentation, MessageCircle, CheckCircle2,
  AlertCircle, Maximize2, Minimize2
} from 'lucide-react';

export default function MeetingRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [participants, setParticipants] = useState<TopicParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Execution state
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
      toast.error('Erro ao carregar dados da reunião');
      navigate(`/meeting/${id}`);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchMeetingData();
  }, [fetchMeetingData]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      toast.info('Tópico finalizado!', {
        description: 'Deseja avançar para o próximo?',
        action: {
          label: 'Próximo',
          onClick: () => handleNext()
        }
      });
      // Play a small sound or visual alert
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
      toast.success('Reunião finalizada!');
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
    setCurrentIndex(0);
    setTimeLeft(items[0].duration_minutes * 60);
    setIsActive(false);
    toast('Reunião reiniciada');
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          <p className="text-slate-400 font-medium font-mono">Iniciando modo execução...</p>
        </div>
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

  const totalDurationSeconds = currentItem.duration_minutes * 60;
  const progress = ((totalDurationSeconds - timeLeft) / totalDurationSeconds) * 100;
  const isNearEnd = timeLeft > 0 && timeLeft < 120; // < 2 minutes

  const currentParticipants = participants.filter(p => p.topic_id === currentItem.id);

  return (
    <div className={`min-h-screen bg-slate-950 text-white flex flex-col font-sans transition-all duration-500 ${isNearEnd && isActive ? 'bg-red-950/20' : ''}`}>
      {/* Header */}
      <header className="h-20 bg-slate-900/50 border-b border-slate-800 px-8 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(`/meeting/${id}`)}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{meeting?.title}</h1>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-0.5">Execução em tempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 flex items-center gap-3">
             <Clock size={16} className="text-indigo-400" />
             <span className="text-sm font-mono font-bold text-indigo-400">
               Item {currentIndex + 1} de {items.length}
             </span>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-slate-500 hover:text-white">
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Main Focus Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
          <div className="w-full max-w-4xl space-y-12">
            {/* Current Topic Info */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                {currentItem.type === 'topic' ? (
                  <Mic size={14} className="text-indigo-400" />
                ) : (
                  <Coffee size={14} className="text-amber-400" />
                )}
                <span className={`text-[10px] uppercase font-black tracking-[0.2em] ${currentItem.type === 'topic' ? 'text-indigo-400' : 'text-amber-400'}`}>
                  {currentItem.type === 'topic' ? 'Tópico Atual' : 'Pausa Programada'}
                </span>
              </div>
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
                {currentItem.title}
              </h2>
              
              {currentItem.type === 'topic' && (
                <div className="flex items-center justify-center gap-8 mt-6">
                  <div className="flex items-center gap-3 bg-slate-900/80 px-6 py-3 rounded-2xl border border-slate-800 shadow-xl">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                       {((currentItem as any).presenter?.[0]?.toUpperCase()) || '?'}
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Apresentador</p>
                      <p className="text-lg font-bold">{(currentItem as any).presenter || 'Não definido'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Timer */}
            <div className="flex flex-col items-center gap-8">
              <div className={`text-[12rem] md:text-[16rem] font-mono font-black leading-none tracking-tighter ${isNearEnd ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {formatTime(timeLeft)}
              </div>

              <div className="w-full max-w-2xl space-y-4">
                <Progress value={progress} className="h-3 bg-slate-800" />
                <div className="flex justify-between text-xs font-mono text-slate-500 font-bold uppercase tracking-widest">
                  <span>Início</span>
                  <span>{currentItem.duration_minutes}m Total</span>
                  <span>Fim</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleBack}
                disabled={currentIndex === 0}
                className="w-14 h-14 rounded-full border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
              >
                <SkipBack size={24} />
              </Button>

              <Button 
                onClick={handleTogglePlay}
                className={`w-24 h-24 rounded-full shadow-2xl transition-all active:scale-95 ${
                  isActive 
                    ? 'bg-slate-100 text-slate-950 hover:bg-white shadow-white/5' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20'
                }`}
              >
                {isActive ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-1" />}
              </Button>

              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleNext}
                disabled={currentIndex === items.length - 1}
                className="w-14 h-14 rounded-full border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
              >
                <SkipForward size={24} />
              </Button>
            </div>

            <div className="flex justify-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRestart}
                className="text-slate-600 hover:text-slate-400 gap-2"
              >
                <RotateCcw size={14} /> Reiniciar Reunião
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar - Agenda List */}
        <aside className="w-96 bg-slate-900/30 border-l border-slate-800 p-8 flex flex-col gap-8 hidden lg:flex">
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Próximos Itens</h3>
            <div className="space-y-4">
              {items.map((item, idx) => {
                const isCurrent = idx === currentIndex;
                const isDone = idx < currentIndex;
                
                return (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setTimeLeft(item.duration_minutes * 60);
                      setIsActive(false);
                    }}
                    className={`flex items-start gap-4 p-4 rounded-2xl transition-all cursor-pointer border ${
                      isCurrent 
                        ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-600/20 scale-[1.02]' 
                        : isDone
                          ? 'bg-slate-900/50 border-slate-800 opacity-40'
                          : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCurrent ? 'bg-white text-indigo-600' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {isDone ? <CheckCircle2 size={16} /> : String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-bold truncate ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                        {item.title}
                      </h4>
                      <p className={`text-[10px] uppercase font-bold tracking-widest mt-1 ${isCurrent ? 'text-indigo-200' : 'text-slate-600'}`}>
                        {item.duration_minutes} min • {item.type === 'topic' ? 'Tópico' : 'Pausa'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-auto">
             <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                  <Users size={14} /> Participantes do Tópico
                </h4>
                {currentParticipants.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {currentParticipants.map(p => (
                      <div key={p.id} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-300">
                        {p.participant_name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 italic">Nenhum participante definido</p>
                )}
             </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
