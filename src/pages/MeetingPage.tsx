import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/hooks/useAuth';
import { Meeting, Topic, Break, AgendaItem, TopicParticipant } from '@/src/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Trash2, GripVertical, Clock, 
  Users, User, Coffee, Save, ChevronDown, ChevronUp, 
  Utensils, Mic, Presentation, MessageCircle, Play,
  Settings2, LayoutList, Share2, MoreHorizontal, Loader2, Sparkles
} from 'lucide-react';

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

interface SortableAgendaItemProps {
  key?: React.Key;
  id: string;
  item: AgendaItem;
  participants: TopicParticipant[];
  onDelete: (id: string, type: 'topic' | 'break') => void | Promise<void>;
  onUpdate: (id: string, type: 'topic' | 'break', updates: any) => void | Promise<void>;
  onAddParticipant: (topicId: string, name: string) => void | Promise<void>;
  onRemoveParticipant: (id: string) => void | Promise<void>;
}

function SortableAgendaItem({ 
  id, item, participants, onDelete, onUpdate, 
  onAddParticipant, onRemoveParticipant 
}: SortableAgendaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ ...item });
  const [newParticipant, setNewParticipant] = useState('');

  const isTopic = item.type === 'topic';
  const itemParticipants = isTopic ? participants.filter(p => p.topic_id === item.id) : [];

  const handleSave = () => {
    onUpdate(item.id, item.type, {
      title: editData.title,
      duration_minutes: Math.max(1, Number(editData.duration_minutes)),
      ...(isTopic ? { presenter: (editData as Topic).presenter } : {})
    });
    setIsEditing(false);
  };

  const adjustTime = (amount: number) => {
    const newTime = Math.max(1, item.duration_minutes + amount);
    onUpdate(item.id, item.type, { duration_minutes: newTime });
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={isDragging ? 'z-50 ring-2 ring-primary/50' : ''}
    >
      <div 
        className={`group relative flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-card border transition-all hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/[0.02] ${
          !isTopic ? 'bg-muted/30 border-dashed' : 'border-border'
        }`}
      >
        {/* Left Section: Drag & Icon */}
        <div className="flex items-center gap-4">
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-grab p-1.5 rounded-lg text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted transition-colors transition-transform active:scale-95"
          >
            <GripVertical size={18} />
          </div>

          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
            isTopic 
              ? 'bg-primary/10 text-primary border-primary/20' 
              : 'bg-muted text-muted-foreground border-border'
          }`}>
            {isTopic ? (
               <Mic size={20} />
            ) : (
               <Coffee size={20} />
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-4 py-1">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input 
                  value={editData.title} 
                  onChange={(e) => setEditData({...editData, title: e.target.value})}
                  className="h-10 rounded-xl bg-muted/30 focus:bg-background border-border/50"
                  placeholder="Título do item"
                  autoFocus
                />
                {isTopic && (
                  <Input 
                    value={(editData as Topic).presenter || ''} 
                    onChange={(e) => setEditData({...editData, presenter: e.target.value})}
                    className="h-10 rounded-xl bg-muted/30 focus:bg-background border-border/50"
                    placeholder="Responsável"
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                 <div className="flex items-center gap-3">
                   <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Minutos</Label>
                   <Input 
                    type="number"
                    value={editData.duration_minutes} 
                    onChange={(e) => setEditData({...editData, duration_minutes: Number(e.target.value)})}
                    className="h-10 w-24 rounded-xl bg-muted/30 focus:bg-background border-border/50"
                  />
                 </div>
                 <div className="flex gap-2">
                   <Button variant="ghost" size="sm" className="rounded-xl h-10 px-4" onClick={() => setIsEditing(false)}>Cancelar</Button>
                   <Button size="sm" className="rounded-xl h-10 px-6 font-bold" onClick={handleSave}>Salvar</Button>
                 </div>
              </div>
            </div>
          ) : (
            <div 
              className="cursor-pointer group/title flex flex-col h-full justify-center"
              onClick={() => { setIsEditing(true); setEditData({ ...item }); }}
            >
              <div className="flex items-baseline gap-2">
                <h4 className={`font-bold text-lg tracking-tight transition-colors truncate ${
                  isTopic ? 'text-foreground' : 'text-muted-foreground font-medium'
                }`}>
                  {item.title}
                </h4>
                {!isTopic && <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 py-0.5 rounded-full border border-border/50">Intervalo</span>}
              </div>
              
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-2">
                {isTopic && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <User size={14} className="text-primary/60" />
                    {(item as Topic).presenter || <span className="text-muted-foreground/40 italic">A definir</span>}
                  </div>
                )}
                
                {isTopic && itemParticipants.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Users size={14} className="text-muted-foreground/60 mr-1" />
                    <div className="flex -space-x-2">
                      {itemParticipants.slice(0, 3).map(p => (
                        <div key={p.id} className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[8px] font-bold ring-1 ring-border/30">
                          {p.participant_name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {itemParticipants.length > 3 && (
                        <div className="h-6 w-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[8px] font-bold text-primary ring-1 ring-border/30">
                          +{itemParticipants.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Time & Actions */}
        <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-4 sm:border-l sm:pl-8 sm:min-w-[120px]">
          <div className="flex items-center gap-1 order-2 sm:order-1">
            <button 
              onClick={(e) => { e.stopPropagation(); adjustTime(-5); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-all active:scale-90"
              title="-5 min"
            >
              <ChevronDown size={18} />
            </button>
            <div className="flex flex-col items-center px-3 min-w-[60px]">
              <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/30 leading-none mb-1">Dur</span>
              <span className="text-base font-mono font-bold tabular-nums">{item.duration_minutes}m</span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); adjustTime(5); }}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-all active:scale-90"
              title="+5 min"
            >
              <ChevronUp size={18} />
            </button>
          </div>
          
          <div className="flex items-center gap-1 order-1 sm:order-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
              onClick={() => onDelete(item.id, item.type)}
            >
              <Trash2 size={16} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted transition-all"
              onClick={() => setIsEditing(true)}
            >
              <Settings2 size={16} />
            </Button>
          </div>
        </div>

        {/* Inline Add Participant (Bottom Overlay for topics) */}
        {isTopic && !isEditing && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-card/80 backdrop-blur-sm border border-border/50 rounded-full h-8 px-3 flex items-center gap-2 shadow-xl ring-1 ring-black/5 dark:ring-white/5">
             <Users size={12} className="text-primary/60" />
             <input 
              placeholder="Adicionar pessoa..." 
              className="bg-transparent border-none outline-none text-[10px] w-24 placeholder:text-muted-foreground/40 font-medium"
              value={newParticipant}
              onChange={(e) => setNewParticipant(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newParticipant.trim()) {
                  onAddParticipant(id, newParticipant);
                  setNewParticipant('');
                }
              }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [participants, setParticipants] = useState<TopicParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (id) {
      fetchMeetingData();
    }
  }, [id]);

  const fetchMeetingData = async () => {
    try {
      setLoading(true);
      const { data: meetingData, error: mError } = await supabase.from('meetings').select('*').eq('id', id).single();
      if (mError) throw mError;
      setMeeting(meetingData);
      setTitleInput(meetingData.title);

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
    } catch (error: any) {
      toast.error('Erro ao carregar reunião.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalTime = () => items.reduce((acc, item) => acc + item.duration_minutes, 0);

  const updateMeetingTitle = async () => {
    if (!titleInput.trim() || titleInput === meeting?.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ 
          title: titleInput,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
      setMeeting({ ...meeting!, title: titleInput });
      setIsEditingTitle(false);
      toast.success('Título atualizado');
    } catch (error: any) {
      toast.error('Erro ao atualizar título');
    }
  };

  const addItem = async (type: 'topic' | 'break', customTitle?: string, customDuration?: number) => {
    const nextIndex = items.length;
    const body = {
      meeting_id: id,
      title: customTitle || (type === 'topic' ? 'Novo Tópico' : 'Intervalo'),
      duration_minutes: customDuration || (type === 'topic' ? 15 : 10),
      order_index: nextIndex
    };

    try {
      const dbTable = type === 'topic' ? 'topics' : 'breaks';
      const { data, error } = await supabase.from(dbTable).insert([body]).select();
      if (error) throw error;
      
      const newItem = { ...data[0], type } as AgendaItem;
      setItems(prev => [...prev, newItem]);
    } catch (error: any) {
      toast.error('Erro ao adicionar item');
    }
  };

  const deleteItem = async (itemId: string, type: 'topic' | 'break') => {
    try {
      const dbTable = type === 'topic' ? 'topics' : 'breaks';
      await supabase.from(dbTable).delete().eq('id', itemId);
      setItems(items.filter(item => item.id !== itemId));
      toast.success('Item removido');
    } catch (error) {
      toast.error('Erro ao remover item');
    }
  };

  const updateItem = async (itemId: string, type: 'topic' | 'break', updates: any) => {
    try {
      const dbTable = type === 'topic' ? 'topics' : 'breaks';
      await supabase.from(dbTable).update(updates).eq('id', itemId);
      setItems(items.map(item => item.id === itemId ? { ...item, ...updates } : item));
    } catch (error) {
      toast.error('Erro ao atualizar item');
    }
  };

  const addParticipant = async (topicId: string, name: string) => {
    try {
      const { data, error } = await supabase.from('topic_participants').insert([{ topic_id: topicId, participant_name: name }]).select();
      if (error) throw error;
      setParticipants(prev => [...prev, data[0]]);
    } catch (error) {
      toast.error('Erro ao adicionar participante');
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      await supabase.from('topic_participants').delete().eq('id', participantId);
      setParticipants(participants.filter(p => p.id !== participantId));
    } catch (error) {
      toast.error('Erro ao remover participante');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      const newArray = arrayMove(items, oldIndex, newIndex);
      setItems(newArray);
      try {
        const updates = newArray.map((item: AgendaItem, index: number) => {
          const dbTable = item.type === 'topic' ? 'topics' : 'breaks';
          return supabase.from(dbTable).update({ order_index: index }).eq('id', item.id);
        });
        await Promise.all(updates);
      } catch (error) {
        toast.error('Erro ao salvar nova ordem');
      }
    }
  };

  if (loading && !meeting) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalMin = calculateTotalTime();

  return (
    <div className="space-y-10 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4 max-w-2xl flex-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-[0.2em]">
            <LayoutList size={14} />
            <span>Agenda Planner</span>
          </div>
          
          <AnimatePresence mode="wait">
            {isEditingTitle ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Input 
                  value={titleInput} 
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={updateMeetingTitle}
                  onKeyDown={(e) => e.key === 'Enter' && updateMeetingTitle()}
                  autoFocus
                  className="h-12 text-3xl font-bold tracking-tight bg-muted/40 border-primary/20 rounded-xl focus:bg-background transition-all px-0 border-none shadow-none focus-visible:ring-0"
                />
              </motion.div>
            ) : (
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-4xl font-bold tracking-tight cursor-text hover:text-primary transition-colors leading-tight truncate"
                onClick={() => setIsEditingTitle(true)}
              >
                {meeting?.title}
              </motion.h1>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap items-center gap-6">
             <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/50">
               <Clock size={14} className="text-primary" />
               <span className="font-bold tabular-nums text-foreground">{totalMin}m</span>
               <span className="opacity-50">• Duração Total</span>
             </div>
             <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/50">
               <Users size={14} className="text-primary" />
               <span className="font-bold text-foreground">{participants.length}</span>
               <span className="opacity-50">• Carregando...</span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl h-11 px-5 border-border transition-all hover:bg-muted font-bold group">
            <Share2 size={18} className="mr-2 group-hover:text-primary transition-colors" />
            Compartilhar
          </Button>
          <Button 
            className="rounded-xl h-11 px-8 font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary hover:bg-primary/90"
            onClick={() => navigate(`/meeting/${id}/run`)}
          >
            <Play size={18} className="mr-2 fill-current" />
            Iniciar Sessão
          </Button>
        </div>
      </div>

      {/* Main Grid: Content + Actions Bar */}
      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
             <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground/60 flex items-center gap-2">
               <LayoutList size={14} /> 
               Itens da Agenda
             </h2>
             <div className="flex items-center gap-1">
               <span className="text-[10px] font-bold text-muted-foreground/40 mr-2 uppercase tracking-widest hidden sm:inline">Adição Rápida</span>
               <div className="flex p-1 bg-muted/50 rounded-xl border border-border/50">
                 <Button onClick={() => addItem('topic')} variant="ghost" size="sm" className="rounded-lg h-8 text-xs font-bold gap-1.5">
                   <Plus size={14} /> Tópico
                 </Button>
                 <Button onClick={() => addItem('break')} variant="ghost" size="sm" className="rounded-lg h-8 text-xs font-bold gap-1.5">
                   <Plus size={14} /> Intervalo
                 </Button>
               </div>
             </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {items.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-20 bg-muted/20 border-2 border-dashed border-border/50 rounded-[2rem] flex flex-col items-center justify-center space-y-4"
                  >
                    <div className="p-4 rounded-2xl bg-card border shadow-sm">
                      <LayoutList className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold opacity-40">Agenda Vazia</p>
                      <p className="text-xs text-muted-foreground/40 mt-1">Comece adicionando tópicos ou intervalos acima.</p>
                    </div>
                  </motion.div>
                ) : (
                  items.map((item: AgendaItem) => (
                    <SortableAgendaItem
                      key={item.id}
                      id={item.id}
                      item={item}
                      participants={participants}
                      onDelete={deleteItem}
                      onUpdate={updateItem}
                      onAddParticipant={addParticipant}
                      onRemoveParticipant={removeParticipant}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Floating Sidebar Tips (Desktop Only) */}
        <div className="lg:w-80 space-y-6">
          <div className="sticky top-10 space-y-6">
            {/* Quick Actions Card */}
            <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm shadow-black/[0.02]">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/40 mb-6">Sugestões de Bloco</h3>
              <div className="grid grid-cols-1 gap-3">
                <Button 
                  variant="outline" 
                  className="justify-start h-12 rounded-2xl bg-muted/20 border-transparent hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-all group"
                  onClick={() => addItem('topic', 'Apresentação de Resultados', 15)}
                >
                  <Presentation size={16} className="mr-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                  <span className="text-xs font-bold font-sans">Apresentação</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start h-12 rounded-2xl bg-muted/20 border-transparent hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-all group"
                  onClick={() => addItem('topic', 'Brainstorming & Novas Ideias', 25)}
                >
                  <MessageCircle size={16} className="mr-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                  <span className="text-xs font-bold font-sans">Discussão</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start h-12 rounded-2xl bg-muted/20 border-transparent hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-all group"
                  onClick={() => addItem('break', 'Pausa para Café', 10)}
                >
                  <Coffee size={16} className="mr-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                  <span className="text-xs font-bold font-sans">Pausa Rápida</span>
                </Button>
              </div>
            </div>

            {/* Smart Tip Card */}
            <div className="relative group overflow-hidden bg-primary/5 border border-primary/10 rounded-3xl p-6 hover:bg-primary/10 transition-colors">
              <div className="absolute -right-4 -top-4 text-primary/5 group-hover:scale-125 group-hover:rotate-12 transition-transform">
                <Sparkles size={120} />
              </div>
              <div className="relative z-10 flex flex-col gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                  <Sparkles size={18} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-primary">Dica de Especialista</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {items.length > 5 
                      ? "Uma pauta com muitos itens pode ser exaustiva. Considere focar nos 3 tópicos mais críticos." 
                      : items.length === 0 
                        ? "Uma agenda bem estruturada economiza até 30% do tempo total da reunião."
                        : "Lembre-se de definir um responsável (apresentador) para cada tópico importante."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

