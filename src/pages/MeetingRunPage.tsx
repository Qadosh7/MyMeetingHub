import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Settings2, Edit3, Save, X, GripVertical, Lock, Unlock,
  Plus, Minus, ChevronUp, ChevronDown
} from 'lucide-react';
import { format, addMinutes, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SidebarItemProps {
  item: AgendaItem;
  index: number;
  isCurrent: boolean;
  isLocked: boolean;
  onSelect: () => void;
  onUpdate: (updates: any) => void;
  globalParticipants: Participant[];
  key?: React.Key;
}

function SortableSidebarItem({ 
  item, 
  index, 
  isCurrent, 
  isLocked, 
  onSelect, 
  onUpdate,
  globalParticipants 
}: SidebarItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(item.title);
  const [localPresenter, setLocalPresenter] = useState((item as any).presenter_name || '');

  const handleAdjustTime = (amount: number) => {
    const newMinutes = Math.max(1, item.duration_minutes + amount);
    onUpdate({ duration_minutes: newMinutes });
  };

  const handleTitleBlur = () => {
    if (localTitle !== item.title) {
      onUpdate({ title: localTitle });
    }
    setIsEditing(false);
  };

  const handlePresenterBlur = () => {
    if (localPresenter !== (item as any).presenter_name) {
      onUpdate({ presenter_name: localPresenter });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group flex flex-col gap-3 p-4 rounded-2xl transition-all border ${
        isCurrent 
          ? 'bg-primary border-primary text-[#0b1021] shadow-lg shadow-primary/20' 
          : 'bg-white/5 border-transparent hover:bg-white/10 text-white'
      } ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        {!isLocked && (
          <div {...attributes} {...listeners} className="cursor-grab p-1 opacity-40 hover:opacity-100 transition-opacity">
            <GripVertical size={14} />
          </div>
        )}
        
        <div className="flex-1 min-w-0" onClick={onSelect}>
          <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isCurrent ? 'opacity-60' : 'text-slate-500'}`}>
            {index + 1}. {item.type === 'topic' ? 'Tópico' : 'Pausa'}
          </div>
          
          {isEditing && !isLocked ? (
            <input 
              autoFocus
              value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="w-full bg-transparent border-none text-sm font-bold p-0 outline-none focus:ring-0"
              onKeyDown={e => e.key === 'Enter' && handleTitleBlur()}
            />
          ) : (
            <div 
              className="text-sm font-bold truncate leading-tight cursor-text"
              onClick={(e) => {
                if (!isLocked) {
                  e.stopPropagation();
                  setIsEditing(true);
                }
              }}
            >
              {item.title}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="text-[10px] font-mono font-bold whitespace-nowrap opacity-80">
            {item.duration_minutes}m
          </div>
        </div>
      </div>

      {!isLocked && (
        <div className={`flex items-center justify-between gap-2 pt-2 border-t border-black/10 ${isCurrent ? 'border-black/10' : 'border-white/10'}`}>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => handleAdjustTime(-10)}
              className={`h-6 px-1.5 rounded-md flex items-center justify-center text-[10px] font-black transition-all active:scale-90 ${
                isCurrent ? 'bg-black/10 hover:bg-black/20' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              -10
            </button>
            <button 
              onClick={() => handleAdjustTime(10)}
              className={`h-6 px-1.5 rounded-md flex items-center justify-center text-[10px] font-black transition-all active:scale-90 ${
                isCurrent ? 'bg-black/10 hover:bg-black/20' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              +10
            </button>
          </div>

          {item.type === 'topic' && (
            <div className="flex-1 ml-2">
              <input 
                 value={localPresenter}
                 onChange={e => setLocalPresenter(e.target.value)}
                 onBlur={handlePresenterBlur}
                 placeholder="Quem?"
                 className={`w-full bg-transparent border-none text-[10px] font-bold p-0 outline-none focus:ring-0 placeholder:opacity-30 ${
                   isCurrent ? 'placeholder:text-black' : 'placeholder:text-white'
                 }`}
                 list={`presenters-sidebar-${item.id}`}
              />
              <datalist id={`presenters-sidebar-${item.id}`}>
                {globalParticipants.map(gp => <option key={gp.id} value={gp.name} />)}
              </datalist>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [isLocked, setIsLocked] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [warningTime, setWarningTime] = useState(2); // minutes
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Alert tracking to prevent repeat sounds
  const playState = useRef<{ warning: boolean; critical: boolean; exceeded: boolean }>({
    warning: false,
    critical: false,
    exceeded: false
  });

  // Sound Refs
  const sounds = useRef<{ warning: HTMLAudioElement; critical: HTMLAudioElement; exceeded: HTMLAudioElement } | null>(null);

  useEffect(() => {
    // Preload sounds
    sounds.current = {
      warning: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'),
      critical: new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'),
      exceeded: new Audio('https://assets.mixkit.co/active_storage/sfx/941/941-preview.mp3')
    };
  }, []);

  const playAlert = (type: 'warning' | 'critical' | 'exceeded') => {
    if (!soundEnabled || !sounds.current) return;
    const audio = sounds.current[type];
    audio.currentTime = 0;
    audio.play().catch(e => console.log('Audio play failed:', e));
  };

  // Inline editing states for main display
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
    if (isActive) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 1;
          
          // Logic for alerts
          const totalSeconds = (items[currentIndex] as any)?.duration_minutes * 60 || 0;
          const warnSecs = Math.min(warningTime * 60, totalSeconds * 0.1);
          
          // Warning (Yellow)
          if (next <= warnSecs && next > 0 && !playState.current.warning) {
            playAlert('warning');
            playState.current.warning = true;
          }
          
          // Critical (0:00 / Red)
          if (next === 0 && !playState.current.critical) {
            playAlert('critical');
            playState.current.critical = true;
          }

          // Exceeded (1 min over / Intensified)
          if (next === -60 && !playState.current.exceeded) {
            playAlert('exceeded');
            playState.current.exceeded = true;
          }

          if (autoAdvance && next <= -300) { // 5 mins auto-advance
            handleNext();
            return 0;
          }

          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, items, currentIndex, warningTime, autoAdvance]);

  // Reset alert states when item changes
  useEffect(() => {
    playState.current = { warning: false, critical: false, exceeded: false };
  }, [currentIndex]);

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
      playState.current = { warning: false, critical: false, exceeded: false };
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
      playState.current = { warning: false, critical: false, exceeded: false };
    }
  };

  const resetTimer = () => {
    const item = items[currentIndex];
    if (item) {
      setTimeLeft(item.duration_minutes * 60);
      setIsActive(false);
      playState.current = { warning: false, critical: false, exceeded: false };
    }
  };

  const startEditing = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = async () => {
    if (!editingField || !currentItem) return;
    
    const updates: any = {};
    if (editingField === 'title') updates.title = editValue;
    if (editingField === 'time') updates.duration_minutes = parseInt(editValue);
    if (editingField === 'presenter') {
      const p = globalParticipants.find(gp => gp.name === editValue);
      updates.presenter_id = p?.id || null;
      updates.presenter_name = editValue;
    }

    await updateItem(currentItem.id, currentItem.type, updates);
    setEditingField(null);
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
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const updateItem = async (itemId: string, type: 'topic' | 'break', updates: any) => {
    // 1. Update local state immediately for performance
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));

    // 2. If it's the current item and time changed, update timeLeft
    if (itemId === currentItem?.id && updates.duration_minutes !== undefined) {
      setTimeLeft(updates.duration_minutes * 60);
    }

    // 3. Debounce database save
    if (saveTimeoutRef.current[itemId]) {
      clearTimeout(saveTimeoutRef.current[itemId]);
    }

    saveTimeoutRef.current[itemId] = setTimeout(async () => {
      try {
        const table = type === 'topic' ? 'topics' : 'breaks';
        const { error } = await supabase.from(table).update(updates).eq('id', itemId);
        if (error) throw error;
      } catch (error) {
        console.error('Error saving update:', error);
        toast.error('Erro ao salvar alterações no banco');
      }
    }, 1000);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (isLocked) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      
      const newArray = arrayMove(items, oldIndex, newIndex);
      
      // Update local state
      setItems(newArray);
      
      // Keep trackers consistent: find where the "current item" moved to
      const currentItemId = (items[currentIndex] as any).id;
      const newCurrentIndex = newArray.findIndex((i: any) => i.id === currentItemId);
      setCurrentIndex(newCurrentIndex);

      // Save to database
      try {
        const updates = newArray.map((item: any, index: number) => {
          const dbTable = item.type === 'topic' ? 'topics' : 'breaks';
          return supabase.from(dbTable).update({ order_index: index }).eq('id', item.id);
        });
        await Promise.all(updates);
      } catch (error) {
        toast.error('Erro ao salvar nova ordem');
      }
    }
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
    
    // Timer Stages
    const totalSeconds = (currentItem?.duration_minutes || 0) * 60;
    const warnSecs = Math.min(warningTime * 60, totalSeconds * 0.1);
    const isWarning = timeLeft <= warnSecs && timeLeft > 0;
    const isExpired = timeLeft <= 0;
    const isExceeded = timeLeft <= -60;

    const timerColorClass = isExceeded 
      ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
      : isExpired 
        ? 'text-red-500' 
        : isWarning 
          ? 'text-amber-400' 
          : 'text-white';
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
           <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSettings(!showSettings)} 
            className={`transition-colors ${showSettings ? 'text-primary' : 'text-slate-500 hover:text-white'}`}
           >
             <Settings2 size={20} />
           </Button>
           <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-slate-500 hover:text-white hover:bg-white/10">
             {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
           </Button>
        </div>

        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-24 right-8 w-64 bg-[#1a1f33] border border-white/10 rounded-2xl p-6 shadow-2xl z-50 space-y-6"
            >
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Configurações do Timer</h4>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Alertas Sonoros</span>
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${soundEnabled ? 'bg-primary' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${soundEnabled ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Auto Avançar</span>
                  <button 
                    onClick={() => setAutoAdvance(!autoAdvance)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${autoAdvance ? 'bg-primary' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${autoAdvance ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Tempo de Aviso</span>
                    <span className="text-xs text-primary font-bold">{warningTime}m</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    step="1"
                    value={warningTime}
                    onChange={(e) => setWarningTime(parseInt(e.target.value))}
                    className="w-full accent-primary bg-slate-700 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-80 bg-black/40 border-r border-white/10 p-6 overflow-y-auto hidden lg:flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Fluxo da Reunião</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsLocked(!isLocked)}
              className={`h-8 w-8 rounded-full ${isLocked ? 'text-primary' : 'text-slate-500'}`}
              title={isLocked ? "Desbloquear Edição" : "Bloquear Edição"}
            >
              {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
            </Button>
          </div>

          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={items.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <SortableSidebarItem 
                    key={item.id}
                    item={item}
                    index={idx}
                    isCurrent={idx === currentIndex}
                    isLocked={isLocked}
                    globalParticipants={globalParticipants}
                    onSelect={() => {
                      setCurrentIndex(idx);
                      setTimeLeft(item.duration_minutes * 60);
                      setIsActive(false);
                    }}
                    onUpdate={(updates) => updateItem(item.id, item.type, updates)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
                  <motion.div 
                    animate={isWarning ? { scale: [1, 1.02, 1] } : isExceeded ? { x: [-2, 2, -2] } : {}}
                    transition={isWarning ? { repeat: Infinity, duration: 1.5 } : isExceeded ? { repeat: Infinity, duration: 0.1 } : {}}
                    className={`text-[12rem] lg:text-[16rem] font-mono leading-none tracking-tighter tabular-nums cursor-pointer transition-all duration-500 ${timerColorClass} ${!isActive && !isExpired ? 'opacity-40' : ''}`}
                    onClick={() => startEditing('time', Math.ceil(Math.abs(timeLeft) / 60).toString())}
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
                  </motion.div>
                  
                  <div className="w-full max-w-2xl mt-4">
                    <Progress 
                      value={((totalSeconds - timeLeft) / totalSeconds) * 100} 
                      className={`h-1.5 transition-all ${isExpired ? 'bg-red-500/20' : 'bg-white/5'}`} 
                    />
                    <div className="flex justify-between mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span>Início</span>
                      <span className={isExpired ? 'text-red-500' : 'text-primary'}>
                        {isExpired ? 'Tempo Excedido' : `${Math.floor(timeLeft / 60)}m restantes`}
                      </span>
                      <span>Final</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls Bar */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 bg-[#1a1f33]/80 border border-white/10 rounded-[2.5rem] backdrop-blur-xl shadow-2xl">
            <Button 
               variant="ghost" 
               size="icon" 
               onClick={resetTimer}
               className="h-14 w-14 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
               title="Resetar tempo"
             >
               <RotateCcw size={20} />
            </Button>

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
              className={`h-20 w-20 rounded-full shadow-lg transition-all active:scale-95 ${
                isActive ? 'bg-amber-500 text-black hover:bg-amber-600' : 'bg-primary text-black hover:bg-primary/90'
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

